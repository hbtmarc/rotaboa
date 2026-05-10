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

  // ---- Inicializa estado a partir do localStorage ----
  var _viagens    = _carregarViagens();
  var _selectedId = _carregarSelectedId(_viagens);

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
  };

})();
