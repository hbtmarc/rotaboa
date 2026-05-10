// ===================================================
// store.js — Estado global da aplicação
// Simples objeto reativo sem frameworks.
// Na fase com banco de dados, este arquivo buscará
// dados reais e notificará os listeners.
// ===================================================

var Store = (function () {

  // ---- Estado interno ----
  var _state = {
    viagemSelecionadaId: 'viagem-1',   // ID da viagem em foco no dashboard
    viagens: MockData.viagens,
    roteiro: MockData.roteiro,
    financeiro: MockData.financeiro,
    rotas: MockData.rotas,
    configuracoes: MockData.configuracoes,
    usuario: {
      nome: MockData.configuracoes.nomeUsuario,
      email: MockData.configuracoes.email,
    },
  };

  // ---- Listeners para mudanças de estado ----
  var _listeners = [];

  // Notifica todos os listeners registrados
  function _notificar() {
    _listeners.forEach(function (fn) {
      fn(_state);
    });
  }

  // ---- API pública ----
  return {

    // Retorna uma cópia simples do estado (não profunda, suficiente para MVP)
    getState: function () {
      return _state;
    },

    // Registra um callback que será chamado quando o estado mudar
    subscribe: function (fn) {
      _listeners.push(fn);
    },

    // Seleciona qual viagem está em foco
    selecionarViagem: function (id) {
      _state.viagemSelecionadaId = id;
      _notificar();
    },

    // Retorna a viagem atualmente selecionada
    getViagemSelecionada: function () {
      return _state.viagens.find(function (v) {
        return v.id === _state.viagemSelecionadaId;
      }) || _state.viagens[0];
    },

    // Retorna todas as viagens
    getViagens: function () {
      return _state.viagens;
    },

    // Retorna o roteiro da viagem selecionada
    getRoteiro: function () {
      return _state.roteiro;
    },

    // Retorna o resumo financeiro da viagem selecionada
    getFinanceiro: function () {
      return _state.financeiro;
    },

    // Retorna os dados de rota
    getRotas: function () {
      return _state.rotas;
    },

    // Retorna as configurações
    getConfiguracoes: function () {
      return _state.configuracoes;
    },
  };

})();
