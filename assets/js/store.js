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

  var _itinerarios = _carregarItinerarios();

  // ---- Inicializa estado a partir do localStorage ----
  var _viagens    = _carregarViagens();
  var _selectedId = _carregarSelectedId(_viagens);

  // Despesas carregadas DEPOIS de viagens/selectedId para permitir migração com fallback
  var _despesas = _carregarDespesas(_viagens, _selectedId);

  var _state = {
    viagemSelecionadaId: _selectedId,
    viagens: _viagens,
    roteiro: MockData.roteiro,        // Mock por enquanto — Prompt 3 tornará dinâmico
    financeiro: MockData.financeiro,  // idem
    rotas: MockData.rotas,            // idem
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

  // ---- API pública ----
  return {

    getState: function () { return _state; },

    subscribe: function (fn) { _listeners.push(fn); },

    // ---- Leitura ----
    getViagens:        function () { return _state.viagens; },
    getRoteiro:        function () { return _state.roteiro; },
    getFinanceiro:     function () { return _state.financeiro; },
    getRotas:          function () { return _state.rotas; },
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
      return (_despesas[tripId] || []).slice();
    },

    // Adiciona despesa
    adicionarDespesa: function (tripId, dados) {
      if (!_despesas[tripId]) _despesas[tripId] = [];
      var desp = Object.assign({}, dados, { id: _gerarDespesaId(), tripId: tripId });
      _despesas[tripId].push(desp);
      _despesas[tripId].sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
      _salvarDespesas();
      _notificar();
      return desp;
    },

    // Edita despesa
    editarDespesa: function (tripId, despesaId, dados) {
      if (!_despesas[tripId]) return false;
      var idx = _despesas[tripId].findIndex(function (d) { return d.id === despesaId; });
      if (idx === -1) return false;
      _despesas[tripId][idx] = Object.assign({}, _despesas[tripId][idx], dados);
      _despesas[tripId].sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
      _salvarDespesas();
      _notificar();
      return true;
    },

    // Exclui despesa
    excluirDespesa: function (tripId, despesaId) {
      if (!_despesas[tripId]) return false;
      _despesas[tripId] = _despesas[tripId].filter(function (d) { return d.id !== despesaId; });
      _salvarDespesas();
      _notificar();
      return true;
    },

    // Resumo financeiro calculado a partir das despesas reais (isolado por viagem)
    getResumoFinanceiro: function (tripId) {
      var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
      var orcamento = viagem ? (Number(viagem.orcamento) || 0) : 0;
      // Garante isolamento: apenas despesas da viagem solicitada
      var lista = (_despesas[tripId] || []).filter(function (d) {
        return !d.tripId || d.tripId === tripId;
      });
      console.info('[financeiro] viagem ativa:', tripId, '| despesas:', lista.length);

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
  };

})();
