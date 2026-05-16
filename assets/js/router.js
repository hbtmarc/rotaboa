// ===================================================
// router.js — Roteador baseado em hash (#)
// Escuta mudanças na URL e renderiza a página certa.
// ===================================================

var Router = (function () {

  // ---- Tabela de rotas: padrão → função de renderização ----
  // Os padrões podem ter segmentos dinâmicos como :id
  var _rotas = [];

  // Container onde o conteúdo será inserido
  var _container = null;

  // Rota atual
  var _rotaAtual = null;
  var _guard = null;
  var _hashAnterior = null; // controla scroll: só rola ao topo em navegação real

  // ---- Registra uma rota ----
  function registrar(padrao, handler) {
    _rotas.push({ padrao: padrao, handler: handler });
  }

  // ---- Converte padrão em RegExp e extrai nomes dos parâmetros ----
  function _compilarPadrao(padrao) {
    var nomes = [];
    var regex = padrao.replace(/:([a-z]+)/gi, function (_, nome) {
      nomes.push(nome);
      return '([^/]+)';
    });
    return { regex: new RegExp('^' + regex + '$'), nomes: nomes };
  }

  // ---- Faz o match do hash atual com as rotas registradas ----
  function _resolverRota(hash) {
    // Remove o '#' inicial e a '/' inicial se houver
    var caminho = hash.replace(/^#/, '') || '/inicio';
    if (caminho === '/') caminho = '/inicio';

    for (var i = 0; i < _rotas.length; i++) {
      var rota = _rotas[i];
      var compilado = _compilarPadrao(rota.padrao);
      var match = caminho.match(compilado.regex);

      if (match) {
        // Extrai os parâmetros dinâmicos
        var params = {};
        compilado.nomes.forEach(function (nome, idx) {
          params[nome] = match[idx + 1];
        });
        return { handler: rota.handler, params: params, caminho: caminho };
      }
    }
    return null;
  }

  // ---- Atualiza links ativos no header e bottom nav ----
  function _atualizarNavAtivo(caminho) {
    // Remove 'active' de todos os links de navegação
    var links = document.querySelectorAll('.nav-link, .bottom-nav-item');
    links.forEach(function (link) {
      link.classList.remove('active');
    });

    // Encontra o segmento base da rota (ex.: /viagem/viagem-1 → /viagens)
    var segmentoBase = '/' + caminho.split('/')[1];

    links.forEach(function (link) {
      var rota = link.getAttribute('data-route');
      if (rota && (rota === caminho || rota === segmentoBase)) {
        link.classList.add('active');
      }
    });
  }

  // ---- Processa a rota atual ----
  function _processar() {
    var hash = window.location.hash || '#/inicio';
    var caminhoAtual = hash.replace(/^#/, '') || '/inicio';
    if (caminhoAtual === '/') caminhoAtual = '/inicio';

    if (typeof _guard === 'function') {
      var redir = _guard(caminhoAtual, hash);
      if (typeof redir === 'string' && redir && redir !== hash && redir !== '#' + caminhoAtual) {
        window.location.hash = redir;
        return;
      }
    }

    var resultado = _resolverRota(hash);

    _rotaAtual = resultado ? resultado.caminho : null;

    if (!_container) {
      _container = document.getElementById('page-container');
    }

    if (resultado) {
      _atualizarNavAtivo(resultado.caminho);
      try {
        resultado.handler(resultado.params, _container);
      } catch (e) {
        console.error('[Router] erro ao renderizar rota', resultado.caminho, e);
        _container.innerHTML = (
          '<div class="empty-state" style="min-height:60vh">' +
            '<div class="empty-state-icon" style="font-size:3rem">⚠️</div>' +
            '<div class="empty-state-title">Erro ao carregar página</div>' +
            '<div class="empty-state-desc" style="font-size:.75rem;color:#6b7280">' + String(e && e.message || e) + '</div>' +
            '<a href="#/inicio" class="btn btn-primary" style="margin-top:var(--space-4)">Voltar ao Início</a>' +
          '</div>'
        );
      }
    } else {
      // Rota não encontrada — renderiza 404 inline
      _atualizarNavAtivo('');
      _container.innerHTML = (
        '<div class="empty-state" style="min-height:60vh">' +
          '<div class="empty-state-icon" style="font-size:3rem">🗺️</div>' +
          '<div class="empty-state-title">Rota não encontrada</div>' +
          '<div class="empty-state-desc">O caminho <strong>' + (hash || '/') + '</strong> não existe no RotaBoa.</div>' +
          '<a href="#/inicio" class="btn btn-primary" style="margin-top:var(--space-4)">Voltar ao Início</a>' +
        '</div>'
      );
    }

    // Scroll ao topo só quando a rota muda de verdade (não em re-renders do sync)
    if (hash !== _hashAnterior) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    _hashAnterior = hash;
  }

  // ---- Inicializa roteador ----
  function init(container) {
    _container = container || document.getElementById('page-container');

    // Escuta mudanças no hash
    window.addEventListener('hashchange', _processar);

    // Processa rota inicial ao carregar a página
    _processar();
  }

  // ---- Navega programaticamente para uma rota ----
  function navegar(caminho) {
    window.location.hash = caminho;
  }

  function setGuard(fn) {
    _guard = (typeof fn === 'function') ? fn : null;
  }

  return {
    registrar: registrar,
    init: init,
    navegar: navegar,
    setGuard: setGuard,
  };

})();
