// ===================================================
// store.js — Estado global + persistência localStorage
// Sem frameworks ou backend. Dados ficam no navegador.
// Nos próximos passos as funções de leitura/escrita
// serão substituídas por chamadas ao Supabase.
// ===================================================

var Store = (function () {

  // ---- Chaves do localStorage ----
  var _LS_TRIPS    = 'rotaboa.trips.v1';
  var _LS_SELECTED = 'rotaboa.selectedTripId.v1';
  var _LS_ITIN     = 'rotaboa.itineraries.v1';
  var _LS_EXPENSES = 'rotaboa.expenses.v1';
  var _LS_ROUTES   = 'rotaboa.routes.v1';
  var _rotasLegacySemTripIdLogado = false;

  // ---- Migra viagem antiga (campo destino → destinoPrincipal + localizacaoCurta) ----
  function _migrarViagem(v) {
    if (!v.destinoPrincipal && !v.localizacaoCurta) {
      // Viagem salva no formato antigo: usa destino para ambos os campos
      v.destinoPrincipal = v.destino || '';
      v.localizacaoCurta = v.destino || '';
    }
    // Garante que localizacaoCurta tenha fallback
    if (!v.localizacaoCurta) v.localizacaoCurta = v.destinoPrincipal || v.destino || '';
    if (!v.destinoPrincipal) v.destinoPrincipal = v.localizacaoCurta || v.destino || '';
    return v;
  }

  // ---- Carrega viagens do localStorage (fallback: mock) ----
  function _carregarViagens() {
    try {
      var raw = localStorage.getItem(_LS_TRIPS);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(_migrarViagem);
      }
    } catch (e) {
      console.warn('[Store] Falha ao ler localStorage:', e);
    }
    // Primeira vez: persiste os dados mock para ter base consistente
    try {
      localStorage.setItem(_LS_TRIPS, JSON.stringify(MockData.viagens));
    } catch (e) {}
    return MockData.viagens.map(_migrarViagem);
  }

  // ---- Carrega a ID selecionada (fallback: primeira viagem) ----
  function _carregarSelectedId(viagens) {
    try {
      var id = localStorage.getItem(_LS_SELECTED);
      if (id && viagens.find(function (v) { return v.id === id; })) return id;
    } catch (e) {}
    return viagens.length > 0 ? viagens[0].id : null;
  }

  // ---- Persiste viagens no localStorage ----
  function _salvarViagens() {
    try {
      localStorage.setItem(_LS_TRIPS, JSON.stringify(_state.viagens));
    } catch (e) {
      console.warn('[Store] Falha ao salvar viagens:', e);
    }
  }

  // ---- Persiste ID selecionado ----
  function _salvarSelectedId() {
    try {
      localStorage.setItem(_LS_SELECTED, _state.viagemSelecionadaId || '');
    } catch (e) {}
  }

  // ---- Gera ID único baseado em timestamp ----
  function _gerarId() {
    return 'viagem-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
  }

  // ---- Gera ID de atividade ----
  function _gerarAtividadeId() {
    return 'atv-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
  }

  // ---- Gera array de dias entre duas datas ISO ----
  function _gerarDias(viagem) {
    var dias = [];
    if (!viagem || !viagem.dataInicio || !viagem.dataFim) return dias;
    var atual = new Date(viagem.dataInicio + 'T12:00:00');
    var fim   = new Date(viagem.dataFim   + 'T12:00:00');
    while (atual <= fim) {
      dias.push({ data: atual.toISOString().slice(0, 10), titulo: '', atividades: [] });
      atual.setDate(atual.getDate() + 1);
    }
    return dias;
  }

  // ---- Carrega itinerários do localStorage ----
  function _carregarItinerarios() {
    try {
      var raw = localStorage.getItem(_LS_ITIN);
      if (raw) return JSON.parse(raw);
    } catch (e) { console.warn('[Store] Falha ao ler itinerários:', e); }
    return {};
  }

  // ---- Persiste itinerários ----
  function _salvarItinerarios() {
    try {
      localStorage.setItem(_LS_ITIN, JSON.stringify(_itinerarios));
    } catch (e) { console.warn('[Store] Falha ao salvar itinerários:', e); }
  }

  // ---- Carrega despesas do localStorage (com migração de formato antigo) ----
  function _carregarDespesas(viagens, selectedId) {
    try {
      var raw = localStorage.getItem(_LS_EXPENSES);
      if (!raw) return {};
      var parsed = JSON.parse(raw);

      // Migração: formato antigo era array plano de despesas
      if (Array.isArray(parsed)) {
        console.info('[RotaBoa] Migrando despesas do formato antigo para formato isolado por viagem...');
        var migrado = {};
        var fallbackId = selectedId || (viagens && viagens.length > 0 ? viagens[0].id : null);
        parsed.forEach(function (d) {
          var tid = d.tripId || fallbackId;
          if (!tid) return;
          if (!migrado[tid]) migrado[tid] = [];
          migrado[tid].push(Object.assign({}, d, { tripId: tid }));
        });
        try { localStorage.setItem(_LS_EXPENSES, JSON.stringify(migrado)); } catch (e) {}
        console.info('[RotaBoa] Migração concluída:', Object.keys(migrado).length, 'viagem(ns) com despesas.');
        return migrado;
      }

      // Formato correto: objeto keyed por tripId
      // Garante que cada despesa tenha tripId embutido
      var corrigido = false;
      Object.keys(parsed).forEach(function (tid) {
        if (!Array.isArray(parsed[tid])) { parsed[tid] = []; corrigido = true; return; }
        parsed[tid].forEach(function (d, i) {
          if (!d.tripId) { parsed[tid][i] = Object.assign({}, d, { tripId: tid }); corrigido = true; }
        });
      });
      if (corrigido) {
        try { localStorage.setItem(_LS_EXPENSES, JSON.stringify(parsed)); } catch (e) {}
      }
      return parsed;
    } catch (e) {
      console.warn('[Store] Falha ao ler despesas:', e);
      return {};
    }
  }

  // ---- Persiste despesas ----
  function _salvarDespesas() {
    try {
      localStorage.setItem(_LS_EXPENSES, JSON.stringify(_despesas));
    } catch (e) { console.warn('[Store] Falha ao salvar despesas:', e); }
  }

  // ---- Gera ID de despesa ----
  function _gerarDespesaId() {
    return 'desp-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
  }

  function _isDespesaGeradaPorRota(d) {
    if (!d || typeof d !== 'object') return false;
    var origem = String(d.origem || d.source || '').trim().toLowerCase();
    var desc = String(d.descricao || '').trim().toLowerCase();
    if (d.routeSegmentId || d.routeExpenseId) return true;
    if (origem === 'rota') return true;
    if (desc.indexOf('rota:') === 0) return true;
    return false;
  }

  function _limparDespesasGeradasPorRota(despesas, viagens) {
    var idsValidos = {};
    (viagens || []).forEach(function (v) { idsValidos[v.id] = true; });
    var mudou = false;
    var limpo = {};

    Object.keys(despesas || {}).forEach(function (tid) {
      if (!idsValidos[tid]) { mudou = true; return; }
      var lista = Array.isArray(despesas[tid]) ? despesas[tid] : [];
      var antes = lista.length;
      var filtrada = lista.filter(function (d) {
        var comTripCorreta = d && (!d.tripId || d.tripId === tid);
        return comTripCorreta && !_isDespesaGeradaPorRota(d);
      }).map(function (d) {
        if (d.tripId === tid) return d;
        mudou = true;
        return Object.assign({}, d, { tripId: tid });
      });

      if (antes !== filtrada.length) mudou = true;
      limpo[tid] = filtrada;
    });

    return { mudou: mudou, despesas: limpo };
  }

  function _logRotasLegacySemTripIdUmaVez() {
    if (_rotasLegacySemTripIdLogado) return;
    _rotasLegacySemTripIdLogado = true;
    console.info('[rotas] rotas antigas sem tripId ignoradas');
  }

  // ---- Carrega trechos de rotas do localStorage (isolados por viagem) ----
  function _carregarRotas(viagens, selectedId) {
    try {
      var raw = localStorage.getItem(_LS_ROUTES);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      var idsValidos = {};
      var ignoradasSemTripId = 0;
      (viagens || []).forEach(function (v) { idsValidos[v.id] = true; });

      // Migração legado: array global -> objeto por tripId (somente itens com tripId válido)
      if (Array.isArray(parsed)) {
        var migradoArray = {};
        parsed.forEach(function (t) {
          if (t && !t.tripId) { ignoradasSemTripId++; return; }
          if (!t || !t.tripId || !idsValidos[t.tripId]) return;
          if (!migradoArray[t.tripId]) migradoArray[t.tripId] = [];
          migradoArray[t.tripId].push(Object.assign({}, t, { tripId: t.tripId }));
        });
        if (ignoradasSemTripId > 0) _logRotasLegacySemTripIdUmaVez();
        try { localStorage.setItem(_LS_ROUTES, JSON.stringify(migradoArray)); } catch (e) {}
        return migradoArray;
      }

      // Formato atual: objeto keyed por tripId
      if (parsed && typeof parsed === 'object') {
        var normalizado = {};
        Object.keys(parsed).forEach(function (tid) {
          if (!idsValidos[tid]) return;
          var lista = Array.isArray(parsed[tid]) ? parsed[tid] : [];
          normalizado[tid] = lista.filter(function (t) {
            if (t && !t.tripId) { ignoradasSemTripId++; return false; }
            return t && t.tripId && t.tripId === tid && idsValidos[t.tripId];
          }).map(function (t) {
            return Object.assign({}, t, { tripId: tid });
          });
        });
        if (ignoradasSemTripId > 0) _logRotasLegacySemTripIdUmaVez();
        try { localStorage.setItem(_LS_ROUTES, JSON.stringify(normalizado)); } catch (e) {}
        return normalizado;
      }
    } catch (e) {
      console.warn('[Store] Falha ao ler rotas:', e);
    }
    return {};
  }

  // ---- Persiste trechos ----
  function _salvarRotas() {
    try {
      localStorage.setItem(_LS_ROUTES, JSON.stringify(_rotasTrechos));
    } catch (e) { console.warn('[Store] Falha ao salvar rotas:', e); }
  }

  function _hojeISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function _round2(n) {
    return Math.round((Number(n) || 0) * 100) / 100;
  }

  function _labelsParticipantes(tripId) {
    var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
    var n = Math.max(1, Number(viagem && viagem.participantes) || 1);
    var arr = [];
    for (var i = 1; i <= n; i++) arr.push('Pessoa ' + i);
    return arr;
  }

  function _normalizarTrecho(tripId, dados, idFixo) {
    var distancia = Math.max(0, Number(dados.distanciaKm) || 0);
    var consumo = Math.max(0, Number(dados.consumoKmL) || 0);
    var preco = Math.max(0, Number(dados.precoCombustivelLitro) || 0);
    var fixo = Math.max(0, Number(dados.custoFixo) || 0);
    var litros = consumo > 0 ? (distancia / consumo) : 0;
    var custoComb = litros * preco;
    var custoTotal = fixo + custoComb;
    var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
    var participantes = Math.max(1, Number(viagem && viagem.participantes) || 1);

    return Object.assign({}, dados, {
      id: idFixo || dados.id || _gerarTrechoId(),
      tripId: tripId,
      origem: String(dados.origem || '').trim(),
      destino: String(dados.destino || '').trim(),
      tipo: dados.tipo || 'outro',
      distanciaKm: distancia,
      duracaoEstimada: String(dados.duracaoEstimada || '').trim(),
      consumoKmL: consumo,
      precoCombustivelLitro: preco,
      custoFixo: fixo,
      observacoes: String(dados.observacoes || '').trim(),
      litrosEstimados: _round2(litros),
      custoCombustivel: _round2(custoComb),
      custoTotal: _round2(custoTotal),
      custoPorPessoa: _round2(custoTotal / participantes),
      calculoModo: dados.calculoModo || 'manual',
    });
  }

  function _normalizarDespesaManual(tripId, dados, idFixo) {
    var base = Object.assign({}, dados);
    delete base.routeSegmentId;
    delete base.routeExpenseId;
    delete base.source;
    if (String(base.origem || '').trim().toLowerCase() === 'rota') delete base.origem;

    return Object.assign({}, base, {
      id: idFixo || base.id || _gerarDespesaId(),
      tripId: tripId,
      categoria: base.categoria || 'outros',
      descricao: String(base.descricao || '').trim(),
      valor: _round2(Number(base.valor) || 0),
      data: base.data || _hojeISO(),
      quemPagou: String(base.quemPagou || '').trim(),
      participantes: Array.isArray(base.participantes) ? base.participantes.slice() : [],
      observacoes: String(base.observacoes || '').trim(),
    });
  }

  function _gerarDespesasVirtuaisRotas(tripId) {
    var trechos = (_rotasTrechos[tripId] || []).filter(function (t) {
      return t && t.tripId === tripId;
    });

    var virtuais = trechos.map(function (trecho) {
      var normalizado = _normalizarTrecho(tripId, trecho, trecho.id);
      var total = _round2(normalizado.custoTotal);
      if (total <= 0) return null;
      return {
        id: 'route-expense-' + trecho.id,
        tripId: tripId,
        routeSegmentId: trecho.id,
        origem: 'rota',
        categoria: 'transporte',
        descricao: 'Rota: ' + normalizado.origem + ' → ' + normalizado.destino,
        valor: total,
        data: trecho.data || _hojeISO(),
        quemPagou: 'Rota',
        participantes: _labelsParticipantes(tripId),
        observacoes: 'Gerado automaticamente pelo módulo de rotas.',
      };
    }).filter(Boolean);

    virtuais.sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
    return virtuais;
  }

  // ---- Gera ID de trecho ----
  function _gerarTrechoId() {
    return 'trecho-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
  }

  function _parseDuracaoMinutos(txt) {
    var s = String(txt || '').trim().toLowerCase();
    if (!s) return 0;
    var horas = 0;
    var mins = 0;
    var h = s.match(/(\d+)\s*h/);
    var m = s.match(/(\d+)\s*m/);
    if (h) horas = Number(h[1]) || 0;
    if (m) mins = Number(m[1]) || 0;
    if (!h && !m) {
      var soNum = Number(s.replace(',', '.'));
      return Number.isFinite(soNum) ? Math.round(soNum * 60) : 0;
    }
    return (horas * 60) + mins;
  }

  function _fmtDuracaoTotal(minutos) {
    var m = Math.max(0, Math.round(Number(minutos) || 0));
    var h = Math.floor(m / 60);
    var r = m % 60;
    if (h && r) return h + 'h ' + r + 'min';
    if (h) return h + 'h';
    return r + 'min';
  }

  var _itinerarios = _carregarItinerarios();

  // ---- Inicializa estado a partir do localStorage ----
  var _viagens    = _carregarViagens();
  var _selectedId = _carregarSelectedId(_viagens);

  // Despesas carregadas DEPOIS de viagens/selectedId para permitir migração com fallback
  var _despesas = _carregarDespesas(_viagens, _selectedId);
  var _rotasTrechos = _carregarRotas(_viagens, _selectedId);
  var _cleanup = _limparDespesasGeradasPorRota(_despesas, _viagens);
  _despesas = _cleanup.despesas;
  if (_cleanup.mudou) _salvarDespesas();

  var _state = {
    viagemSelecionadaId: _selectedId,
    viagens: _viagens,
    roteiro: MockData.roteiro,        // Mock por enquanto — Prompt 3 tornará dinâmico
    financeiro: MockData.financeiro,  // idem
    rotas: {},
    configuracoes: MockData.configuracoes,
    usuario: {
      nome: MockData.configuracoes.nomeUsuario,
      email: MockData.configuracoes.email,
    },
  };

  // ---- Listeners ----
  var _listeners = [];

  function _notificar() {
    _listeners.forEach(function (fn) { fn(_state); });
  }

  function _marcarSyncPendente() {
    try {
      if (window.SyncService && typeof window.SyncService.markPendingSync === 'function') {
        window.SyncService.markPendingSync();
      }
    } catch (e) {}
  }

  // ---- API pública ----
  return {

    getState: function () { return _state; },

    subscribe: function (fn) { _listeners.push(fn); },

    // ---- Leitura ----
    getViagens:        function () { return _state.viagens; },
    getRoteiro:        function () { return _state.roteiro; },
    getFinanceiro:     function () { return _state.financeiro; },
    getRotas:          function (tripId) {
      if (!tripId) return [];
      return (_rotasTrechos[tripId] || []).filter(function (t) {
        return t && t.tripId === tripId;
      }).slice();
    },
    getConfiguracoes:  function () { return _state.configuracoes; },

    getViagemSelecionada: function () {
      if (!_state.viagens.length) return null;
      return _state.viagens.find(function (v) {
        return v.id === _state.viagemSelecionadaId;
      }) || _state.viagens[0];
    },

    // ---- Seleção ----
    selecionarViagem: function (id) {
      _state.viagemSelecionadaId = id;
      _salvarSelectedId();
      _marcarSyncPendente();
      _notificar();
    },

    // ---- Criar viagem ----
    criarViagem: function (dados) {
      // Alterna entre os 3 gradientes ciclicamente
      var capas = ['alt-1', 'alt-2', 'alt-3'];
      var novaViagem = Object.assign({
        id:         _gerarId(),
        gastoAtual: 0,
        capa:       capas[_state.viagens.length % 3],
      }, dados);

      _state.viagens.push(novaViagem);

      // Seleciona automaticamente se for a primeira viagem
      if (_state.viagens.length === 1) {
        _state.viagemSelecionadaId = novaViagem.id;
        _salvarSelectedId();
      }
      _salvarViagens();
      _marcarSyncPendente();
      _notificar();
      return novaViagem;
    },

    // ---- Editar viagem ----
    editarViagem: function (id, dados) {
      var idx = _state.viagens.findIndex(function (v) { return v.id === id; });
      if (idx === -1) return false;
      // Preserva campos que o formulário não edita (gastoAtual, capa, id)
      _state.viagens[idx] = Object.assign({}, _state.viagens[idx], dados);
      _salvarViagens();
      _marcarSyncPendente();
      _notificar();
      return true;
    },

    // ---- Excluir viagem ----
    excluirViagem: function (id) {
      _state.viagens = _state.viagens.filter(function (v) { return v.id !== id; });
      // Corrige seleção se a viagem excluída era a atual
      if (_state.viagemSelecionadaId === id) {
        _state.viagemSelecionadaId = _state.viagens.length > 0 ? _state.viagens[0].id : null;
        _salvarSelectedId();
      }
      _salvarViagens();
      _marcarSyncPendente();
      _notificar();
    },

    // ================================================================
    // Itinerário
    // ================================================================

    // Retorna itinerário de uma viagem (gerando dias se necessário)
    getItinerario: function (tripId) {
      var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
      if (!viagem) return null;

      if (!_itinerarios[tripId]) {
        // Primeira vez: gera dias vazios
        _itinerarios[tripId] = { dias: _gerarDias(viagem) };
        _salvarItinerarios();
      } else {
        // Garante que novos dias (caso datas da viagem mudem) sejam incluídos
        var datasExistentes = _itinerarios[tripId].dias.map(function (d) { return d.data; });
        _gerarDias(viagem).forEach(function (dNovo) {
          if (datasExistentes.indexOf(dNovo.data) === -1) {
            _itinerarios[tripId].dias.push(dNovo);
          }
        });
        _itinerarios[tripId].dias.sort(function (a, b) { return a.data.localeCompare(b.data); });
      }
      return _itinerarios[tripId];
    },

    // Adiciona atividade a um dia específico (por data ISO)
    adicionarAtividade: function (tripId, dataISO, dados) {
      var itin = this.getItinerario(tripId);
      if (!itin) return false;
      var dia = itin.dias.find(function (d) { return d.data === dataISO; });
      if (!dia) return false;
      var ativ = Object.assign({}, dados, { id: _gerarAtividadeId(), status: dados.status || 'planejado' });
      dia.atividades.push(ativ);
      dia.atividades.sort(function (a, b) { return (a.hora || '').localeCompare(b.hora || ''); });
      _salvarItinerarios();
      _marcarSyncPendente();
      return ativ;
    },

    // Edita atividade — suporta mover de dia se dados.data mudar
    editarAtividade: function (tripId, atividadeId, dados) {
      var itin = this.getItinerario(tripId);
      if (!itin) return false;
      var diaOrigem = null, idxOrigem = -1;
      itin.dias.forEach(function (d) {
        var i = d.atividades.findIndex(function (a) { return a.id === atividadeId; });
        if (i !== -1) { diaOrigem = d; idxOrigem = i; }
      });
      if (!diaOrigem) return false;
      var ativOriginal = diaOrigem.atividades[idxOrigem];
      var novaData = dados.data;
      if (novaData && novaData !== diaOrigem.data) {
        // Move para outro dia
        diaOrigem.atividades.splice(idxOrigem, 1);
        var diaDestino = itin.dias.find(function (d) { return d.data === novaData; });
        if (diaDestino) {
          diaDestino.atividades.push(Object.assign({}, ativOriginal, dados));
          diaDestino.atividades.sort(function (a, b) { return (a.hora || '').localeCompare(b.hora || ''); });
        }
      } else {
        diaOrigem.atividades[idxOrigem] = Object.assign({}, ativOriginal, dados);
        diaOrigem.atividades.sort(function (a, b) { return (a.hora || '').localeCompare(b.hora || ''); });
      }
      _salvarItinerarios();
      _marcarSyncPendente();
      return true;
    },

    // Exclui atividade (busca em todos os dias)
    excluirAtividade: function (tripId, atividadeId) {
      var itin = this.getItinerario(tripId);
      if (!itin) return false;
      itin.dias.forEach(function (d) {
        d.atividades = d.atividades.filter(function (a) { return a.id !== atividadeId; });
      });
      _salvarItinerarios();
      _marcarSyncPendente();
      return true;
    },

    // Alterna status feito ↔ planejado
    toggleAtividade: function (tripId, atividadeId) {
      var itin = this.getItinerario(tripId);
      if (!itin) return false;
      itin.dias.forEach(function (d) {
        d.atividades.forEach(function (a) {
          if (a.id === atividadeId) {
            a.status = (a.status === 'feito') ? 'planejado' : 'feito';
          }
        });
      });
      _salvarItinerarios();
      _marcarSyncPendente();
      return true;
    },

    // Retorna as próximas N atividades não-feitas/não-canceladas de uma viagem
    getProximasAtividades: function (tripId, max) {
      var itin = this.getItinerario(tripId);
      if (!itin) return [];
      var todas = [];
      itin.dias.forEach(function (d) {
        d.atividades.forEach(function (a) {
          if (a.status !== 'cancelado') {
            todas.push(Object.assign({ _data: d.data }, a));
          }
        });
      });
      todas.sort(function (a, b) {
        return (a._data + (a.hora || '')).localeCompare(b._data + (b.hora || ''));
      });
      return todas.slice(0, max || 3);
    },

    // ================================================================
    // Despesas financeiras
    // ================================================================

    // Retorna despesas de uma viagem
    getDespesas: function (tripId) {
      if (!tripId) return [];
      var manuais = (_despesas[tripId] || []).filter(function (d) {
        return d && d.tripId === tripId && !_isDespesaGeradaPorRota(d);
      }).slice();
      var virtuais = _gerarDespesasVirtuaisRotas(tripId);
      var merged = manuais.concat(virtuais);
      merged.sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
      return merged;
    },

    // Adiciona despesa
    adicionarDespesa: function (tripId, dados) {
      if (!_despesas[tripId]) _despesas[tripId] = [];
      var desp = _normalizarDespesaManual(tripId, dados, _gerarDespesaId());
      _despesas[tripId].push(desp);
      _despesas[tripId].sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
      _salvarDespesas();
      _marcarSyncPendente();
      _notificar();
      return desp;
    },

    // Edita despesa
    editarDespesa: function (tripId, despesaId, dados) {
      if (!_despesas[tripId]) return false;
      var idx = _despesas[tripId].findIndex(function (d) { return d.id === despesaId; });
      if (idx === -1) return false;
      _despesas[tripId][idx] = _normalizarDespesaManual(tripId, Object.assign({}, _despesas[tripId][idx], dados), despesaId);
      _despesas[tripId].sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
      _salvarDespesas();
      _marcarSyncPendente();
      _notificar();
      return true;
    },

    // Exclui despesa
    excluirDespesa: function (tripId, despesaId) {
      if (!tripId || !despesaId) return false;

      var virtual = _gerarDespesasVirtuaisRotas(tripId).find(function (d) {
        return d.id === despesaId;
      });

      if (virtual && virtual.routeSegmentId) {
        return this.excluirTrechoRota(tripId, virtual.routeSegmentId);
      }

      if (String(despesaId).indexOf('route-expense-') === 0) {
        return this.excluirTrechoRota(tripId, String(despesaId).replace('route-expense-', ''));
      }

      if (!_despesas[tripId]) return false;
      var antes = _despesas[tripId].length;
      _despesas[tripId] = _despesas[tripId].filter(function (d) { return d.id !== despesaId; });
      var mudou = _despesas[tripId].length !== antes;
      if (mudou) {
        _salvarDespesas();
        _marcarSyncPendente();
        _notificar();
      }
      return mudou;
    },

    // Resumo financeiro calculado a partir das despesas reais (isolado por viagem)
    getResumoFinanceiro: function (tripId) {
      var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
      var orcamento = viagem ? (Number(viagem.orcamento) || 0) : 0;
      var lista = this.getDespesas(tripId);

      var totalGasto = lista.reduce(function (acc, d) { return acc + (Number(d.valor) || 0); }, 0);

      // Agrupa por categoria
      var _catCfg = {
        transporte:   { emoji: '🚗', nome: 'Transporte'   },
        hospedagem:   { emoji: '🏨', nome: 'Hospedagem'   },
        alimentacao:  { emoji: '🍽️', nome: 'Alimentação'  },
        passeios:     { emoji: '🎡', nome: 'Passeios'     },
        compras:      { emoji: '🛍️', nome: 'Compras'      },
        outros:       { emoji: '📌', nome: 'Outros'       },
      };
      var porCat = {};
      lista.forEach(function (d) {
        var k = d.categoria || 'outros';
        porCat[k] = (porCat[k] || 0) + (Number(d.valor) || 0);
      });

      var categorias = Object.keys(_catCfg).map(function (k) {
        var cfg = _catCfg[k];
        return {
          key:    k,
          nome:   cfg.nome,
          emoji:  cfg.emoji,
          valor:  porCat[k] || 0,
          pct:    orcamento > 0 ? Math.round(((porCat[k] || 0) / orcamento) * 100) : 0,
        };
      }).filter(function (c) { return c.valor > 0; });

      return {
        orcamento:   orcamento,
        totalGasto:  totalGasto,
        saldo:       orcamento - totalGasto,
        pct:         orcamento > 0 ? Math.min(100, Math.round((totalGasto / orcamento) * 100)) : 0,
        categorias:  categorias,
        despesas:    lista,
      };
    },

    // ================================================================
    // Rotas por viagem
    // ================================================================

    getTrechosRota: function (tripId) {
      if (!tripId) return [];
      return (_rotasTrechos[tripId] || []).filter(function (t) {
        return t && t.tripId === tripId;
      }).slice();
    },

    adicionarTrechoRota: function (tripId, dados) {
      if (!tripId) return null;
      if (!_rotasTrechos[tripId]) _rotasTrechos[tripId] = [];
      var trecho = _normalizarTrecho(tripId, dados, _gerarTrechoId());
      if (!trecho || trecho.tripId !== tripId) return null;
      _rotasTrechos[tripId].push(trecho);
      _salvarRotas();
      _marcarSyncPendente();
      _notificar();
      return trecho;
    },

    editarTrechoRota: function (tripId, trechoId, dados) {
      if (!tripId || !trechoId) return false;
      if (!_rotasTrechos[tripId]) return false;
      var idx = _rotasTrechos[tripId].findIndex(function (t) {
        return t && t.id === trechoId && t.tripId === tripId;
      });
      if (idx === -1) return false;
      var atual = _rotasTrechos[tripId][idx];
      var trecho = _normalizarTrecho(tripId, Object.assign({}, atual, dados), trechoId);
      if (!trecho || trecho.tripId !== tripId) return false;
      _rotasTrechos[tripId][idx] = trecho;
      _salvarRotas();
      _marcarSyncPendente();
      _notificar();
      return true;
    },

    excluirTrechoRota: function (tripId, trechoId) {
      if (!tripId || !trechoId) return false;
      if (!_rotasTrechos[tripId]) return false;
      var antes = _rotasTrechos[tripId].length;
      _rotasTrechos[tripId] = _rotasTrechos[tripId].filter(function (t) {
        return !(t && t.id === trechoId && t.tripId === tripId);
      });
      if (_rotasTrechos[tripId].length === antes) return false;
      _salvarRotas();
      _marcarSyncPendente();
      _notificar();
      return true;
    },

    excluirTrecho: function (tripId, trechoId) {
      return this.excluirTrechoRota(tripId, trechoId);
    },

    getResumoRotas: function (tripId) {
      if (!tripId) {
        return {
          trechos: [],
          totalKm: 0,
          totalDuracaoMin: 0,
          totalDuracaoTexto: _fmtDuracaoTotal(0),
          totalLitros: 0,
          custoTotal: 0,
          custoPorPessoa: 0,
          participantes: 1,
        };
      }
      var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
      var participantes = Math.max(1, Number(viagem && viagem.participantes) || 1);
      var lista = this.getRotas(tripId).filter(function (t) {
        return t && t.tripId === tripId;
      }).map(function (t) {
        var distancia = Number(t.distanciaKm) || 0;
        var consumo = Number(t.consumoKmL) || 0;
        var preco = Number(t.precoCombustivelLitro) || 0;
        var fixo = Number(t.custoFixo) || 0;
        var litros = consumo > 0 ? (distancia / consumo) : 0;
        var custoComb = litros * preco;
        var custoTotal = fixo + custoComb;
        return Object.assign({}, t, {
          distanciaKm: distancia,
          consumoKmL: consumo,
          precoCombustivelLitro: preco,
          custoFixo: fixo,
          litrosEstimados: litros,
          custoCombustivel: custoComb,
          custoTotal: custoTotal,
          custoPorPessoa: custoTotal / participantes,
          duracaoMinutos: _parseDuracaoMinutos(t.duracaoEstimada),
        });
      });

      var totalKm = lista.reduce(function (acc, t) { return acc + t.distanciaKm; }, 0);
      var totalMin = lista.reduce(function (acc, t) { return acc + t.duracaoMinutos; }, 0);
      var totalLitros = lista.reduce(function (acc, t) { return acc + t.litrosEstimados; }, 0);
      var custoTotal = lista.reduce(function (acc, t) { return acc + t.custoTotal; }, 0);

      return {
        trechos: lista,
        totalKm: totalKm,
        totalDuracaoMin: totalMin,
        totalDuracaoTexto: _fmtDuracaoTotal(totalMin),
        totalLitros: totalLitros,
        custoTotal: custoTotal,
        custoPorPessoa: custoTotal / participantes,
        participantes: participantes,
      };
    },
  };

})();
