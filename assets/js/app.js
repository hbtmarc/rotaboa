// ===================================================
// app.js — Inicialização e renderização das páginas
// Cada página é uma função que retorna HTML como string
// e é passada para o Router.
// ===================================================

// Chaves de dados locais do app (mantidas em localStorage)
var RB_LOCAL_KEYS = {
  trips: 'rotaboa.trips.v1',
  selectedTrip: 'rotaboa.selectedTripId.v1',
  itineraries: 'rotaboa.itineraries.v1',
  expenses: 'rotaboa.expenses.v1',
  routes: 'rotaboa.routes.v1',
  googleMapsApiKey: 'rotaboa.googleMapsApiKey.v1',
};
var RB_OFFLINE_KEY = 'rotaboa.offlineMode.v1';
var RB_SYNC_STATUS_KEY = 'rotaboa.sync.status.v1';
var RB_PREFS_KEY = 'rotaboa.preferences.v1';
var RB_APP_VERSION = 'mvp-0.2.0';

// ---- Debug de autenticação (desativar em produção real) ----
var RB_DEBUG_AUTH = true;
function _dbgAuth() {
  if (!RB_DEBUG_AUTH) return;
  var args = Array.prototype.slice.call(arguments);
  console.log.apply(console, ['[AuthGate]'].concat(args));
}

// ---- Estado de diagnóstico (atualizado pelo AuthGate) ----
var RB_DIAG_STATE = {
  rtdbStatus: 'pending',       // 'pending' | 'loaded' | 'cached' | 'offline' | 'error'
  rtdbStatusMsg: '',
  lastLoadAt: null,
  ambiente: (function () {
    var h = window.location.hostname || '';
    if (h === 'localhost' || h === '127.0.0.1' || h === '') return 'localhost';
    if (h.indexOf('github.io') !== -1) return 'GitHub Pages';
    return h;
  }()),
};

var RB_PREFS_DEFAULT = {
  nomeUsuario: '',
  paginaInicialPadrao: '/inicio',
  mostrarValoresInicio: true,
  confirmarAntesExcluir: true,
  densidadeVisual: 'confortavel',
  checkInPadrao: '14:00',
  checkOutPadrao: '12:00',
  routeTipoPadrao: 'carro',
  consumoPadrao: '',
  precoCombustivelPadrao: '',
  syncAuto: true,
  syncIntervalo: 1,
  templatesEditaveis: [],
};

var RB_AUTH_STATE = {
  user: null,
  initialized: false,
  unsubscribe: null,
  offlineMode: localStorage.getItem(RB_OFFLINE_KEY) === 'true',
};

function _lerSyncStatus() {
  try {
    var raw = localStorage.getItem(RB_SYNC_STATUS_KEY);
    if (!raw) return { pending: false, syncing: false, lastSyncAt: null, lastError: '' };
    return JSON.parse(raw);
  } catch (e) {
    return { pending: false, syncing: false, lastSyncAt: null, lastError: '' };
  }
}

function _salvarSyncStatus(status) {
  try {
    localStorage.setItem(RB_SYNC_STATUS_KEY, JSON.stringify(status));
  } catch (e) {}
}

// Chave para isolar uid ativo e evitar mistura entre usuários
var RB_CURRENT_UID_KEY = 'rotaboa.currentUid.v1';

