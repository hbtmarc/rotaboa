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
};
var RB_OFFLINE_KEY = 'rotaboa.offlineMode.v1';
var RB_SYNC_STATUS_KEY = 'rotaboa.sync.status.v1';
var RB_PREFS_KEY = 'rotaboa.preferences.v1';
var RB_APP_VERSION = 'mvp-0.2.0';

var RB_PREFS_DEFAULT = {
  paginaInicialPadrao: '/inicio',
  mostrarValoresInicio: true,
  confirmarAntesExcluir: true,
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

var SyncService = (function () {
  var _status = _lerSyncStatus();
  var _timer = null;
  var _isSyncing = false;
  var _lastToastAt = { ok: 0, pending: 0, offline: 0 };

  function _agora() {
    return Date.now();
  }

  function _toastCooldown(tipo, ms) {
    var now = _agora();
    if ((now - (_lastToastAt[tipo] || 0)) < ms) return false;
    _lastToastAt[tipo] = now;
    return true;
  }

  function _temSessaoAtiva() {
    return !!RB_AUTH_STATE.user || !!RB_AUTH_STATE.offlineMode;
  }

  function _payloadLocal() {
    function ler(chave) {
      try {
        var raw = localStorage.getItem(chave);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    }

    return {
      trips: ler(RB_LOCAL_KEYS.trips) || [],
      selectedTripId: localStorage.getItem(RB_LOCAL_KEYS.selectedTrip) || null,
      itineraries: ler(RB_LOCAL_KEYS.itineraries) || {},
      expenses: ler(RB_LOCAL_KEYS.expenses) || {},
      routes: ler(RB_LOCAL_KEYS.routes) || {},
      updatedAt: new Date().toISOString(),
      appVersion: RB_APP_VERSION,
    };
  }

  function _persistir() {
    _salvarSyncStatus(_status);
  }

  async function syncLocalToCloud(opcoes) {
    var opts = opcoes || {};
    var silent = opts.silent !== false;

    if (_isSyncing) {
      return { ok: false, reason: 'syncing' };
    }

    if (RB_AUTH_STATE.offlineMode) {
      _status.pending = true;
      _persistir();
      if (!silent && _toastCooldown('offline', 5000)) {
        _mostrarToast('Sem conexão');
      }
      return { ok: false, reason: 'offline-mode' };
    }
    if (!RB_AUTH_STATE.user || !RB_AUTH_STATE.user.uid) {
      _status.pending = true;
      _persistir();
      return { ok: false, reason: 'sem-usuario' };
    }
    if (!navigator.onLine) {
      _status.pending = true;
      _persistir();
      if (!silent && _toastCooldown('offline', 5000)) {
        _mostrarToast('Sem conexão');
      }
      return { ok: false, reason: 'sem-internet' };
    }
    if (!window.FirebaseClient || !FirebaseClient.uploadAppState) {
      _status.pending = true;
      _status.lastError = 'Cliente Firebase indisponível para sincronização.';
      _persistir();
      if (!silent && _toastCooldown('pending', 5000)) {
        _mostrarToast('Sincronização pendente');
      }
      return { ok: false, reason: 'firebase-indisponivel' };
    }

    _isSyncing = true;
    _status.syncing = true;
    _status.lastError = '';
    _persistir();

    try {
      await FirebaseClient.uploadAppState(RB_AUTH_STATE.user.uid, _payloadLocal());
      _status.pending = false;
      _status.syncing = false;
      _status.lastSyncAt = new Date().toISOString();
      _status.lastError = '';
      _persistir();
      if (!silent && _toastCooldown('ok', 2500)) {
        _mostrarToast('Sincronizado');
      }
      return { ok: true };
    } catch (e) {
      _status.pending = true;
      _status.syncing = false;
      _status.lastError = String((e && (e.friendly || e.message)) || 'Falha ao sincronizar.');
      _persistir();
      if (!silent && _toastCooldown('pending', 5000)) {
        _mostrarToast('Sincronização pendente');
      }
      return { ok: false, reason: 'erro-sync' };
    } finally {
      _isSyncing = false;
    }
  }

  function markPendingSync(opcoes) {
    var estavaPendente = !!_status.pending;
    _status.pending = true;
    _persistir();
    if (!estavaPendente && (!opcoes || opcoes.toast !== false) && _toastCooldown('pending', 5000)) {
      _mostrarToast('Sincronização pendente');
    }
    if (_temSessaoAtiva()) {
      setTimeout(function () {
        syncLocalToCloud({ silent: true, source: 'pending-change' });
      }, 0);
    }
  }

  function getSyncStatus() {
    return Object.assign({}, _status);
  }

  function stopAutoSync() {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  }

  function startAutoSync() {
    stopAutoSync();
    if (!_temSessaoAtiva()) return;

    _timer = setInterval(function () {
      syncLocalToCloud({ silent: true, source: 'interval' });
    }, 60000);

    syncLocalToCloud({ silent: true, source: 'start' });
  }

  return {
    syncLocalToCloud: syncLocalToCloud,
    markPendingSync: markPendingSync,
    getSyncStatus: getSyncStatus,
    startAutoSync: startAutoSync,
    stopAutoSync: stopAutoSync,
  };
})();

function _temAcessoPrivado() {
  return !!RB_AUTH_STATE.offlineMode || !!RB_AUTH_STATE.user;
}

function _ehRotaPublica(caminho) {
  return caminho === '/login';
}

function _guardAcessoRotas(caminho) {
  if (_ehRotaPublica(caminho)) {
    if (_temAcessoPrivado()) return '#/inicio';
    return null;
  }
  if (_temAcessoPrivado()) return null;
  return '#/login';
}

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
  return merged;
}

function _rotaInicialPadrao() {
  var prefs = _lerPreferencias();
  var validas = ['/inicio', '/viagens', '/roteiro', '/financeiro', '/rotas'];
  return validas.indexOf(prefs.paginaInicialPadrao) !== -1 ? prefs.paginaInicialPadrao : '/inicio';
}

function _confirmarExclusoesAtivo() {
  return _lerPreferencias().confirmarAntesExcluir !== false;
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

function iniciarAuthStateListener() {
  if (RB_AUTH_STATE.initialized) return Promise.resolve();

  if (RB_AUTH_STATE.offlineMode) {
    RB_AUTH_STATE.user = null;
    RB_AUTH_STATE.initialized = true;
    atualizarHeaderAuthUI();
    atualizarBadgeModoDadosHeader();
    SyncService.startAutoSync();
    return Promise.resolve();
  }

  if (!window.FirebaseClient || !FirebaseClient.onAuthChange) {
    RB_AUTH_STATE.user = null;
    RB_AUTH_STATE.initialized = true;
    atualizarHeaderAuthUI();
    atualizarBadgeModoDadosHeader();
    SyncService.stopAutoSync();
    return Promise.resolve();
  }

  return new Promise(function (resolve) {
    var resolvido = false;
    function resolverPrimeiraVez() {
      if (resolvido) return;
      resolvido = true;
      resolve();
    }

    FirebaseClient.onAuthChange(function (user) {
      RB_AUTH_STATE.user = user || null;
      RB_AUTH_STATE.initialized = true;
      atualizarHeaderAuthUI();
      atualizarBadgeModoDadosHeader();
      resolverPrimeiraVez();
      if (RB_AUTH_STATE.user || RB_AUTH_STATE.offlineMode) {
        SyncService.startAutoSync();
        if (RB_AUTH_STATE.user) SyncService.syncLocalToCloud({ silent: false, source: 'auth-ready' });
      } else {
        SyncService.stopAutoSync();
      }
    }).then(function (unsubscribe) {
      RB_AUTH_STATE.unsubscribe = unsubscribe;
    }).catch(function () {
      RB_AUTH_STATE.user = null;
      RB_AUTH_STATE.initialized = true;
      atualizarHeaderAuthUI();
      atualizarBadgeModoDadosHeader();
      SyncService.stopAutoSync();
      resolverPrimeiraVez();
    });
  });
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
      return UI.renderTripCard(v, selectedId);
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
  var desp = res.despesas;
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
      UI.renderSectionHeader('Despesas', '', '') +
      listaDesp +
    '</div>'
  );

  container.innerHTML = html;
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
  var trechosAtivos = Store.getRotas(viagem.id);
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
function paginaConfiguracoes(params, container) {
  var sync = SyncService.getSyncStatus();
  var prefs = _lerPreferencias();
  var avisoSync = _renderAvisoSincronizacao();

  function _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function _txtStatusSync() {
    if (RB_AUTH_STATE.offlineMode) return 'Somente neste dispositivo';
    if (sync.syncing) return 'Sincronizando';
    if (sync.pending) return 'Pendente';
    return 'Sincronizado';
  }

  function _txtUltimaSync() {
    if (!sync.lastSyncAt) return 'Ainda não sincronizado';
    try {
      return new Date(sync.lastSyncAt).toLocaleString('pt-BR');
    } catch (e) {
      return sync.lastSyncAt;
    }
  }

  var html = (
    '<div class="page-section">' +
      UI.renderSectionHeader('Configuração', '', '') +

      avisoSync +

      // Conta
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-header"><span class="font-semibold">👤 Conta</span></div>' +
        '<div class="card-body">' +
          (RB_AUTH_STATE.offlineMode
            ? '<p class="text-sm">Modo offline ativo neste dispositivo.</p>'
            : '<p class="text-sm">' + _esc(_nomeUsuarioAuth(RB_AUTH_STATE.user)) + '</p>') +
          '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-top:var(--space-3)">' +
            (RB_AUTH_STATE.user ? '<button class="btn btn-ghost btn-sm" onclick="AuthActions.sair()">Sair</button>' : '') +
            (RB_AUTH_STATE.offlineMode ? '<button class="btn btn-ghost btn-sm" onclick="ConfigActions.sairModoOffline()">Sair do modo offline</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +

      // Sincronização
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-header"><span class="font-semibold">🔄 Sincronização</span></div>' +
        '<div class="card-body">' +
          '<div class="expense-row">' +
            '<span class="text-sm text-secondary">Status</span>' +
            '<span class="badge ' + ((sync.pending || sync.syncing) ? 'badge-info' : 'badge-ok') + '">' + _esc(_txtStatusSync()) + '</span>' +
          '</div>' +
          '<div class="expense-row">' +
            '<span class="text-sm text-secondary">Última sincronização</span>' +
            '<span class="text-sm">' + _esc(_txtUltimaSync()) + '</span>' +
          '</div>' +
          (sync.lastError ? '<p class="text-xs" style="margin-top:var(--space-2);color:var(--color-danger)">Não foi possível sincronizar agora.</p>' : '') +
          ((!RB_AUTH_STATE.offlineMode && RB_AUTH_STATE.user)
            ? '<div style="margin-top:var(--space-3)"><button class="btn btn-secondary btn-sm" onclick="ConfigActions.sincronizarAgora()"' + (navigator.onLine ? '' : ' disabled') + '>Sincronizar agora</button></div>'
            : '') +
          '<div id="cfg-sync-status" class="text-xs text-muted" style="margin-top:var(--space-3)"></div>' +
        '</div>' +
      '</div>' +

      // Dados locais
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-header"><span class="font-semibold">💾 Dados locais</span></div>' +
        '<div class="card-body">' +
          '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap">' +
            '<button class="btn btn-primary btn-sm" onclick="ConfigActions.exportarBackup()">Exportar backup JSON</button>' +
            '<button class="btn btn-secondary btn-sm" onclick="ConfigActions.importarBackup()">Importar backup JSON</button>' +
            '<button class="btn btn-ghost btn-sm" style="color:var(--color-danger)" onclick="ConfigActions.limparDadosLocais()">Limpar dados locais</button>' +
          '</div>' +
          '<input id="cfg-backup-input" type="file" accept="application/json" style="display:none" onchange="ConfigActions.processarArquivoBackup(event)">' +
          '<div id="cfg-backup-status" class="text-xs text-muted" style="margin-top:var(--space-3)"></div>' +
        '</div>' +
      '</div>' +

      // Preferências
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-header"><span class="font-semibold">⚙️ Preferências</span></div>' +
        '<div class="card-body">' +
          '<div class="form-group">' +
            '<label class="form-label" for="pref-pagina-inicial">Página inicial padrão</label>' +
            '<select id="pref-pagina-inicial" class="form-select">' +
              '<option value="/inicio"' + (prefs.paginaInicialPadrao === '/inicio' ? ' selected' : '') + '>Início</option>' +
              '<option value="/viagens"' + (prefs.paginaInicialPadrao === '/viagens' ? ' selected' : '') + '>Viagens</option>' +
              '<option value="/roteiro"' + (prefs.paginaInicialPadrao === '/roteiro' ? ' selected' : '') + '>Roteiro</option>' +
              '<option value="/financeiro"' + (prefs.paginaInicialPadrao === '/financeiro' ? ' selected' : '') + '>Financeiro</option>' +
              '<option value="/rotas"' + (prefs.paginaInicialPadrao === '/rotas' ? ' selected' : '') + '>Rotas</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label" for="pref-mostrar-valores">Mostrar valores financeiros na tela inicial</label>' +
            '<select id="pref-mostrar-valores" class="form-select">' +
              '<option value="sim"' + (prefs.mostrarValoresInicio !== false ? ' selected' : '') + '>Sim</option>' +
              '<option value="nao"' + (prefs.mostrarValoresInicio === false ? ' selected' : '') + '>Não</option>' +
            '</select>' +
          '</div>' +
          '<div class="form-group">' +
            '<label class="form-label" for="pref-confirmar-exclusao">Confirmações antes de excluir</label>' +
            '<select id="pref-confirmar-exclusao" class="form-select">' +
              '<option value="sim"' + (prefs.confirmarAntesExcluir !== false ? ' selected' : '') + '>Sim</option>' +
              '<option value="nao"' + (prefs.confirmarAntesExcluir === false ? ' selected' : '') + '>Não</option>' +
            '</select>' +
          '</div>' +
          '<button class="btn btn-primary btn-sm" onclick="ConfigActions.salvarPreferencias()">Salvar preferências</button>' +
          '<div id="cfg-pref-status" class="text-xs text-muted" style="margin-top:var(--space-3)"></div>' +
        '</div>' +
      '</div>' +

    '</div>'
  );

  container.innerHTML = html;
  atualizarBadgeModoDadosHeader();
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

  exportarBackup: function () {
    var payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      data: {},
    };

    Object.keys(RB_LOCAL_KEYS).forEach(function (k) {
      var lsKey = RB_LOCAL_KEYS[k];
      var raw = localStorage.getItem(lsKey);
      if (!raw) return;
      try {
        payload.data[lsKey] = JSON.parse(raw);
      } catch (e) {
        payload.data[lsKey] = raw;
      }
    });

    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'rotaboa-backup-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this._statusBackup('Backup exportado com sucesso.', false);
  },

  importarBackup: function () {
    var input = document.getElementById('cfg-backup-input');
    if (!input) return;
    input.value = '';
    input.click();
  },

  processarArquivoBackup: function (event) {
    var self = this;
    var file = event && event.target && event.target.files && event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var parsed = JSON.parse(String(ev.target.result || '{}'));
        var data = parsed && parsed.data ? parsed.data : parsed;
        var restaurou = 0;

        Object.keys(RB_LOCAL_KEYS).forEach(function (k) {
          var lsKey = RB_LOCAL_KEYS[k];
          if (!(lsKey in data)) return;
          var valor = data[lsKey];
          localStorage.setItem(lsKey, typeof valor === 'string' ? valor : JSON.stringify(valor));
          restaurou++;
        });

        SyncService.markPendingSync();

        self._statusBackup('Backup importado (' + restaurou + ' chave(s)). Recarregando...', false);
        setTimeout(function () { window.location.reload(); }, 400);
      } catch (e) {
        self._statusBackup('Arquivo de backup inválido.', true);
      }
    };
    reader.readAsText(file);
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
    if (r && r.ok) {
      this._statusSync('Sincronização concluída.', false);
      if ((window.location.hash || '') === '#/config') {
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
      return;
    }
    this._statusSync('Não foi possível sincronizar agora.', true);
  },

  salvarPreferencias: function () {
    var pagina = document.getElementById('pref-pagina-inicial');
    var mostrarValores = document.getElementById('pref-mostrar-valores');
    var confirmar = document.getElementById('pref-confirmar-exclusao');

    _salvarPreferencias({
      paginaInicialPadrao: pagina ? pagina.value : '/inicio',
      mostrarValoresInicio: mostrarValores ? mostrarValores.value !== 'nao' : true,
      confirmarAntesExcluir: confirmar ? confirmar.value !== 'nao' : true,
    });

    this._statusPrefs('Preferências salvas neste dispositivo.', false);
    _mostrarToast('Preferências salvas.');
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
      SyncService.startAutoSync();
      await SyncService.syncLocalToCloud({ silent: false, source: 'login-email' });
      Router.navegar('#/inicio');
    } catch (e) {
      this._setErro(_mensagemErroAuth(e));
    } finally {
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
      SyncService.startAutoSync();
      await SyncService.syncLocalToCloud({ silent: false, source: 'registro-email' });
      Router.navegar('#/inicio');
    } catch (e) {
      this._setErro(_mensagemErroAuth(e));
    } finally {
      this._setLoading(false, 'btn-login-criar', 'Criar conta', 'Criando...');
    }
  },

  entrarGoogle: async function () {
    this._setErro('');
    this._setLoading(true, 'btn-login-google', 'Entrar com Google', 'Conectando...');
    try {
      await FirebaseClient.loginWithGoogle();
      localStorage.removeItem(RB_OFFLINE_KEY);
      RB_AUTH_STATE.offlineMode = false;
      SyncService.startAutoSync();
      await SyncService.syncLocalToCloud({ silent: false, source: 'login-google' });
      Router.navegar('#/inicio');
    } catch (e) {
      this._setErro(_mensagemErroAuth(e));
    } finally {
      this._setLoading(false, 'btn-login-google', 'Entrar com Google', 'Conectando...');
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

      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="f-inicio">Data de início</label>' +
          '<input id="f-inicio" class="form-input" type="date" value="' + _esc(val('dataInicio')) + '">' +
          '<span class="form-error" id="e-inicio">Data de início obrigatória.</span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="f-fim">Data de fim</label>' +
          '<input id="f-fim" class="form-input" type="date" value="' + _esc(val('dataFim')) + '">' +
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
          '<label class="form-label">Participantes</label>' +
          '<button type="button" class="btn btn-ghost btn-sm" onclick="TripModal.adicionarParticipante()">+ Adicionar</button>' +
        '</div>' +
        '<div id="trip-partic-list" style="display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-2)"></div>' +
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
    for (var i = 1; i <= qtd; i++) {
      lista.push({ id: 'part-local-' + i + '-' + Date.now(), nome: 'Pessoa ' + i, ativo: true });
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

    var inicio = document.getElementById('f-inicio');
    if (!inicio || !inicio.value) { _erro('inicio', true); ok = false; }

    var fim = document.getElementById('f-fim');
    if (!fim || !fim.value) { _erro('fim', true); ok = false; }

    if (inicio && inicio.value && fim && fim.value && fim.value < inicio.value) {
      var errFim = document.getElementById('e-fim');
      if (errFim) errFim.textContent = 'A data de fim não pode ser antes da data de início.';
      _erro('fim', true);
      ok = false;
    }

    var orc = document.getElementById('f-orc');
    if (!orc || !orc.value || Number(orc.value) <= 0) { _erro('orc', true); ok = false; }

    var nomes = _participantesDraft.map(function (p) {
      return String((p && p.nome) || '').trim();
    });
    if (!nomes.length || nomes.some(function (n) { return !n; })) {
      _erroParticipantes(true, 'Preencha o nome de todos os participantes.');
      ok = false;
    }

    var nomesNorm = nomes.map(function (n) { return n.toLowerCase(); });
    var unico = nomesNorm.every(function (n, idx) { return nomesNorm.indexOf(n) === idx; });
    if (!unico) {
      _erroParticipantes(true, 'Não repita nomes de participantes.');
      ok = false;
    }

    var ativos = _participantesDraft.filter(function (p) { return p && p.ativo !== false; }).length;
    if (ativos === 0) {
      _erroParticipantes(true, 'Mantenha ao menos um participante ativo.');
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
        dataInicio:    document.getElementById('f-inicio').value,
        dataFim:       document.getElementById('f-fim').value,
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
      if (!hash.includes('/viagens') && !hash.includes('/inicio')) {
        Router.navegar('#/viagens');
      }
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
// AtividadeModal — Criação e edição de atividades do roteiro
// ================================================================
var AtividadeModal = (function () {
  var _overlay     = null;
  var _tripId      = null;
  var _atividadeId = null;  // null = criar, string = editar
  var _dataPresel  = null;  // data pré-selecionada (vinda do botão do dia)

  // Mapa categoria → label
  var _cats = [
    ['deslocamento', 'Deslocamento 🚗'],
    ['hospedagem',   'Hospedagem 🏨'],
    ['alimentacao',  'Alimentação 🍽️'],
    ['passeio',      'Passeio 🎡'],
    ['compra',       'Compra 🛍️'],
    ['livre',        'Livre 🌴'],
    ['outro',        'Outro 📌'],
  ];

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
          '<input id="af-hora" class="form-input" type="time" value="' + _esc(ativ.hora) + '">' +
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

      // Nome
      '<div class="form-group">' +
        '<label class="form-label form-label-required" for="af-nome">Nome da atividade</label>' +
        '<input id="af-nome" class="form-input" type="text" maxlength="100" placeholder="Ex: Visita ao Cristo Redentor" value="' + _esc(ativ.nome) + '">' +
        '<span class="form-error" id="ae-nome">Nome é obrigatório.</span>' +
      '</div>' +

      // Categoria
      '<div class="form-group">' +
        '<label class="form-label form-label-required" for="af-cat">Categoria</label>' +
        '<select id="af-cat" class="form-select">' +
          '<option value="">Selecione...</option>' +
          _cats.map(function (c) { return _opt(c[0], c[1], ativ.categoria); }).join('') +
        '</select>' +
        '<span class="form-error" id="ae-cat">Selecione uma categoria.</span>' +
      '</div>' +

      '<div class="form-row">' +
        // Local
        '<div class="form-group">' +
          '<label class="form-label" for="af-local">Local</label>' +
          '<input id="af-local" class="form-input" type="text" maxlength="100" placeholder="Ex: Cosme Velho" value="' + _esc(ativ.local) + '">' +
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
      '</div>'
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
    ['dia','hora','nome','cat','custo'].forEach(function (k) { _erro(k, false); });
  }

  function _validar() {
    _limparErros();
    var ok = true;

    var dia = document.getElementById('af-dia');
    if (!dia || !dia.value) { _erro('dia', true); ok = false; }

    var hora = document.getElementById('af-hora');
    if (!hora || !hora.value) { _erro('hora', true); ok = false; }

    var nome = document.getElementById('af-nome');
    if (!nome || !nome.value.trim()) { _erro('nome', true); ok = false; }

    var cat = document.getElementById('af-cat');
    if (!cat || !cat.value) { _erro('cat', true); ok = false; }

    var custo = document.getElementById('af-custo');
    if (custo && custo.value !== '' && Number(custo.value) < 0) {
      _erro('custo', true, 'Custo deve ser zero ou maior.');
      ok = false;
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

      _overlay.classList.add('aberto');
      document.body.style.overflow = 'hidden';
      var f = document.getElementById('af-nome');
      if (f) setTimeout(function () { f.focus(); }, 300);
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
            if (a.id === atividadeId) ativ = Object.assign({ data: d.data }, a);
          });
        });
      }
      if (!ativ) { console.warn('[AtividadeModal] Atividade não encontrada:', atividadeId); return; }

      document.getElementById('ativ-modal-title').textContent = 'Editar atividade';
      document.getElementById('ativ-modal-save').textContent  = 'Salvar alterações';
      document.getElementById('ativ-modal-body').innerHTML    = _renderForm(itin, ativ);

      _overlay.classList.add('aberto');
      document.body.style.overflow = 'hidden';
    },

    fechar: function () {
      _overlay.classList.remove('aberto');
      document.body.style.overflow = '';
      _tripId = _atividadeId = _dataPresel = null;
    },

    salvar: function () {
      if (!_validar()) return;

      var dados = {
        data:           document.getElementById('af-dia').value,
        hora:           document.getElementById('af-hora').value,
        nome:           document.getElementById('af-nome').value.trim(),
        categoria:      document.getElementById('af-cat').value,
        local:          document.getElementById('af-local').value.trim(),
        custoEstimado:  Number(document.getElementById('af-custo').value) || 0,
        status:         document.getElementById('af-status').value,
        observacoes:    document.getElementById('af-obs').value.trim(),
      };

      if (_atividadeId) {
        Store.editarAtividade(_tripId, _atividadeId, dados);
      } else {
        Store.adicionarAtividade(_tripId, dados.data, dados);
      }

      AtividadeModal.fechar();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
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
    if (itin) {
      itin.dias.forEach(function (d) {
        d.atividades.forEach(function (a) { if (a.id === atividadeId) nome = '"' + a.nome + '"'; });
      });
    }
    if (!_confirmarExclusoesAtivo()) {
      Store.excluirAtividade(tripId, atividadeId);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }

    // Usa ConfirmModal com callback customizado
    ConfirmModal.abrirComCallback(
      'Excluir atividade?',
      'Excluir ' + nome + '? Esta ação não pode ser desfeita.',
      function () {
        Store.excluirAtividade(tripId, atividadeId);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    );
  },
};

// ================================================================
// DespesaModal — Criação e edição de despesas financeiras
// ================================================================
var DespesaModal = (function () {
  var _overlay   = null;
  var _tripId    = null;
  var _despesaId = null;

  var _cats = [
    ['transporte',  'Transporte 🚗'],
    ['hospedagem',  'Hospedagem 🏨'],
    ['alimentacao', 'Alimentação 🍽️'],
    ['passeios',    'Passeios 🎡'],
    ['compras',     'Compras 🛍️'],
    ['outros',      'Outros 📌'],
  ];

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
        .map(function (p) { return String(p.nome || '').trim(); })
        .filter(Boolean);
    }
    var qtd = Math.max(1, Number(viagem.participantes) || 1);
    var lista = [];
    for (var i = 1; i <= qtd; i++) lista.push('Pessoa ' + i);
    return lista;
  }

  function _checkboxesPartic(participantesAtivos, selecionados) {
    var checks = '';
    participantesAtivos.forEach(function (nome) {
      var checked = (!selecionados || selecionados.length === 0 || selecionados.indexOf(nome) !== -1) ? ' checked' : '';
      checks += (
        '<label class="desp-check-label">' +
          '<input type="checkbox" name="df-partic" value="' + _esc(nome) + '"' + checked + '> ' + _esc(nome) +
        '</label>'
      );
    });
    return checks;
  }

  function _selectPagante(participantesAtivos, atual) {
    var opcoes = participantesAtivos.map(function (nome) {
      return '<option value="' + _esc(nome) + '"' + (nome === atual ? ' selected' : '') + '>' + _esc(nome) + '</option>';
    }).join('');
    if (atual && participantesAtivos.indexOf(atual) === -1) {
      opcoes += '<option value="' + _esc(atual) + '" selected>' + _esc(atual) + ' (participante removido)</option>';
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

  function _renderForm(viagem, desp) {
    desp = desp || {};
    var participantesAtivos = _participantesAtivos(viagem);
    var totalParcelas = Math.max(1, Number(desp.totalParcelas) || 1);
    var modoPagamento = totalParcelas > 1 ? 'parcelado' : 'avista';
    return (
      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="df-data">Data</label>' +
          '<input id="df-data" class="form-input" type="date" value="' + _esc(desp.data || '') + '">' +
          '<span class="form-error" id="de-data">Informe a data.</span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="df-cat">Categoria</label>' +
          '<select id="df-cat" class="form-select">' +
            '<option value="">Selecione...</option>' +
            _cats.map(function (c) { return _opt(c[0], c[1], desp.categoria); }).join('') +
          '</select>' +
          '<span class="form-error" id="de-cat">Selecione uma categoria.</span>' +
        '</div>' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label form-label-required" for="df-desc">Descrição</label>' +
        '<input id="df-desc" class="form-input" type="text" maxlength="120" placeholder="Ex: Almoço no restaurante" value="' + _esc(desp.descricao) + '">' +
        '<span class="form-error" id="de-desc">Descrição é obrigatória.</span>' +
      '</div>' +

      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="df-valor">Valor (R$)</label>' +
          '<input id="df-valor" class="form-input" type="number" min="0.01" step="0.01" placeholder="0,00" value="' + _esc(desp.valor > 0 ? desp.valor : '') + '">' +
          '<span class="form-error" id="de-valor">Valor deve ser maior que zero.</span>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label form-label-required" for="df-pagante">Quem pagou</label>' +
          '<select id="df-pagante" class="form-select">' +
            '<option value="">Selecione...</option>' +
            _selectPagante(participantesAtivos, desp.quemPagou) +
          '</select>' +
          '<span class="form-error" id="de-pagante">Informe quem pagou.</span>' +
        '</div>' +
      '</div>' +

      '<div class="form-row">' +
        '<div class="form-group">' +
          '<label class="form-label" for="df-pagamento">Pagamento</label>' +
          '<select id="df-pagamento" class="form-select" onchange="DespesaModal.alterarPagamento()">' +
            _opt('avista', 'À vista', modoPagamento) +
            _opt('parcelado', 'Parcelado', modoPagamento) +
          '</select>' +
        '</div>' +
        '<div class="form-group" id="df-parcelas-wrap" style="display:' + (modoPagamento === 'parcelado' ? 'block' : 'none') + '">' +
          '<label class="form-label" for="df-parcelas">Quantidade de parcelas</label>' +
          '<input id="df-parcelas" class="form-input" type="number" min="2" max="48" step="1" value="' + (totalParcelas > 1 ? totalParcelas : 2) + '" oninput="DespesaModal.alterarPagamento()">' +
        '</div>' +
      '</div>' +
      '<div class="text-xs text-muted" id="df-parcelas-resumo" style="margin-top:calc(var(--space-2) * -1);margin-bottom:var(--space-2)">' + _resumoParcelas(desp.valor, totalParcelas) + '</div>' +

      '<div class="form-group">' +
        '<label class="form-label">Participantes no rateio</label>' +
        '<div class="desp-check-grid">' + _checkboxesPartic(participantesAtivos, desp.participantes) + '</div>' +
        '<span class="text-xs text-muted" style="margin-top:4px;display:block">Padrão: todos selecionados.</span>' +
      '</div>' +

      '<div class="form-group">' +
        '<label class="form-label" for="df-obs">Observações</label>' +
        '<textarea id="df-obs" class="form-textarea" maxlength="300" placeholder="Detalhes ou observações...">' + _esc(desp.observacoes) + '</textarea>' +
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
    ['data', 'cat', 'desc', 'valor', 'pagante'].forEach(function (k) { _erro(k, false); });
  }

  function _validar() {
    _limparErros();
    var ok = true;
    if (!document.getElementById('df-data').value) { _erro('data', true); ok = false; }
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
      _erro('pagante', true, 'Selecione ao menos 1 participante no rateio.');
      ok = false;
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
      document.getElementById('desp-modal-body').innerHTML    = _renderForm(viagem, desp || {});
      this.alterarPagamento();
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
        data:         document.getElementById('df-data').value,
        categoria:    document.getElementById('df-cat').value,
        descricao:    document.getElementById('df-desc').value.trim(),
        valor:        Number(document.getElementById('df-valor').value),
        quemPagou:    document.getElementById('df-pagante').value.trim(),
        participantes: _coletarPartic(),
        observacoes:  document.getElementById('df-obs').value.trim(),
        tipoPagamento: modo,
        totalParcelas: totalParcelas,
      };
      if (_despesaId) {
        Store.editarDespesa(_tripId, _despesaId, dados);
      } else {
        Store.adicionarDespesa(_tripId, dados);
      }
      DespesaModal.fechar();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
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

  function _renderForm(t) {
    t = t || {};
    return (
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
          '<input id="rf-dur" class="form-input" type="text" maxlength="40" placeholder="Ex: 2h 30min" value="' + _esc(t.duracaoEstimada) + '">' +
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
      '</div>'
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
    ['origem', 'destino', 'tipo', 'dist', 'consumo', 'preco', 'fixo'].forEach(function (k) { _erro(k, false); });
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
      document.getElementById('trecho-modal-title').textContent = trechoId ? 'Editar trecho' : 'Novo trecho';
      document.getElementById('trecho-modal-save').textContent = trechoId ? 'Salvar alterações' : 'Salvar trecho';
      document.getElementById('trecho-modal-body').innerHTML = _renderForm(trecho || {});
      _overlay.classList.add('aberto');
      document.body.style.overflow = 'hidden';
      var f = document.getElementById('rf-origem');
      if (f) setTimeout(function () { f.focus(); }, 300);
    },

    fechar: function () {
      _overlay.classList.remove('aberto');
      document.body.style.overflow = '';
      _tripId = _trechoId = null;
    },

    salvar: function () {
      if (!_validar()) return;

      var dados = {
        origem: document.getElementById('rf-origem').value.trim(),
        destino: document.getElementById('rf-destino').value.trim(),
        tipo: document.getElementById('rf-tipo').value,
        distanciaKm: Number(document.getElementById('rf-dist').value) || 0,
        duracaoEstimada: document.getElementById('rf-dur').value.trim(),
        consumoKmL: Number(document.getElementById('rf-consumo').value) || 0,
        precoCombustivelLitro: Number(document.getElementById('rf-preco').value) || 0,
        custoFixo: Number(document.getElementById('rf-fixo').value) || 0,
        observacoes: document.getElementById('rf-obs').value.trim(),
      };

      if (_trechoId) {
        Store.editarTrechoRota(_tripId, _trechoId, dados);
      } else {
        Store.adicionarTrechoRota(_tripId, dados);
      }

      TrechoModal.fechar();
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    },
  };
})();

// ================================================================
// TrechoActions — Ações nos cards de trecho
// ================================================================
var TrechoActions = {
  editar: function (tripId, trechoId) {
    TrechoModal.abrir(tripId, trechoId);
  },

  excluir: function (tripId, trechoId) {
    var lista = Store.getTrechosRota(tripId);
    var nome = 'este trecho';
    lista.forEach(function (t) {
      if (t.id === trechoId) nome = '"' + t.origem + ' → ' + t.destino + '"';
    });
    if (!_confirmarExclusoesAtivo()) {
      Store.excluirTrechoRota(tripId, trechoId);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    ConfirmModal.abrirComCallback(
      'Excluir trecho?',
      'Excluir ' + nome + '? Esta ação não pode ser desfeita.',
      function () {
        Store.excluirTrechoRota(tripId, trechoId);
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      }
    );
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

  Router.setGuard(_guardAcessoRotas);

  // Registra todas as rotas
  Router.registrar('/inicio',        paginaInicio);
  Router.registrar('/viagens',       paginaViagens);
  Router.registrar('/viagem/:id',    paginaViagemDetalhe);
  Router.registrar('/roteiro',       paginaRoteiro);
  Router.registrar('/financeiro',    paginaFinanceiro);
  Router.registrar('/rotas',         paginaRotas);
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
    if ((window.location.hash || '') === '#/config') {
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      SyncService.syncLocalToCloud({ silent: true, source: 'visible' });
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