var SyncService = (function () {
  var _status     = _lerSyncStatus();
  var _timer      = null;
  var _isSyncing  = false;
  var _dirtyTimer = null;
  var _lastToastAt = { ok: 0, pending: 0, offline: 0 };
  var _connectedUnsubscribe = null;

  // ---- Chaves isoladas por UID ----
  function _cacheKey(uid)   { return 'rotaboa.cache.'   + uid + '.v1'; }
  function _uidSyncKey(uid) { return 'rotaboa.sync.'    + uid + '.v1'; }

  function _toastCooldown(tipo, ms) {
    var now = Date.now();
    if ((now - (_lastToastAt[tipo] || 0)) < ms) return false;
    _lastToastAt[tipo] = now;
    return true;
  }

  // ---- Segurança entre usuários: limpa LS de trabalho de outro uid ----
  function _garantirIsolamentoUid(novoUid) {
    if (!novoUid) return;
    var anterior = localStorage.getItem(RB_CURRENT_UID_KEY) || '';
    if (anterior && anterior !== novoUid) {
      // Usuário diferente: limpa chaves de trabalho globais (não o cache isolado)
      Object.keys(RB_LOCAL_KEYS).forEach(function (k) {
        localStorage.removeItem(RB_LOCAL_KEYS[k]);
      });
      localStorage.removeItem(RB_SYNC_STATUS_KEY);
    }
    localStorage.setItem(RB_CURRENT_UID_KEY, novoUid);
  }

  // ---- Cache por UID (snapshot pós-RTDB) ----
  function _salvarCacheUid(uid, payload) {
    if (!uid || !payload) return;
    try { localStorage.setItem(_cacheKey(uid), JSON.stringify(payload)); } catch (e) {}
  }

  function carregarCacheUid(uid) {
    if (!uid) return null;
    try {
      var raw = localStorage.getItem(_cacheKey(uid));
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  // ---- Payload completo do estado atual ----
  function _payloadAtual() {
    if (window.Store && typeof Store.exportarEstadoCompleto === 'function') {
      return Object.assign(Store.exportarEstadoCompleto(), {
        preferences: _lerPreferencias(),
        appVersion:  RB_APP_VERSION,
        updatedAt:   new Date().toISOString(),
      });
    }
    // fallback: lê diretamente do localStorage
    function _ler(k) {
      try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; }
    }
    return {
      trips:          _ler(RB_LOCAL_KEYS.trips)      || [],
      selectedTripId: localStorage.getItem(RB_LOCAL_KEYS.selectedTrip) || null,
      itineraries:    _ler(RB_LOCAL_KEYS.itineraries) || {},
      expenses:       _ler(RB_LOCAL_KEYS.expenses)    || {},
      routes:         _ler(RB_LOCAL_KEYS.routes)      || {},
      preferences:    _lerPreferencias(),
      updatedAt:      new Date().toISOString(),
      appVersion:     RB_APP_VERSION,
    };
  }

  // ---- PULL: RTDB → Store + cache local (RTDB é fonte primária) ----
  async function pullFromRtdb(uid) {
    if (!uid) return { ok: false, reason: 'no-uid' };
    if (!navigator.onLine) return { ok: false, reason: 'offline' };
    if (!window.FirebaseClient || typeof FirebaseClient.loadAppStateRtdb !== 'function') {
      return { ok: false, reason: 'no-client' };
    }
    try {
      var rtdbData = await FirebaseClient.loadAppStateRtdb(uid);
      if (rtdbData && typeof rtdbData === 'object') {
        _salvarCacheUid(uid, rtdbData);
        if (window.Store && typeof Store.carregarEstadoCompleto === 'function') {
          Store.carregarEstadoCompleto(rtdbData);
        }
        _status.lastSyncAt = new Date().toISOString();
        _status.lastError  = '';
        _salvarSyncStatus(_status);
        return { ok: true, hasData: true };
      }
      return { ok: true, hasData: false };
    } catch (e) {
      var msg = String((e && (e.message || e)) || 'Falha ao carregar do RTDB');
      _status.lastError = msg;
      _salvarSyncStatus(_status);
      return { ok: false, reason: 'error', error: msg };
    }
  }

  // ---- PUSH: Store → RTDB + atualiza cache local ----
  async function pushToRtdb(uid, opts) {
    var options = opts || {};
    if (!uid) return { ok: false, reason: 'no-uid' };
    if (RB_AUTH_STATE.offlineMode) {
      _status.pending = true;
      _salvarSyncStatus(_status);
      return { ok: false, reason: 'offline-mode' };
    }
    if (!navigator.onLine) {
      _status.pending    = true;
      _status.lastError  = '';
      _salvarSyncStatus(_status);
      return { ok: false, reason: 'sem-internet' };
    }
    if (_isSyncing) return { ok: false, reason: 'syncing' };
    if (!window.FirebaseClient || typeof FirebaseClient.saveAppStateRtdb !== 'function') {
      _status.pending   = true;
      _status.lastError = 'Cliente Firebase indisponível.';
      _salvarSyncStatus(_status);
      return { ok: false, reason: 'no-client' };
    }

    _isSyncing        = true;
    _status.syncing   = true;
    _status.lastError = '';
    _salvarSyncStatus(_status);

    try {
      var payload = _payloadAtual();
      await FirebaseClient.saveAppStateRtdb(uid, payload);
      _salvarCacheUid(uid, payload);
      _status.pending    = false;
      _status.syncing    = false;
      _status.lastSyncAt = new Date().toISOString();
      _status.lastError  = '';
      _salvarSyncStatus(_status);
      if (!options.silent && _toastCooldown('ok', 2500)) {
        _mostrarToast('Sincronizado');
      }
      return { ok: true };
    } catch (e) {
      _status.pending   = true;
      _status.syncing   = false;
      _status.lastError = String((e && (e.friendly || e.message)) || 'Falha ao salvar no RTDB.');
      _salvarSyncStatus(_status);
      if (!options.silent && _toastCooldown('pending', 5000)) {
        _mostrarToast('Sincronização pendente');
      }
      return { ok: false, reason: 'error' };
    } finally {
      _isSyncing = false;
    }
  }

  // ---- markPendingSync: chamado pelo Store após cada mutação ----
  function markPendingSync() {
    _status.pending = true;
    _salvarSyncStatus(_status);
    // Debounce: agrupa mutações rápidas em um único push
    if (_dirtyTimer) clearTimeout(_dirtyTimer);
    _dirtyTimer = setTimeout(function () {
      var uid = RB_AUTH_STATE.user && RB_AUTH_STATE.user.uid;
      if (uid && navigator.onLine && !RB_AUTH_STATE.offlineMode) {
        pushToRtdb(uid, { silent: true, source: 'debounced' });
      }
    }, 1500);
  }

  // ---- syncLocalToCloud: wrapper compatível com código legado ----
  async function syncLocalToCloud(opcoes) {
    var uid = RB_AUTH_STATE.user && RB_AUTH_STATE.user.uid;
    if (RB_AUTH_STATE.offlineMode || !uid) return { ok: false, reason: 'no-session' };
    return pushToRtdb(uid, opcoes);
  }

  function getSyncStatus() { return Object.assign({}, _status); }

  function stopAutoSync() {
    if (_timer)      { clearInterval(_timer);      _timer      = null; }
    if (_dirtyTimer) { clearTimeout(_dirtyTimer);  _dirtyTimer = null; }
    if (_connectedUnsubscribe) {
      try { _connectedUnsubscribe(); } catch (e) {}
      _connectedUnsubscribe = null;
    }
  }

  function startAutoSync() {
    stopAutoSync();
    var uid = RB_AUTH_STATE.user && RB_AUTH_STATE.user.uid;
    if (!uid && !RB_AUTH_STATE.offlineMode) return;
    // Flush pending push se online
    if (uid && _status.pending && navigator.onLine) {
      pushToRtdb(uid, { silent: true, source: 'start' });
    }
    // Listener .info/connected para reagir a reconexões
    if (uid && window.FirebaseClient && typeof FirebaseClient.onConnectedChange === 'function') {
      FirebaseClient.onConnectedChange(function (isConnected) {
        if (isConnected && _status.pending) {
          pushToRtdb(uid, { silent: true, source: 'reconnect' });
        }
      }).then(function (unsub) {
        _connectedUnsubscribe = unsub;
      }).catch(function () {});
    }
  }

  return {
    pullFromRtdb:     pullFromRtdb,
    pushToRtdb:       pushToRtdb,
    carregarCacheUid: carregarCacheUid,
    garantirIsolamentoUid: _garantirIsolamentoUid,
    markPendingSync:  markPendingSync,
    syncLocalToCloud: syncLocalToCloud,
    getSyncStatus:    getSyncStatus,
    startAutoSync:    startAutoSync,
    stopAutoSync:     stopAutoSync,
  };
})();

function _temAcessoPrivado() {
  return !!RB_AUTH_STATE.offlineMode || !!RB_AUTH_STATE.user;
}

function _ehRotaPublica(caminho) {
  return caminho === '/login';
}

function _guardAcessoRotas(caminho) {
  // Enquanto o AuthGate ainda não resolveu, não redireciona nada —
  // o overlay de boot cobre a tela, evitando flash de conteúdo protegido.
  if (!RB_AUTH_STATE.initialized) {
    _dbgAuth('guard: aguardando init |', caminho);
    return null;
  }
  if (_ehRotaPublica(caminho)) {
    if (_temAcessoPrivado()) {
      _dbgAuth('guard: autenticado + /login → #/inicio');
      return '#/inicio';
    }
    return null;
  }
  if (_temAcessoPrivado()) {
    _dbgAuth('guard: acesso ok |', caminho);
    return null;
  }
  _dbgAuth('guard: sem sessão, bloqueando |', caminho, '→ /login');
  return '#/login';
}

// ================================================================
// _DTWidget — Widget de data/hora cross-platform (sem input nativo)
// ================================================================
var _DTWidget = (function () {
  var _MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  function _pad(n) { return n < 10 ? '0' + n : String(n); }
  function _parseISO(iso) {
    if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
    var p = iso.split('-');
    return { y: p[0], m: p[1], d: p[2] };
  }

  function renderData(id, valorISO) {
    var parsed = _parseISO(valorISO);
    var curD = parsed ? parsed.d : '';
    var curM = parsed ? parsed.m : '';
    var curY = parsed ? parsed.y : '';
    var anoAtual = new Date().getFullYear();
    var dayOpts = '<option value="">Dia</option>';
    for (var d = 1; d <= 31; d++) { var dv = _pad(d); dayOpts += '<option value="' + dv + '"' + (dv === curD ? ' selected' : '') + '>' + d + '</option>'; }
    var mesOpts = '<option value="">Mês</option>';
    _MESES.forEach(function (m, i) { var mv = _pad(i + 1); mesOpts += '<option value="' + mv + '"' + (mv === curM ? ' selected' : '') + '>' + m + '</option>'; });
    var anoOpts = '<option value="">Ano</option>';
    for (var y = anoAtual - 1; y <= anoAtual + 5; y++) { var yv = String(y); anoOpts += '<option value="' + yv + '"' + (yv === curY ? ' selected' : '') + '>' + y + '</option>'; }
    return '<div class="dt-date-widget">' +
      '<select id="' + id + '-d" class="form-select dt-sel dt-sel-dia">' + dayOpts + '</select>' +
      '<select id="' + id + '-m" class="form-select dt-sel dt-sel-mes">' + mesOpts + '</select>' +
      '<select id="' + id + '-y" class="form-select dt-sel dt-sel-ano">' + anoOpts + '</select>' +
    '</div>';
  }

  function lerData(id) {
    var d = document.getElementById(id + '-d');
    var m = document.getElementById(id + '-m');
    var y = document.getElementById(id + '-y');
    if (!d || !m || !y || !d.value || !m.value || !y.value) return '';
    return y.value + '-' + m.value + '-' + d.value;
  }

  function renderHora(id, valor, onApplyExpr) {
    return SmartTimePicker.render(id, valor || '', onApplyExpr || '');
  }

  function lerHora(id) {
    return SmartTimePicker.lerHora(id);
  }

  function renderDuracao(id, valorMin) {
    var txt = (valorMin > 0) ? _durMinParaTexto(valorMin) : '';
    var chips = ['30min', '1h', '2h', '3h', '4h', '5h', '6h', '8h'];
    return (
      '<div class="duration-field">' +
        '<input type="text" id="' + id + '" class="form-input" placeholder="Ex: 2h, 1h30, 90min, 4:27" value="' + txt + '" autocomplete="off" onblur="_durNormalizarBlur(this)">' +
        '<div class="dur-chips">' +
          chips.map(function (c) {
            return '<button type="button" class="dur-chip" onclick="_durChipClick(\'' + id + '\',\'' + c + '\')">' + c + '</button>';
          }).join('') +
        '</div>' +
      '</div>'
    );
  }

  function lerDuracao(id) {
    var el = document.getElementById(id);
    return el ? (_parseDuracaoMin(el.value) || 0) : 0;
  }

  return { renderData: renderData, lerData: lerData, renderHora: renderHora, lerHora: lerHora, renderDuracao: renderDuracao, lerDuracao: lerDuracao };
})();

// ---- Helpers globais de duração ----
function _parseDuracaoMin(txt) {
  if (!txt) return 0;
  var s = String(txt).trim().toLowerCase();
  var hm = s.match(/^(\d+)\s*h\s*(\d+)\s*(?:min|m)?$/);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
  var ho = s.match(/^(\d+)\s*h$/);
  if (ho) return parseInt(ho[1], 10) * 60;
  var mi = s.match(/^(\d+)\s*(?:min|m)$/);
  if (mi) return parseInt(mi[1], 10);
  var col = s.match(/^(\d+)[:]?(\d{2})$/);
  if (col) return parseInt(col[1], 10) * 60 + parseInt(col[2], 10);
  var n = parseInt(s, 10);
  return (!isNaN(n) && n > 0) ? n : 0;
}

function _durMinParaTexto(min) {
  if (!min || min <= 0) return '';
  var h = Math.floor(min / 60);
  var m = min % 60;
  if (h > 0 && m > 0) return h + 'h ' + m + 'min';
  if (h > 0) return h + 'h';
  return m + 'min';
}

function _durChipClick(id, chip) {
  var el = document.getElementById(id);
  if (!el) return;
  el.value = chip;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.focus();
}

function _durNormalizarBlur(el) {
  var min = _parseDuracaoMin(el.value);
  if (min > 0) {
    var novo = _durMinParaTexto(min);
    if (novo !== el.value) {
      el.value = novo;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}

// ================================================================
// SmartTimePicker — Custom time picker (popover + bottom-sheet)
// ================================================================
var SmartTimePicker = (function () {
  var _overlay  = null;
  var _activeId = null;
  var _tempH    = 8;
  var _tempM    = 0;
  var _CHIPS    = ['06:00','08:00','10:00','12:00','14:00','15:00','18:00','20:00','22:00'];

  function _pad(n) { return n < 10 ? '0' + n : String(n); }

  function _parseHM(str) {
    if (!str) return null;
    var s = String(str).replace(/[^\d:]/g, '');
    if (!/[:]/.test(s) && s.length === 4) s = s.slice(0, 2) + ':' + s.slice(2);
    var m = s.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    var h = parseInt(m[1], 10), mi = parseInt(m[2], 10);
    if (h > 23 || mi > 59) return null;
    return { h: h, m: mi };
  }

  function _buildOverlay() {
    var div = document.createElement('div');
    div.id = 'stp-overlay';
    div.className = 'stp-overlay';
    div.innerHTML = (
      '<div class="stp-sheet" role="dialog" aria-label="Selecionar horário" aria-modal="true">' +
        '<div class="stp-handle"></div>' +
        '<div class="stp-title">Selecionar horário</div>' +
        '<div class="stp-chips" id="stp-chips">' +
          _CHIPS.map(function (c) {
            return '<button type="button" class="stp-chip" data-val="' + c + '" onclick="SmartTimePicker._chipClick(\'' + c + '\')">' + c + '</button>';
          }).join('') +
        '</div>' +
        '<div class="stp-manual">' +
          '<button type="button" class="stp-adj-btn" onclick="SmartTimePicker._adj(-15)">−15min</button>' +
          '<input id="stp-input" class="stp-input" type="text" inputmode="numeric" maxlength="5" placeholder="HH:mm" autocomplete="off">' +
          '<button type="button" class="stp-adj-btn" onclick="SmartTimePicker._adj(15)">+15min</button>' +
        '</div>' +
        '<div class="stp-error" id="stp-error"></div>' +
        '<div class="stp-actions">' +
          '<button type="button" class="btn btn-ghost" onclick="SmartTimePicker.fechar()">Cancelar</button>' +
          '<button type="button" class="btn btn-primary" onclick="SmartTimePicker._apply()">Aplicar</button>' +
        '</div>' +
      '</div>'
    );
    div.addEventListener('click', function (e) { if (e.target === div) SmartTimePicker.fechar(); });
    div.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') SmartTimePicker.fechar();
      if (e.key === 'Enter' && document.activeElement === document.getElementById('stp-input')) {
        SmartTimePicker._apply();
      }
    });
    document.body.appendChild(div);
    _overlay = div;
    var inp = document.getElementById('stp-input');
    inp.addEventListener('input', function () { SmartTimePicker._onInputChange(); });
  }

  function _setDisplay(h, m) {
    _tempH = ((h % 24) + 24) % 24;
    _tempM = ((m % 60) + 60) % 60;
    var inp = document.getElementById('stp-input');
    if (inp) inp.value = _pad(_tempH) + ':' + _pad(_tempM);
    var chipVal = _pad(_tempH) + ':' + _pad(_tempM);
    if (_overlay) {
      _overlay.querySelectorAll('.stp-chip').forEach(function (c) {
        c.classList.toggle('active', c.getAttribute('data-val') === chipVal);
      });
    }
    var err = document.getElementById('stp-error');
    if (err) err.textContent = '';
  }

  function _commit(finalVal) {
    var hidden = _activeId ? document.getElementById(_activeId) : null;
    if (!hidden) return;
    hidden.value = finalVal;
    var btn = document.getElementById('stp-btn-' + _activeId);
    if (btn) {
      var span = btn.querySelector('.stp-value');
      if (span) span.textContent = finalVal;
      btn.classList.remove('stp-empty');
    }
    var cb = hidden.getAttribute('data-onapply');
    if (cb) { try { (new Function(cb))(); } catch (e) { console.warn('stp callback:', e); } }
    try { hidden.dispatchEvent(new Event('input',  { bubbles: true })); } catch (e) {}
    try { hidden.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
  }

  return {
    _chipClick: function (val) {
      var p = _parseHM(val);
      if (p) _setDisplay(p.h, p.m);
    },

    _adj: function (delta) {
      var total = _tempH * 60 + _tempM + delta;
      total = ((total % 1440) + 1440) % 1440;
      _setDisplay(Math.floor(total / 60), total % 60);
    },

    _onInputChange: function () {
      var inp = document.getElementById('stp-input');
      if (!inp) return;
      var v = inp.value;
      if (/^\d{4}$/.test(v)) { inp.value = v.slice(0, 2) + ':' + v.slice(2); v = inp.value; }
      var p = _parseHM(v);
      if (p) { _tempH = p.h; _tempM = p.m; }
      var chipVal = p ? (_pad(p.h) + ':' + _pad(p.m)) : '';
      if (_overlay) {
        _overlay.querySelectorAll('.stp-chip').forEach(function (c) {
          c.classList.toggle('active', chipVal !== '' && c.getAttribute('data-val') === chipVal);
        });
      }
    },

    _apply: function () {
      var inp = document.getElementById('stp-input');
      var v = inp ? inp.value.trim() : '';
      if (/^\d{4}$/.test(v)) v = v.slice(0, 2) + ':' + v.slice(2);
      var p = _parseHM(v);
      if (!p) {
        var err = document.getElementById('stp-error');
        if (err) err.textContent = 'Horário inválido. Use HH:mm (ex: 20:00).';
        if (inp) inp.focus();
        return;
      }
      _commit(_pad(p.h) + ':' + _pad(p.m));
      SmartTimePicker.fechar();
    },

    _open: function (id) {
      _activeId = id;
      if (!_overlay) _buildOverlay();
      var hidden = document.getElementById(id);
      var p = _parseHM(hidden ? hidden.value : '') || { h: 8, m: 0 };
      _setDisplay(p.h, p.m);
      _overlay.classList.add('aberto');
      document.body.style.overflow = 'hidden';
      setTimeout(function () {
        var inp = document.getElementById('stp-input');
        if (inp) inp.focus();
      }, 80);
    },

    fechar: function () {
      if (_overlay) _overlay.classList.remove('aberto');
      document.body.style.overflow = '';
      _activeId = null;
    },

    render: function (id, valor, onApplyExpr) {
      var v = (_parseHM(valor) ? String(valor).slice(0, 5) : '');
      var emptyClass = v ? '' : ' stp-empty';
      var display = v || 'Selecionar horário';
      var cbAttr = onApplyExpr ? ' data-onapply="' + onApplyExpr.replace(/"/g, '&quot;') + '"' : '';
      return (
        '<div class="stp-wrap">' +
          '<button type="button" class="stp-btn' + emptyClass + '" id="stp-btn-' + id + '" onclick="SmartTimePicker._open(\'' + id + '\')">' +
            '<span class="stp-icon">🕐</span>' +
            '<span class="stp-value">' + display + '</span>' +
            '<span class="stp-chevron">▾</span>' +
          '</button>' +
          '<input type="hidden" id="' + id + '" value="' + v + '"' + cbAttr + '>' +
        '</div>'
      );
    },

    lerHora: function (id) {
      var el = document.getElementById(id);
      return el ? (el.value || '') : '';
    },
  };
})();

function _lerPreferencias() {
  try {
    var raw = localStorage.getItem(RB_PREFS_KEY);
    var data = raw ? JSON.parse(raw) : {};
    return Object.assign({}, RB_PREFS_DEFAULT, data || {});
  } catch (e) {
    return Object.assign({}, RB_PREFS_DEFAULT);
  }
}

function _salvarPreferencias(prefs) {
  var merged = Object.assign({}, RB_PREFS_DEFAULT, prefs || {});
  try {
    localStorage.setItem(RB_PREFS_KEY, JSON.stringify(merged));
  } catch (e) {}
  // Persistir no RTDB quando o usuário estiver autenticado
  if (RB_AUTH_STATE.user && RB_AUTH_STATE.user.uid &&
      window.FirebaseClient && typeof FirebaseClient.savePreferences === 'function') {
    FirebaseClient.savePreferences(RB_AUTH_STATE.user.uid, merged).catch(function () {});
  }
  return merged;
}

// Restaura preferências salvas no RTDB para o localStorage ao fazer login
function _restaurarPrefsDoRtdb(uid) {
  if (!uid || !window.FirebaseClient || typeof FirebaseClient.loadPreferences !== 'function') return;
  FirebaseClient.loadPreferences(uid).then(function (remotePrefs) {
    if (!remotePrefs || typeof remotePrefs !== 'object') return;
    var local = _lerPreferencias();
    // Preferências remotas têm prioridade sobre o padrão, mas locais modificadas recentemente também contam
    var merged = Object.assign({}, RB_PREFS_DEFAULT, remotePrefs, local);
    // Se local === default, remoto ganha; se local foi explicitamente modificado, mantém
    // Estratégia: prefer remote para garantir sincronia entre dispositivos
    var mergedRemoteWins = Object.assign({}, RB_PREFS_DEFAULT, local, remotePrefs);
    try { localStorage.setItem(RB_PREFS_KEY, JSON.stringify(mergedRemoteWins)); } catch (e) {}
    _aplicarDensidade();
  }).catch(function () {});
}

function _rotaInicialPadrao() {
  var prefs = _lerPreferencias();
  var validas = ['/inicio', '/viagens', '/roteiro', '/financeiro', '/rotas'];
  return validas.indexOf(prefs.paginaInicialPadrao) !== -1 ? prefs.paginaInicialPadrao : '/inicio';
}

function _confirmarExclusoesAtivo() {
  return _lerPreferencias().confirmarAntesExcluir !== false;
}

function _aplicarDensidade() {
  var d = _lerPreferencias().densidadeVisual || 'confortavel';
  document.body.setAttribute('data-density', d);
}

function atualizarBadgeModoDadosHeader() {
  var badge = document.getElementById('header-data-badge');
  if (!badge) return;
  badge.style.display = 'none';
}

function _firebaseConfigurado() {
  if (RB_AUTH_STATE.offlineMode) return false;
  return !!window.FirebaseClient;
}

function _nomeUsuarioAuth(user) {
  if (!user) return '';
  return user.displayName || user.email || 'Usuário';
}

function _renderAvisoSincronizacao() {
  if (RB_AUTH_STATE.offlineMode) return '';
  if (!_firebaseConfigurado() || RB_AUTH_STATE.user) return '';
  return (
    '<div class="card" style="margin-bottom:var(--space-4)">' +
      '<div class="card-body" style="padding:var(--space-3) var(--space-4)">' +
        '<span class="text-sm text-secondary">Entre para sincronizar seus dados futuramente.</span>' +
      '</div>' +
    '</div>'
  );
}

function _mostrarToast(msg, tipo) {
  if (!msg) return;
  var id = 'rb-toast';
  var existente = document.getElementById(id);
  if (existente && existente.parentNode) existente.parentNode.removeChild(existente);

  var el = document.createElement('div');
  el.id = id;
  el.className = 'rb-toast' + (tipo === 'erro' ? ' rb-toast-erro' : '');
  el.textContent = msg;
  document.body.appendChild(el);

  requestAnimationFrame(function () {
    el.classList.add('visivel');
  });

  setTimeout(function () {
    el.classList.remove('visivel');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 220);
  }, 2200);
}

function atualizarHeaderAuthUI() {
  var nav = document.getElementById('header-nav');
  if (!nav) return;
  var linksPrivados = nav.querySelectorAll('[data-route]');
  var mostrarPrivado = _temAcessoPrivado();
  linksPrivados.forEach(function (link) {
    link.style.display = mostrarPrivado ? '' : 'none';
  });

  var bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) bottomNav.style.display = mostrarPrivado ? '' : 'none';

  var slot = document.getElementById('header-auth-slot');
  if (!slot) {
    slot = document.createElement('span');
    slot.id = 'header-auth-slot';
    slot.style.display = 'inline-flex';
    slot.style.alignItems = 'center';
    slot.style.gap = '8px';
    slot.style.marginLeft = '8px';
    nav.appendChild(slot);
  }

  if (RB_AUTH_STATE.offlineMode) {
    slot.innerHTML = '<a href="#/config" class="nav-link">Offline</a>';
  } else if (RB_AUTH_STATE.user) {
    var nome = _nomeUsuarioAuth(RB_AUTH_STATE.user);
    slot.innerHTML = (
      '<span class="badge badge-neutral" title="Usuário autenticado">' + nome + '</span>' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="AuthActions.sair()">Sair</button>'
    );
  } else {
    slot.innerHTML = '';
  }
}

// ---- Overlay de boot (ocultado após inicialização completa) ----
function _mostrarBootOverlay(msg) {
  var el = document.getElementById('rb-boot-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rb-boot-overlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--color-bg,#fff);gap:16px;transition:opacity .3s';
    el.innerHTML = '<div style="font-size:2rem">🗺️</div><div id="rb-boot-msg" style="font-size:.875rem;color:var(--text-muted,#6b7280)">Carregando…</div>';
    document.body.appendChild(el);
  }
  var msgEl = el.querySelector('#rb-boot-msg');
  if (msgEl && msg) msgEl.textContent = msg;
  el.style.opacity = '1';
  el.style.display = 'flex';
}

function _ocultarBootOverlay() {
  var el = document.getElementById('rb-boot-overlay');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(function () { el.style.display = 'none'; }, 320);
}

async function iniciarAuthStateListener() {
  if (RB_AUTH_STATE.initialized) return;

  _mostrarBootOverlay('Verificando autenticação…');
  _dbgAuth('firebase init started | ambiente:', RB_DIAG_STATE.ambiente);

  try {
    // ---- Modo offline: sem Firebase ----
    if (RB_AUTH_STATE.offlineMode) {
      _dbgAuth('modo offline ativo');
      RB_AUTH_STATE.initialized = true;
      atualizarHeaderAuthUI();
      atualizarBadgeModoDadosHeader();
      SyncService.startAutoSync();
      RB_DIAG_STATE.rtdbStatus = 'offline';
      return;
    }

    // ---- Firebase indisponível ----
    if (!window.FirebaseClient || typeof FirebaseClient.waitForAuthReady !== 'function') {
      _dbgAuth('FirebaseClient não disponível');
      RB_AUTH_STATE.initialized = true;
      atualizarHeaderAuthUI();
      RB_DIAG_STATE.rtdbStatus = 'error';
      RB_DIAG_STATE.rtdbStatusMsg = 'FirebaseClient ausente';
      return;
    }

    // ---- Aguarda Firebase Auth resolver (persistência + redirect + onAuthStateChanged) ----
    try {
      await FirebaseClient.waitForAuthReady();
    } catch (e) {
      console.warn('[AuthGate] waitForAuthReady error:', e);
    }

    var user = FirebaseClient.getCurrentUser();
    _dbgAuth('auth ready | uid:', user ? user.uid : null);

    RB_AUTH_STATE.user        = user || null;
    RB_AUTH_STATE.initialized = true;
    atualizarHeaderAuthUI();
    atualizarBadgeModoDadosHeader();

    // ---- Usuário autenticado: pull RTDB ----
    if (user) {
      var uid = user.uid;
      SyncService.garantirIsolamentoUid(uid);
      _mostrarBootOverlay('Carregando seus dados…');
      _dbgAuth('RTDB pull started | uid:', uid);
      var pullResult = await SyncService.pullFromRtdb(uid).catch(function () {
        return { ok: false, reason: 'exception' };
      });
      _dbgAuth('RTDB pull done:', JSON.stringify(pullResult));

      if (pullResult.ok) {
        RB_DIAG_STATE.rtdbStatus  = 'loaded';
        RB_DIAG_STATE.rtdbStatusMsg = '';
        RB_DIAG_STATE.lastLoadAt  = new Date().toISOString();
      } else if (pullResult.reason === 'offline' || pullResult.reason === 'sem-internet') {
        RB_DIAG_STATE.rtdbStatus  = 'offline';
        RB_DIAG_STATE.rtdbStatusMsg = 'Sem conexão';
        var cached = SyncService.carregarCacheUid(uid);
        if (cached && window.Store && typeof Store.carregarEstadoCompleto === 'function') {
          Store.carregarEstadoCompleto(cached);
          RB_DIAG_STATE.rtdbStatus = 'cached';
        }
      } else {
        RB_DIAG_STATE.rtdbStatus  = 'error';
        RB_DIAG_STATE.rtdbStatusMsg = pullResult.error || 'Erro ao carregar';
        var cached2 = SyncService.carregarCacheUid(uid);
        if (cached2 && window.Store && typeof Store.carregarEstadoCompleto === 'function') {
          Store.carregarEstadoCompleto(cached2);
          RB_DIAG_STATE.rtdbStatus = 'cached';
        }
      }

      SyncService.startAutoSync();
      _restaurarPrefsDoRtdb(uid);
    } else {
      SyncService.stopAutoSync();
      RB_DIAG_STATE.rtdbStatus = 'pending';
    }

    // ---- Registra listener de mudanças subsequentes (pós-boot) ----
    if (typeof FirebaseClient.onAuthChange === 'function') {
      FirebaseClient.onAuthChange(function (changedUser) {
        (async function () {
          try {
            _dbgAuth('onAuthChange pós-boot | uid:', changedUser ? changedUser.uid : null);
            var prevUser = RB_AUTH_STATE.user;
            RB_AUTH_STATE.user = changedUser || null;
            atualizarHeaderAuthUI();
            atualizarBadgeModoDadosHeader();

            if (changedUser && (!prevUser || prevUser.uid !== changedUser.uid)) {
              // Novo login pós-boot: pull RTDB e navega
              var uid2 = changedUser.uid;
              SyncService.garantirIsolamentoUid(uid2);
              _mostrarBootOverlay('Carregando seus dados…');
              _dbgAuth('RTDB pull pós-login | uid:', uid2);
              var pr = await SyncService.pullFromRtdb(uid2).catch(function () {
                return { ok: false, reason: 'exception' };
              });
              _dbgAuth('RTDB pull pós-login done:', JSON.stringify(pr));
              if (pr.ok) {
                RB_DIAG_STATE.rtdbStatus = 'loaded';
                RB_DIAG_STATE.lastLoadAt = new Date().toISOString();
              } else {
                var c2 = SyncService.carregarCacheUid(uid2);
                if (c2 && window.Store && typeof Store.carregarEstadoCompleto === 'function') {
                  Store.carregarEstadoCompleto(c2);
                  RB_DIAG_STATE.rtdbStatus = 'cached';
                }
              }
              SyncService.startAutoSync();
              _restaurarPrefsDoRtdb(uid2);
              // Navega a partir de /login ou vazio
              var hashAtual = (window.location.hash || '').replace(/^#/, '');
              if (!hashAtual || hashAtual === '/login') {
                Router.navegar('#/inicio');
              } else {
                window.dispatchEvent(new HashChangeEvent('hashchange'));
              }
            } else if (!changedUser && prevUser) {
              // Logout: vai para /login
              SyncService.stopAutoSync();
              RB_DIAG_STATE.rtdbStatus = 'pending';
              Router.navegar('#/login');
            }
          } catch (e) {
            _dbgAuth('onAuthChange pós-boot erro:', e);
          } finally {
            _ocultarBootOverlay();
          }
        })();
      });
    }

    _dbgAuth('router init');
  } catch (e) {
    // Segurança: qualquer exceção não deve deixar o app pendurado
    console.warn('[AuthGate] erro inesperado na inicialização:', e);
    if (!RB_AUTH_STATE.initialized) {
      RB_AUTH_STATE.user = null;
      RB_AUTH_STATE.initialized = true;
      atualizarHeaderAuthUI();
      atualizarBadgeModoDadosHeader();
    }
  } finally {
    _ocultarBootOverlay();
  }
}

function _mensagemErroAuth(err) {
  var msg = String((err && (err.friendly || err.message)) || 'Erro ao autenticar.');
  var map = [
    ['auth/invalid-email', 'E-mail inválido.'],
    ['auth/user-not-found', 'Usuário não encontrado.'],
    ['auth/wrong-password', 'Senha incorreta.'],
    ['auth/invalid-credential', 'Credenciais inválidas.'],
    ['auth/email-already-in-use', 'Este e-mail já está em uso.'],
    ['auth/weak-password', 'Senha fraca. Use pelo menos 6 caracteres.'],
    ['auth/popup-closed-by-user', 'Login com Google cancelado.'],
    ['auth/popup-blocked', 'Popup bloqueado pelo navegador.'],
    ['auth/operation-not-allowed', 'Método de login não habilitado para esta conta.'],
    ['auth/network-request-failed', 'Falha de rede. Verifique sua conexão.'],
  ];

  for (var i = 0; i < map.length; i++) {
    if (msg.indexOf(map[i][0]) !== -1) return map[i][1];
  }
  return msg;
}

function _contarParticipantesAtivos(viagem) {
  if (!viagem) return 1;
  if (Array.isArray(viagem.participantes)) {
    var ativos = viagem.participantes.filter(function (p) {
      return p && p.ativo !== false && String(p.nome || '').trim();
    }).length;
    return Math.max(1, ativos);
  }
  return Math.max(1, Number(viagem.participantes) || 1);
}

function _nomesParticipantesAtivos(viagem) {
  if (!viagem) return [];
  if (Array.isArray(viagem.participantes)) {
    return viagem.participantes
      .filter(function (p) { return p && p.ativo !== false; })
      .map(function (p) { return String(p.nome || '').trim(); })
      .filter(Boolean);
  }
  var qtd = Math.max(1, Number(viagem.participantes) || 1);
  var lista = [];
  for (var i = 1; i <= qtd; i++) lista.push('Pessoa ' + i);
  return lista;
}

// ==== PÁGINA: Início ====
function paginaInicio(params, container) {
  var viagem = Store.getViagemSelecionada();
  var prefsInicio = _lerPreferencias();
  var config = Store.getConfiguracoes();
  var viagens = Store.getViagens();

  if (!viagem) {
    container.innerHTML = (
      '<div class="empty-trips">' +
        '<div class="empty-trips-emoji">🗺️</div>' +
        '<h2 style="font-weight:700;font-size:var(--text-xl)">Nenhuma viagem ainda</h2>' +
        '<p class="text-secondary text-sm">Crie sua primeira viagem para começar a planejar!</p>' +
        '<button class="btn btn-primary" onclick="TripModal.abrir()">+ Nova viagem</button>' +
      '</div>'
    );
    return;
  }

  function _fmtData(iso) {
    if (!iso) return '-';
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
    } catch (e) {
      return iso;
    }
  }

  function _moedaInicio(v) {
    return prefsInicio.mostrarValoresInicio !== false ? UI.formatarMoeda(v) : '••••';
  }

  var resumoFinanceiro = Store.getResumoFinanceiro(viagem.id);
  var resumoRotas = Store.getResumoRotas(viagem.id);
  var proximas = Store.getProximasAtividades(viagem.id, 3);
  var nomesParticipantesSelecionada = _nomesParticipantesAtivos(viagem);
  var loc = viagem.localizacaoCurta || viagem.destinoPrincipal || viagem.destino || '';

  var totalOrcamento = 0;
  var totalGasto = 0;
  var totalParticipantes = 0;
  viagens.forEach(function (v) {
    var r = Store.getResumoFinanceiro(v.id);
    totalOrcamento += Number(v.orcamento) || 0;
    totalGasto += Number(r.totalGasto) || 0;
    totalParticipantes += _contarParticipantesAtivos(v);
  });
  var saldoTotal = totalOrcamento - totalGasto;

  var destaque = viagens.slice(0, 3).map(function (v) {
    var r = Store.getResumoFinanceiro(v.id);
    var rv = Store.getResumoRotas(v.id);
    var local = v.localizacaoCurta || v.destinoPrincipal || v.destino || '';
    return (
      '<div class="card" style="margin-bottom:var(--space-3)">' +
        '<div class="card-body">' +
          '<div style="display:flex;justify-content:space-between;gap:var(--space-2);align-items:flex-start">' +
            '<div style="min-width:0">' +
              '<div class="font-semibold truncate">' + v.nome + '</div>' +
              '<div class="text-xs text-secondary">📍 ' + local + '</div>' +
            '</div>' +
            '<span class="badge ' + UI.badgeStatus(v.status) + '">' + UI.textoStatus(v.status) + '</span>' +
          '</div>' +
          '<div style="display:flex;gap:var(--space-3);flex-wrap:wrap;margin-top:var(--space-2)">' +
            '<span class="text-xs text-secondary">💰 ' + _moedaInicio(v.orcamento) + '</span>' +
            '<span class="text-xs text-secondary">💸 ' + _moedaInicio(r.totalGasto) + '</span>' +
            '<span class="text-xs text-secondary">🛣️ ' + rv.trechos.length + ' trecho(s)</span>' +
          '</div>' +
        '</div>' +
        '<div class="card-footer">' +
          '<button class="btn btn-ghost btn-sm" onclick="TripActions.abrirDetalhes(\'' + v.id + '\')">Abrir viagem</button>' +
        '</div>' +
      '</div>'
    );
  }).join('');

  var proximasHtml = proximas.length
    ? proximas.map(function (a) {
        return (
          '<div class="expense-row" style="padding:var(--space-2) 0">' +
            '<div style="min-width:0">' +
              '<div class="font-medium truncate">' + (a.nome || 'Atividade') + '</div>' +
              '<div class="text-xs text-secondary">📅 ' + _fmtData(a._data) + ' · ⏰ ' + (a.hora || '--:--') + '</div>' +
            '</div>' +
            '<span class="badge badge-neutral">' + (a.categoria || 'atividade') + '</span>' +
          '</div>'
        );
      }).join('')
    : '<div class="itin-empty-day" style="margin:0">Sem atividades futuras para esta viagem.</div>';

  var html = (
    '<div class="hero-banner dashboard-hero">' +
      '<div class="hero-eyebrow">Painel</div>' +
      '<h1 class="hero-title">Olá, ' + (config.nomeUsuario || 'viajante') + ' 👋</h1>' +
      '<p class="hero-subtitle">Viagem selecionada: <strong>' + viagem.nome + '</strong></p>' +
      '<div class="hero-actions">' +
        '<button class="btn btn-white" onclick="TripSwitcher.abrir()">Trocar viagem</button>' +
        '<a href="#/viagens" class="btn btn-outline-white">Ver viagens</a>' +
        '<button class="btn btn-outline-white" onclick="TripModal.abrir()">Nova viagem</button>' +
      '</div>' +
    '</div>' +

    '<div class="page-section">' +
      UI.renderSectionHeader('Totais do painel', '', '') +
      '<div class="stats-grid dashboard-kpis">' +
        UI.renderStatCard('Orçamento total', _moedaInicio(totalOrcamento), 'Todas as viagens', 'stat-icon-blue', '💼') +
        UI.renderStatCard('Gasto total', _moedaInicio(totalGasto), 'Todas as viagens', 'stat-icon-yellow', '💸') +
        UI.renderStatCard('Saldo total', _moedaInicio(saldoTotal), saldoTotal >= 0 ? 'Em dia' : 'Acima do planejado', saldoTotal >= 0 ? 'stat-icon-green' : 'stat-icon-red', saldoTotal >= 0 ? '✅' : '⚠️') +
        UI.renderStatCard('Participantes', String(totalParticipantes), 'Somatório das viagens', 'stat-icon-blue', '👥') +
        UI.renderStatCard('Próximas atividades', String(proximas.length), 'Da viagem selecionada', 'stat-icon-green', '🗓️') +
        UI.renderStatCard('Trechos', String(resumoRotas.trechos.length), 'Da viagem selecionada', 'stat-icon-blue', '🛣️') +
      '</div>' +
    '</div>' +

    '<div class="page-section">' +
      UI.renderSectionHeader('Viagem selecionada', '', '') +
      '<div class="card">' +
        '<div class="card-body">' +
          '<div style="display:flex;justify-content:space-between;gap:var(--space-2);align-items:flex-start;flex-wrap:wrap">' +
            '<div style="min-width:0">' +
              '<div class="font-semibold" style="font-size:var(--text-lg)">' + viagem.nome + '</div>' +
              '<div class="text-sm text-secondary">📍 ' + loc + '</div>' +
              '<div class="text-xs text-secondary" style="margin-top:var(--space-1)">👥 ' + (nomesParticipantesSelecionada.length ? nomesParticipantesSelecionada.join(', ') : 'Sem participantes ativos') + '</div>' +
              '<div class="text-xs text-secondary" style="margin-top:var(--space-1)">📅 ' + _fmtData(viagem.dataInicio) + ' → ' + _fmtData(viagem.dataFim) + '</div>' +
            '</div>' +
            '<span class="badge ' + UI.badgeStatus(viagem.status) + '">' + UI.textoStatus(viagem.status) + '</span>' +
          '</div>' +
          '<div style="margin-top:var(--space-3)">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2)">' +
              '<span class="text-sm text-secondary">Progresso do orçamento</span>' +
              '<span class="text-sm font-semibold">' + resumoFinanceiro.pct + '%</span>' +
            '</div>' +
            UI.progressBar(resumoFinanceiro.pct, UI.corBarra(resumoFinanceiro.pct)) +
          '</div>' +
        '</div>' +
        '<div class="card-footer">' +
          '<a href="#/viagem/' + viagem.id + '" class="btn btn-ghost btn-sm">Detalhes</a>' +
          '<a href="#/roteiro" class="btn btn-primary btn-sm">Roteiro</a>' +
          '<a href="#/financeiro" class="btn btn-secondary btn-sm">Financeiro</a>' +
          '<a href="#/rotas" class="btn btn-ghost btn-sm">Rotas</a>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="page-section dashboard-grid-two">' +
      '<div class="card">' +
        '<div class="card-header"><span class="font-semibold">🗓️ Próximas atividades</span><a href="#/roteiro" class="btn btn-ghost btn-sm">Abrir roteiro</a></div>' +
        '<div class="card-body">' + proximasHtml + '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-header"><span class="font-semibold">💰 Resumo financeiro</span><a href="#/financeiro" class="btn btn-ghost btn-sm">Ver tudo</a></div>' +
        '<div class="card-body">' +
          '<div class="expense-row"><span class="text-sm text-secondary">Orçamento</span><strong>' + _moedaInicio(resumoFinanceiro.orcamento) + '</strong></div>' +
          '<div class="expense-row"><span class="text-sm text-secondary">Gasto</span><strong>' + _moedaInicio(resumoFinanceiro.totalGasto) + '</strong></div>' +
          '<div class="expense-row"><span class="text-sm text-secondary">Compromisso parcelado</span><strong>' + _moedaInicio(resumoFinanceiro.compromissoParcelado || 0) + '</strong></div>' +
          '<div class="expense-row"><span class="text-sm text-secondary">Disponível</span><strong>' + _moedaInicio(resumoFinanceiro.saldo) + '</strong></div>' +
          '<div style="margin-top:var(--space-2)">' +
            UI.progressBar(resumoFinanceiro.pct, UI.corBarra(resumoFinanceiro.pct)) +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="page-section dashboard-grid-two">' +
      '<div class="card">' +
        '<div class="card-header"><span class="font-semibold">🛣️ Resumo de rotas</span><a href="#/rotas" class="btn btn-ghost btn-sm">Abrir rotas</a></div>' +
        '<div class="card-body">' +
          '<div class="expense-row"><span class="text-sm text-secondary">Trechos</span><strong>' + resumoRotas.trechos.length + '</strong></div>' +
          '<div class="expense-row"><span class="text-sm text-secondary">Distância</span><strong>' + (resumoRotas.totalKm || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km</strong></div>' +
          '<div class="expense-row"><span class="text-sm text-secondary">Tempo estimado</span><strong>' + (resumoRotas.totalDuracaoTexto || '0min') + '</strong></div>' +
          '<div class="expense-row"><span class="text-sm text-secondary">Litros</span><strong>' + (resumoRotas.totalLitros || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' L</strong></div>' +
          '<div class="expense-row"><span class="text-sm text-secondary">Custo</span><strong>' + _moedaInicio(resumoRotas.custoTotal || 0) + '</strong></div>' +
        '</div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="card-header"><span class="font-semibold">⭐ Viagens em destaque</span><a href="#/viagens" class="btn btn-ghost btn-sm">Ver todas</a></div>' +
        '<div class="card-body">' + (destaque || '<div class="itin-empty-day" style="margin:0">Sem viagens para destacar.</div>') + '</div>' +
      '</div>' +
    '</div>'
  );

  container.innerHTML = html;
}

// ==== PÁGINA: Lista de Viagens ====
function paginaViagens(params, container) {
  var viagens      = Store.getViagens();
  var selectedId   = Store.getState().viagemSelecionadaId;
  var filtroAtivo  = (window._filtroViagens) || 'todas';

  // Aplica filtro por status
  var viaigensFiltradas = viagens.filter(function (v) {
    if (filtroAtivo === 'todas') return true;
    return v.status === filtroAtivo;
  });

  function btnFiltro(label, valor) {
    var ativo = filtroAtivo === valor;
    return '<button class="btn ' + (ativo ? 'btn-primary' : 'btn-ghost') + ' btn-sm" ' +
      'onclick="window._filtroViagens=\'' + valor + '\';Router.navegar(\'#/viagens\')">' +
      label + '</button>';
  }

  var conteudoCards = '';
  if (viaigensFiltradas.length === 0) {
    conteudoCards = (
      '<div style="grid-column:1/-1">' +
        '<div class="empty-trips">' +
          '<div class="empty-trips-emoji">' + (viagens.length === 0 ? '✈️' : '🔍') + '</div>' +
          '<h2 style="font-weight:700;font-size:var(--text-lg)">' +
            (viagens.length === 0 ? 'Nenhuma viagem criada' : 'Nenhuma viagem neste filtro') +
          '</h2>' +
          '<p class="text-secondary text-sm">' +
            (viagens.length === 0
              ? 'Crie sua primeira viagem e comece a planejar!'
              : 'Tente selecionar outro filtro acima.') +
          '</p>' +
          (viagens.length === 0
            ? '<button class="btn btn-primary" onclick="TripModal.abrir()">+ Nova viagem</button>'
            : '') +
        '</div>' +
      '</div>'
    );
  } else {
    conteudoCards = viaigensFiltradas.map(function (v) {
      var resumoAtual = Store.getResumoFinanceiro(v.id);
      var viagemAtualizada = Object.assign({}, v, {
        gastoAtualCalculado: Number(resumoAtual.totalGasto) || 0,
      });
      return UI.renderTripCard(viagemAtualizada, selectedId);
    }).join('');
  }

  var html = (
    '<div class="page-section">' +
      // Cabeçalho com botão Nova viagem
      '<div class="section-header" style="margin-bottom:var(--space-4)">' +
        '<h2 class="section-title">Minhas Viagens</h2>' +
        '<button class="btn btn-primary btn-sm" onclick="TripModal.abrir()">+ Nova viagem</button>' +
      '</div>' +

      // Filtros de status
      '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-5)">' +
        btnFiltro('Todas', 'todas') +
        btnFiltro('Planejando', 'planejando') +
        btnFiltro('Em andamento', 'em-andamento') +
        btnFiltro('Concluídas', 'concluida') +
      '</div>' +

      '<div class="cards-grid">' +
        conteudoCards +
      '</div>' +
    '</div>'
  );

  container.innerHTML = html;
  _bindTripCards(container);
}

// ==== PÁGINA: Detalhe da Viagem ====
function paginaViagemDetalhe(params, container) {
  var id = params.id;
  var viagem = Store.getViagens().find(function (v) { return v.id === id; });

  if (!viagem) {
    container.innerHTML = UI.renderEmptyState('Viagem não encontrada', 'O ID informado não existe.');
    return;
  }

  // URL de detalhe sempre define a viagem ativa (inclusive em link direto)
  if (Store.getState().viagemSelecionadaId !== id) {
    Store.selecionarViagem(id);
  }

  var resFinanceiro = Store.getResumoFinanceiro(id);
  var pct = resFinanceiro.pct;
  var proximas = Store.getProximasAtividades(id, 3);
  var resRotas = Store.getResumoRotas(id);
  var nomesParticipantesViagem = _nomesParticipantesAtivos(viagem);

  // Bloco de prévia do roteiro
  var previewRoteiro;
  if (proximas.length === 0) {
    previewRoteiro = (
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-header" style="justify-content:space-between">' +
          '<span class="font-semibold">🗓️ Roteiro</span>' +
          '<a href="#/roteiro" class="btn btn-ghost btn-sm">Abrir roteiro</a>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="itin-empty-day" style="text-align:left">Nenhuma atividade planejada ainda.<br><button class="btn btn-primary btn-sm" style="margin-top:var(--space-3)" onclick="Router.navegar(\'#/roteiro\')">+ Criar roteiro</button></div>' +
        '</div>' +
      '</div>'
    );
  } else {
    previewRoteiro = (
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-header" style="justify-content:space-between">' +
          '<span class="font-semibold">🗓️ Próximas atividades</span>' +
          '<a href="#/roteiro" class="btn btn-ghost btn-sm">Abrir roteiro</a>' +
        '</div>' +
        '<div class="card-body" style="padding-top:0">' +
          proximas.map(UI.renderPreviewAtividade).join('') +
        '</div>' +
      '</div>'
    );
  }

  var html = (
    // Topo da página com cor temática
    '<div class="card trip-card" style="margin-bottom:var(--space-5)">' +
      '<div class="trip-card-cover trip-card-cover-' + viagem.capa + '" style="height:180px;flex-direction:column;justify-content:flex-end;gap:var(--space-1)">' +
        '<span class="badge ' + UI.badgeStatus(viagem.status) + '" style="align-self:flex-start">' + UI.textoStatus(viagem.status) + '</span>' +
        '<div class="trip-card-title" style="font-size:var(--text-2xl)">' + viagem.nome + '</div>' +
        '<div style="color:rgba(255,255,255,0.85);font-size:var(--text-sm)">📍 ' + (viagem.localizacaoCurta || viagem.destinoPrincipal || viagem.destino || '') + ' · 📅 ' + viagem.dataInicio + ' → ' + viagem.dataFim + '</div>' +
      '</div>' +
      '<div class="card-body">' +
        '<p class="text-secondary" style="margin-bottom:var(--space-4)">' + (viagem.descricao || '') + '</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-4)">' +
          (viagem.tags || []).map(function (t) { return '<span class="chip">' + t + '</span>'; }).join('') +
          '<span class="chip">👥 ' + _contarParticipantesAtivos(viagem) + ' pessoas</span>' +
          (nomesParticipantesViagem.length ? '<span class="chip">' + nomesParticipantesViagem.join(', ') + '</span>' : '') +
        '</div>' +
        '<div>' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2)">' +
            '<span class="text-sm text-secondary">Orçamento usado</span>' +
            '<span class="text-sm font-semibold">' + UI.formatarMoeda(resFinanceiro.totalGasto) + ' / ' + UI.formatarMoeda(viagem.orcamento) + '</span>' +
          '</div>' +
          UI.progressBar(pct, UI.corBarra(pct)) +
        '</div>' +
      '</div>' +
      '<div class="card-footer">' +
        '<a href="#/roteiro" class="btn btn-primary btn-sm">Roteiro</a>' +
        '<a href="#/financeiro" class="btn btn-secondary btn-sm">Financeiro</a>' +
        '<a href="#/rotas" class="btn btn-ghost btn-sm">Rotas</a>' +
      '</div>' +
    '</div>' +

    previewRoteiro +

    // Prévia financeira
    '<div class="card" style="margin-bottom:var(--space-5)">' +
      '<div class="card-header" style="justify-content:space-between">' +
        '<span class="font-semibold">💰 Financeiro</span>' +
        '<a href="#/financeiro" class="btn btn-ghost btn-sm">Ver detalhes</a>' +
      '</div>' +
      '<div class="card-body">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2)">' +
          '<span class="text-sm text-secondary">Orçamento utilizado</span>' +
          '<span class="text-sm font-bold">' + resFinanceiro.pct + '%</span>' +
        '</div>' +
        UI.progressBar(resFinanceiro.pct, UI.corBarra(resFinanceiro.pct)) +
        '<div style="display:flex;justify-content:space-between;margin-top:var(--space-3);flex-wrap:wrap;gap:var(--space-2)">' +
          '<span class="text-xs text-secondary">💸 Gasto: <strong>' + UI.formatarMoeda(resFinanceiro.totalGasto) + '</strong></span>' +
          '<span class="text-xs text-secondary">🧩 Parcelado: <strong>' + UI.formatarMoeda(resFinanceiro.compromissoParcelado || 0) + '</strong></span>' +
          '<span class="text-xs text-secondary">🏦 Saldo: <strong>' + UI.formatarMoeda(resFinanceiro.saldo) + '</strong></span>' +
          '<span class="text-xs text-muted">🧾 ' + resFinanceiro.despesas.length + ' despesa' + (resFinanceiro.despesas.length !== 1 ? 's' : '') + '</span>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // Prévia de rotas
    '<div class="card" style="margin-bottom:var(--space-5)">' +
      '<div class="card-header" style="justify-content:space-between">' +
        '<span class="font-semibold">🛣️ Rotas</span>' +
        '<a href="#/rotas" class="btn btn-ghost btn-sm">Abrir rotas</a>' +
      '</div>' +
      '<div class="card-body">' +
        '<div style="display:flex;flex-wrap:wrap;gap:var(--space-2) var(--space-4)">' +
          '<span class="text-xs text-secondary">📍 Trechos: <strong>' + resRotas.trechos.length + '</strong></span>' +
          '<span class="text-xs text-secondary">🛣️ Distância: <strong>' + (resRotas.totalKm || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km</strong></span>' +
          '<span class="text-xs text-secondary">💸 Custo estimado: <strong>' + UI.formatarMoeda(resRotas.custoTotal || 0) + '</strong></span>' +
        '</div>' +
      '</div>' +
    '</div>'
  );

  container.innerHTML = html;
}

// ==== PÁGINA: Roteiro ====
function paginaRoteiro(params, container) {
  var viagem = Store.getViagemSelecionada();
  if (!viagem) {
    container.innerHTML = (
      '<div class="empty-trips">' +
        '<div class="empty-trips-emoji">🗓️</div>' +
        '<h2 style="font-weight:700;font-size:var(--text-lg)">Nenhuma viagem selecionada</h2>' +
        '<p class="text-secondary text-sm">Selecione uma viagem para ver o roteiro.</p>' +
        '<a href="#/viagens" class="btn btn-primary">Ver viagens</a>' +
      '</div>'
    );
    return;
  }

  var itin  = Store.getItinerario(viagem.id);
  var dias  = itin ? itin.dias : [];
  var total = dias.reduce(function (acc, d) { return acc + d.atividades.length; }, 0);
  var loc   = viagem.localizacaoCurta || viagem.destinoPrincipal || viagem.destino || '';

  var diasHtml = dias.map(function (dia, idx) {
    return UI.renderDiaItinerario(dia, idx + 1, viagem.id);
  }).join('');
  var avisoSync = _renderAvisoSincronizacao();

  var html = (
    '<div class="page-section">' +

      // Cabeçalho
      '<div class="section-header" style="margin-bottom:var(--space-4)">' +
        '<h2 class="section-title">Roteiro</h2>' +
        '<button class="btn btn-primary btn-sm" onclick="AtividadeModal.abrir(\'' + viagem.id + '\', null)">+ Nova atividade</button>' +
      '</div>' +

      avisoSync +

      // Resumo da viagem
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body" style="padding:var(--space-4) var(--space-5)">' +
          '<div style="display:flex;align-items:flex-start;gap:var(--space-4)">' +
            // Ícone de capa
            '<div class="trip-card-cover trip-card-cover-' + viagem.capa + '" style="width:56px;height:56px;border-radius:var(--radius-xl);flex-shrink:0;background-size:cover"></div>' +
            // Informações
            '<div style="flex:1;min-width:0">' +
              '<div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-1)">' +
                '<span style="font-size:var(--text-lg);font-weight:800;color:var(--color-text)">' + viagem.nome + '</span>' +
                '<span class="badge ' + UI.badgeStatus(viagem.status) + '">' + UI.textoStatus(viagem.status) + '</span>' +
              '</div>' +
              '<div style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:var(--space-2)">📍 ' + loc + '</div>' +
              '<div style="display:flex;gap:var(--space-3);flex-wrap:wrap">' +
                '<span style="display:inline-flex;align-items:center;gap:4px;font-size:var(--text-xs);background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-full);padding:3px 10px;font-weight:600;color:var(--color-text-secondary)">📅 ' + dias.length + ' ' + (dias.length !== 1 ? 'dias' : 'dia') + '</span>' +
                '<span style="display:inline-flex;align-items:center;gap:4px;font-size:var(--text-xs);background:var(--color-bg-alt);border:1px solid var(--color-border);border-radius:var(--radius-full);padding:3px 10px;font-weight:600;color:var(--color-text-secondary)">🗓️ ' + total + ' ' + (total !== 1 ? 'atividades' : 'atividade') + '</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Dias
      (diasHtml || '<div class="itin-empty-day">Nenhum dia gerado. Verifique as datas da viagem.</div>') +

    '</div>'
  );

  container.innerHTML = html;
}


// ==== PÁGINA: Bagagem ====
function paginaBagagem(params, container) {
  var viagem = Store.getViagemSelecionada();
  if (!viagem) {
    container.innerHTML = (
      '<div class="page-section">' +
        '<div class="fin-empty">' +
          '<div style="font-size:2.5rem;margin-bottom:var(--space-3)">🧳</div>' +
          '<p class="font-semibold" style="margin-bottom:var(--space-1)">Nenhuma viagem selecionada</p>' +
          '<p class="text-sm text-secondary" style="margin-bottom:var(--space-4)">Selecione uma viagem para organizar a bagagem.</p>' +
          '<a href="#/viagens" class="btn btn-primary btn-sm">Escolher viagem</a>' +
        '</div>' +
      '</div>'
    );
    return;
  }
  BagagemPage.render(viagem, container);
}

// ==== PÁGINA: Financeiro ====
function paginaFinanceiro(params, container) {
  var viagem = Store.getViagemSelecionada();
  if (!viagem) {
    container.innerHTML = (
      '<div class="page-section">' +
        '<div class="fin-empty">' +
          '<div style="font-size:2.5rem;margin-bottom:var(--space-3)">✈️</div>' +
          '<p class="font-semibold" style="margin-bottom:var(--space-1)">Nenhuma viagem selecionada</p>' +
          '<p class="text-sm text-secondary" style="margin-bottom:var(--space-4)">Selecione uma viagem para visualizar o financeiro.</p>' +
          '<a href="#/viagens" class="btn btn-primary btn-sm">Ir para viagens</a>' +
        '</div>' +
      '</div>'
    );
    return;
  }

  var res  = Store.getResumoFinanceiro(viagem.id);
  var balancoMensal = Store.getBalancoMensal(viagem.id);
  var desp = res.despesas;
  var nomesParticipantesFinanceiro = _nomesParticipantesAtivos(viagem);
  var loc  = viagem.localizacaoCurta || viagem.destinoPrincipal || viagem.destino || '';
  var avisoSync = _renderAvisoSincronizacao();

  // ---- Cartão de contexto: viagem selecionada ----
  var cartaoViagem = (
    '<div class="card fin-trip-card" style="margin-bottom:var(--space-5)">' +
      '<div class="fin-trip-cover trip-card-cover trip-card-cover-' + viagem.capa + '"></div>' +
      '<div class="fin-trip-info">' +
        '<div class="fin-trip-top">' +
          '<div class="fin-trip-names">' +
            '<div class="fin-trip-nome">' + viagem.nome + '</div>' +
            (loc ? '<div class="fin-trip-loc">📍 ' + loc + '</div>' : '') +
          '</div>' +
          '<span class="badge ' + UI.badgeStatus(viagem.status) + '">' + UI.textoStatus(viagem.status) + '</span>' +
        '</div>' +
        '<div class="fin-trip-meta">' +
          '<span>💰 Orçamento: <strong>' + UI.formatarMoeda(res.orcamento) + '</strong></span>' +
          '<span>🧾 ' + desp.length + ' despesa' + (desp.length !== 1 ? 's' : '') + '</span>' +
          (nomesParticipantesFinanceiro.length ? '<span>👥 ' + nomesParticipantesFinanceiro.join(', ') + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<button type="button" class="btn btn-ghost btn-sm fin-trip-troca" title="Trocar viagem" onclick="TripSwitcher.abrir()">⇄ Trocar viagem</button>' +
    '</div>'
  );

  var kpis = (
    '<div class="stats-grid" style="margin-bottom:var(--space-5)">' +
      UI.renderStatCard('Orçamento', UI.formatarMoeda(res.orcamento), viagem.nome, 'stat-icon-blue', '💰') +
      UI.renderStatCard('Total gasto', UI.formatarMoeda(res.totalGasto), res.pct + '% do total', 'stat-icon-yellow', '💸') +
      UI.renderStatCard('Disponível', UI.formatarMoeda(res.saldo), res.saldo >= 0 ? 'Saldo positivo' : 'Orçamento estourado', res.saldo >= 0 ? 'stat-icon-green' : 'stat-icon-red', res.saldo >= 0 ? '✅' : '⚠️') +
      UI.renderStatCard('Despesas', String(desp.length), 'Lançamentos', 'stat-icon-blue', '🧾') +
    '</div>'
  );

  var barraGlobal = (
    '<div class="card" style="margin-bottom:var(--space-5)">' +
      '<div class="card-body">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2)">' +
          '<span class="text-sm font-semibold">Orçamento total utilizado</span>' +
          '<span class="text-sm font-bold">' + res.pct + '%</span>' +
        '</div>' +
        UI.progressBar(res.pct, UI.corBarra(res.pct)) +
        '<div style="display:flex;justify-content:space-between;margin-top:var(--space-2)">' +
          '<span class="text-xs text-muted">' + UI.formatarMoeda(res.totalGasto) + ' gastos</span>' +
          '<span class="text-xs text-secondary">de ' + UI.formatarMoeda(res.orcamento) + '</span>' +
        '</div>' +
        '<div class="expense-row" style="margin-top:var(--space-2)"><span class="text-sm text-secondary">Compromisso parcelado</span><strong>' + UI.formatarMoeda(res.compromissoParcelado || 0) + '</strong></div>' +
      '</div>' +
    '</div>'
  );

  var secCategorias = '';
  if (res.categorias.length > 0) {
    secCategorias = (
      UI.renderSectionHeader('Por categoria', '', '') +
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body">' +
          res.categorias.map(UI.renderBarraCategoria).join('') +
        '</div>' +
      '</div>'
    );
  }

  var secBalancoMensal = '';
  var detalhesBalanco = window._finBalancoDetalhes || {};
  var mostrarOutrosMeses = !!window._finBalancoOutrosMeses;

  function _mesAtualChave() {
    var hoje = new Date();
    var mes = String(hoje.getMonth() + 1).padStart(2, '0');
    return String(hoje.getFullYear()) + '-' + mes;
  }

  function _escBm(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _ordenarMeses(meses, chavAtual) {
    // Numeric key: YYYY-MM → number for stable chronological sort
    function chaveNum(chave) {
      var parts = String(chave || '').split('-');
      return (parseInt(parts[0], 10) || 0) * 100 + (parseInt(parts[1], 10) || 0);
    }
    var atual = chaveNum(chavAtual);
    var presentes = [], futuros = [], passados = [];
    (meses || []).forEach(function (mes) {
      var n = chaveNum(mes.chave);
      if (n === atual) presentes.push(mes);
      else if (n > atual) futuros.push(mes);
      else passados.push(mes);
    });
    futuros.sort(function (a, b) { return chaveNum(a.chave) - chaveNum(b.chave); }); // ASC
    passados.sort(function (a, b) { return chaveNum(b.chave) - chaveNum(a.chave); }); // DESC newest first
    return presentes.concat(futuros).concat(passados);
  }

  var _catChip = {
    deslocamento: { emoji: '🚗', label: 'Deslocamento' },
    transporte:   { emoji: '🚗', label: 'Transporte'   },
    hospedagem:   { emoji: '🏨', label: 'Hospedagem'   },
    alimentacao:  { emoji: '🍽️', label: 'Alimentação'  },
    passeio:      { emoji: '🎡', label: 'Passeio'       },
    compra:       { emoji: '🛍️', label: 'Compra'        },
    livre:        { emoji: '🌴', label: 'Livre'         },
    outro:        { emoji: '📌', label: 'Outro'         },
  };

  function _renderDetalheItem(d) {
    var chip = _catChip[d.categoria] || { emoji: '📌', label: d.categoria || 'Outro' };

    // Route expense: build compact directional title with smart icon per transport mode
    var titulo = _escBm(d.descricao);
    if (d.origemRota) {
      var destLabel = loc || 'da viagem';
      var _routeTipo = d.routeTipo || 'outro';
      // Icon map per mode: [neutral, ida, volta]
      var _modoIcones = {
        aereo:     { n: '✈️',  ida: '🛫', volta: '🛬', lbl: 'Aéreo'      },
        carro:     { n: '⛽',  ida: '⛽',  volta: '⛽',  lbl: 'Combustível' },
        van:       { n: '🚐',  ida: '🚐',  volta: '🚐',  lbl: 'Van'         },
        onibus:    { n: '🚌',  ida: '🚌',  volta: '🚌',  lbl: 'Ônibus'      },
        trem:      { n: '🚆',  ida: '🚆',  volta: '🚆',  lbl: 'Trem'        },
        barco:     { n: '⛵',  ida: '⛵',  volta: '⛵',  lbl: 'Barco'       },
        caminhada: { n: '🚶',  ida: '🚶',  volta: '🚶',  lbl: 'Caminhada'   },
        moto:      { n: '⛽',  ida: '⛽',  volta: '⛽',  lbl: 'Combustível' },
        outro:     { n: '🧭',  ida: '🧭',  volta: '🧭',  lbl: 'Rota'        },
      };
      var _modoInfo = _modoIcones[_routeTipo] || _modoIcones.outro;
      if (d.routeDirection === 'ida') {
        titulo = 'IDA p/ ' + _escBm(destLabel);
        chip = { emoji: _modoInfo.ida, label: _modoInfo.lbl };
      } else if (d.routeDirection === 'volta') {
        titulo = 'VOLTA de ' + _escBm(destLabel);
        chip = { emoji: _modoInfo.volta, label: _modoInfo.lbl };
      } else {
        titulo = 'Rota ' + _escBm(destLabel);
        chip = { emoji: _modoInfo.n, label: _modoInfo.lbl };
      }
    }

    var meta = '';
    if (d.totalParcelas > 1) {
      meta += 'Parcela ' + d.parcelaAtual + '/' + d.totalParcelas;
    }
    if (d.dataParcela) {
      var p = d.dataParcela.split('-');
      if (p.length === 3) {
        meta += (meta ? ' · ' : '') + p[2] + '/' + p[1] + '/' + p[0];
      }
    }
    return (
      '<div class="fin-bm-detail-item">' +
        '<div class="fin-bm-detail-chip">' + chip.emoji + '</div>' +
        '<div class="fin-bm-detail-main">' +
          '<div class="fin-bm-detail-title">' + titulo + '</div>' +
          (meta ? '<div class="fin-bm-detail-meta">' + _escBm(chip.label) + ' · ' + meta + '</div>' : '<div class="fin-bm-detail-meta">' + _escBm(chip.label) + '</div>') +
        '</div>' +
        '<div class="fin-bm-detail-amount">' + UI.formatarMoeda(d.valorParcela) + '</div>' +
      '</div>'
    );
  }

  function _renderMesCard(mes, destaqueAtual) {
    var detalhesAbertos = !!detalhesBalanco[mes.chave];
    var nPartic = (mes.participantesAtivos || []).length;

    var parcelasMes = mes.despesas && mes.despesas.length
      ? '<div class="fin-bm-detail-list">' + mes.despesas.map(_renderDetalheItem).join('') + '</div>'
      : '<div class="fin-bm-detail-vazio">Sem despesas neste mês.</div>';

    return (
      '<div class="card fin-bm-card' + (destaqueAtual ? ' fin-bm-card-atual' : '') + '">' +
        '<div class="card-body">' +
          '<div class="fin-bm-top">' +
            '<div class="fin-bm-title-wrap">' +
              '<div class="fin-bm-title">' + _escBm(mes.label) + (destaqueAtual ? ' <span class="fin-bm-badge">mês atual</span>' : '') + '</div>' +
            '</div>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-bm-toggle="' + mes.chave + '">' +
              (detalhesAbertos ? 'Ocultar despesas' : 'Ver despesas') +
            '</button>' +
          '</div>' +
          '<div class="fin-bm-headline">' +
            '<div class="fin-bm-kpi"><span>Total do mês</span><strong>' + UI.formatarMoeda(mes.totalMes) + '</strong></div>' +
            '<div class="fin-bm-kpi"><span>Participantes</span><strong>' + nPartic + '</strong></div>' +
            '<div class="fin-bm-kpi"><span>Parte por pessoa</span><strong>' + UI.formatarMoeda(mes.partePorPessoa) + '</strong></div>' +
          '</div>' +
          '<div class="fin-bm-summary">' +
            (mes.participantesAtivos || []).map(function (p) {
              return (
                '<div class="fin-bm-part-row">' +
                  '<span class="fin-bm-part-name">' + _escBm(p.nome) + '</span>' +
                  '<span class="fin-bm-part-valor">' + UI.formatarMoeda(mes.partePorPessoa) + '</span>' +
                '</div>'
              );
            }).join('') +
          '</div>' +
          '<div class="fin-bm-details' + (detalhesAbertos ? ' aberto' : '') + '">' +
            '<div class="fin-bm-detalhe-titulo">Parcelas/despesas no mês</div>' +
            parcelasMes +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  var chaveMesAtual = _mesAtualChave();
  var mesesOrdenados = _ordenarMeses(balancoMensal.meses, chaveMesAtual);
  var mesAtual = mesesOrdenados.find(function (mes) { return mes.chave === chaveMesAtual; }) || mesesOrdenados[0] || null;
  var outrosMeses = mesesOrdenados.filter(function (mes) {
    return mesAtual ? mes.chave !== mesAtual.chave : true;
  });

  if (!balancoMensal.meses.length) {
    secBalancoMensal = (
      UI.renderSectionHeader('Balanço mensal', '', '') +
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body">' +
          '<div class="fin-empty" style="padding:var(--space-5)">Nenhum compromisso mensal encontrado.</div>' +
        '</div>' +
      '</div>'
    );
  } else {
    secBalancoMensal = (
      UI.renderSectionHeader('Balanço mensal', '', '') +
      '<div class="fin-balanco-list" style="margin-bottom:var(--space-5)">' +
        (mesAtual ? _renderMesCard(mesAtual, true) : '<div class="card"><div class="card-body"><div class="fin-empty" style="padding:var(--space-5)">Nenhum compromisso mensal encontrado.</div></div></div>') +
        (outrosMeses.length
          ? (
            '<div class="fin-bm-others">' +
              '<button type="button" class="btn btn-ghost btn-sm" data-bm-toggle-outros="1">' + (mostrarOutrosMeses ? 'Ocultar outros meses' : 'Ver outros meses') + '</button>' +
              '<div class="fin-bm-others-list' + (mostrarOutrosMeses ? ' aberto' : '') + '">' +
                outrosMeses.map(function (mes) { return _renderMesCard(mes, false); }).join('') +
              '</div>' +
            '</div>'
          )
          : '') +
      '</div>'
    );
  }

  var listaDesp;
  if (desp.length === 0) {
    listaDesp = (
      '<div class="fin-empty">' +
        '<div style="font-size:2.5rem;margin-bottom:var(--space-3)">🧾</div>' +
        '<p class="font-semibold" style="margin-bottom:var(--space-1)">Nenhuma despesa registrada</p>' +
        '<p class="text-sm text-secondary" style="margin-bottom:var(--space-4)">Adicione a primeira despesa desta viagem.</p>' +
        '<button class="btn btn-primary btn-sm" onclick="DespesaModal.abrir(\'' + viagem.id + '\', null)">+ Nova despesa</button>' +
      '</div>'
    );
  } else {
    listaDesp = (
      '<div class="desp-list">' +
        desp.map(function (d) { return UI.renderDespesaItem(d, viagem.id); }).join('') +
      '</div>'
    );
  }

  var html = (
    '<div class="page-section">' +
      '<div class="section-header" style="margin-bottom:var(--space-4)">' +
        '<h2 class="section-title">Financeiro</h2>' +
        '<button class="btn btn-primary btn-sm" onclick="DespesaModal.abrir(\'' + viagem.id + '\', null)">+ Nova despesa</button>' +
      '</div>' +
      avisoSync +
      cartaoViagem +
      kpis +
      barraGlobal +
      secCategorias +
      secBalancoMensal +
      UI.renderSectionHeader('Despesas', '', '') +
      listaDesp +
    '</div>'
  );

  container.innerHTML = html;

  container.querySelectorAll('[data-bm-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var chave = btn.getAttribute('data-bm-toggle');
      var card = btn.closest('.fin-bm-card');
      if (!card) return;
      var detalhes = card.querySelector('.fin-bm-details');
      if (!detalhes) return;
      var aberto = detalhes.classList.toggle('aberto');
      btn.textContent = aberto ? 'Ocultar despesas' : 'Ver despesas';
      if (!window._finBalancoDetalhes) window._finBalancoDetalhes = {};
      window._finBalancoDetalhes[chave] = aberto;
    });
  });

  container.querySelectorAll('[data-bm-toggle-outros]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var lista = btn.parentElement && btn.parentElement.querySelector('.fin-bm-others-list');
      if (!lista) return;
      var aberto = lista.classList.toggle('aberto');
      btn.textContent = aberto ? 'Ocultar outros meses' : 'Ver outros meses';
      window._finBalancoOutrosMeses = aberto;
    });
  });
}

// ==== PÁGINA: Rotas ====
function paginaRotas(params, container) {
  var viagem = Store.getViagemSelecionada();
  if (!viagem) {
    container.innerHTML = (
      '<div class="page-section">' +
        '<div class="fin-empty">' +
          '<div style="font-size:2.5rem;margin-bottom:var(--space-3)">🛣️</div>' +
          '<p class="font-semibold" style="margin-bottom:var(--space-1)">Nenhuma viagem selecionada</p>' +
          '<p class="text-sm text-secondary" style="margin-bottom:var(--space-4)">Selecione uma viagem para visualizar as rotas.</p>' +
          '<a href="#/viagens" class="btn btn-primary btn-sm">Ir para viagens</a>' +
        '</div>' +
      '</div>'
    );
    return;
  }

  var resumo = Store.getResumoRotas(viagem.id);
  var trechosAtivos = Store.getRotas(viagem.id).slice().sort(function (a, b) {
    // Primary: data (YYYY-MM-DD string comparison)
    var da = a.data || '';
    var db = b.data || '';
    if (da < db) return -1;
    if (da > db) return 1;
    // Secondary: horario (HH:MM) — use chegadaHorario as tiebreaker
    var ha = a.horario || a.chegadaHorario || '00:00';
    var hb = b.horario || b.chegadaHorario || '00:00';
    if (ha < hb) return -1;
    if (ha > hb) return 1;
    // Tertiary: creation order preserved (stable sort in modern engines)
    return 0;
  });
  var loc = viagem.localizacaoCurta || viagem.destinoPrincipal || viagem.destino || '';
  var avisoSync = _renderAvisoSincronizacao();

  var cartaoViagem = (
    '<div class="card fin-trip-card" style="margin-bottom:var(--space-5)">' +
      '<div class="fin-trip-cover trip-card-cover trip-card-cover-' + viagem.capa + '"></div>' +
      '<div class="fin-trip-info">' +
        '<div class="fin-trip-top">' +
          '<div class="fin-trip-names">' +
            '<div class="fin-trip-nome">' + viagem.nome + '</div>' +
            (loc ? '<div class="fin-trip-loc">📍 ' + loc + '</div>' : '') +
          '</div>' +
          '<span class="badge ' + UI.badgeStatus(viagem.status) + '">' + UI.textoStatus(viagem.status) + '</span>' +
        '</div>' +
        '<div class="fin-trip-meta">' +
          '<span>🛣️ Trechos: <strong>' + resumo.trechos.length + '</strong></span>' +
          '<span>👥 ' + resumo.participantes + ' participante' + (resumo.participantes !== 1 ? 's' : '') + '</span>' +
        '</div>' +
      '</div>' +
      '<button type="button" class="btn btn-ghost btn-sm fin-trip-troca" onclick="TripSwitcher.abrir()">⇄ Trocar viagem</button>' +
    '</div>'
  );

  var kpis = (
    '<div class="stats-grid" style="margin-bottom:var(--space-5)">' +
      UI.renderStatCard('Total km', (resumo.totalKm || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km', 'Soma dos trechos', 'stat-icon-blue', '🛣️') +
      UI.renderStatCard('Tempo estimado', resumo.totalDuracaoTexto, 'Total da rota', 'stat-icon-green', '🕒') +
      UI.renderStatCard('Litros estimados', (resumo.totalLitros || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' L', 'Com base no consumo', 'stat-icon-yellow', '⛽') +
      UI.renderStatCard('Custo total', UI.formatarMoeda(resumo.custoTotal || 0), UI.formatarMoeda(resumo.custoPorPessoa || 0) + '/pessoa', 'stat-icon-blue', '💰') +
    '</div>'
  );

  var lista = '';
  if (!trechosAtivos.length) {
    lista = (
      '<div class="fin-empty" style="padding:var(--space-8) var(--space-5)">' +
        '<p class="font-semibold" style="margin-bottom:var(--space-1)">Nenhum trecho cadastrado para esta viagem.</p>' +
        '<p class="text-sm text-secondary" style="margin-bottom:var(--space-4)">Adicione o primeiro trecho da rota desta viagem.</p>' +
        '<button class="btn btn-primary btn-sm" onclick="TrechoModal.abrir(\'' + viagem.id + '\', null)">+ Novo trecho</button>' +
      '</div>'
    );
  } else {
    lista = (
      '<div class="rota-list">' +
        trechosAtivos.map(function (t) {
          var calc = resumo.trechos.find(function (x) { return x.id === t.id; }) || t;
          return UI.renderTrechoItem(calc, viagem.id);
        }).join('') +
      '</div>'
    );
  }

  var html = (
    '<div class="page-section">' +
      '<div class="section-header" style="margin-bottom:var(--space-4)">' +
        '<h2 class="section-title">Rotas</h2>' +
        '<button class="btn btn-primary btn-sm" onclick="TrechoModal.abrir(\'' + viagem.id + '\', null)">+ Novo trecho</button>' +
      '</div>' +
      avisoSync +
      cartaoViagem +
      kpis +
      UI.renderSectionHeader('Trechos', '', '') +
      lista +
    '</div>'
  );

  container.innerHTML = html;
}

// ==== PÁGINA: Configurações ====
// ---- Diagnósticos da camada de dados (para página Config) ----
function _renderDiagnosticosHtml() {
  function _esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var uid   = RB_AUTH_STATE.user ? RB_AUTH_STATE.user.uid : null;
  var email = RB_AUTH_STATE.user ? (RB_AUTH_STATE.user.email || '—') : '—';
  var env   = RB_DIAG_STATE.ambiente;
  var syncSt = SyncService.getSyncStatus();
  var cacheExiste = uid ? !!localStorage.getItem('rotaboa.cache.' + uid + '.v1') : false;
  var cacheSize = 0;
  if (cacheExiste) {
    try { cacheSize = Math.round((localStorage.getItem('rotaboa.cache.' + uid + '.v1') || '').length / 1024); } catch(e) {}
  }
  var pendente  = syncSt.pending ? 'Sim' : 'Não';
  var ultimaSync = syncSt.lastSyncAt ? new Date(syncSt.lastSyncAt).toLocaleString('pt-BR') : '—';
  var erroSync  = syncSt.lastError || '';
  var online    = navigator.onLine ? 'Online' : 'Offline';

  var rtdbStatusLabel = {
    loaded:  'Carregado do RTDB',
    cached:  'Cache local (RTDB indisponível)',
    offline: 'Offline',
    error:   'Erro',
    pending: 'Aguardando',
  }[RB_DIAG_STATE.rtdbStatus] || RB_DIAG_STATE.rtdbStatus;
  var rtdbCor = {
    loaded:  'var(--color-success,#16a34a)',
    cached:  'var(--color-warning,#d97706)',
    offline: 'var(--color-warning,#d97706)',
    error:   'var(--color-danger)',
    pending: '',
  }[RB_DIAG_STATE.rtdbStatus] || '';
  var ultimoCarregamento = RB_DIAG_STATE.lastLoadAt
    ? new Date(RB_DIAG_STATE.lastLoadAt).toLocaleString('pt-BR') : '—';
  var authInicio = RB_AUTH_STATE.initialized ? (uid ? 'Conectado' : 'Desconectado') : 'Aguardando';
  var authCor = uid ? 'var(--color-success,#16a34a)' : 'var(--color-danger)';

  function _linha(label, valor, cor) {
    return '<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--color-border,#f3f4f6);gap:8px">' +
      '<span class="text-xs text-secondary">' + _esc(label) + '</span>' +
      '<span class="text-xs font-semibold" style="text-align:right;word-break:break-all' + (cor ? ';color:' + cor : '') + '">' + _esc(valor) + '</span>' +
    '</div>';
  }

  return (
    _linha('Ambiente', env) +
    _linha('Auth', authInicio, authCor) +
    _linha('Usuário', uid ? email : 'Sem sessão', uid ? '' : 'var(--color-danger)') +
    _linha('UID', uid || '—') +
    _linha('Conexão', online, navigator.onLine ? 'var(--color-success,#16a34a)' : 'var(--color-danger)') +
    _linha('RTDB', rtdbStatusLabel + (RB_DIAG_STATE.rtdbStatusMsg ? ' — ' + RB_DIAG_STATE.rtdbStatusMsg : ''), rtdbCor) +
    _linha('Último carregamento', ultimoCarregamento) +
    _linha('Cache local (uid)', cacheExiste ? 'Presente (~' + cacheSize + ' KB)' : 'Ausente', cacheExiste ? '' : 'var(--color-warning,#d97706)') +
    _linha('Sincr. pendente', pendente, syncSt.pending ? 'var(--color-warning,#d97706)' : '') +
    _linha('Última sincronização', ultimaSync) +
    (erroSync ? _linha('Erro RTDB', erroSync, 'var(--color-danger)') : '') +
    '<div style="margin-top:var(--space-2);display:flex;gap:var(--space-2);flex-wrap:wrap">' +
      '<button class="btn btn-ghost btn-sm" onclick="_atualizarDiagnosticosConfig()">Atualizar</button>' +
      (uid ? '<button class="btn btn-ghost btn-sm" onclick="ConfigActions.sincronizarAgora()">Sincronizar agora</button>' : '') +
    '</div>'
  );
}

function _atualizarDiagnosticosConfig() {
  var el = document.getElementById('cfg-diagnostico-corpo');
  if (!el) return;
  el.innerHTML = _renderDiagnosticosHtml();
}

function paginaConfiguracoes(params, container) {
  var prefs = _lerPreferencias();
  var avisoSync = _renderAvisoSincronizacao();

  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _opt(val, label, atual) {
    return '<option value="' + val + '"' + (String(val) === String(atual) ? ' selected' : '') + '>' + label + '</option>';
  }

  var _tiposRota = [
    ['carro', 'Carro 🚗'], ['van', 'Van 🚐'], ['onibus', 'Ônibus 🚌'],
    ['aereo', 'Aéreo ✈️'], ['trem', 'Trem 🚆'], ['barco', 'Barco ⛵'],
    ['caminhada', 'Caminhada 🚶'], ['outro', 'Outro 🧭'],
  ];

  var html = (
    '<div class="page-section">' +

      '<div class="cfg-hero">' +
        '<h2 class="section-title" style="margin-bottom:var(--space-1)">Configurações</h2>' +
        '<p class="text-sm text-secondary">Ajuste preferências, Google Maps e dados locais.</p>' +
      '</div>' +

      avisoSync +

      '<div class="card cfg-account-card" style="margin-bottom:var(--space-5)">' +
        '<div class="cfg-account-info">' +
          '<div class="cfg-account-avatar">👤</div>' +
          '<div>' +
            (RB_AUTH_STATE.offlineMode
              ? '<div class="font-semibold text-sm">Modo offline</div><div class="text-xs text-secondary">Dados salvos neste dispositivo</div>'
              : '<div class="font-semibold text-sm">' + _esc(_nomeUsuarioAuth(RB_AUTH_STATE.user)) + '</div><div class="text-xs text-secondary">' + _esc((RB_AUTH_STATE.user && RB_AUTH_STATE.user.email) || '') + '</div>') +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:var(--space-2)">' +
          (RB_AUTH_STATE.user ? '<button class="btn btn-ghost btn-sm" onclick="AuthActions.sair()">Sair</button>' : '') +
          (RB_AUTH_STATE.offlineMode ? '<button class="btn btn-ghost btn-sm" onclick="ConfigActions.sairModoOffline()">Sair do modo offline</button>' : '') +
        '</div>' +
      '</div>' +

      '<div class="cfg-section-title">👤 Dados pessoais</div>' +
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body">' +
          '<div class="form-group">' +
            '<label class="form-label" for="pref-nome-usuario">Seu nome</label>' +
            '<input id="pref-nome-usuario" class="form-input" type="text" maxlength="80" placeholder="Como você se chama" value="' + _esc(prefs.nomeUsuario || '') + '">' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="cfg-section-title">⚙️ Preferências do app</div>' +
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body">' +
          '<div class="cfg-grid">' +
            '<div class="form-group">' +
              '<label class="form-label" for="pref-pagina-inicial">Página inicial</label>' +
              '<select id="pref-pagina-inicial" class="form-select">'+
                _opt('/inicio', 'Início', prefs.paginaInicialPadrao) +
                _opt('/viagens', 'Viagens', prefs.paginaInicialPadrao) +
                _opt('/roteiro', 'Roteiro', prefs.paginaInicialPadrao) +
                _opt('/financeiro', 'Financeiro', prefs.paginaInicialPadrao) +
                _opt('/rotas', 'Rotas', prefs.paginaInicialPadrao) +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label" for="pref-densidade">Densidade visual</label>' +
              '<select id="pref-densidade" class="form-select">'+
                _opt('confortavel', 'Confortável', prefs.densidadeVisual) +
                _opt('compacta', 'Compacta', prefs.densidadeVisual) +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label" for="pref-mostrar-valores">Valores financeiros na tela inicial</label>' +
              '<select id="pref-mostrar-valores" class="form-select">'+
                '<option value="sim"' + (prefs.mostrarValoresInicio !== false ? ' selected' : '') + '>Sim</option>' +
                '<option value="nao"' + (prefs.mostrarValoresInicio === false ? ' selected' : '') + '>Não</option>' +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label" for="pref-confirmar-exclusao">Confirmar antes de excluir</label>' +
              '<select id="pref-confirmar-exclusao" class="form-select">'+
                '<option value="sim"' + (prefs.confirmarAntesExcluir !== false ? ' selected' : '') + '>Sim</option>' +
                '<option value="nao"' + (prefs.confirmarAntesExcluir === false ? ' selected' : '') + '>Não</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div id="cfg-pref-status" class="text-xs text-muted" style="margin-top:var(--space-2)"></div>' +
        '</div>' +
      '</div>' +

      '<div class="cfg-section-title">🗓️ Viagens e roteiro</div>' +
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body">' +
          '<div class="cfg-grid">' +
            '<div class="form-group">' +
              '<label class="form-label" for="pref-ci-hora">Horário padrão de check-in</label>' +
              SmartTimePicker.render('pref-ci-hora', prefs.checkInPadrao || '14:00') +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label" for="pref-co-hora">Horário padrão de check-out</label>' +
              SmartTimePicker.render('pref-co-hora', prefs.checkOutPadrao || '12:00') +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label" for="pref-route-tipo">Tipo padrão de trecho</label>' +
              '<select id="pref-route-tipo" class="form-select">' +
                _tiposRota.map(function (p) { return _opt(p[0], p[1], prefs.routeTipoPadrao || 'carro'); }).join('') +
              '</select>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label" for="pref-consumo">Consumo médio padrão (km/L)</label>' +
              '<input id="pref-consumo" class="form-input" type="number" min="0" step="0.01" placeholder="Ex: 12" value="' + _esc(prefs.consumoPadrao) + '">' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label" for="pref-preco-comb">Preço padrão do combustível (R$/L)</label>' +
              '<input id="pref-preco-comb" class="form-input" type="number" min="0" step="0.01" placeholder="Ex: 6.20" value="' + _esc(prefs.precoCombustivelPadrao) + '">' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="cfg-section-title">📋 Templates de bagagem</div>' +
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body">' +
          '<p class="cfg-tpl-hint">Templates marcados podem ser editados diretamente na página de Bagagem.</p>' +
          '<div class="cfg-tpl-grid">' +
          (function () {
            var editaveis = Array.isArray(prefs.templatesEditaveis) ? prefs.templatesEditaveis : [];
            var builtins  = window.BAG_BUILT_IN_TEMPLATES || [];
            return builtins.map(function (t) {
              var checked = editaveis.indexOf(t.id) >= 0;
              var total = 0;
              (t.containers || []).forEach(function (c) {
                (c.grupos || []).forEach(function (g) { total += (g.itens || []).length; });
              });
              var emoji = (t.containers && t.containers[0] && t.containers[0].emoji) || '📋';
              return (
                '<label class="cfg-tpl-card' + (checked ? ' cfg-tpl-card-on' : '') + '">' +
                  '<input type="checkbox" class="cfg-tpl-cb" data-tpl-id="' + t.id + '"' + (checked ? ' checked' : '') + ' onchange="this.closest(\'.cfg-tpl-card\').classList.toggle(\'cfg-tpl-card-on\',this.checked)">' +
                  '<div class="cfg-tpl-card-emoji">' + emoji + '</div>' +
                  '<div class="cfg-tpl-card-body">' +
                    '<div class="cfg-tpl-card-nome">' + _esc(t.nome) + '</div>' +
                    '<div class="cfg-tpl-card-meta">' + _esc(t.descricao || '') + ' &nbsp;·&nbsp; ' + total + ' itens</div>' +
                  '</div>' +
                  '<div class="cfg-tpl-toggle">' +
                    '<div class="cfg-tpl-toggle-track"><div class="cfg-tpl-toggle-thumb"></div></div>' +
                  '</div>' +
                '</label>'
              );
            }).join('');
          }()) +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div style="margin-bottom:var(--space-5);display:flex;align-items:center;gap:var(--space-3)">' +
        '<button class="btn btn-primary" onclick="ConfigActions.salvarPreferencias(false)">Salvar preferências</button>' +
        '<span id="cfg-pref-status" class="text-xs text-muted"></span>' +
      '</div>' +

      '<div class="cfg-section-title">☁️ Backup na nuvem</div>' +
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body">' +
          (RB_AUTH_STATE.user
            ? '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center;margin-bottom:var(--space-3)">' +
                '<button class="btn btn-primary btn-sm" onclick="ConfigActions.criarBackup()">Criar backup agora</button>' +
                '<span class="text-xs text-muted">Backups ficam associados à sua conta no servidor.</span>' +
              '</div>' +
              '<div id="cfg-bkp-lista" class="text-xs text-muted">Carregando backups...</div>' +
              '<div id="cfg-bkp-status" class="text-xs text-muted" style="margin-top:var(--space-2)"></div>'
            : '<div class="text-xs text-secondary">Faça login para criar e restaurar backups na nuvem. Os backups são vinculados à sua conta e acessíveis em qualquer dispositivo.</div>') +
        '</div>' +
      '</div>' +

      '<div class="cfg-section-title">� Diagnóstico de dados</div>' +
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body" id="cfg-diagnostico-corpo">' +
          _renderDiagnosticosHtml() +
        '</div>' +
      '</div>' +

      (RB_AUTH_STATE.user
        ? '<div class="cfg-section-title">💾 Migração de dados</div>' +
          '<div class="card" style="margin-bottom:var(--space-5)">' +
            '<div class="card-body">' +
              '<p class="text-xs text-secondary" style="margin-bottom:var(--space-3)">Envia os dados armazenados neste dispositivo para sua conta na nuvem.<br>' +
              '<strong>Use apenas uma vez na migração inicial.</strong> Sobrescreve os dados do RTDB.</p>' +
              '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center">' +
                '<button class="btn btn-secondary btn-sm" onclick="ConfigActions.importarDadosLocais()">Enviar dados locais para minha conta</button>' +
                '<button class="btn btn-ghost btn-sm" onclick="ConfigActions.baixarDoRtdb()">↓ Baixar dados da nuvem</button>' +
              '</div>' +
              '<div id="cfg-migrar-status" class="text-xs text-muted" style="margin-top:var(--space-2)"></div>' +
            '</div>' +
          '</div>'
        : '') +

      '<div class="cfg-section-title">�🗑️ Dados locais</div>' +
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body">' +
          '<div class="text-xs text-secondary" style="margin-bottom:var(--space-3)">Remove todas as viagens, roteiro, despesas e rotas armazenados neste dispositivo.</div>' +
          '<button class="btn btn-ghost btn-sm" style="color:var(--color-danger)" onclick="ConfigActions.limparDadosLocais()">Limpar dados locais</button>' +
          '<div id="cfg-backup-status" class="text-xs text-muted" style="margin-top:var(--space-3)"></div>' +
        '</div>' +
      '</div>' +

    '</div>'
  );

  container.innerHTML = html;
  atualizarBadgeModoDadosHeader();
  if (RB_AUTH_STATE.user) {
    ConfigActions.carregarBackups();
  }
}

// ==== PÁGINA: Login ====
function paginaLogin(params, container) {
  if (_temAcessoPrivado()) {
    Router.navegar('#/inicio');
    return;
  }

  var html = (
    '<div class="page-section">' +
      '<div class="card" style="max-width:520px;margin:0 auto">' +
        '<div class="card-header"><span class="font-semibold">🔐 Entrar</span></div>' +
        '<div class="card-body">' +
          '<div class="form-group">' +
            '<label class="form-label form-label-required" for="login-email">Email</label>' +
            '<input id="login-email" class="form-input" type="email" autocomplete="email" placeholder="voce@exemplo.com">' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label form-label-required" for="login-senha">Senha</label>' +
            '<input id="login-senha" class="form-input" type="password" autocomplete="current-password" placeholder="••••••">' +
          '</div>' +
          '<div id="login-erro" class="text-xs" style="color:var(--color-danger);min-height:1rem"></div>' +
          '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-top:var(--space-2)">' +
            '<button id="btn-login-entrar" type="button" class="btn btn-primary btn-sm" onclick="AuthActions.entrar()">Entrar</button>' +
            '<button id="btn-login-criar" type="button" class="btn btn-secondary btn-sm" onclick="AuthActions.criarConta()">Criar conta</button>' +
            '<button id="btn-login-google" type="button" class="btn btn-ghost btn-sm" onclick="AuthActions.entrarGoogle()">Entrar com Google</button>' +
            '<button id="btn-login-offline" type="button" class="btn btn-ghost btn-sm" onclick="AuthActions.usarOfflineNesteDispositivo()">Usar offline neste dispositivo</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );

  container.innerHTML = html;
}

var ConfigActions = {
  _statusBackup: function (msg, erro) {
    var el = document.getElementById('cfg-backup-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = erro ? 'var(--color-danger)' : 'var(--color-text-muted)';
  },

  _statusSync: function (msg, erro) {
    var el = document.getElementById('cfg-sync-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = erro ? 'var(--color-danger)' : 'var(--color-text-muted)';
  },

  _statusPrefs: function (msg, erro) {
    var el = document.getElementById('cfg-pref-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = erro ? 'var(--color-danger)' : 'var(--color-text-muted)';
  },

  _statusMaps: function (msg, erro) {
    var el = document.getElementById('cfg-maps-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = erro ? 'var(--color-danger)' : 'var(--color-text-muted)';
  },

  _statusBkp: function (msg, erro) {
    var el = document.getElementById('cfg-bkp-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = erro ? 'var(--color-danger)' : 'var(--color-text-muted)';
  },

  criarBackup: async function () {
    if (!RB_AUTH_STATE.user) { _mostrarToast('Faça login para criar backups.'); return; }
    this._statusBkp('Criando backup...', false);
    var uid = RB_AUTH_STATE.user.uid;
    try {
      var payload = (function () {
        function _ler(k) {
          try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (e) { return null; }
        }
        return {
          trips: _ler(RB_LOCAL_KEYS.trips) || [],
          selectedTripId: localStorage.getItem(RB_LOCAL_KEYS.selectedTrip) || null,
          itineraries: _ler(RB_LOCAL_KEYS.itineraries) || {},
          expenses: _ler(RB_LOCAL_KEYS.expenses) || {},
          routes: _ler(RB_LOCAL_KEYS.routes) || {},
          preferences: _lerPreferencias(),
          appVersion: RB_APP_VERSION,
        };
      })();
      await FirebaseClient.criarBackupRtdb(uid, payload);
      this._statusBkp('✅ Backup criado com sucesso.', false);
      _mostrarToast('Backup criado.');
      await this.carregarBackups();
    } catch (e) {
      this._statusBkp('Falha ao criar backup: ' + String((e && (e.friendly || e.message)) || 'erro desconhecido'), true);
    }
  },

  carregarBackups: async function () {
    var lista = document.getElementById('cfg-bkp-lista');
    if (!lista || !RB_AUTH_STATE.user) return;
    lista.innerHTML = '<span class="text-muted">Carregando...</span>';
    try {
      var uid = RB_AUTH_STATE.user.uid;
      var backups = await FirebaseClient.listarBackupsRtdb(uid);
      if (!backups || backups.length === 0) {
        lista.innerHTML = '<span class="text-muted">Nenhum backup encontrado. Crie o primeiro acima.</span>';
        return;
      }
      var rows = backups.map(function (b) {
        var dtStr = b.createdAt ? new Date(b.createdAt).toLocaleString('pt-BR') : '—';
        var qtdViagens = (b.data && Array.isArray(b.data.trips)) ? b.data.trips.length : '?';
        var bId = String(b.id || '');
        return (
          '<div style="display:flex;align-items:center;justify-content:space-between;padding:var(--space-2) 0;border-bottom:1px solid var(--color-border,#e5e7eb)">' +
            '<div>' +
              '<div class="font-semibold text-sm">' + dtStr + '</div>' +
              '<div class="text-xs text-muted">' + qtdViagens + ' viagem(s) &middot; v' + String(b.appVersion || '—') + '</div>' +
            '</div>' +
            '<div style="display:flex;gap:var(--space-2)">' +
              '<button class="btn btn-secondary btn-sm" onclick="ConfigActions.restaurarBackup(\'' + bId + '\')">Restaurar</button>' +
              '<button class="btn btn-ghost btn-sm" style="color:var(--color-danger)" onclick="ConfigActions.excluirBackup(\'' + bId + '\')">Excluir</button>' +
            '</div>' +
          '</div>'
        );
      }).join('');
      lista.innerHTML = '<div style="max-height:320px;overflow-y:auto">' + rows + '</div>';
    } catch (e) {
      lista.textContent = 'Erro ao carregar backups.';
    }
  },

  restaurarBackup: async function (backupId) {
    if (!RB_AUTH_STATE.user || !backupId) return;
    var self = this;
    ConfirmModal.abrirComCallback(
      'Restaurar backup?',
      'Os dados atuais serão substituídos pelos dados deste backup. A página será recarregada.',
      async function () {
        self._statusBkp('Restaurando...', false);
        try {
          var uid = RB_AUTH_STATE.user.uid;
          var payload = await FirebaseClient.restaurarBackupRtdb(uid, backupId);
          if (!payload) { self._statusBkp('Backup sem dados válidos.', true); return; }

          var lsMap = {
            trips: RB_LOCAL_KEYS.trips,
            selectedTripId: RB_LOCAL_KEYS.selectedTrip,
            itineraries: RB_LOCAL_KEYS.itineraries,
            expenses: RB_LOCAL_KEYS.expenses,
            routes: RB_LOCAL_KEYS.routes,
            preferences: RB_PREFS_KEY,
          };
          Object.keys(lsMap).forEach(function (k) {
            if (!(k in payload)) return;
            var val = payload[k];
            localStorage.setItem(lsMap[k], typeof val === 'string' ? val : JSON.stringify(val));
          });

          SyncService.markPendingSync();
          self._statusBkp('Backup restaurado. Recarregando...', false);
          setTimeout(function () { window.location.reload(); }, 700);
        } catch (e) {
          self._statusBkp('Erro ao restaurar: ' + String((e && (e.friendly || e.message)) || ''), true);
        }
      }
    );
  },

  excluirBackup: async function (backupId) {
    if (!RB_AUTH_STATE.user || !backupId) return;
    var self = this;
    ConfirmModal.abrirComCallback(
      'Excluir backup?',
      'Esta ação não pode ser desfeita.',
      async function () {
        self._statusBkp('Excluindo...', false);
        try {
          await FirebaseClient.excluirBackupRtdb(RB_AUTH_STATE.user.uid, backupId);
          _mostrarToast('Backup excluído.');
          self._statusBkp('Backup excluído.', false);
          await self.carregarBackups();
        } catch (e) {
          self._statusBkp('Erro ao excluir: ' + String((e && (e.friendly || e.message)) || ''), true);
        }
      }
    );
  },

  limparDadosLocais: function () {
    if (!_confirmarExclusoesAtivo()) {
      Object.keys(RB_LOCAL_KEYS).forEach(function (k) {
        localStorage.removeItem(RB_LOCAL_KEYS[k]);
      });
      SyncService.markPendingSync();
      window.location.reload();
      return;
    }

    ConfirmModal.abrirComCallback(
      'Limpar dados locais?',
      'Esta ação remove viagens, roteiro, despesas, rotas e seleção atual do armazenamento local.',
      function () {
        Object.keys(RB_LOCAL_KEYS).forEach(function (k) {
          localStorage.removeItem(RB_LOCAL_KEYS[k]);
        });
        SyncService.markPendingSync();
        window.location.reload();
      }
    );
  },

  sincronizarAgora: async function () {
    this._statusSync('Sincronizando...', false);
    var r = await SyncService.syncLocalToCloud({ silent: false, source: 'manual' });
    atualizarBadgeModoDadosHeader();
    _atualizarDiagnosticosConfig();
    if (r && r.ok) {
      this._statusSync('Sincronização concluída.', false);
      if ((window.location.hash || '') === '#/config') {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
      return;
    }
    this._statusSync('Não foi possível sincronizar agora.', true);
  },

  importarDadosLocais: async function () {
    if (!RB_AUTH_STATE.user) { _mostrarToast('Faça login para importar dados.'); return; }
    var statusEl = document.getElementById('cfg-migrar-status');
    function _setStatus(msg, err) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.style.color = err ? 'var(--color-danger)' : 'var(--color-text-muted,#9ca3af)';
    }
    ConfirmModal.abrirComCallback(
      'Enviar dados locais?',
      'Os dados atuais na nuvem serão substituídos pelos dados deste dispositivo. Essa ação não pode ser desfeita.',
      async function () {
        _setStatus('Enviando…', false);
        var uid = RB_AUTH_STATE.user.uid;
        var r = await SyncService.pushToRtdb(uid, { silent: true, source: 'importar-manual' });
        if (r && r.ok) {
          _setStatus('✅ Dados enviados com sucesso.', false);
          _mostrarToast('Dados importados para sua conta.');
          _atualizarDiagnosticosConfig();
        } else {
          _setStatus('Falha ao enviar dados. Verifique a conexão.', true);
        }
      }
    );
  },

  baixarDoRtdb: async function () {
    if (!RB_AUTH_STATE.user) { _mostrarToast('Faça login para baixar dados.'); return; }
    var statusEl = document.getElementById('cfg-migrar-status');
    function _setStatus(msg, err) {
      if (!statusEl) return;
      statusEl.textContent = msg;
      statusEl.style.color = err ? 'var(--color-danger)' : 'var(--color-text-muted,#9ca3af)';
    }
    ConfirmModal.abrirComCallback(
      'Baixar dados da nuvem?',
      'Os dados deste dispositivo serão substituídos pelos dados da nuvem. A página será recarregada.',
      async function () {
        _setStatus('Baixando…', false);
        var uid = RB_AUTH_STATE.user.uid;
        var r = await SyncService.pullFromRtdb(uid);
        if (r && r.ok) {
          if (r.hasData) {
            _setStatus('✅ Dados baixados. Recarregando...', false);
            setTimeout(function () { window.dispatchEvent(new HashChangeEvent('hashchange')); }, 500);
          } else {
            _setStatus('⚠️ Nenhum dado encontrado na nuvem para esta conta.', false);
          }
          _atualizarDiagnosticosConfig();
        } else {
          _setStatus('Falha ao baixar dados. Verifique a conexão.', true);
        }
      }
    );
  },

  salvarPreferencias: function (silencioso) {
    var pagina    = document.getElementById('pref-pagina-inicial');
    var valores   = document.getElementById('pref-mostrar-valores');
    var confirmar = document.getElementById('pref-confirmar-exclusao');
    var densidade = document.getElementById('pref-densidade');
    var ciHora    = document.getElementById('pref-ci-hora');
    var coHora    = document.getElementById('pref-co-hora');
    var routeTipo = document.getElementById('pref-route-tipo');
    var consumo   = document.getElementById('pref-consumo');
    var precoComb = document.getElementById('pref-preco-comb');
    var syncAuto  = document.getElementById('pref-sync-auto');
    var syncInt   = document.getElementById('pref-sync-intervalo');
    var nomeUsr   = document.getElementById('pref-nome-usuario');

    var prefs = {};
    if (nomeUsr)   prefs.nomeUsuario            = String(nomeUsr.value || '').trim();
    if (pagina)    prefs.paginaInicialPadrao    = pagina.value;
    if (valores)   prefs.mostrarValoresInicio   = valores.value !== 'nao';
    if (confirmar) prefs.confirmarAntesExcluir  = confirmar.value !== 'nao';
    if (densidade) prefs.densidadeVisual        = densidade.value;
    if (ciHora)    prefs.checkInPadrao          = ciHora.value || '14:00';
    if (coHora)    prefs.checkOutPadrao         = coHora.value || '12:00';
    if (routeTipo) prefs.routeTipoPadrao        = routeTipo.value || 'carro';
    if (consumo)   prefs.consumoPadrao          = consumo.value;
    if (precoComb) prefs.precoCombustivelPadrao = precoComb.value;
    if (syncAuto)  prefs.syncAuto              = syncAuto.value !== 'nao';
    if (syncInt)   prefs.syncIntervalo         = Number(syncInt.value) || 1;

    // Collect editable-builtin-templates checkboxes
    var tplCbs = document.querySelectorAll('.cfg-tpl-cb');
    var editaveis = [];
    tplCbs.forEach(function (cb) { if (cb.checked) editaveis.push(cb.getAttribute('data-tpl-id')); });
    prefs.templatesEditaveis = editaveis;

    _salvarPreferencias(prefs);
    _aplicarDensidade();

    if (syncAuto || syncInt) {
      SyncService.startAutoSync();
    }

    // Feedback imediato sempre que o usuário clica Salvar
    this._statusPrefs('Preferências salvas.' + (RB_AUTH_STATE.user ? ' (nuvem)' : ''), false);
    _mostrarToast('Preferências salvas.');
    setTimeout(function () {
      var el = document.getElementById('cfg-pref-status');
      if (el) el.textContent = '';
    }, 3000);
  },

  _statusFirebase: function (msg, erro) {
    var el = document.getElementById('cfg-firebase-status');
    if (!el) return;
    el.textContent = msg || '';
    el.style.color = erro ? 'var(--color-danger)' : 'var(--color-text-muted)';
  },

  salvarFirebaseConfig: function () {
    var apiKey        = document.getElementById('cfg-fb-api-key');
    var authDomain    = document.getElementById('cfg-fb-auth-domain');
    var projectId     = document.getElementById('cfg-fb-project-id');
    var appId         = document.getElementById('cfg-fb-app-id');
    var storageBucket = document.getElementById('cfg-fb-storage-bucket');
    var dbUrl         = document.getElementById('cfg-fb-db-url');

    var cfg = {
      apiKey:            apiKey        ? String(apiKey.value        || '').trim() : '',
      authDomain:        authDomain    ? String(authDomain.value    || '').trim() : '',
      projectId:         projectId     ? String(projectId.value     || '').trim() : '',
      appId:             appId         ? String(appId.value         || '').trim() : '',
      storageBucket:     storageBucket ? String(storageBucket.value || '').trim() : '',
      databaseURL:       dbUrl         ? String(dbUrl.value         || '').trim() : '',
    };

    if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) {
      this._statusFirebase('Preencha pelo menos API Key, Auth Domain, Project ID e App ID.', true);
      return;
    }

    if (window.FirebaseClient && typeof FirebaseClient.saveFirebaseConfig === 'function') {
      FirebaseClient.saveFirebaseConfig(cfg);
    } else {
      localStorage.setItem('rotaboa.firebase.config.v1', JSON.stringify(cfg));
    }

    this._statusFirebase('✅ Configuração Firebase salva. Você já pode fazer login.', false);
    _mostrarToast('Configuração Firebase salva.');
    // Rerender page so badge atualiza
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  },

  sairModoOffline: function () {
    localStorage.removeItem(RB_OFFLINE_KEY);
    RB_AUTH_STATE.offlineMode = false;
    RB_AUTH_STATE.user = null;
    RB_AUTH_STATE.initialized = false;
    SyncService.stopAutoSync();
    atualizarHeaderAuthUI();
    atualizarBadgeModoDadosHeader();
    Router.navegar('#/login');
    setTimeout(function () { window.location.reload(); }, 50);
  },
};

var AuthActions = {
  _setErro: function (msg) {
    var el = document.getElementById('login-erro');
    if (el) el.textContent = msg || '';
  },

  _setLoading: function (ativo, botaoId, txtNormal, txtLoading) {
    var btn = document.getElementById(botaoId);
    if (!btn) return;
    btn.disabled = !!ativo;
    btn.textContent = ativo ? txtLoading : txtNormal;
  },

  _emailSenha: function () {
    var email = document.getElementById('login-email');
    var senha = document.getElementById('login-senha');
    return {
      email: email ? String(email.value || '').trim() : '',
      senha: senha ? String(senha.value || '') : '',
    };
  },

  entrar: async function () {
    this._setErro('');
    var dados = this._emailSenha();
    this._setLoading(true, 'btn-login-entrar', 'Entrar', 'Entrando...');
    try {
      await FirebaseClient.loginWithEmail(dados.email, dados.senha);
      localStorage.removeItem(RB_OFFLINE_KEY);
      RB_AUTH_STATE.offlineMode = false;
      // onAuthChange pós-boot cuida da navegação após o pull do RTDB
    } catch (e) {
      this._setErro(_mensagemErroAuth(e));
      this._setLoading(false, 'btn-login-entrar', 'Entrar', 'Entrando...');
    }
  },

  criarConta: async function () {
    this._setErro('');
    var dados = this._emailSenha();
    this._setLoading(true, 'btn-login-criar', 'Criar conta', 'Criando...');
    try {
      await FirebaseClient.registerWithEmail(dados.email, dados.senha);
      localStorage.removeItem(RB_OFFLINE_KEY);
      RB_AUTH_STATE.offlineMode = false;
      // onAuthChange pós-boot cuida da navegação
    } catch (e) {
      this._setErro(_mensagemErroAuth(e));
      this._setLoading(false, 'btn-login-criar', 'Criar conta', 'Criando...');
    }
  },

  entrarGoogle: async function () {
    this._setErro('');
    var host = window.location.hostname;
    var isLocalhost = (host === 'localhost' || host === '127.0.0.1' || host === '');
    var txtLoading = isLocalhost ? 'Conectando...' : 'Redirecionando...';
    this._setLoading(true, 'btn-login-google', 'Entrar com Google', txtLoading);
    try {
      var user = await FirebaseClient.loginWithGoogle();
      if (!user) {
        // Fluxo redirect: a página vai recarregar.
        // Mantém o botão desabilitado para evitar cliques repetidos.
        return;
      }
      // Popup (localhost): onAuthChange pós-boot cuida da navegação
    } catch (e) {
      this._setErro(_mensagemErroAuth(e));
      this._setLoading(false, 'btn-login-google', 'Entrar com Google', txtLoading);
    }
  },

  usarOfflineNesteDispositivo: function () {
    localStorage.setItem(RB_OFFLINE_KEY, 'true');
    RB_AUTH_STATE.offlineMode = true;
    RB_AUTH_STATE.user = null;
    RB_AUTH_STATE.initialized = true;
    atualizarHeaderAuthUI();
    atualizarBadgeModoDadosHeader();
    SyncService.startAutoSync();
    Router.navegar('#/inicio');
  },

  sair: async function () {
    try {
      await FirebaseClient.logoutUser();
      RB_AUTH_STATE.user = null;
      RB_AUTH_STATE.offlineMode = false;
      localStorage.removeItem(RB_OFFLINE_KEY);
      SyncService.stopAutoSync();
      atualizarHeaderAuthUI();
      atualizarBadgeModoDadosHeader();
      Router.navegar('#/login');
    } catch (e) {}
  },
};

// ==== Helper: clique no corpo do card navega para detalhe ====
function _bindTripCards(container) {
  var cards = container.querySelectorAll('.card-clickable[data-viagem-id]');
  cards.forEach(function (card) {
    card.addEventListener('click', function (e) {
      // Ignora cliques em elementos interativos internos
      if (e.target.closest('a, button')) return;
      var id = card.getAttribute('data-viagem-id');
      Store.selecionarViagem(id);
      Router.navegar('#/viagem/' + id);
    });
  });
}

// ================================================================
// TripModal — Modal de criação e edição de viagens
// ================================================================
var TripModal = (function () {
  var _editandoId = null;   // null = novo, string = edição
  var _overlay    = null;   // elemento DOM do overlay
  var _participantesDraft = [];

  // ---- Injeta o HTML do modal no body (chamado 1x na inicialização) ----
  function _inject() {
    var div = document.createElement('div');
    div.id = 'trip-modal-overlay';
    div.className = 'modal-overlay';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.setAttribute('aria-label', 'Formulário de viagem');
    div.innerHTML = (
      '<div class="modal-box" id="trip-modal-box">' +
        '<div class="modal-handle"></div>' +
        '<div class="modal-header">' +
          '<span class="modal-title" id="trip-modal-title">Nova viagem</span>' +
          '<button class="modal-close" onclick="TripModal.fechar()" aria-label="Fechar">✕</button>' +
        '</div>' +
        '<div class="modal-body" id="trip-modal-body"></div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-ghost" onclick="TripModal.fechar()">Cancelar</button>' +
          '<button class="btn btn-primary" id="trip-modal-save" onclick="TripModal.salvar()">Salvar viagem</button>' +
        '</div>' +
      '</div>'
    );
    // Fecha ao clicar fora da caixa
    div.addEventListener('click', function (e) {
      if (e.target === div) TripModal.fechar();
    });
    document.body.appendChild(div);
    _overlay = div;
  }

  // ---- Renderiza o formulário (com dados pré-preenchidos opcionalmente) ----
  function _renderForm(viagem) {
    viagem = viagem || {};
    function val(campo, fb) { return (viagem[campo] !== undefined ? viagem[campo] : (fb || '')); }
    function tags() {
      var t = viagem.tags;
      if (Array.isArray(t)) return t.join(', ');
      return t || '';
    }

    return (
      '<div class="form-group">' +
        '<label class="form-label form-label-required" for="f-nome">Nome da viagem</label>' +
        '<input id="f-nome" class="form-input" type="text" maxlength="80" placeholder="Ex: Chapada Diamantina" value="' + _esc(val('nome')) + '">' +
        '<span class="form-error" id="e-nome">Nome é obrigatório.</span>' +
      '</div>' +

      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="f-dest-principal">Destino principal</label>' +
          '<input id="f-dest-principal" class="form-input" type="text" maxlength="80" placeholder="Ex: Chapada Diamantina" value="' + _esc(val('destinoPrincipal', val('destino'))) + '">' +
          '<span class="form-error" id="e-dest-principal">Destino principal é obrigatório.</span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="f-loc-curta">Localização curta</label>' +
          '<input id="f-loc-curta" class="form-input" type="text" maxlength="80" placeholder="Ex: Lençóis, BA" value="' + _esc(val('localizacaoCurta', val('destino'))) + '">' +
          '<span class="form-error" id="e-loc-curta">Localização curta é obrigatória.</span>' +
        '</div>' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label" for="f-status">Status</label>' +
        '<select id="f-status" class="form-select">' +
          _opt('planejando',   'Planejando',    val('status', 'planejando')) +
          _opt('em-andamento', 'Em andamento',  val('status', 'planejando')) +
          _opt('concluida',    'Concluída',     val('status', 'planejando')) +
        '</select>' +
      '</div>' +

      '<div class="form-row form-row-datas">' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required">Data de início</label>' +
          _DTWidget.renderData('f-inicio', val('dataInicio') || new Date().toISOString().slice(0, 10)) +
          '<span class="form-error" id="e-inicio">Data de início obrigatória.</span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required">Data de fim</label>' +
          _DTWidget.renderData('f-fim', val('dataFim') || new Date().toISOString().slice(0, 10)) +
          '<span class="form-error" id="e-fim">Data de fim obrigatória.</span>' +
        '</div>' +
      '</div>' +

      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="f-orc">Orçamento (R$)</label>' +
          '<input id="f-orc" class="form-input" type="number" min="1" step="1" placeholder="5000" value="' + _esc(val('orcamento')) + '">' +
          '<span class="form-error" id="e-orc">Informe um valor maior que zero.</span>' +
        '</div>' +
      '</div>' +

      '<div class="form-group">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-2)">' +
          '<label class="form-label">Participantes da viagem</label>' +
          '<button type="button" class="btn btn-ghost btn-sm" onclick="TripModal.adicionarParticipante()">+ Adicionar participante</button>' +
        '</div>' +
        '<div id="trip-partic-list" style="display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-2)"></div>' +
        '<span class="text-xs text-muted" style="margin-top:4px;display:block">Esses nomes serão usados no financeiro e no rateio.</span>' +
        '<span class="form-error" id="e-partic">Inclua participantes válidos.</span>' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label" for="f-tags">Tags (separadas por vírgula)</label>' +
        '<input id="f-tags" class="form-input" type="text" placeholder="praia, natureza, cidade" value="' + _esc(tags()) + '">' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label" for="f-desc">Descrição curta</label>' +
        '<textarea id="f-desc" class="form-textarea" maxlength="300" placeholder="Descreva em poucas palavras o que a viagem inclui...">' + _esc(val('descricao')) + '</textarea>' +
      '</div>'
    );
  }

  function _normalizarParticipantesDraft(viagem) {
    if (viagem && Array.isArray(viagem.participantes) && viagem.participantes.length > 0) {
      return viagem.participantes.map(function (p, idx) {
        return {
          id: p && p.id ? String(p.id) : ('part-local-' + idx + '-' + Date.now()),
          nome: String((p && p.nome) || '').trim(),
          ativo: !p || p.ativo !== false,
        };
      });
    }
    var qtd = Math.max(1, Number(viagem && viagem.participantes) || 1);
    var lista = [];
    var prefs = _lerPreferencias();
    var nomeBase = String(prefs.nomeUsuario || '').trim() || null;
    for (var i = 1; i <= qtd; i++) {
      var nome = (i === 1 && nomeBase) ? nomeBase : 'Pessoa ' + i;
      lista.push({ id: 'part-local-' + i + '-' + Date.now(), nome: nome, ativo: true });
    }
    return lista;
  }

  function _erroParticipantes(mostrar, mensagem) {
    var el = document.getElementById('e-partic');
    if (!el) return;
    if (mensagem) el.textContent = mensagem;
    if (mostrar) el.classList.add('visivel');
    else el.classList.remove('visivel');
  }

  function _renderParticipantesEditor() {
    var alvo = document.getElementById('trip-partic-list');
    if (!alvo) return;
    alvo.innerHTML = _participantesDraft.map(function (p, idx) {
      return (
        '<div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:var(--space-2);align-items:center">' +
          '<input class="form-input" type="text" maxlength="60" placeholder="Nome do participante" value="' + _esc(p.nome) + '" oninput="TripModal.atualizarNomeParticipante(' + idx + ', this.value)">' +
          '<label class="desp-check-label" style="justify-content:center;min-width:88px">' +
            '<input type="checkbox" ' + (p.ativo ? 'checked' : '') + ' onchange="TripModal.alternarAtivoParticipante(' + idx + ', this.checked)"> Ativo' +
          '</label>' +
          '<button type="button" class="btn btn-ghost btn-sm" onclick="TripModal.removerParticipante(' + idx + ')" ' + (_participantesDraft.length <= 1 ? 'disabled' : '') + '>Remover</button>' +
        '</div>'
      );
    }).join('');
  }

  // ---- Utilitário: option selecionado ----
  function _opt(valor, label, atual) {
    return '<option value="' + valor + '"' + (atual === valor ? ' selected' : '') + '>' + label + '</option>';
  }

  // ---- Escapa HTML básico para evitar XSS nos values ----
  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ---- Mostra/esconde erro de campo (id = chave curta, ex: 'nome' → 'e-nome' / 'f-nome') ----
  function _erro(id, mostrar) {
    var el  = document.getElementById('e-' + id);
    var inp = document.getElementById('f-' + id);
    if (!el) return;
    if (mostrar) {
      el.classList.add('visivel');
      if (inp) inp.classList.add('invalido');
    } else {
      el.classList.remove('visivel');
      if (inp) inp.classList.remove('invalido');
    }
  }

  // ---- Limpa todos os erros ----
  function _limparErros() {
    ['nome','dest-principal','loc-curta','inicio','fim','orc'].forEach(function (k) { _erro(k, false); });
    _erroParticipantes(false);
  }

  // ---- Valida o formulário ----
  function _validar() {
    _limparErros();
    var ok = true;

    var nome = document.getElementById('f-nome');
    if (!nome || !nome.value.trim()) { _erro('nome', true); ok = false; }

    var destPrincipal = document.getElementById('f-dest-principal');
    if (!destPrincipal || !destPrincipal.value.trim()) { _erro('dest-principal', true); ok = false; }

    var locCurta = document.getElementById('f-loc-curta');
    if (!locCurta || !locCurta.value.trim()) { _erro('loc-curta', true); ok = false; }

    var inicioVal = _DTWidget.lerData('f-inicio');
    if (!inicioVal) { _erro('inicio', true); ok = false; }

    var fimVal = _DTWidget.lerData('f-fim');
    if (!fimVal) { _erro('fim', true); ok = false; }

    if (inicioVal && fimVal && fimVal < inicioVal) {
      var errFim = document.getElementById('e-fim');
      if (errFim) errFim.textContent = 'A data de fim não pode ser antes da data de início.';
      _erro('fim', true);
      ok = false;
    }

    var orc = document.getElementById('f-orc');
    if (!orc || !orc.value || Number(orc.value) <= 0) { _erro('orc', true); ok = false; }

    var ativosLista = _participantesDraft.filter(function (p) { return p && p.ativo !== false; });
    var nomesAtivos = ativosLista.map(function (p) {
      return String((p && p.nome) || '').trim();
    });
    if (!nomesAtivos.length) {
      _erroParticipantes(true, 'Mantenha ao menos 1 participante ativo.');
      ok = false;
    }

    if (nomesAtivos.some(function (n) { return !n; })) {
      _erroParticipantes(true, 'Preencha o nome de todos os participantes ativos.');
      ok = false;
    }

    var nomesNorm = nomesAtivos.map(function (n) { return n.toLowerCase(); });
    var unico = nomesNorm.every(function (n, idx) { return nomesNorm.indexOf(n) === idx; });
    if (!unico) {
      _erroParticipantes(true, 'Não repita nomes entre participantes ativos.');
      ok = false;
    }

    return ok;
  }

  // ---- API pública ----
  return {

    init: _inject,

    // Abre modal para criar (sem id) ou editar (com id)
    abrir: function (id) {
      _editandoId = id || null;
      var viagem = id ? Store.getViagens().find(function (v) { return v.id === id; }) : null;
      _participantesDraft = _normalizarParticipantesDraft(viagem);

      document.getElementById('trip-modal-title').textContent = id ? 'Editar viagem' : 'Nova viagem';
      document.getElementById('trip-modal-save').textContent  = id ? 'Salvar alterações' : 'Salvar viagem';
      document.getElementById('trip-modal-body').innerHTML    = _renderForm(viagem);
      _renderParticipantesEditor();

      _overlay.classList.add('aberto');
      document.body.style.overflow = 'hidden';

      // Foca no primeiro campo
      var primeiroInput = document.getElementById('f-nome');
      if (primeiroInput) setTimeout(function () { primeiroInput.focus(); }, 300);
    },

    fechar: function () {
      _overlay.classList.remove('aberto');
      document.body.style.overflow = '';
      _editandoId = null;
      _participantesDraft = [];
    },

    adicionarParticipante: function () {
      _participantesDraft.push({ id: 'part-local-' + Date.now(), nome: '', ativo: true });
      _renderParticipantesEditor();
      _erroParticipantes(false);
    },

    removerParticipante: function (idx) {
      if (_participantesDraft.length <= 1) return;
      _participantesDraft.splice(idx, 1);
      _renderParticipantesEditor();
    },

    atualizarNomeParticipante: function (idx, valor) {
      if (!_participantesDraft[idx]) return;
      _participantesDraft[idx].nome = String(valor || '').trimStart();
      _erroParticipantes(false);
    },

    alternarAtivoParticipante: function (idx, ativo) {
      if (!_participantesDraft[idx]) return;
      _participantesDraft[idx].ativo = !!ativo;
      _erroParticipantes(false);
    },

    // Coleta dados, valida e persiste
    salvar: function () {
      if (!_validar()) return;

      var tagsRaw  = (document.getElementById('f-tags').value || '').split(',');
      var tagsLista = tagsRaw.map(function (t) { return t.trim(); }).filter(Boolean);

      var destPrincipal = document.getElementById('f-dest-principal').value.trim();
      var locCurta      = document.getElementById('f-loc-curta').value.trim();

      var dados = {
        nome:              document.getElementById('f-nome').value.trim(),
        destinoPrincipal:  destPrincipal,
        localizacaoCurta:  locCurta,
        destino:           locCurta || destPrincipal, // compatibilidade retroativa
        status:            document.getElementById('f-status').value,
        dataInicio:    _DTWidget.lerData('f-inicio'),
        dataFim:       _DTWidget.lerData('f-fim'),
        orcamento:     Number(document.getElementById('f-orc').value),
        participantes: _participantesDraft.map(function (p) {
          return {
            id: p.id || ('part-local-' + Date.now()),
            nome: String(p.nome || '').trim(),
            ativo: p.ativo !== false,
          };
        }),
        tags:          tagsLista,
        descricao:     document.getElementById('f-desc').value.trim(),
      };

      if (_editandoId) {
        Store.editarViagem(_editandoId, dados);
      } else {
        Store.criarViagem(dados);
      }

      TripModal.fechar();

      // Re-renderiza a página atual
      var hash = window.location.hash || '#/viagens';
      // Força re-renderização mesmo que o hash não mude
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    },
  };
})();

// ================================================================
// ConfirmModal — Diálogo de confirmação de exclusão
// ================================================================
var ConfirmModal = (function () {
  var _overlay         = null;
  var _pendingId       = null;
  var _pendingCallback = null;   // callback genérico (para atividades etc.)

  function _inject() {
    var div = document.createElement('div');
    div.id = 'confirm-modal-overlay';
    div.className = 'modal-overlay';
    div.setAttribute('role', 'alertdialog');
    div.setAttribute('aria-label', 'Confirmação de exclusão');
    div.innerHTML = (
      '<div class="confirm-box">' +
        '<div class="confirm-icon">🗑️</div>' +
        '<div class="confirm-title" id="confirm-title">Excluir?</div>' +
        '<p class="confirm-desc" id="confirm-desc">Esta ação não pode ser desfeita.</p>' +
        '<div class="confirm-actions">' +
          '<button class="btn btn-ghost" onclick="ConfirmModal.fechar()">Cancelar</button>' +
          '<button class="btn btn-danger" onclick="ConfirmModal.confirmar()">Excluir</button>' +
        '</div>' +
      '</div>'
    );
    div.addEventListener('click', function (e) {
      if (e.target === div) ConfirmModal.fechar();
    });
    document.body.appendChild(div);
    _overlay = div;
  }

  return {
    init: _inject,

    // Exclusão de viagem (uso original)
    abrir: function (id, nomeViagem) {
      _pendingId       = id;
      _pendingCallback = null;
      var title = document.getElementById('confirm-title');
      var desc  = document.getElementById('confirm-desc');
      if (title) title.textContent = 'Excluir viagem?';
      if (desc)  desc.textContent  = 'Excluir "' + nomeViagem + '"? Esta ação não pode ser desfeita.';
      _overlay.classList.add('aberto');
      document.body.style.overflow = 'hidden';
    },

    // Confirmação genérica com callback
    abrirComCallback: function (titulo, descricao, callback) {
      _pendingId       = null;
      _pendingCallback = callback;
      var title = document.getElementById('confirm-title');
      var desc  = document.getElementById('confirm-desc');
      if (title) title.textContent = titulo;
      if (desc)  desc.textContent  = descricao;
      _overlay.classList.add('aberto');
      document.body.style.overflow = 'hidden';
    },

    fechar: function () {
      _overlay.classList.remove('aberto');
      document.body.style.overflow = '';
      _pendingId = _pendingCallback = null;
    },

    confirmar: function () {
      if (_pendingCallback) {
        var cb = _pendingCallback;
        ConfirmModal.fechar();
        cb();
      } else if (_pendingId) {
        Store.excluirViagem(_pendingId);
        ConfirmModal.fechar();
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    },
  };
})();

// ================================================================
// TripActions — Ações nos cards de viagem (chamadas via onclick)
// ================================================================
var TripActions = {
  abrirDetalhes: function (id) {
    Store.selecionarViagem(id);
    Router.navegar('#/viagem/' + id);
  },

  selecionar: function (id) {
    Store.selecionarViagem(id);
    // Re-renderiza a página atual para atualizar o badge de seleção
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  },

  editar: function (id) {
    TripModal.abrir(id);
  },

  excluir: function (id) {
    var viagem = Store.getViagens().find(function (v) { return v.id === id; });
    var nome = viagem ? viagem.nome : 'esta viagem';
    if (!_confirmarExclusoesAtivo()) {
      Store.excluirViagem(id);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    ConfirmModal.abrir(id, nome);
  },
};

// ================================================================
// TripSwitcher — Troca de viagem sem sair da página atual
// ================================================================
var TripSwitcher = (function () {
  var _overlay = null;

  function _inject() {
    var div = document.createElement('div');
    div.id = 'trip-switcher-overlay';
    div.className = 'modal-overlay';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.setAttribute('aria-label', 'Trocar viagem');
    div.innerHTML = (
      '<div class="modal-box" id="trip-switcher-box">' +
        '<div class="modal-handle"></div>' +
        '<div class="modal-header">' +
          '<span class="modal-title">Trocar viagem</span>' +
          '<button class="modal-close" onclick="TripSwitcher.fechar()" aria-label="Fechar">✕</button>' +
        '</div>' +
        '<div class="modal-body" id="trip-switcher-body"></div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-ghost" onclick="TripSwitcher.fechar()">Fechar</button>' +
        '</div>' +
      '</div>'
    );
    div.addEventListener('click', function (e) {
      if (e.target === div) TripSwitcher.fechar();
    });
    document.body.appendChild(div);
    _overlay = div;
  }

  function _renderLista() {
    var viagens = Store.getViagens() || [];
    var atual = Store.getViagemSelecionada();

    if (!viagens.length) {
      return '<div class="itin-empty-day">Nenhuma viagem cadastrada.</div>';
    }

    return (
      '<div style="display:flex;flex-direction:column;gap:var(--space-2)">' +
        viagens.map(function (v) {
          var ativa = atual && atual.id === v.id;
          var loc = v.localizacaoCurta || v.destinoPrincipal || v.destino || '';
          return (
            '<button type="button" class="btn ' + (ativa ? 'btn-primary' : 'btn-ghost') + '" ' +
              'style="justify-content:space-between;width:100%" ' +
              'onclick="TripSwitcher.selecionar(\'' + v.id + '\')">' +
              '<span style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0">' +
                '<span style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">' + v.nome + '</span>' +
                (loc ? '<span style="font-size:var(--text-xs);opacity:.85">📍 ' + loc + '</span>' : '') +
              '</span>' +
              '<span class="badge ' + (ativa ? 'badge-ok' : 'badge-neutral') + '">' + (ativa ? 'Atual' : 'Selecionar') + '</span>' +
            '</button>'
          );
        }).join('') +
      '</div>'
    );
  }

  return {
    init: _inject,

    abrir: function () {
      if (!_overlay) return;
      var body = document.getElementById('trip-switcher-body');
      if (body) body.innerHTML = _renderLista();
      _overlay.classList.add('aberto');
      document.body.style.overflow = 'hidden';
    },

    fechar: function () {
      if (!_overlay) return;
      _overlay.classList.remove('aberto');
      document.body.style.overflow = '';
    },

    selecionar: function (tripId) {
      var atual = Store.getViagemSelecionada();
      if (!tripId || (atual && atual.id === tripId)) {
        TripSwitcher.fechar();
        return;
      }
      Store.selecionarViagem(tripId);
      TripSwitcher.fechar();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    },
  };
})();

// ================================================================
// Categorias de atividade/despesa — lista centralizada
// ================================================================
var _APP_CATS = [
  ['alimentacao', 'Alimentação',  '🍽️'],
  ['aventura',    'Aventura',     '🧗'],
  ['cachoeira',   'Cachoeira',    '💧'],
  ['compra',      'Compra',       '🛍️'],
  ['cultura',     'Cultura',      '🏛️'],
  ['descanso',    'Descanso',     '😴'],
  ['deslocamento','Deslocamento', '🚗'],
  ['emergencia',  'Emergência',   '🚑'],
  ['evento',      'Evento',       '🎟️'],
  ['hospedagem',  'Hospedagem',   '🏨'],
  ['livre',       'Livre',        '🌴'],
  ['natureza',    'Natureza',     '🌿'],
  ['noturno',     'Noturno',      '🌇'],
  ['outro',       'Outro',        '📌'],
  ['passeio',     'Passeio',      '🎡'],
  ['praia',       'Praia',        '🏖️'],
  ['restaurante', 'Restaurante',  '🍽️'],
  ['trilha',      'Trilha',       '🥾'],
];

// ================================================================
// CustomSelect — Custom dropdown that replaces native <select>
// ================================================================
var CustomSelect = (function () {
  var _currentId  = null;   // id of the select currently open
  var _optsMap    = {};     // id → [[slug, label, emoji], ...]
  var _overlayEl  = null;   // single shared overlay element

  /* ── Build / retrieve the shared overlay DOM node ── */
  function _getOverlay() {
    if (_overlayEl) return _overlayEl;
    _overlayEl = document.createElement('div');
    _overlayEl.id        = 'csel-overlay';
    _overlayEl.className = 'csel-overlay';
    _overlayEl.setAttribute('role', 'dialog');
    _overlayEl.setAttribute('aria-modal', 'true');
    // Backdrop tap → close
    _overlayEl.addEventListener('click', function (e) {
      if (e.target === _overlayEl) CustomSelect._closeAll();
    });
    // ESC key anywhere
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && _currentId) CustomSelect._closeAll();
    });
    document.body.appendChild(_overlayEl);
    return _overlayEl;
  }

  /* ── Refresh the button face after a selection ── */
  function _updateBtn(id, val) {
    var btn = document.getElementById('csel-btn-' + id);
    if (!btn) return;
    var lbl  = btn.querySelector('.csel-label');
    if (!lbl) return;
    var opts = _optsMap[id] || [];
    var found = null;
    for (var i = 0; i < opts.length; i++) {
      if (opts[i][0] === val) { found = opts[i]; break; }
    }
    if (found && val) {
      lbl.innerHTML = '<span class="csel-emoji">' + found[2] + '</span><span class="csel-lbl-text">' + found[1] + '</span>';
      btn.classList.remove('csel-placeholder');
    } else {
      lbl.innerHTML = '<span class="csel-ph">' + (btn.getAttribute('data-ph') || 'Selecione...') + '</span>';
      btn.classList.add('csel-placeholder');
    }
  }

  /* ── Populate the grid inside the open sheet ── */
  function _buildGrid(id, filter) {
    var sheet = _overlayEl && _overlayEl.querySelector('.csel-sheet');
    var grid  = sheet && sheet.querySelector('.csel-grid');
    if (!grid) return;
    var opts   = _optsMap[id] || [];
    var hidden = document.getElementById(id);
    var curVal = hidden ? hidden.value : '';
    var q = (filter || '').toLowerCase().trim();
    var html = '';
    var count = 0;
    for (var i = 0; i < opts.length; i++) {
      var o = opts[i], slug = o[0], lbl = o[1], emoji = o[2];
      if (q && lbl.toLowerCase().indexOf(q) === -1 && slug.indexOf(q) === -1) continue;
      var isSel = slug === curVal;
      html += '<button type="button" class="csel-item' + (isSel ? ' csel-item-sel' : '') + '"' +
              ' data-val="' + slug + '"' +
              ' onclick="CustomSelect._select(\'' + id + '\',\'' + slug + '\')"' +
              ' onkeydown="CustomSelect._kItem(event,\'' + id + '\')">' +
              '<span class="csel-item-emoji">' + emoji + '</span>' +
              '<span class="csel-item-lbl">' + lbl + '</span>' +
              (isSel ? '<span class="csel-item-check">✓</span>' : '') +
              '</button>';
      count++;
    }
    if (!count) {
      html = '<p class="csel-empty">Nenhuma categoria encontrada</p>';
    }
    grid.innerHTML = html;
    if (!filter) {
      setTimeout(function () {
        var sel = grid.querySelector('.csel-item-sel');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
      }, 60);
    }
  }

  return {
    /* ── render() — side-effect: caches opts; returns HTML string ── */
    render: function (id, opts, selectedVal, placeholder, onchangeExpr) {
      _optsMap[id] = opts;  // cache for _toggle
      selectedVal  = selectedVal  || '';
      placeholder  = placeholder  || 'Selecione...';
      var found = null;
      for (var i = 0; i < opts.length; i++) {
        if (opts[i][0] === selectedVal) { found = opts[i]; break; }
      }
      var labelHtml = found
        ? '<span class="csel-emoji">' + found[2] + '</span><span class="csel-lbl-text">' + found[1] + '</span>'
        : '<span class="csel-ph">' + placeholder + '</span>';
      return (
        '<div class="csel-wrap" id="csel-wrap-' + id + '">' +
          '<button type="button" class="csel-btn' + (found ? '' : ' csel-placeholder') + '"' +
            ' id="csel-btn-' + id + '"' +
            ' data-ph="' + placeholder + '"' +
            ' aria-haspopup="dialog" aria-expanded="false"' +
            ' onclick="CustomSelect._toggle(\'' + id + '\')">' +
            '<span class="csel-label">' + labelHtml + '</span>' +
            '<span class="csel-arrow" aria-hidden="true">▾</span>' +
          '</button>' +
          '<input type="hidden" id="' + id + '" value="' + selectedVal + '"' +
            (onchangeExpr ? ' data-onchange="' + onchangeExpr.replace(/"/g, '&quot;') + '"' : '') + '>' +
        '</div>'
      );
    },

    /* ── Open the bottom-sheet overlay for the given select ── */
    _toggle: function (id) {
      if (_currentId === id) { CustomSelect._closeAll(); return; }
      if (_currentId) CustomSelect._closeAll();
      var ov = _getOverlay();
      ov.innerHTML =
        '<div class="csel-sheet" id="csel-sheet">' +
          '<div class="csel-handle"></div>' +
          '<p class="csel-title">Selecione a categoria</p>' +
          '<div class="csel-search-wrap">' +
            '<span class="csel-search-ico">🔍</span>' +
            '<input type="text" class="csel-search" placeholder="Buscar…" autocomplete="off"' +
              ' oninput="CustomSelect._filter(\'' + id + '\',this.value)"' +
              ' onkeydown="CustomSelect._kSearch(event,\'' + id + '\')">' +
          '</div>' +
          '<div class="csel-grid" role="listbox"></div>' +
        '</div>';
      _buildGrid(id, '');
      ov.classList.add('csel-open');
      _currentId = id;
      var btn = document.getElementById('csel-btn-' + id);
      if (btn) btn.setAttribute('aria-expanded', 'true');
      var searchEl = ov.querySelector('.csel-search');
      if (searchEl) setTimeout(function () { searchEl.focus(); }, 60);
    },

    /* ── Live search filter ── */
    _filter: function (id, q) { _buildGrid(id, q); },

    /* ── Keyboard: search input ── */
    _kSearch: function (e, id) {
      if (e.key === 'Escape') { e.preventDefault(); CustomSelect._closeAll(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        var first = _overlayEl && _overlayEl.querySelector('.csel-item');
        if (first) first.focus();
      }
    },

    /* ── Keyboard: grid items ── */
    _kItem: function (e, id) {
      var items = _overlayEl
        ? Array.prototype.slice.call(_overlayEl.querySelectorAll('.csel-item'))
        : [];
      var idx = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (items[idx + 1]) items[idx + 1].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx <= 0) {
          var s = _overlayEl && _overlayEl.querySelector('.csel-search');
          if (s) s.focus();
        } else { items[idx - 1].focus(); }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        CustomSelect._closeAll();
      }
    },

    /* ── Confirm a selection ── */
    _select: function (id, val) {
      var hidden = document.getElementById(id);
      if (!hidden) return;
      hidden.value = val;
      _updateBtn(id, val);
      var cb = hidden.getAttribute('data-onchange') || '';
      if (cb) { try { (new Function(cb))(); } catch (ex) { console.warn('csel cb:', ex); } }
      try { hidden.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
      CustomSelect._closeAll();
      var btn = document.getElementById('csel-btn-' + id);
      if (btn) { btn.focus(); }
    },

    /* ── Close overlay ── */
    _closeAll: function () {
      if (!_currentId) return;
      var ov  = _overlayEl;
      var btn = document.getElementById('csel-btn-' + _currentId);
      if (ov)  ov.classList.remove('csel-open');
      if (btn) { btn.classList.remove('csel-open'); btn.setAttribute('aria-expanded', 'false'); }
      _currentId = null;
    },

    // Legacy shim — some inline onkeydown="CustomSelect._key(...)" may still exist
    _key: function (e, id) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); CustomSelect._toggle(id); }
      if (e.key === 'Escape') CustomSelect._closeAll();
    }
  };
})();


/* ================================================================
   _scrollToSaved — scroll suave até o elemento recém-criado / editado
   selector: CSS selector do elemento alvo
   ================================================================ */
function _scrollToSaved(selector) {
  // Re-render is synchronous after hashchange; give the browser one paint
  setTimeout(function () {
    var el = document.querySelector(selector);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Flash highlight so the user sees exactly which item was saved
    el.classList.add('just-saved');
    setTimeout(function () { el.classList.remove('just-saved'); }, 1800);
  }, 80);
}

/* ----------------------------------------------------------------
   Helpers globais de hora/duração (usados por AtividadeModal + rota)
   ---------------------------------------------------------------- */
function _horaToMinG(h) {
  var p = String(h || '').split(':');
  return p.length === 2 ? parseInt(p[0], 10) * 60 + parseInt(p[1], 10) : -1;
}
function _minToHHMMG(m) {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  var hh = Math.floor(m / 60), mm = m % 60;
  return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
}
function _parseDurMinG(str) {
  var s = String(str || '');
  var m;
  m = s.match(/^(\d+)h\s*(\d+)min$/i); if (m) return +m[1] * 60 + +m[2];
  m = s.match(/^(\d+)h$/i);            if (m) return +m[1] * 60;
  m = s.match(/^(\d+)min$/i);          if (m) return +m[1];
  return 0;
}

/* ----------------------------------------------------------------
   _encontrarOrigemAtividade — resolve o melhor ponto de partida
   para uma atividade com placeId, na ordem:
     1. Atividade anterior com localização no mesmo dia
     2. Hospedagem ativa com localização
     3. Destino principal da viagem (texto)
   ---------------------------------------------------------------- */
function _encontrarOrigemAtividade(tripId, dadosAtiv) {
  var itin = Store.getItinerario(tripId);
  if (!itin) return null;

  // 1. Atividade anterior (mesmo dia, com placeId, hora ≤ hora da atividade)
  var diaDados = null;
  itin.dias.forEach(function (d) { if (d.data === dadosAtiv.data) diaDados = d; });
  if (diaDados) {
    var anteriores = (diaDados.atividades || []).filter(function (a) {
      return a.id !== dadosAtiv.id &&
             a.placeId &&
             (a.localEndereco || a.localNome) &&
             (a.hora || '') <= (dadosAtiv.hora || '');
    });
    anteriores.sort(function (a, b) { return (b.hora || '').localeCompare(a.hora || ''); });
    if (anteriores.length > 0) {
      var prev = anteriores[0];
      return { label: prev.localEndereco || prev.localNome || '', placeId: prev.placeId || '' };
    }
  }

  // 2. Hospedagem ativa com placeId (mais recente até a data da atividade)
  var hospAtiv = null;
  itin.dias.forEach(function (d) {
    (d.atividades || []).forEach(function (a) {
      if (a.categoria === 'hospedagem' && a.placeId && (a.localEndereco || a.localNome)) {
        if (!hospAtiv || (d.data <= dadosAtiv.data && d.data >= (hospAtiv._data || ''))) {
          hospAtiv = Object.assign({ _data: d.data }, a);
        }
      }
    });
  });
  if (hospAtiv) {
    return { label: hospAtiv.localEndereco || hospAtiv.localNome || '', placeId: hospAtiv.placeId || '' };
  }

  // 3. Destino principal da viagem (sem placeId — geocodificação por texto)
  var viagens = Store.getViagens ? Store.getViagens() : [];
  var viagem = viagens.find(function (v) { return v.id === tripId; });
  if (viagem) {
    var dest = viagem.destinoPrincipal || viagem.destino || viagem.localizacaoCurta || '';
    if (dest) return { label: dest, placeId: '' };
  }

  return null;
}

var AtividadeModal = (function () {
  var _overlay       = null;
  var _tripId        = null;
  var _atividadeId   = null;  // null = criar, string = editar
  var _dataPresel    = null;  // data pré-selecionada (vinda do botão do dia)
  var _localPlace    = null;  // { nome, endereco, placeId, lat, lng } ou null
  var _calculandoRota = false; // bloqueia duplo-clique durante cálculo async

  // ---- Autocomplete no campo Local ----
  function _setupLocalAutocomplete(existingPlace) {
    _localPlace = existingPlace || null;
    MapsService.setupAutocomplete(document.getElementById('af-local')).then(function (ac) {
      if (!ac) return;
      ac.addListener('place_changed', function () {
        var p  = ac.getPlace();
        var nome  = String(p && p.name || '').trim();
        var end   = String(p && p.formatted_address || '').trim();
        var pid   = String(p && p.place_id || '').trim();
        var lat   = p && p.geometry && p.geometry.location ? p.geometry.location.lat() : null;
        var lng   = p && p.geometry && p.geometry.location ? p.geometry.location.lng() : null;
        if (pid) {
          _localPlace = { nome: nome, endereco: end, placeId: pid, lat: lat, lng: lng };
          // Update the visible input to show the place name
          var inp = document.getElementById('af-local');
          if (inp && nome) inp.value = nome;
        } else {
          _localPlace = null;
        }
      });
    });
    var inputEl = document.getElementById('af-local');
    if (inputEl) {
      inputEl.addEventListener('input', function () {
        // If user types manually after a place was selected, clear place data
        _localPlace = null;
      });
    }
  }

  // Usa lista centralizada _APP_CATS

  var _statusOpts = [
    ['planejado',  'Planejado'],
    ['reservado',  'Reservado'],
    ['confirmado', 'Confirmado'],
    ['feito',      'Feito'],
    ['cancelado',  'Cancelado'],
  ];

  function _inject() {
    var div = document.createElement('div');
    div.id = 'ativ-modal-overlay';
    div.className = 'modal-overlay';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.setAttribute('aria-label', 'Formulário de atividade');
    div.innerHTML = (
      '<div class="modal-box" id="ativ-modal-box">' +
        '<div class="modal-handle"></div>' +
        '<div class="modal-header">' +
          '<span class="modal-title" id="ativ-modal-title">Nova atividade</span>' +
          '<button class="modal-close" onclick="AtividadeModal.fechar()" aria-label="Fechar">✕</button>' +
        '</div>' +
        '<div class="modal-body" id="ativ-modal-body"></div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-ghost" onclick="AtividadeModal.fechar()">Cancelar</button>' +
          '<button class="btn btn-primary" id="ativ-modal-save" onclick="AtividadeModal.salvar()">Salvar</button>' +
        '</div>' +
      '</div>'
    );
    div.addEventListener('click', function (e) {
      if (e.target === div) AtividadeModal.fechar();
    });
    document.body.appendChild(div);
    _overlay = div;
  }

  // Gera options de dias da viagem
  function _optsData(itin, presel, ativData) {
    if (!itin) return '<option value="">-- sem dias --</option>';
    return itin.dias.map(function (d, i) {
      var partes = d.data.split('-');
      var label  = 'Dia ' + (i + 1) + ' · ' + partes[2] + '/' + partes[1] + '/' + partes[0];
      var sel    = (d.data === (ativData || presel)) ? ' selected' : '';
      return '<option value="' + d.data + '"' + sel + '>' + label + '</option>';
    }).join('');
  }

  // Gera options de dias para check-in/check-out (hospedagem)
  function _optsHospDia(itin, sel, def) {
    if (!itin || !itin.dias || !itin.dias.length) return '<option value="">-- sem dias --</option>';
    var escolha = sel || def || itin.dias[0].data;
    return itin.dias.map(function (d, i) {
      var p = d.data.split('-');
      var label = 'Dia ' + (i + 1) + ' · ' + p[2] + '/' + p[1] + '/' + p[0];
      var selected = d.data === escolha ? ' selected' : '';
      return '<option value="' + d.data + '"' + selected + '>' + label + '</option>';
    }).join('');
  }

  function _lerDiaSelect(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '') : '';
  }

  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function _opt(val, label, atual) {
    return '<option value="' + val + '"' + (val === atual ? ' selected' : '') + '>' + label + '</option>';
  }

  function _renderForm(itin, ativ) {
    ativ = ativ || {};
    return (
      // Dia
      '<div class="form-group">' +
        '<label class="form-label form-label-required" for="af-dia">Dia da viagem</label>' +
        '<select id="af-dia" class="form-select">' +
          _optsData(itin, _dataPresel, ativ.data || ativ._data) +
        '</select>' +
        '<span class="form-error" id="ae-dia">Selecione um dia.</span>' +
      '</div>' +

      '<div class="form-row">' +
        // Horário
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="af-hora">Horário</label>' +
          _DTWidget.renderHora('af-hora', ativ.hora) +
          '<span class="form-error" id="ae-hora">Informe o horário.</span>' +
        '</div>' +
        // Status
        '<div class="form-group">' +
          '<label class="form-label" for="af-status">Status</label>' +
          '<select id="af-status" class="form-select">' +
            _statusOpts.map(function (s) { return _opt(s[0], s[1], ativ.status || 'planejado'); }).join('') +
          '</select>' +
        '</div>' +
      '</div>' +

      // Duração
      '<div class="form-group">' +
        '<label class="form-label" for="af-dur">Duração (opcional)</label>' +
        _DTWidget.renderDuracao('af-dur', ativ.duracaoMin || 0) +
      '</div>' +

      // Nome
      '<div class="form-group">' +
        '<label class="form-label form-label-required" for="af-nome">Nome da atividade</label>' +
        '<input id="af-nome" class="form-input" type="text" maxlength="100" placeholder="Ex: Visita ao Cristo Redentor" value="' + _esc(ativ.nome) + '">' +
        '<span class="form-error" id="ae-nome">Nome é obrigatório.</span>' +
      '</div>' +

      // Categoria
      '<div class="form-group">' +
        '<label class="form-label form-label-required" for="af-cat">Categoria</label>' +
        CustomSelect.render('af-cat', _APP_CATS, ativ.categoria, 'Selecione...', 'AtividadeModal._onCatChange()') +
        '<span class="form-error" id="ae-cat">Selecione uma categoria.</span>' +
      '</div>' +

      '<div class="form-row">' +
        // Local
        '<div class="form-group">' +
          '<label class="form-label" for="af-local">Local</label>' +
          '<input id="af-local" class="form-input" type="text" maxlength="200" autocomplete="off"' +
            ' placeholder="Busque endereço, pousada, restaurante, praça..."' +
            ' value="' + _esc(ativ.localNome || ativ.local) + '">' +
          '<div id="af-route-status" class="af-route-status"></div>' +
        '</div>' +
        // Custo
        '<div class="form-group">' +
          '<label class="form-label" for="af-custo">Custo previsto (R$)</label>' +
          '<input id="af-custo" class="form-input" type="number" min="0" step="0.01" placeholder="0,00" value="' + _esc(ativ.custoEstimado > 0 ? ativ.custoEstimado : '') + '">' +
          '<span class="form-error" id="ae-custo">Custo deve ser zero ou maior.</span>' +
        '</div>' +
      '</div>' +

      // Observações
      '<div class="form-group">' +
        '<label class="form-label" for="af-obs">Observações</label>' +
        '<textarea id="af-obs" class="form-textarea" maxlength="300" placeholder="Detalhes, links, dicas...">' + _esc(ativ.observacoes) + '</textarea>' +
      '</div>' +

      // Bloco Hospedagem (aparece quando categoria = hospedagem)
      (function () {
        var h = (ativ.hospedagem && typeof ativ.hospedagem === 'object') ? ativ.hospedagem : {};
        var isH = ativ.categoria === 'hospedagem';
        var temDias = itin && itin.dias && itin.dias.length > 0;
        var primeiroDia = temDias ? itin.dias[0].data : '';
        var ultimoDia   = temDias ? itin.dias[itin.dias.length - 1].data : '';
        var ciDataPre = (h.checkInDate  && temDias && itin.dias.some(function(d){return d.data===h.checkInDate;}))
          ? h.checkInDate : primeiroDia;
        var coDataPre = (h.checkOutDate && temDias && itin.dias.some(function(d){return d.data===h.checkOutDate;}))
          ? h.checkOutDate : ultimoDia;
        return (
          '<div id="af-hosp-extra" class="desp-hosp-block' + (isH ? ' desp-hosp-block-visivel' : '') + '">' +
            (!temDias
              ? '<p class="desp-hosp-nodates">⚠️ Cadastre as datas da viagem antes de configurar hospedagem.</p>'
              : (
                '<div class="desp-hosp-header">🏨 Datas da hospedagem</div>' +
                '<div class="form-row">' +
                  '<div class="form-group">' +
                    '<label class="form-label form-label-required">Check-in · dia</label>' +
                    '<select id="af-ci-data" class="form-select">' + _optsHospDia(itin, ciDataPre, primeiroDia) + '</select>' +
                    '<span class="form-error" id="ae-ci-data">Selecione o dia.</span>' +
                  '</div>' +
                  '<div class="form-group">' +
                    '<label class="form-label form-label-required" for="af-ci-hora">Check-in · hora</label>' +
                    _DTWidget.renderHora('af-ci-hora', h.checkInTime || _lerPreferencias().checkInPadrao || '14:00') +
                    '<span class="form-error" id="ae-ci-hora">Informe o horário.</span>' +
                  '</div>' +
                '</div>' +
                '<div class="form-row">' +
                  '<div class="form-group">' +
                    '<label class="form-label form-label-required" for="af-co-data">Check-out · dia</label>' +
                    '<select id="af-co-data" class="form-select">' + _optsHospDia(itin, coDataPre, ultimoDia) + '</select>' +
                    '<span class="form-error" id="ae-co-data">Selecione o dia.</span>' +
                  '</div>' +
                  '<div class="form-group">' +
                    '<label class="form-label form-label-required" for="af-co-hora">Check-out · hora</label>' +
                    _DTWidget.renderHora('af-co-hora', h.checkOutTime || _lerPreferencias().checkOutPadrao || '12:00') +
                    '<span class="form-error" id="ae-co-hora">Informe o horário.</span>' +
                  '</div>' +
                '</div>' +
                '<span class="form-error" id="ae-hosp-order">Check-out deve ser igual ou após o check-in.</span>'
              )
            ) +
          '</div>'
        );
      })()
    );
  }

  // ---- Erro inline (id curto: 'nome' → 'ae-nome' / 'af-nome') ----
  function _erro(id, mostrar, msg) {
    var el  = document.getElementById('ae-' + id);
    var inp = document.getElementById('af-' + id);
    if (!el) return;
    if (mostrar) {
      if (msg) el.textContent = msg;
      el.classList.add('visivel');
      if (inp) inp.classList.add('invalido');
    } else {
      el.classList.remove('visivel');
      if (inp) inp.classList.remove('invalido');
    }
  }

  function _limparErros() {
    ['dia','hora','nome','cat','custo','ci-data','ci-hora','co-data','co-hora','hosp-order'].forEach(function (k) { _erro(k, false); });
  }

  function _isHospAtiv() {
    var cat = document.getElementById('af-cat');
    return cat && cat.value === 'hospedagem';
  }

  function _validar() {
    _limparErros();
    var ok = true;

    var dia = document.getElementById('af-dia');
    if (!dia || !dia.value) { _erro('dia', true); ok = false; }

    if (!_DTWidget.lerHora('af-hora')) { _erro('hora', true); ok = false; }

    var nome = document.getElementById('af-nome');
    if (!nome || !nome.value.trim()) { _erro('nome', true); ok = false; }

    var cat = document.getElementById('af-cat');
    if (!cat || !cat.value) { _erro('cat', true); ok = false; }

    var custo = document.getElementById('af-custo');
    if (custo && custo.value !== '' && Number(custo.value) < 0) {
      _erro('custo', true, 'Custo deve ser zero ou maior.');
      ok = false;
    }

    if (_isHospAtiv()) {
      var ciData = _lerDiaSelect('af-ci-data');
      var ciHora = _DTWidget.lerHora('af-ci-hora');
      var coData = _lerDiaSelect('af-co-data');
      var coHora = _DTWidget.lerHora('af-co-hora');
      var ciEl   = document.getElementById('af-ci-data');
      if (!ciEl) {
        _erro('ci-data', true, 'Cadastre as datas da viagem antes de configurar hospedagem.');
        ok = false;
      } else {
        if (!ciData) { _erro('ci-data', true, 'Selecione o dia do check-in.'); ok = false; }
        if (!ciHora) { _erro('ci-hora', true); ok = false; }
        if (!coData) { _erro('co-data', true, 'Selecione o dia do check-out.'); ok = false; }
        if (!coHora) { _erro('co-hora', true); ok = false; }
        if (ciData && coData && ciHora && coHora) {
          if ((coData + 'T' + coHora) < (ciData + 'T' + ciHora)) {
            _erro('hosp-order', true, 'Check-out deve ser igual ou após o check-in.');
            ok = false;
          }
        }
      }
    }

    return ok;
  }

  return {
    init: _inject,

    // Criar: tripId obrigatório, dataISO pode ser null (usuário escolhe no select)
    abrir: function (tripId, dataISO) {
      _tripId      = tripId;
      _atividadeId = null;
      _dataPresel  = dataISO || null;

      var itin = Store.getItinerario(tripId);
      document.getElementById('ativ-modal-title').textContent = 'Nova atividade';
      document.getElementById('ativ-modal-save').textContent  = 'Salvar atividade';
      document.getElementById('ativ-modal-body').innerHTML    = _renderForm(itin, {});
      this._onCatChange();

      _overlay.classList.add('aberto');
      document.body.style.overflow = 'hidden';
      var f = document.getElementById('af-nome');
      if (f) setTimeout(function () { f.focus(); }, 300);
      setTimeout(function () { _setupLocalAutocomplete(null); }, 50);
    },

    // Editar
    editar: function (tripId, atividadeId) {
      _tripId      = tripId;
      _atividadeId = atividadeId;
      _dataPresel  = null;

      var itin = Store.getItinerario(tripId);
      // Encontra atividade
      var ativ = null;
      if (itin) {
        itin.dias.forEach(function (d) {
          d.atividades.forEach(function (a) {
            if (a.id === atividadeId) ativ = Object.assign({ data: d.data, _data: d.data }, a);
          });
        });
      }
      if (!ativ) { console.warn('[AtividadeModal] Atividade não encontrada:', atividadeId); return; }

      document.getElementById('ativ-modal-title').textContent = 'Editar atividade';
      document.getElementById('ativ-modal-save').textContent  = 'Salvar alterações';
      document.getElementById('ativ-modal-body').innerHTML    = _renderForm(itin, ativ);
      this._onCatChange();

      _overlay.classList.add('aberto');
      document.body.style.overflow = 'hidden';
      // Restore existing place data so we don't clear the linked route if user doesn't re-pick
      var existingPlace = (ativ.placeId)
        ? { nome: ativ.localNome || '', endereco: ativ.localEndereco || '', placeId: ativ.placeId, lat: ativ.lat || null, lng: ativ.lng || null }
        : null;
      setTimeout(function () { _setupLocalAutocomplete(existingPlace); }, 50);
    },

    fechar: function () {
      _overlay.classList.remove('aberto');
      document.body.style.overflow = '';
      _tripId = _atividadeId = _dataPresel = null;
      _localPlace = null;
      _calculandoRota = false;
    },

    salvar: function () {
      if (_calculandoRota) return;
      if (!_validar()) return;

      var dados = {
        data:           document.getElementById('af-dia').value,
        hora:           _DTWidget.lerHora('af-hora'),
        nome:           document.getElementById('af-nome').value.trim(),
        categoria:      document.getElementById('af-cat').value,
        local:          document.getElementById('af-local').value.trim(),
        duracaoMin:     _DTWidget.lerDuracao('af-dur') || null,
        custoEstimado:  Number(document.getElementById('af-custo').value) || 0,
        status:         document.getElementById('af-status').value,
        observacoes:    document.getElementById('af-obs').value.trim(),
      };

      // Merge place data into dados (all DOM-readable, do now before any async)
      if (_localPlace && _localPlace.placeId) {
        dados.local         = _localPlace.nome || _localPlace.endereco || dados.local;
        dados.localNome     = _localPlace.nome     || '';
        dados.localEndereco = _localPlace.endereco || '';
        dados.placeId       = _localPlace.placeId  || '';
        dados.lat           = _localPlace.lat  != null ? _localPlace.lat  : null;
        dados.lng           = _localPlace.lng  != null ? _localPlace.lng  : null;
      } else {
        dados.localNome = dados.localEndereco = dados.placeId = '';
        dados.lat = dados.lng = null;
      }

      // --- Hospedagem: collect extra fields and link to Financeiro (synchronous) ---
      if (_isHospAtiv()) {
        var ciData = _lerDiaSelect('af-ci-data');
        var ciHora = _DTWidget.lerHora('af-ci-hora');
        var coData = _lerDiaSelect('af-co-data');
        var coHora = _DTWidget.lerHora('af-co-hora');
        dados.hospedagem = {
          nome:         dados.nome,
          endereco:     dados.local,
          checkInDate:  ciData  || dados.data,
          checkInTime:  ciHora  || '14:00',
          checkOutDate: coData  || '',
          checkOutTime: coHora  || '11:00',
        };
        dados.linkedActivityType = 'hospedagem';
        dados.origemModulo       = 'roteiro';

        var viagem = Store.getViagens().find(function (v) { return v.id === _tripId; }) || {};
        var partAtivos = (Array.isArray(viagem.participantes)
          ? viagem.participantes.filter(function (p) { return p && p.ativo !== false; })
          : []).map(function (p) { return String(p.id || ''); }).filter(Boolean);
        var despData = {
          data:                   dados.hospedagem.checkInDate || dados.data,
          categoria:              'hospedagem',
          descricao:              dados.nome,
          valor:                  dados.custoEstimado,
          quemPagouId:            partAtivos[0] || '',
          participantesRateioIds: partAtivos,
          observacoes:            dados.observacoes,
          tipoPagamento:          'avista',
          totalParcelas:          1,
          hospedagem:             Object.assign({}, dados.hospedagem),
          origemModulo:           'roteiro',
        };

        var linkedId = null;
        if (_atividadeId) {
          var itin = Store.getItinerario(_tripId);
          if (itin) {
            itin.dias.forEach(function (d) {
              d.atividades.forEach(function (a) {
                if (a.id === _atividadeId && a.linkedDespesaId) linkedId = a.linkedDespesaId;
              });
            });
          }
        }

        if (linkedId) {
          Store.editarDespesa(_tripId, linkedId, despData);
          dados.linkedDespesaId = linkedId;
        } else {
          var despCriada = Store.adicionarDespesa(_tripId, despData);
          if (despCriada && despCriada.id) dados.linkedDespesaId = despCriada.id;
        }
      } else {
        dados.hospedagem         = null;
        dados.linkedActivityType = null;
      }

      // --- Rota vinculada: calcular antes de persistir ---
      if (_localPlace && _localPlace.placeId) {
        var origemRota = _encontrarOrigemAtividade(_tripId, Object.assign({ id: _atividadeId }, dados));
        if (origemRota) {
          _calculandoRota = true;
          var saveBtn  = document.getElementById('ativ-modal-save');
          var statusEl = document.getElementById('af-route-status');
          if (saveBtn)   { saveBtn.disabled = true; saveBtn.textContent = 'Calculando rota...'; }
          if (statusEl)  { statusEl.innerHTML = '<span class="af-route-calculating">⏳ Calculando rota...</span>'; }

          // Snapshot closure vars before async
          var _snap = {
            tripId: _tripId, atividadeId: _atividadeId, dados: dados,
            origem: origemRota,
            dest:   { label: _localPlace.endereco || _localPlace.nome || dados.local, placeId: _localPlace.placeId },
          };

          MapsService.computeRoute({
            origin:             _snap.origem.label,
            originPlaceId:      _snap.origem.placeId || '',
            destination:        _snap.dest.label,
            destinationPlaceId: _snap.dest.placeId,
            travelMode:         'DRIVING',
          }).then(function (res) {
            _calculandoRota = false;
            var chegMin  = _horaToMinG(_snap.dados.hora || '08:00');
            var durMin   = _parseDurMinG(res.durationText);
            var partHora = _minToHHMMG(Math.max(0, chegMin - durMin));
            var trechoData = {
              source:             'roteiro',
              tipo:               'carro',
              origem:             _snap.origem.label,
              destino:            _snap.dest.label,
              originPlaceId:      _snap.origem.placeId || '',
              destinationPlaceId: _snap.dest.placeId,
              data:               _snap.dados.data,
              horario:            partHora,
              chegadaHorario:     _snap.dados.hora,
              distanciaKm:        res.distanceKm,
              duracaoEstimada:    res.durationText,
              calculoModo:        'google',
              routeSource:        'google',
              observacoes:        '',
            };
            AtividadeModal._persistirSalvar(_snap.tripId, _snap.atividadeId, _snap.dados, trechoData);
          }).catch(function () {
            _calculandoRota = false;
            _mostrarToast('Atividade salva. Não foi possível calcular a rota.');
            AtividadeModal._persistirSalvar(_snap.tripId, _snap.atividadeId, _snap.dados, null);
          });
          return; // espera async
        } else {
          _mostrarToast('Atividade salva. Ponto de origem não encontrado para calcular rota.');
        }
      }

      AtividadeModal._persistirSalvar(_tripId, _atividadeId, dados, null);
    },

    // Persiste atividade + trecho vinculado e fecha o modal
    _persistirSalvar: function (tripId, atividadeId, dados, trechoData) {
      var savedId;
      if (atividadeId) {
        Store.editarAtividade(tripId, atividadeId, dados);
        savedId = atividadeId;
      } else {
        var criada = Store.adicionarAtividade(tripId, dados.data, dados);
        savedId = criada ? criada.id : null;
      }

      if (savedId) {
        if (trechoData) {
          // Cria ou atualiza o trecho vinculado
          trechoData.tripId = tripId;
          trechoData.linkedActivityId = savedId;
          var trechosExist = Store.getTrechosRota(tripId).filter(function (t) {
            return t.source === 'roteiro' && t.linkedActivityId === savedId;
          });
          if (trechosExist.length > 0) {
            Store.editarTrechoRota(tripId, trechosExist[0].id, trechoData);
            for (var i = 1; i < trechosExist.length; i++) {
              Store.excluirTrechoRota(tripId, trechosExist[i].id);
            }
          } else {
            Store.adicionarTrechoRota(tripId, trechoData);
          }
        } else if (atividadeId && !(dados.placeId)) {
          // Local foi apagado ao editar — remove rota vinculada se houver
          Store.getTrechosRota(tripId).filter(function (t) {
            return t.source === 'roteiro' && t.linkedActivityId === savedId;
          }).forEach(function (t) { Store.excluirTrechoRota(tripId, t.id); });
        }
      }

      AtividadeModal.fechar();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      if (savedId) _scrollToSaved('[data-ativ-id="' + savedId + '"]');
    },

    _onCatChange: function () {
      var extra = document.getElementById('af-hosp-extra');
      if (!extra) return;
      if (_isHospAtiv()) {
        extra.classList.add('desp-hosp-block-visivel');
      } else {
        extra.classList.remove('desp-hosp-block-visivel');
      }
    },
  };
})();

// ================================================================
// AtividadeActions — Ações nas atividades do roteiro
// ================================================================
var AtividadeActions = {
  toggle: function (tripId, atividadeId) {
    Store.toggleAtividade(tripId, atividadeId);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  },

  editar: function (tripId, atividadeId) {
    AtividadeModal.editar(tripId, atividadeId);
  },

  excluir: function (tripId, atividadeId) {
    // Pequeno confirm inline usando o ConfirmModal existente com override de callback
    var itin = Store.getItinerario(tripId);
    var nome = 'esta atividade';
    var linkedDespesaId = null;
    if (itin) {
      itin.dias.forEach(function (d) {
        d.atividades.forEach(function (a) {
          if (a.id === atividadeId) {
            nome = '"' + a.nome + '"';
            linkedDespesaId = a.linkedDespesaId || null;
          }
        });
      });
    }

    function _doExcluir() {
      Store.excluirAtividade(tripId, atividadeId);
      if (linkedDespesaId) Store.excluirDespesa(tripId, linkedDespesaId);
      // Remove linked route segment (created via Itinerary-to-Route integration)
      Store.getTrechosRota(tripId).filter(function (t) {
        return t.source === 'roteiro' && t.linkedActivityId === atividadeId;
      }).forEach(function (t) { Store.excluirTrechoRota(tripId, t.id); });
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }

    if (!_confirmarExclusoesAtivo()) {
      _doExcluir();
      return;
    }

    // Usa ConfirmModal com callback customizado
    ConfirmModal.abrirComCallback(
      'Excluir atividade?',
      'Excluir ' + nome + '? Esta ação não pode ser desfeita.',
      _doExcluir
    );
  },
};

// ================================================================
// ReajustarModal — Replan timeline from a given activity
// ================================================================
var ReajustarModal = (function () {
  var _overlay   = null;
  var _tripId    = null;
  var _atividadeId = null;
  var _dataISO   = null;
  var _horaOriginal = '08:00';

  function _pad(n) { return n < 10 ? '0' + n : String(n); }

  function _horaToMin(h) {
    var p = String(h || '').split(':');
    return p.length === 2 ? parseInt(p[0], 10) * 60 + parseInt(p[1], 10) : -1;
  }

  function _minToHHMM(m) {
    m = ((m % 1440) + 1440) % 1440;
    return _pad(Math.floor(m / 60)) + ':' + _pad(m % 60);
  }

  function _shiftHora(hora, deltaMin) {
    var m = _horaToMin(hora);
    if (m < 0) return hora;
    return _minToHHMM(m + deltaMin);
  }

  function _calcDelta() {
    var novaHora = SmartTimePicker.lerHora('rj-nova-hora') || _horaOriginal;
    var orig = _horaToMin(_horaOriginal);
    var nova = _horaToMin(novaHora);
    if (orig < 0 || nova < 0) return 0;
    return nova - orig;
  }

  function _updateDeltaPreview() {
    var delta = _calcDelta();
    var el = document.getElementById('rj-delta');
    if (!el) return;
    if (delta === 0) { el.textContent = ''; return; }
    var sign = delta > 0 ? '+' : '';
    var h = Math.floor(Math.abs(delta) / 60);
    var m = Math.abs(delta) % 60;
    var str = sign + (delta < 0 ? '-' : '') + (h > 0 ? h + 'h' : '') + (m > 0 ? (h > 0 ? ' ' : '') + m + 'min' : '');
    el.textContent = str;
    el.className = 'rj-delta-badge ' + (delta > 0 ? 'pos' : 'neg');
  }

  function _buildOverlay() {
    var div = document.createElement('div');
    div.id = 'rj-overlay';
    div.className = 'modal-overlay';
    div.innerHTML = (
      '<div class="modal-card rj-card" role="dialog" aria-modal="true" aria-label="Reajustar timeline">' +
        '<div class="modal-header">' +
          '<h2 class="modal-title">⟳ Reajustar a partir daqui</h2>' +
          '<button class="modal-close" onclick="ReajustarModal.fechar()">×</button>' +
        '</div>' +
        '<div class="modal-body rj-body">' +
          '<div class="rj-time-row">' +
            '<div class="form-group">' +
              '<label class="form-label">Horário planejado</label>' +
              '<div id="rj-hora-original" class="rj-hora-display"></div>' +
            '</div>' +
            '<div class="rj-arrow">→</div>' +
            '<div class="form-group">' +
              '<label class="form-label">Novo horário real</label>' +
              '<div id="rj-nova-hora-wrap"></div>' +
            '</div>' +
            '<div id="rj-delta" class="rj-delta-badge"></div>' +
          '</div>' +
          '<div class="rj-warn" id="rj-warn" style="display:none">⚠ Alguns itens ultrapassariam o fim do dia.</div>' +
          '<div class="form-group">' +
            '<label class="form-label">O que fazer com os próximos itens?</label>' +
            '<div class="rj-options">' +
              '<label class="rj-opt"><input type="radio" name="rj-modo" value="dia" checked> Ajustar próximos itens do dia</label>' +
              '<label class="rj-opt"><input type="radio" name="rj-modo" value="viagem"> Ajustar próximos itens da viagem</label>' +
              '<label class="rj-opt"><input type="radio" name="rj-modo" value="fixar"> Manter demais itens fixos</label>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-ghost" onclick="ReajustarModal.fechar()">Cancelar</button>' +
          '<button class="btn btn-primary" onclick="ReajustarModal._aplicar()">Aplicar</button>' +
        '</div>' +
      '</div>'
    );
    div.addEventListener('click', function (e) { if (e.target === div) ReajustarModal.fechar(); });
    div.addEventListener('keydown', function (e) { if (e.key === 'Escape') ReajustarModal.fechar(); });
    document.body.appendChild(div);
    _overlay = div;
  }

  return {
    abrir: function (tripId, atividadeId, dataISO) {
      _tripId = tripId;
      _atividadeId = atividadeId;

      // Locate the activity to get its current hora
      var itin = Store.getItinerario(tripId);
      if (!itin) return;
      var ativ = null;
      itin.dias.forEach(function (d) {
        d.atividades.forEach(function (a) {
          if (a.id === atividadeId) { ativ = a; if (!dataISO) dataISO = d.data; }
        });
      });
      if (!ativ) return;
      _dataISO = dataISO || '';
      _horaOriginal = ativ.hora || '08:00';

      if (!_overlay) _buildOverlay();

      document.getElementById('rj-hora-original').textContent = _horaOriginal;
      var wrap = document.getElementById('rj-nova-hora-wrap');
      wrap.innerHTML = SmartTimePicker.render('rj-nova-hora', _horaOriginal, 'ReajustarModal._onHoraChange()');

      document.getElementById('rj-warn').style.display = 'none';
      document.getElementById('rj-delta').textContent = '';
      document.getElementById('rj-delta').className = 'rj-delta-badge';

      _overlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    },

    fechar: function () {
      if (_overlay) _overlay.style.display = 'none';
      document.body.style.overflow = '';
    },

    _onHoraChange: function () {
      _updateDeltaPreview();
    },

    _aplicar: function () {
      var delta = _calcDelta();
      var modoEl = _overlay.querySelector('input[name="rj-modo"]:checked');
      var modo = modoEl ? modoEl.value : 'dia';

      var itin = Store.getItinerario(_tripId);
      if (!itin) return;

      // Always update the selected activity itself
      Store.editarAtividade(_tripId, _atividadeId, { hora: _minToHHMM(_horaToMin(_horaOriginal) + delta) });

      if (modo === 'fixar' || delta === 0) {
        ReajustarModal.fechar();
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        return;
      }

      // Sort days by date
      var dias = itin.dias.slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; });
      var pastSelected = false;
      var warn = false;

      dias.forEach(function (d) {
        if (modo === 'dia' && d.data !== _dataISO) return;
        if (modo === 'viagem' && d.data < _dataISO) return;

        d.atividades.forEach(function (a) {
          if (a.id === _atividadeId) { pastSelected = true; return; }
          if (!pastSelected) return;
          if (a.locked) return; // fixed — skip

          var m = _horaToMin(a.hora || '');
          if (m < 0) return;
          var shifted = m + delta;
          if (shifted < 0 || shifted >= 1440) warn = true;
          Store.editarAtividade(_tripId, a.id, { hora: _minToHHMM(shifted) });
        });

        // Reset pastSelected between days only for 'viagem' mode over multiple days
        if (modo === 'viagem' && d.data !== _dataISO) pastSelected = true;
      });

      if (warn) {
        var warnEl = document.getElementById('rj-warn');
        if (warnEl) warnEl.style.display = 'block';
        setTimeout(function () {
          ReajustarModal.fechar();
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }, 1500);
      } else {
        ReajustarModal.fechar();
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    },
  };
})();


var DespesaModal = (function () {
  var _overlay   = null;
  var _tripId    = null;
  var _despesaId = null;

  // Usa lista centralizada _APP_CATS

  function _inject() {
    var div = document.createElement('div');
    div.id = 'desp-modal-overlay';
    div.className = 'modal-overlay';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.setAttribute('aria-label', 'Formulário de despesa');
    div.innerHTML = (
      '<div class="modal-box" id="desp-modal-box">' +
        '<div class="modal-handle"></div>' +
        '<div class="modal-header">' +
          '<span class="modal-title" id="desp-modal-title">Nova despesa</span>' +
          '<button class="modal-close" onclick="DespesaModal.fechar()" aria-label="Fechar">✕</button>' +
        '</div>' +
        '<div class="modal-body" id="desp-modal-body"></div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-ghost" onclick="DespesaModal.fechar()">Cancelar</button>' +
          '<button class="btn btn-primary" id="desp-modal-save" onclick="DespesaModal.salvar()">Salvar</button>' +
        '</div>' +
      '</div>'
    );
    div.addEventListener('click', function (e) {
      if (e.target === div) DespesaModal.fechar();
    });
    document.body.appendChild(div);
    _overlay = div;
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _opt(val, label, atual) {
    return '<option value="' + val + '"' + (val === atual ? ' selected' : '') + '>' + label + '</option>';
  }

  function _participantesAtivos(viagem) {
    if (!viagem) return [];
    if (Array.isArray(viagem.participantes)) {
      return viagem.participantes
        .filter(function (p) { return p && p.ativo !== false; })
        .map(function (p) {
          return {
            id: String(p.id || ''),
            nome: String(p.nome || '').trim(),
          };
        })
        .filter(function (p) { return p.id && p.nome; });
    }
    var qtd = Math.max(1, Number(viagem.participantes) || 1);
    var lista = [];
    for (var i = 1; i <= qtd; i++) lista.push({ id: 'legacy-' + i, nome: 'Pessoa ' + i });
    return lista;
  }

  function _checkboxesPartic(participantesAtivos, selecionados) {
    var checks = '';
    participantesAtivos.forEach(function (participante) {
      var checked = (!selecionados || selecionados.length === 0 || selecionados.indexOf(participante.id) !== -1) ? ' checked' : '';
      checks += (
        '<label class="desp-check-label">' +
          '<input type="checkbox" name="df-partic" value="' + _esc(participante.id) + '"' + checked + '> ' + _esc(participante.nome) +
        '</label>'
      );
    });
    return checks;
  }

  function _selectPagante(participantesAtivos, atual) {
    var opcoes = participantesAtivos.map(function (participante) {
      return '<option value="' + _esc(participante.id) + '"' + (participante.id === atual ? ' selected' : '') + '>' + _esc(participante.nome) + '</option>';
    }).join('');
    var existe = participantesAtivos.some(function (participante) { return participante.id === atual; });
    if (atual && !existe) {
      opcoes += '<option value="' + _esc(atual) + '" selected>Participante não encontrado</option>';
    }
    return opcoes;
  }

  function _resumoParcelas(valor, totalParcelas) {
    var total = Math.max(1, Math.floor(Number(totalParcelas) || 1));
    var v = Math.round((Number(valor) || 0) * 100);
    if (total <= 1 || v <= 0) return 'Pagamento à vista.';
    var base = Math.floor(v / total);
    var ultima = v - (base * (total - 1));
    return total + 'x de ' + UI.formatarMoeda(base / 100) + ' (última de ' + UI.formatarMoeda(ultima / 100) + ')';
  }

  // Gera <option>s de dias da viagem para selects de data de hospedagem
  // itin = Store.getItinerario result, sel = ISO date pre-selected, def = ISO date fallback default
  function _optsHospDia(itin, sel, def) {
    if (!itin || !itin.dias || !itin.dias.length) return '<option value="">-- sem dias --</option>';
    var escolha = sel || def || itin.dias[0].data;
    return itin.dias.map(function (d, i) {
      var p = d.data.split('-');
      var label = 'Dia ' + (i + 1) + ' · ' + p[2] + '/' + p[1] + '/' + p[0];
      var selected = d.data === escolha ? ' selected' : '';
      return '<option value="' + d.data + '"' + selected + '>' + label + '</option>';
    }).join('');
  }

  // Lê data ISO de um select de dia de viagem
  function _lerDiaSelect(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '') : '';
  }

  function _renderForm(viagem, desp, itin) {
    desp = desp || {};
    var participantesAtivos = _participantesAtivos(viagem);
    var totalParcelas = Math.max(1, Number(desp.totalParcelas) || 1);
    var modoPagamento = totalParcelas > 1 ? 'parcelado' : 'avista';
    var h = (desp.hospedagem && typeof desp.hospedagem === 'object') ? desp.hospedagem : {};
    var isHosp = desp.categoria === 'hospedagem';

    // Trip days for lodging date selects
    var temDias = itin && itin.dias && itin.dias.length > 0;
    var primeiroDia = temDias ? itin.dias[0].data : '';
    var ultimoDia   = temDias ? itin.dias[itin.dias.length - 1].data : '';
    // Map saved ISO dates to trip days; use trip defaults if no saved date
    var ciDataPre = (h.checkInDate  && temDias && itin.dias.some(function(d){return d.data===h.checkInDate;}))
      ? h.checkInDate  : primeiroDia;
    var coDataPre = (h.checkOutDate && temDias && itin.dias.some(function(d){return d.data===h.checkOutDate;}))
      ? h.checkOutDate : ultimoDia;

    return (
      /* --- Linha 1: Data + Categoria --- */
      '<div class="desp-form-grid">' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required">Data</label>' +
          _DTWidget.renderData('df-data', desp.data || '') +
          '<span class="form-error" id="de-data">Informe a data.</span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="df-cat">Categoria</label>' +
          CustomSelect.render('df-cat', _APP_CATS, desp.categoria, 'Selecione...', 'DespesaModal._onCatChange()') +
          '<span class="form-error" id="de-cat">Selecione uma categoria.</span>' +
        '</div>' +
      '</div>' +

      /* --- Descrição (largura total) --- */
      '<div class="form-group">' +
        '<label class="form-label form-label-required" for="df-desc">Descrição</label>' +
        '<input id="df-desc" class="form-input" type="text" maxlength="120" placeholder="Ex: Almoço no restaurante" value="' + _esc(desp.descricao) + '">' +
        '<span class="form-error" id="de-desc">Descrição é obrigatória.</span>' +
      '</div>' +

      /* --- Linha 2: Valor + Quem Pagou --- */
      '<div class="desp-form-grid">' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="df-valor">Valor (R$)</label>' +
          '<input id="df-valor" class="form-input" type="number" min="0.01" step="0.01" placeholder="0,00" value="' + _esc(desp.valor > 0 ? desp.valor : '') + '">' +
          '<span class="form-error" id="de-valor">Valor deve ser maior que zero.</span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="df-pagante">Quem pagou</label>' +
          '<select id="df-pagante" class="form-select">' +
            '<option value="">Selecione...</option>' +
            _selectPagante(participantesAtivos, desp.quemPagouId) +
          '</select>' +
          '<span class="form-error" id="de-pagante">Informe quem pagou.</span>' +
        '</div>' +
      '</div>' +

      /* --- Linha 3: Modo de pagamento + Parcelas --- */
      '<div class="desp-form-grid">' +
        '<div class="form-group">' +
          '<label class="form-label" for="df-pagamento">Pagamento</label>' +
          '<select id="df-pagamento" class="form-select" onchange="DespesaModal.alterarPagamento()">' +
            _opt('avista', 'À vista', modoPagamento) +
            _opt('parcelado', 'Parcelado', modoPagamento) +
          '</select>' +
        '</div>' +
        '<div class="form-group" id="df-parcelas-wrap" style="display:' + (modoPagamento === 'parcelado' ? '' : 'none') + '">' +
          '<label class="form-label" for="df-parcelas">Nº de parcelas</label>' +
          '<input id="df-parcelas" class="form-input" type="number" min="2" max="48" step="1" value="' + (totalParcelas > 1 ? totalParcelas : 2) + '" oninput="DespesaModal.alterarPagamento()">' +
        '</div>' +
      '</div>' +
      '<p class="text-xs text-muted desp-parcelas-resumo" id="df-parcelas-resumo">' + _resumoParcelas(desp.valor, totalParcelas) + '</p>' +

      /* --- Participantes no rateio --- */
      '<div class="form-group">' +
        '<label class="form-label">Participantes no rateio</label>' +
        '<div class="desp-check-grid">' + _checkboxesPartic(participantesAtivos, desp.participantesRateioIds) + '</div>' +
        '<span class="text-xs text-muted desp-partic-hint">Padrão: todos selecionados.</span>' +
        '<span class="form-error" id="de-partic">Selecione ao menos 1 participante.</span>' +
      '</div>' +

      /* --- Observações --- */
      '<div class="form-group">' +
        '<label class="form-label" for="df-obs">Observações</label>' +
        '<textarea id="df-obs" class="form-textarea" maxlength="300" placeholder="Detalhes ou observações...">' + _esc(desp.observacoes) + '</textarea>' +
      '</div>' +

      /* --- Bloco Hospedagem (aparece só quando categoria = hospedagem) --- */
      '<div id="df-hosp-extra" class="desp-hosp-block' + (isHosp ? ' desp-hosp-block-visivel' : '') + '">' +
        (!temDias
          ? '<p class="desp-hosp-nodates">⚠️ Cadastre as datas da viagem antes de configurar hospedagem.</p>'
          : (
            '<div class="desp-hosp-header">🏨 Dados da hospedagem</div>' +
            '<div class="form-group">' +
              '<label class="form-label" for="df-hosp-nome">Nome da hospedagem</label>' +
              '<input id="df-hosp-nome" class="form-input" type="text" maxlength="120" placeholder="Ex: Pousada Serra Verde" value="' + _esc(h.nome || desp.descricao) + '">' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label" for="df-hosp-end">Endereço / local</label>' +
              '<input id="df-hosp-end" class="form-input" type="text" maxlength="200" placeholder="Ex: Rua das Flores, 42 – Centro" value="' + _esc(h.endereco || '') + '">' +
            '</div>' +
            '<div class="desp-form-grid">' +
              '<div class="form-group">' +
                '<label class="form-label form-label-required">Check-in · dia</label>' +
                '<select id="df-ci-data" class="form-select">' + _optsHospDia(itin, ciDataPre, primeiroDia) + '</select>' +
                '<span class="form-error" id="de-ci-data">Selecione o dia do check-in.</span>' +
              '</div>' +
              '<div class="form-group">' +
                '<label class="form-label form-label-required" for="df-ci-hora">Check-in · hora</label>' +
                _DTWidget.renderHora('df-ci-hora', h.checkInTime || _lerPreferencias().checkInPadrao || '14:00') +
                '<span class="form-error" id="de-ci-hora">Informe o horário.</span>' +
              '</div>' +
            '</div>' +
            '<div class="desp-form-grid">' +
              '<div class="form-group">' +
                '<label class="form-label form-label-required" for="df-co-data">Check-out · dia</label>' +
                '<select id="df-co-data" class="form-select">' + _optsHospDia(itin, coDataPre, ultimoDia) + '</select>' +
                '<span class="form-error" id="de-co-data">Selecione o dia do check-out.</span>' +
              '</div>' +
              '<div class="form-group">' +
                '<label class="form-label form-label-required" for="df-co-hora">Check-out · hora</label>' +
                _DTWidget.renderHora('df-co-hora', h.checkOutTime || _lerPreferencias().checkOutPadrao || '12:00') +
                '<span class="form-error" id="de-co-hora">Informe o horário.</span>' +
              '</div>' +
            '</div>' +
            '<span class="form-error" id="de-hosp-order">Check-out deve ser após o check-in.</span>'
          )
        ) +
      '</div>'
    );
  }

  function _erro(id, mostrar, msg) {
    var el  = document.getElementById('de-' + id);
    var inp = document.getElementById('df-' + id);
    if (!el) return;
    if (mostrar) {
      if (msg) el.textContent = msg;
      el.classList.add('visivel');
      if (inp) inp.classList.add('invalido');
    } else {
      el.classList.remove('visivel');
      if (inp) inp.classList.remove('invalido');
    }
  }

  function _limparErros() {
    ['data', 'cat', 'desc', 'valor', 'pagante', 'partic', 'ci-data', 'ci-hora', 'co-data', 'co-hora', 'hosp-order'].forEach(function (k) { _erro(k, false); });
  }

  function _isHospedagem() {
    var cat = document.getElementById('df-cat');
    return cat && cat.value === 'hospedagem';
  }

  function _validar() {
    _limparErros();
    var ok = true;
    if (!_DTWidget.lerData('df-data')) { _erro('data', true); ok = false; }
    if (!document.getElementById('df-cat').value)  { _erro('cat', true);  ok = false; }
    var desc = document.getElementById('df-desc');
    if (!desc || !desc.value.trim()) { _erro('desc', true); ok = false; }
    var val = Number(document.getElementById('df-valor').value);
    if (!val || val <= 0) { _erro('valor', true, 'Valor deve ser maior que zero.'); ok = false; }
    var pag = document.getElementById('df-pagante');
    if (!pag || !pag.value.trim()) { _erro('pagante', true); ok = false; }

    var modo = document.getElementById('df-pagamento');
    if (modo && modo.value === 'parcelado') {
      var parcelas = Number(document.getElementById('df-parcelas').value);
      if (!parcelas || parcelas < 2) {
        _erro('valor', true, 'Para parcelado, informe ao menos 2 parcelas.');
        ok = false;
      }
    }

    var checks = _coletarPartic();
    if (!checks.length) {
      _erro('partic', true, 'Selecione ao menos 1 participante no rateio.');
      ok = false;
    }

    // Validação extra para Hospedagem
    if (_isHospedagem()) {
      var ciData = _lerDiaSelect('df-ci-data');
      var ciHora = _DTWidget.lerHora('df-ci-hora');
      var coData = _lerDiaSelect('df-co-data');
      var coHora = _DTWidget.lerHora('df-co-hora');
      // Verifica se o select foi gerado (pode estar oculto por falta de dias na viagem)
      var ciDataEl = document.getElementById('df-ci-data');
      if (!ciDataEl) {
        _erro('ci-data', true, 'Cadastre as datas da viagem antes de configurar hospedagem.');
        ok = false;
      } else {
        if (!ciData) { _erro('ci-data', true, 'Selecione o dia do check-in.'); ok = false; }
        if (!ciHora) { _erro('ci-hora', true); ok = false; }
        if (!coData) { _erro('co-data', true, 'Selecione o dia do check-out.'); ok = false; }
        if (!coHora) { _erro('co-hora', true); ok = false; }
        if (ciData && coData && ciHora && coHora) {
          if ((coData + 'T' + coHora) < (ciData + 'T' + ciHora)) {
            _erro('hosp-order', true, 'Check-out deve ser igual ou após o check-in.');
            ok = false;
          }
        }
      }
    }

    return ok;
  }

  function _coletarPartic() {
    var checks = document.querySelectorAll('input[name="df-partic"]:checked');
    return Array.prototype.map.call(checks, function (c) { return c.value; });
  }

  return {
    init: _inject,

    alterarPagamento: function () {
      var modo = document.getElementById('df-pagamento');
      var wrapParcelas = document.getElementById('df-parcelas-wrap');
      var resumo = document.getElementById('df-parcelas-resumo');
      var val = Number(document.getElementById('df-valor') && document.getElementById('df-valor').value);
      var totalParcelas = Number(document.getElementById('df-parcelas') && document.getElementById('df-parcelas').value) || 1;

      if (modo && wrapParcelas) {
        var parcelado = modo.value === 'parcelado';
        wrapParcelas.style.display = parcelado ? 'block' : 'none';
        if (!parcelado) totalParcelas = 1;
      }

      if (resumo) resumo.textContent = _resumoParcelas(val, totalParcelas);
    },

    abrir: function (tripId, despesaId) {
      _tripId    = tripId;
      _despesaId = despesaId || null;
      var viagem = Store.getViagens().find(function (v) { return v.id === tripId; }) || {};
      var participantesAtivos = _participantesAtivos(viagem);
      if (!participantesAtivos.length && !_despesaId) {
        _mostrarToast('Adicione ao menos 1 participante ativo na viagem antes de lançar despesas.', true);
        return;
      }
      var desp   = null;
      if (_despesaId) {
        Store.getDespesas(tripId).forEach(function (d) {
          if (d.id === _despesaId) desp = d;
        });
      }
      document.getElementById('desp-modal-title').textContent = despesaId ? 'Editar despesa' : 'Nova despesa';
      document.getElementById('desp-modal-save').textContent  = despesaId ? 'Salvar alterações' : 'Salvar despesa';
      // Para nova despesa usa a data de início da viagem como padrão
      var despForm = desp || {};
      if (!_despesaId && !despForm.data) {
        despForm = Object.assign({}, despForm, { data: (viagem && viagem.dataInicio) || '' });
      }
      var itin = Store.getItinerario ? Store.getItinerario(tripId) : null;
      document.getElementById('desp-modal-body').innerHTML    = _renderForm(viagem, despForm, itin);
      this.alterarPagamento();
      this._onCatChange();
      _overlay.classList.add('aberto');
      document.body.style.overflow = 'hidden';
      var f = document.getElementById('df-desc');
      if (f) setTimeout(function () { f.focus(); }, 300);
    },

    fechar: function () {
      _overlay.classList.remove('aberto');
      document.body.style.overflow = '';
      _tripId = _despesaId = null;
    },

    salvar: function () {
      if (!_validar()) return;
      var modo = document.getElementById('df-pagamento').value;
      var totalParcelas = modo === 'parcelado'
        ? Math.max(2, Math.floor(Number(document.getElementById('df-parcelas').value) || 2))
        : 1;
      var dados = {
        data:         _DTWidget.lerData('df-data'),
        categoria:    document.getElementById('df-cat').value,
        descricao:    document.getElementById('df-desc').value.trim(),
        valor:        Number(document.getElementById('df-valor').value),
        quemPagouId:  document.getElementById('df-pagante').value.trim(),
        participantesRateioIds: _coletarPartic(),
        observacoes:  document.getElementById('df-obs').value.trim(),
        tipoPagamento: modo,
        totalParcelas: totalParcelas,
      };
      // Coleta dados de hospedagem se aplicável
      if (dados.categoria === 'hospedagem') {
        var hospNome     = document.getElementById('df-hosp-nome');
        var hospEnd      = document.getElementById('df-hosp-end');
        var ciData       = _lerDiaSelect('df-ci-data');
        var ciHora       = _DTWidget.lerHora('df-ci-hora');
        var coData       = _lerDiaSelect('df-co-data');
        var coHora       = _DTWidget.lerHora('df-co-hora');
        dados.hospedagem = {
          nome:         (hospNome ? hospNome.value.trim() : '') || dados.descricao,
          endereco:     hospEnd  ? hospEnd.value.trim()  : '',
          checkInDate:  ciData  || '',
          checkInTime:  ciHora  || '',
          checkOutDate: coData  || '',
          checkOutTime: coHora  || '',
        };
        dados.origemModulo = dados.origemModulo || 'financeiro';
      } else {
        dados.hospedagem = null;
      }

      var savedDespId;
      if (_despesaId) {
        Store.editarDespesa(_tripId, _despesaId, dados);
        savedDespId = _despesaId;
      } else {
        var despCriada2 = Store.adicionarDespesa(_tripId, dados);
        savedDespId = despCriada2 ? despCriada2.id : null;
      }
      DespesaModal.fechar();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      if (savedDespId) _scrollToSaved('[data-desp-id="' + savedDespId + '"]');
    },

    _onCatChange: function () {
      var extra = document.getElementById('df-hosp-extra');
      if (!extra) return;
      if (_isHospedagem()) {
        extra.classList.add('desp-hosp-block-visivel');
      } else {
        extra.classList.remove('desp-hosp-block-visivel');
      }
    },
  };
})();

// ================================================================
// DespesaActions — Ações nos cards de despesa
// ================================================================
var DespesaActions = {
  editar: function (tripId, despesaId) {
    var lista = Store.getDespesas(tripId);
    var despesa = lista.find(function (d) { return d.id === despesaId; }) || null;
    var eRota = despesa && (despesa.origem === 'rota' || !!despesa.routeSegmentId);

    if (eRota) {
      var routeId = despesa.routeSegmentId;
      if (!routeId) return;
      if (Store.getState().viagemSelecionadaId !== tripId) {
        Store.selecionarViagem(tripId);
      }
      if (window.location.hash === '#/rotas') {
        TrechoModal.abrir(tripId, routeId);
      } else {
        Router.navegar('#/rotas');
        setTimeout(function () {
          TrechoModal.abrir(tripId, routeId);
        }, 0);
      }
      return;
    }

    DespesaModal.abrir(tripId, despesaId);
  },

  excluir: function (tripId, despesaId) {
    var lista = Store.getDespesas(tripId);
    var despesa = lista.find(function (d) { return d.id === despesaId; }) || null;
    var eRota = despesa && (despesa.origem === 'rota' || !!despesa.routeSegmentId);

    if (eRota) {
      if (!_confirmarExclusoesAtivo()) {
        Store.excluirTrecho(tripId, despesa.routeSegmentId);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        return;
      }
      ConfirmModal.abrirComCallback(
        'Excluir rota vinculada?',
        'Esta despesa foi gerada por uma rota. Ao confirmar, o trecho também será removido.',
        function () {
          Store.excluirTrecho(tripId, despesa.routeSegmentId);
          window.dispatchEvent(new HashChangeEvent('hashchange'));
        }
      );
      return;
    }

    var desc = 'esta despesa';
    if (despesa) desc = '"' + despesa.descricao + '"';
    if (!_confirmarExclusoesAtivo()) {
      Store.excluirDespesa(tripId, despesaId);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    ConfirmModal.abrirComCallback(
      'Excluir despesa?',
      'Excluir ' + desc + '? Esta ação não pode ser desfeita.',
      function () {
        Store.excluirDespesa(tripId, despesaId);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    );
  },
};

// ================================================================
// TrechoModal — Criação e edição de trechos de rota
// ================================================================
var TrechoModal = (function () {
  var _overlay = null;
  var _tripId = null;
  var _trechoId = null;
  var _routeSourceAtual = 'manual';
  var _origemPlace = null;
  var _destinoPlace = null;
  var _smController = null;

  var _tipos = [
    ['aereo', 'Aéreo ✈️'],
    ['carro', 'Carro 🚗'],
    ['van', 'Van 🚐'],
    ['onibus', 'Ônibus 🚌'],
    ['trem', 'Trem 🚆'],
    ['barco', 'Barco ⛵'],
    ['caminhada', 'Caminhada 🚶'],
    ['outro', 'Outro 🧭'],
  ];

  function _inject() {
    var div = document.createElement('div');
    div.id = 'trecho-modal-overlay';
    div.className = 'modal-overlay';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');
    div.setAttribute('aria-label', 'Formulário de trecho');
    div.innerHTML = (
      '<div class="modal-box" id="trecho-modal-box">' +
        '<div class="modal-handle"></div>' +
        '<div class="modal-header">' +
          '<span class="modal-title" id="trecho-modal-title">Novo trecho</span>' +
          '<button class="modal-close" onclick="TrechoModal.fechar()" aria-label="Fechar">✕</button>' +
        '</div>' +
        '<div class="modal-body" id="trecho-modal-body"></div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-ghost" onclick="TrechoModal.fechar()">Cancelar</button>' +
          '<button class="btn btn-primary" id="trecho-modal-save" onclick="TrechoModal.salvar()">Salvar</button>' +
        '</div>' +
      '</div>'
    );
    div.addEventListener('click', function (e) {
      if (e.target === div) TrechoModal.fechar();
    });
    document.body.appendChild(div);
    _overlay = div;
  }

  function _esc(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _opt(val, label, atual) {
    return '<option value="' + val + '"' + (val === atual ? ' selected' : '') + '>' + label + '</option>';
  }

  function _diasViagem(tripId) {
    var viagem = Store.getViagemSelecionada ? Store.getViagemSelecionada() : null;
    // Garante que seja a viagem correta
    if (!viagem || viagem.id !== tripId) {
      var lista = Store.getViagens ? Store.getViagens() : [];
      viagem = lista.find(function (v) { return v.id === tripId; }) || null;
    }
    if (!viagem || !viagem.dataInicio || !viagem.dataFim) return [];
    var dias = [];
    var atual = new Date(viagem.dataInicio + 'T12:00:00');
    var fim   = new Date(viagem.dataFim   + 'T12:00:00');
    var meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    while (atual <= fim) {
      var iso = atual.toISOString().slice(0, 10);
      var partes = iso.split('-');
      var label = partes[2] + ' ' + meses[Number(partes[1]) - 1] + ' ' + partes[0];
      dias.push({ iso: iso, label: label });
      atual.setDate(atual.getDate() + 1);
    }
    return dias;
  }

  function _renderForm(t, tripId) {
    t = t || {};
    var dias = _diasViagem(tripId || _tripId);
    var dataAtual = t.data || '';
    var dataSel = dias.length
      ? ('<div class="form-group" style="margin-bottom:var(--space-4)">' +
          '<label class="form-label" for="rf-data">Data do trecho <span style="font-size:var(--text-xs);color:var(--color-text-muted);font-weight:400">(aparece no Roteiro)</span></label>' +
          '<select id="rf-data" class="form-select">' +
            '<option value="">— Sem data —</option>' +
            dias.map(function (d) {
              return '<option value="' + d.iso + '"' + (d.iso === dataAtual ? ' selected' : '') + '>' + d.label + '</option>';
            }).join('') +
          '</select>' +
        '</div>')
      : ('<div class="form-group" style="margin-bottom:var(--space-4)">' +
          '<label class="form-label" for="rf-data">Data do trecho</label>' +
          _DTWidget.renderData('rf-data', dataAtual) +
          '<span class="form-hint" style="font-size:var(--text-xs);color:var(--color-text-muted)">Defina datas de início e fim na viagem para ver os dias disponíveis.</span>' +
        '</div>');
    var horarioPadrao = (t && t.horario) ? t.horario : '08:00';
    var horarioSecSel = (
      '<div class="form-group" style="margin-bottom:var(--space-3)">' +
        '<label class="form-label" for="rf-horario">Horário da partida</label>' +
        SmartTimePicker.render('rf-horario', horarioPadrao, 'TrechoModal._updateArrivalPreview()') +
      '</div>' +
      '<div id="rf-chegada-preview" class="rota-arrival-preview" style="display:none"></div>'
    );

    return (
      dataSel +
      horarioSecSel +
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="rf-origem">Origem</label>' +
          '<input id="rf-origem" class="form-input" type="text" maxlength="90" placeholder="Ex: Salvador - BA" value="' + _esc(t.origem) + '">' +
          '<span class="form-error" id="re-origem">Informe a origem.</span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="rf-destino">Destino</label>' +
          '<input id="rf-destino" class="form-input" type="text" maxlength="90" placeholder="Ex: Lençóis - BA" value="' + _esc(t.destino) + '">' +
          '<span class="form-error" id="re-destino">Informe o destino.</span>' +
        '</div>' +
      '</div>' +

      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="rf-tipo">Tipo</label>' +
          '<select id="rf-tipo" class="form-select">' +
            '<option value="">Selecione...</option>' +
            _tipos.map(function (p) { return _opt(p[0], p[1], t.tipo); }).join('') +
          '</select>' +
          '<span class="form-error" id="re-tipo">Selecione o tipo do trecho.</span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label" for="rf-dist">Distância (km)</label>' +
          '<input id="rf-dist" class="form-input" type="number" min="0" step="0.1" value="' + _esc(t.distanciaKm || '') + '">' +
          '<span class="form-error" id="re-dist">Distância deve ser zero ou maior.</span>' +
        '</div>' +
      '</div>' +

      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label" for="rf-dur">Duração estimada</label>' +
          '<div class="duration-field">' +
            '<input id="rf-dur" class="form-input" type="text" maxlength="40" placeholder="Ex: 2h, 1h30, 4:27" value="' + _esc(t.duracaoEstimada) + '" oninput="TrechoModal._updateArrivalPreview()" onblur="_durNormalizarBlur(this)">' +
            '<div class="dur-chips">' +
              ['30min','1h','2h','3h','4h','5h','6h','8h'].map(function(c){
                return '<button type="button" class="dur-chip" onclick="_durChipClick(\'rf-dur\',\'' + c + '\');TrechoModal._updateArrivalPreview()">' + c + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label" for="rf-consumo">Consumo médio (km/L)</label>' +
          '<input id="rf-consumo" class="form-input" type="number" min="0" step="0.01" value="' + _esc(t.consumoKmL || '') + '">' +
          '<span class="form-error" id="re-consumo">Consumo deve ser zero ou maior.</span>' +
        '</div>' +
      '</div>' +

      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label" for="rf-preco">Preço do combustível (R$/L)</label>' +
          '<input id="rf-preco" class="form-input" type="number" min="0" step="0.01" value="' + _esc(t.precoCombustivelLitro || '') + '">' +
          '<span class="form-error" id="re-preco">Preço deve ser zero ou maior.</span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label" for="rf-fixo">Custo fixo do trecho (R$)</label>' +
          '<input id="rf-fixo" class="form-input" type="number" min="0" step="0.01" value="' + _esc(t.custoFixo || '') + '">' +
          '<span class="form-error" id="re-fixo">Custo fixo deve ser zero ou maior.</span>' +
        '</div>' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label" for="rf-obs">Observações</label>' +
        '<textarea id="rf-obs" class="form-textarea" maxlength="300" placeholder="Observações do trecho...">' + _esc(t.observacoes) + '</textarea>' +
      '</div>' +

      // "Adicionar volta" — única em criação
      (!_trechoId
        ? ('<hr style="border:none;border-top:1px solid var(--color-border);margin:var(--space-4) 0">' +
           '<div class="form-group">' +
             '<label class="form-label" style="display:flex;align-items:center;gap:var(--space-2);cursor:pointer">' +
               '<input type="checkbox" id="rf-volta-check" onchange="TrechoModal._onVoltaToggle()" style="width:16px;height:16px;cursor:pointer"> ' +
               'Adicionar segmento de volta (Destino → Origem)' +
             '</label>' +
             '<div id="rf-volta-extra" style="display:none;margin-top:var(--space-3)">' +
               '<div class="form-group" style="margin-bottom:var(--space-3)">' +
                 '<label class="form-label" for="rf-volta-data">Data da volta</label>' +
                 (dias.length
                   ? ('<select id="rf-volta-data" class="form-select" onchange="TrechoModal._updateVoltaArrivalPreview()">' +
                      '<option value="">— Sem data —</option>' +
                      dias.map(function (d) { return '<option value="' + d.iso + '">' + d.label + '</option>'; }).join('') +
                      '</select>')
                   : _DTWidget.renderData('rf-volta-data', '')) +
               '</div>' +
               '<div class="form-group" style="margin-bottom:var(--space-3)">' +
                 '<label class="form-label" for="rf-volta-horario">Horário da volta</label>' +
                 SmartTimePicker.render('rf-volta-horario', '16:00', 'TrechoModal._updateVoltaArrivalPreview()') +
               '</div>' +
               '<div id="rf-volta-chegada-preview" class="rota-arrival-preview" style="display:none"></div>' +
               '<div class="rota-volta-preview" id="rf-volta-preview" style="display:none"></div>' +
             '</div>' +
           '</div>')
        : '')
    );
  }

  function _erro(id, mostrar, msg) {
    var el = document.getElementById('re-' + id);
    var inp = document.getElementById('rf-' + id);
    if (!el) return;
    if (mostrar) {
      if (msg) el.textContent = msg;
      el.classList.add('visivel');
      if (inp) inp.classList.add('invalido');
    } else {
      el.classList.remove('visivel');
      if (inp) inp.classList.remove('invalido');
    }
  }

  function _limparErros() {
    ['origem', 'destino', 'tipo', 'dist', 'consumo', 'preco', 'fixo', 'data'].forEach(function (k) { _erro(k, false); });
  }

  function _validar() {
    _limparErros();
    var ok = true;
    var origem = document.getElementById('rf-origem');
    var destino = document.getElementById('rf-destino');
    var tipo = document.getElementById('rf-tipo');
    var dist = Number(document.getElementById('rf-dist').value || 0);
    var consumo = Number(document.getElementById('rf-consumo').value || 0);
    var preco = Number(document.getElementById('rf-preco').value || 0);
    var fixo = Number(document.getElementById('rf-fixo').value || 0);

    if (!origem || !origem.value.trim()) { _erro('origem', true); ok = false; }
    if (!destino || !destino.value.trim()) { _erro('destino', true); ok = false; }
    if (!tipo || !tipo.value) { _erro('tipo', true); ok = false; }
    if (dist < 0) { _erro('dist', true); ok = false; }
    if (consumo < 0) { _erro('consumo', true); ok = false; }
    if (preco < 0) { _erro('preco', true); ok = false; }
    if (fixo < 0) { _erro('fixo', true); ok = false; }

    return ok;
  }

  // ---- Arrival time helpers (private) ----
  function _parseDurMinutes(str) {
    if (!str) return null;
    var s = String(str).trim().toLowerCase();
    var hm = s.match(/^(\d+)\s*h\s*(\d+)\s*(?:min|m)?$/);
    if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
    var ho = s.match(/^(\d+)\s*h$/);
    if (ho) return parseInt(ho[1], 10) * 60;
    var mi = s.match(/^(\d+)\s*(?:min|m)$/);
    if (mi) return parseInt(mi[1], 10);
    var col = s.match(/^(\d+):(\d{2})$/);
    if (col) return parseInt(col[1], 10) * 60 + parseInt(col[2], 10);
    var n = parseInt(s, 10);
    return (!isNaN(n) && n > 0) ? n : null;
  }

  function _computeArrival(dateISO, timeHHMM, durationStr) {
    if (!dateISO || !timeHHMM) return null;
    var mins = _parseDurMinutes(durationStr);
    if (!mins || mins <= 0) return null;
    var parts = timeHHMM.split(':');
    var depMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    var arrMins = depMins + mins;
    var extraDays = Math.floor(arrMins / (24 * 60));
    arrMins = arrMins % (24 * 60);
    var hh = String(Math.floor(arrMins / 60)).padStart(2, '0');
    var mm = String(arrMins % 60).padStart(2, '0');
    var arrDate = dateISO;
    if (extraDays > 0) {
      var d = new Date(dateISO + 'T12:00:00');
      d.setDate(d.getDate() + extraDays);
      arrDate = d.toISOString().slice(0, 10);
    }
    return { data: arrDate, horario: hh + ':' + mm, nextDay: extraDays > 0 };
  }

  return {
    init: _inject,

    abrir: function (tripId, trechoId) {
      _tripId = tripId;
      _trechoId = trechoId || null;
      var trecho = null;
      if (_trechoId) {
        Store.getTrechosRota(tripId).forEach(function (t) {
          if (t.id === _trechoId) trecho = t;
        });
      }
      _routeSourceAtual = (trecho && trecho.routeSource) ? trecho.routeSource : 'manual';
      _origemPlace = trecho && trecho.origemPlaceId
        ? { label: trecho.origem || '', placeId: trecho.origemPlaceId }
        : null;
      _destinoPlace = trecho && trecho.destinoPlaceId
        ? { label: trecho.destino || '', placeId: trecho.destinoPlaceId }
        : null;
      document.getElementById('trecho-modal-title').textContent = trechoId ? 'Editar trecho' : 'Novo trecho';
      document.getElementById('trecho-modal-save').textContent = trechoId ? 'Salvar alterações' : 'Salvar trecho';
      var _trechoBase = trecho;
      if (!_trechoId) {
        var _prefs = _lerPreferencias();
        _trechoBase = Object.assign({
          tipo: _prefs.routeTipoPadrao || 'carro',
          consumoKmL: (_prefs.consumoPadrao !== '' && _prefs.consumoPadrao != null) ? Number(_prefs.consumoPadrao) || '' : '',
          precoCombustivelLitro: (_prefs.precoCombustivelPadrao !== '' && _prefs.precoCombustivelPadrao != null) ? Number(_prefs.precoCombustivelPadrao) || '' : '',
        }, trecho || {});
      } else {
        _trechoBase = trecho || {};
      }
      document.getElementById('trecho-modal-body').innerHTML = _renderForm(_trechoBase, tripId);

      _smController = null;

      function _setSaveDisabled(dis) {
        var btn = document.getElementById('trecho-modal-save');
        if (btn) btn.disabled = !!dis;
      }

      function _setStatus(tipo) {
        if (tipo === 'calculando') {
          _setSaveDisabled(true);
        } else {
          _setSaveDisabled(false);
        }
      }

      if (window.MapsService && typeof MapsService.bindSmartRouteInputs === 'function' && MapsService.hasApiKey()) {
        var origemInput = document.getElementById('rf-origem');
        var destinoInput = document.getElementById('rf-destino');
        var tipoSelect = document.getElementById('rf-tipo');

        // Atualizar preview de volta quando origem/destino mudarem
        function _onTrajetoChange() { TrechoModal._updateVoltaPreview(); }
        if (origemInput) origemInput.addEventListener('input', _onTrajetoChange);
        if (destinoInput) destinoInput.addEventListener('input', _onTrajetoChange);

        _smController = MapsService.bindSmartRouteInputs({
          originInput:      origemInput,
          destinationInput: destinoInput,
          getTipo: function () {
            return tipoSelect ? tipoSelect.value : '';
          },
          onCalculating: function () {
            _routeSourceAtual = 'google';
            _setStatus('calculando');
          },
          onRouteComputed: function (res) {
            _routeSourceAtual = 'google';
            _origemPlace  = _smController ? _smController.getOriginPlace()      : null;
            _destinoPlace = _smController ? _smController.getDestinationPlace() : null;
            var dist = document.getElementById('rf-dist');
            var dur  = document.getElementById('rf-dur');
            if (dist) dist.value = String(res.distanceKm  || '');
            if (dur)  dur.value  = String(res.durationText || '');
            _setStatus('ok');
          },
          onError: function (msg) {
            _routeSourceAtual = 'manual';
            _origemPlace  = _smController ? _smController.getOriginPlace()      : null;
            _destinoPlace = _smController ? _smController.getDestinationPlace() : null;
            _setStatus('erro', msg);
          },
          onManual: function () {
            _routeSourceAtual = 'manual';
            _origemPlace  = null;
            _destinoPlace = null;
            var tipo = tipoSelect ? tipoSelect.value : '';
            var supported = tipo && window.MapsService && MapsService.travelModeForTipo(tipo);
            _setStatus(tipo && !supported ? 'manual' : 'hint');
          },
        });

        // Tipo change → retrigger
        if (tipoSelect) {
          tipoSelect.addEventListener('change', function () {
            if (_smController) _smController.retrigger();
          });
        }
      }

      _overlay.classList.add('aberto');
      document.body.style.overflow = 'hidden';
      var f = document.getElementById('rf-origem');
      if (f) setTimeout(function () { f.focus(); }, 300);
    },

    fechar: function () {
      _overlay.classList.remove('aberto');
      document.body.style.overflow = '';
      _tripId = _trechoId = null;
      _routeSourceAtual = 'manual';
      _origemPlace = null;
      _destinoPlace = null;
      if (_smController) { _smController.reset(); _smController = null; }
      var btn = document.getElementById('trecho-modal-save');
      if (btn) btn.disabled = false;
    },

    salvar: function () {
      if (!_validar()) return;
      var saveBtn = document.getElementById('trecho-modal-save');
      if (saveBtn && saveBtn.disabled) return; // cálculo em andamento

      // Capture local copies before fechar() nullifies the module state
      var tripId   = _tripId;
      var trechoId = _trechoId;
      var routeSource  = _routeSourceAtual || 'manual';
      var origemPlace  = _origemPlace;
      var destinoPlace = _destinoPlace;

      var dados = {
        origem: document.getElementById('rf-origem').value.trim(),
        destino: document.getElementById('rf-destino').value.trim(),
        tipo: document.getElementById('rf-tipo').value,
        data: (function() { var el = document.getElementById('rf-data'); return el ? el.value : _DTWidget.lerData('rf-data'); })(),
        horario: (function() { var el = document.getElementById('rf-horario'); return el ? (el.value || '08:00') : '08:00'; })(),
        distanciaKm: Number(document.getElementById('rf-dist').value) || 0,
        duracaoEstimada: document.getElementById('rf-dur').value.trim(),
        consumoKmL: Number(document.getElementById('rf-consumo').value) || 0,
        precoCombustivelLitro: Number(document.getElementById('rf-preco').value) || 0,
        custoFixo: Number(document.getElementById('rf-fixo').value) || 0,
        observacoes: document.getElementById('rf-obs').value.trim(),
        routeSource: routeSource,
        calculoModo: (routeSource === 'google' ? 'google' : 'manual'),
        origemPlaceId:  origemPlace  && origemPlace.placeId  ? origemPlace.placeId  : '',
        destinoPlaceId: destinoPlace && destinoPlace.placeId ? destinoPlace.placeId : '',
      };
      // Compute and persist arrival time
      var _chegIda = _computeArrival(dados.data, dados.horario, dados.duracaoEstimada);
      if (_chegIda) { dados.chegadaData = _chegIda.data; dados.chegadaHorario = _chegIda.horario; }

      // Read return-trip fields before closing modal
      var voltaCheck  = document.getElementById('rf-volta-check');
      var comVolta    = !trechoId && voltaCheck && voltaCheck.checked;
      var voltaDataEl = document.getElementById('rf-volta-data');
      var voltaData   = voltaDataEl ? voltaDataEl.value : (_DTWidget ? _DTWidget.lerData('rf-volta-data') : '');
      var voltaHorarioEl = document.getElementById('rf-volta-horario');
      var voltaHorario   = voltaHorarioEl ? (voltaHorarioEl.value || '16:00') : '16:00';

      // Close modal immediately — UI state cleared after this line
      TrechoModal.fechar();

      if (trechoId) {
        Store.editarTrechoRota(tripId, trechoId, dados);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        return;
      }

      if (comVolta) {
        // Shared group id for ida + volta
        var groupId = 'rtg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        var dadosIda = Object.assign({}, dados, { direction: 'ida', roundTripGroupId: groupId });

        // Return segment base data (reversed origin/destination)
        var dadosVolta = {
          origem:              dados.destino,
          destino:             dados.origem,
          tipo:                dados.tipo,
          data:                voltaData || '',
          horario:             voltaHorario,
          distanciaKm:         dados.distanciaKm,
          duracaoEstimada:     dados.duracaoEstimada,
          consumoKmL:          dados.consumoKmL,
          precoCombustivelLitro: dados.precoCombustivelLitro,
          custoFixo:           dados.custoFixo,
          observacoes:         dados.observacoes,
          routeSource:         'manualFallback',
          calculoModo:         'manual',
          origemPlaceId:       dados.destinoPlaceId || '',
          destinoPlaceId:      dados.origemPlaceId  || '',
          direction:           'volta',
          roundTripGroupId:    groupId,
        };
        // Compute arrival for return segment
        var _chegVolta = _computeArrival(dadosVolta.data, dadosVolta.horario, dadosVolta.duracaoEstimada);
        if (_chegVolta) { dadosVolta.chegadaData = _chegVolta.data; dadosVolta.chegadaHorario = _chegVolta.horario; }

        // Save outbound first (synchronous)
        Store.adicionarTrechoRota(tripId, dadosIda);

        // Try to auto-compute reverse route via Google Maps
        var canComputeReverse = routeSource === 'google' &&
          destinoPlace && destinoPlace.placeId &&
          origemPlace  && origemPlace.placeId  &&
          window.MapsService && typeof MapsService.computeRoute === 'function' &&
          MapsService.travelModeForTipo(dados.tipo);

        if (canComputeReverse) {
          MapsService.computeRoute({
            origin:               destinoPlace.label,
            destination:          origemPlace.label,
            originPlaceId:        destinoPlace.placeId,
            destinationPlaceId:   origemPlace.placeId,
            travelMode:           MapsService.travelModeForTipo(dados.tipo),
          }).then(function (res) {
            if (res && res.distanceKm != null) {
              dadosVolta.distanciaKm     = res.distanceKm;
              dadosVolta.duracaoEstimada = res.durationText || '';
              dadosVolta.routeSource     = 'google';
              dadosVolta.calculoModo     = 'google';
            }
            Store.adicionarTrechoRota(tripId, dadosVolta);
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          }).catch(function () {
            // Fallback: copy outbound values, mark as manualFallback
            Store.adicionarTrechoRota(tripId, dadosVolta);
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          });
          // Dispatch for outbound card to appear immediately; volta will re-render on resolve
          window.dispatchEvent(new HashChangeEvent('hashchange'));
          return;
        }

        // No Google Maps available — save both synchronously
        Store.adicionarTrechoRota(tripId, dadosVolta);
      } else {
        Store.adicionarTrechoRota(tripId, dados);
      }

      window.dispatchEvent(new HashChangeEvent('hashchange'));
    },

    _onVoltaToggle: function () {
      var chk = document.getElementById('rf-volta-check');
      var extra = document.getElementById('rf-volta-extra');
      if (!chk || !extra) return;
      extra.style.display = chk.checked ? '' : 'none';
      TrechoModal._updateVoltaPreview();
    },

    _updateVoltaPreview: function () {
      var previewDiv = document.getElementById('rf-volta-preview');
      if (!previewDiv) return;
      var origemEl = document.getElementById('rf-origem');
      var destinoEl = document.getElementById('rf-destino');
      var origem = origemEl ? origemEl.value.trim() : '';
      var destino = destinoEl ? destinoEl.value.trim() : '';
      if (!destino || !origem) { previewDiv.style.display = 'none'; return; }
      previewDiv.style.display = '';
      previewDiv.textContent = '↩ Volta: ' + destino + ' → ' + origem;
      TrechoModal._updateVoltaArrivalPreview();
    },

    _updateArrivalPreview: function () {
      var preview = document.getElementById('rf-chegada-preview');
      if (!preview) return;
      var dateEl = document.getElementById('rf-data');
      var timeEl = document.getElementById('rf-horario');
      var durEl  = document.getElementById('rf-dur');
      var arr = _computeArrival(
        dateEl ? dateEl.value : '',
        timeEl ? timeEl.value : '',
        durEl  ? durEl.value  : ''
      );
      if (!arr) { preview.style.display = 'none'; return; }
      var p = arr.data.split('-');
      preview.style.display = '';
      preview.textContent = '→ Chegada prevista: ' + arr.horario + (arr.nextDay ? ' (+1 dia)' : '') + ' · ' + p[2] + '/' + p[1] + '/' + p[0];
    },

    _updateVoltaArrivalPreview: function () {
      var preview = document.getElementById('rf-volta-chegada-preview');
      if (!preview) return;
      var dateEl = document.getElementById('rf-volta-data');
      var timeEl = document.getElementById('rf-volta-horario');
      var durEl  = document.getElementById('rf-dur');
      var arr = _computeArrival(
        dateEl ? dateEl.value : '',
        timeEl ? timeEl.value : '',
        durEl  ? durEl.value  : ''
      );
      if (!arr) { preview.style.display = 'none'; return; }
      var p = arr.data.split('-');
      preview.style.display = '';
      preview.textContent = '→ Chegada prevista: ' + arr.horario + (arr.nextDay ? ' (+1 dia)' : '') + ' · ' + p[2] + '/' + p[1] + '/' + p[0];
    },
  };
})();

// ================================================================
// ================================================================
// TrechoActions — Ações nos cards de trecho
// ================================================================

// Mini-dialog de escolha para round-trip (ida e volta)
function _abrirRoundTripDialog(titulo, desc, labelSo, labelTodos, cbSo, cbTodos) {
  var existente = document.getElementById('_rt-dialog-overlay');
  if (existente) existente.remove();
  var ov = document.createElement('div');
  ov.id = '_rt-dialog-overlay';
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  ov.innerHTML = (
    '<div style="background:var(--color-surface);border-radius:var(--radius-xl) var(--radius-xl) 0 0;padding:var(--space-5) var(--space-4) var(--space-6);width:100%;max-width:480px;box-shadow:0 -4px 24px rgba(0,0,0,.18)">' +
      '<div style="font-size:var(--text-base);font-weight:700;margin-bottom:var(--space-2)">' + titulo + '</div>' +
      '<div style="font-size:var(--text-sm);color:var(--color-text-secondary);margin-bottom:var(--space-4)">' + desc + '</div>' +
      '<div style="display:flex;flex-direction:column;gap:var(--space-2)">' +
        '<button id="_rt-btn-so" class="btn btn-danger" style="width:100%">' + labelSo + '</button>' +
        '<button id="_rt-btn-todos" class="btn btn-danger btn-outline" style="width:100%">' + labelTodos + '</button>' +
        '<button id="_rt-btn-cancel" class="btn btn-ghost" style="width:100%">Cancelar</button>' +
      '</div>' +
    '</div>'
  );
  document.body.appendChild(ov);
  function _fechar() { ov.remove(); }
  document.getElementById('_rt-btn-so').onclick = function () { _fechar(); cbSo(); };
  document.getElementById('_rt-btn-todos').onclick = function () { _fechar(); cbTodos(); };
  document.getElementById('_rt-btn-cancel').onclick = _fechar;
  ov.addEventListener('click', function (e) { if (e.target === ov) _fechar(); });
}

var TrechoActions = {
  editar: function (tripId, trechoId) {
    TrechoModal.abrir(tripId, trechoId);
  },

  excluir: function (tripId, trechoId) {
    var lista = Store.getTrechosRota(tripId);
    var trecho = null;
    var nome = 'este trecho';
    lista.forEach(function (t) {
      if (t.id === trechoId) { trecho = t; nome = '"' + t.origem + ' → ' + t.destino + '"'; }
    });

    var groupId = trecho && trecho.roundTripGroupId;

    function _excluirSo() {
      Store.excluirTrechoRota(tripId, trechoId);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    function _excluirGrupo() {
      Store.excluirTrechosPorGrupo(tripId, groupId);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }

    if (!_confirmarExclusoesAtivo()) {
      if (groupId) {
        _abrirRoundTripDialog(
          'Excluir trecho?',
          nome + ' faz parte de um grupo ida/volta.',
          'Excluir só ' + (trecho.direction === 'volta' ? 'a volta' : 'a ida'),
          'Excluir ida e volta',
          _excluirSo,
          _excluirGrupo
        );
      } else {
        _excluirSo();
      }
      return;
    }

    if (groupId) {
      _abrirRoundTripDialog(
        'Excluir trecho?',
        nome + ' faz parte de um grupo ida/volta. O que deseja excluir?',
        'Excluir só ' + (trecho.direction === 'volta' ? 'a volta' : 'a ida'),
        'Excluir ida e volta',
        function () {
          ConfirmModal.abrirComCallback(
            'Excluir trecho?',
            'Excluir ' + nome + '? Esta ação não pode ser desfeita.',
            _excluirSo
          );
        },
        function () {
          ConfirmModal.abrirComCallback(
            'Excluir ida e volta?',
            'Excluir grupo de ida e volta? Esta ação não pode ser desfeita.',
            _excluirGrupo
          );
        }
      );
    } else {
      ConfirmModal.abrirComCallback(
        'Excluir trecho?',
        'Excluir ' + nome + '? Esta ação não pode ser desfeita.',
        _excluirSo
      );
    }
  },
};

// ==== INICIALIZAÇÃO ====
(async function inicializar() {

  // Injeta modais no DOM antes de qualquer coisa
  TripModal.init();
  ConfirmModal.init();
  TripSwitcher.init();
  AtividadeModal.init();
  DespesaModal.init();
  TrechoModal.init();

  await iniciarAuthStateListener();
  atualizarHeaderAuthUI();
  atualizarBadgeModoDadosHeader();
  _aplicarDensidade();

  if (window.MapsService && typeof MapsService.init === 'function') {
    MapsService.init().catch(function () {});
  }

  Router.setGuard(_guardAcessoRotas);

  // Registra todas as rotas
  Router.registrar('/inicio',        paginaInicio);
  Router.registrar('/viagens',       paginaViagens);
  Router.registrar('/viagem/:id',    paginaViagemDetalhe);
  Router.registrar('/roteiro',       paginaRoteiro);
  Router.registrar('/financeiro',    paginaFinanceiro);
  Router.registrar('/rotas',         paginaRotas);
  Router.registrar('/bagagem',        paginaBagagem);
  Router.registrar('/login',         paginaLogin);
  Router.registrar('/config',        paginaConfiguracoes);
  Router.registrar('/configuracoes', paginaConfiguracoes);

  // Inicia o roteador
  Router.init(document.getElementById('page-container'));

  if (!window.location.hash) {
    window.location.hash = '#' + _rotaInicialPadrao();
  }

  window.addEventListener('online', function () {
    SyncService.syncLocalToCloud({ silent: false, source: 'online' });
    _atualizarDiagnosticosConfig();
    if ((window.location.hash || '') === '#/config') {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      SyncService.syncLocalToCloud({ silent: true, source: 'visible' });
      _atualizarDiagnosticosConfig();
    }
  });

  // Registra o Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').then(function (reg) {
        console.log('[RotaBoa] SW registrado:', reg.scope);
      }).catch(function (err) {
        console.warn('[RotaBoa] SW falhou:', err);
      });
    });
  }

})();
