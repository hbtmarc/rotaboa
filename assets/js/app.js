// ===================================================
// app.js — Inicialização e renderização das páginas
// Cada página é uma função que retorna HTML como string
// e é passada para o Router.
// ===================================================

// ==== PÁGINA: Início ====
function paginaInicio(params, container) {
  var viagem = Store.getViagemSelecionada();
  var pct = UI.calcularPorcentagem(viagem.gastoAtual, viagem.orcamento);
  var fin = Store.getFinanceiro();
  var config = Store.getConfiguracoes();

  var html = (
    // Hero banner de boas-vindas
    '<div class="hero-banner">' +
      '<div class="hero-eyebrow">Olá, ' + config.nomeUsuario + ' 👋</div>' +
      '<h1 class="hero-title">Pronto para a próxima aventura?</h1>' +
      '<p class="hero-subtitle">Sua viagem <strong>' + viagem.nome + '</strong> está em andamento.</p>' +
      '<div class="hero-actions">' +
        '<a href="#/viagens" class="btn btn-white">Ver viagens</a>' +
        '<a href="#/roteiro" class="btn btn-outline-white">Abrir roteiro</a>' +
      '</div>' +
    '</div>' +

    // Stats rápidos
    '<div class="page-section">' +
      UI.renderSectionHeader('Visão Geral', '', '') +
      '<div class="stats-grid">' +
        UI.renderStatCard('Orçamento', UI.formatarMoeda(viagem.orcamento), 'Total planejado', 'stat-icon-blue', '💰') +
        UI.renderStatCard('Gastos', UI.formatarMoeda(viagem.gastoAtual), pct + '% do orçamento', 'stat-icon-yellow', '💸') +
        UI.renderStatCard('Saldo', UI.formatarMoeda(viagem.orcamento - viagem.gastoAtual), 'Disponível', 'stat-icon-green', '✅') +
        UI.renderStatCard('Participantes', viagem.participantes + ' pessoas', viagem.destino, 'stat-icon-blue', '👥') +
      '</div>' +
    '</div>' +

    // Viagem selecionada
    '<div class="page-section">' +
      UI.renderSectionHeader('Viagem selecionada', 'Trocar', '#/viagens') +
      '<div class="card">' +
        '<div class="card-body">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">' +
            '<div>' +
              '<div style="font-weight:700;font-size:var(--text-xl)">' + viagem.nome + '</div>' +
              '<div class="text-sm text-secondary" style="margin-top:2px">📍 ' + viagem.destino + '</div>' +
            '</div>' +
            '<span class="badge ' + UI.badgeStatus(viagem.status) + '">' + UI.textoStatus(viagem.status) + '</span>' +
          '</div>' +
          '<p class="text-sm text-secondary" style="margin-bottom:var(--space-4)">' + viagem.descricao + '</p>' +
          '<div style="margin-bottom:var(--space-2)">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2)">' +
              '<span class="text-sm text-secondary">Progresso do orçamento</span>' +
              '<span class="text-sm font-semibold">' + pct + '%</span>' +
            '</div>' +
            UI.progressBar(pct, UI.corBarra(pct)) +
          '</div>' +
        '</div>' +
        '<div class="card-footer">' +
          '<a href="#/roteiro" class="btn btn-primary btn-sm">Ver roteiro</a>' +
          '<a href="#/financeiro" class="btn btn-secondary btn-sm">Financeiro</a>' +
          '<a href="#/rotas" class="btn btn-ghost btn-sm">Rotas</a>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // Próximas despesas
    '<div class="page-section">' +
      UI.renderSectionHeader('Últimas despesas', 'Ver tudo', '#/financeiro') +
      '<div class="card">' +
        '<div class="card-body" style="padding:0">' +
          fin.despesas.slice(0, 4).map(UI.renderDespesa).join('') +
        '</div>' +
      '</div>' +
    '</div>'
  );

  container.innerHTML = html;
  _bindTripCards(container);
}

// ==== PÁGINA: Lista de Viagens ====
function paginaViagens(params, container) {
  var viagens = Store.getViagens();

  var html = (
    '<div class="page-section">' +
      UI.renderSectionHeader('Minhas Viagens', '', '') +

      // Filtros rápidos (visuais, sem lógica neste MVP)
      '<div style="display:flex;gap:var(--space-2);flex-wrap:wrap;margin-bottom:var(--space-5)">' +
        '<button class="btn btn-primary btn-sm">Todas</button>' +
        '<button class="btn btn-ghost btn-sm">Planejando</button>' +
        '<button class="btn btn-ghost btn-sm">Em andamento</button>' +
        '<button class="btn btn-ghost btn-sm">Concluídas</button>' +
      '</div>' +

      '<div class="cards-grid">' +
        viagens.map(UI.renderTripCard).join('') +
      '</div>' +
    '</div>' +

    // CTA nova viagem
    '<div class="card" style="text-align:center;padding:var(--space-8)">' +
      '<div style="font-size:2.5rem;margin-bottom:var(--space-3)">✈️</div>' +
      '<div style="font-weight:700;font-size:var(--text-lg);margin-bottom:var(--space-2)">Planejar nova viagem</div>' +
      '<p class="text-sm text-secondary" style="margin-bottom:var(--space-4)">Em breve você poderá criar roteiros completos aqui.</p>' +
      '<button class="btn btn-primary" disabled style="opacity:0.5;cursor:not-allowed">+ Nova viagem (em breve)</button>' +
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

  var pct = UI.calcularPorcentagem(viagem.gastoAtual, viagem.orcamento);

  var html = (
    // Topo da página com cor temática
    '<div class="card trip-card" style="margin-bottom:var(--space-6)">' +
      '<div class="trip-card-cover trip-card-cover-' + viagem.capa + '" style="height:180px;flex-direction:column;justify-content:flex-end;gap:var(--space-1)">' +
        '<span class="badge ' + UI.badgeStatus(viagem.status) + '" style="align-self:flex-start">' + UI.textoStatus(viagem.status) + '</span>' +
        '<div class="trip-card-title" style="font-size:var(--text-2xl)">' + viagem.nome + '</div>' +
        '<div style="color:rgba(255,255,255,0.85);font-size:var(--text-sm)">📍 ' + viagem.destino + ' · 📅 ' + viagem.dataInicio + ' → ' + viagem.dataFim + '</div>' +
      '</div>' +
      '<div class="card-body">' +
        '<p class="text-secondary" style="margin-bottom:var(--space-4)">' + viagem.descricao + '</p>' +
        '<div style="display:flex;flex-wrap:wrap;gap:var(--space-2);margin-bottom:var(--space-4)">' +
          (viagem.tags || []).map(function (t) { return '<span class="chip">' + t + '</span>'; }).join('') +
          '<span class="chip">👥 ' + viagem.participantes + ' pessoas</span>' +
        '</div>' +
        '<div>' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2)">' +
            '<span class="text-sm text-secondary">Orçamento usado</span>' +
            '<span class="text-sm font-semibold">' + UI.formatarMoeda(viagem.gastoAtual) + ' / ' + UI.formatarMoeda(viagem.orcamento) + '</span>' +
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

    // Mais detalhes (placeholder para Prompt 2)
    '<div class="card">' +
      '<div class="card-body">' +
        '<div style="text-align:center;padding:var(--space-8)">' +
          '<div style="font-size:2rem;margin-bottom:var(--space-3)">🏗️</div>' +
          '<div class="text-lg font-bold" style="margin-bottom:var(--space-2)">Mais detalhes em breve</div>' +
          '<p class="text-secondary text-sm">Esta tela receberá check-lists, mapas e colaboração no Prompt 2.</p>' +
        '</div>' +
      '</div>' +
    '</div>'
  );

  container.innerHTML = html;
}

// ==== PÁGINA: Roteiro ====
function paginaRoteiro(params, container) {
  var viagem = Store.getViagemSelecionada();
  var roteiro = Store.getRoteiro();

  var html = (
    '<div class="page-section">' +
      UI.renderSectionHeader('Roteiro por Dia', '', '') +
      '<div class="card" style="margin-bottom:var(--space-4)">' +
        '<div class="card-body" style="padding:var(--space-4)">' +
          '<div style="display:flex;align-items:center;gap:var(--space-3)">' +
            '<div style="font-size:1.5rem">🗓️</div>' +
            '<div>' +
              '<div class="font-bold">' + viagem.nome + '</div>' +
              '<div class="text-sm text-secondary">📍 ' + viagem.destino + ' · ' + roteiro.length + ' dias planejados</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      roteiro.map(UI.renderDiaRoteiro).join('') +
    '</div>'
  );

  container.innerHTML = html;
}

// ==== PÁGINA: Financeiro ====
function paginaFinanceiro(params, container) {
  var fin = Store.getFinanceiro();
  var saldo = fin.orcamentoTotal - fin.gastoTotal;
  var pct = UI.calcularPorcentagem(fin.gastoTotal, fin.orcamentoTotal);
  var viagem = Store.getViagemSelecionada();

  var html = (
    // Resumo geral
    '<div class="page-section">' +
      UI.renderSectionHeader('Resumo Financeiro', '', '') +
      '<div class="stats-grid" style="margin-bottom:var(--space-5)">' +
        UI.renderStatCard('Orçamento', UI.formatarMoeda(fin.orcamentoTotal), viagem.nome, 'stat-icon-blue', '💰') +
        UI.renderStatCard('Total gasto', UI.formatarMoeda(fin.gastoTotal), pct + '% do total', 'stat-icon-yellow', '💸') +
        UI.renderStatCard('Disponível', UI.formatarMoeda(saldo), 'Saldo atual', 'stat-icon-green', '✅') +
        UI.renderStatCard('Categorias', fin.categorias.length + '', 'Tipos de gasto', 'stat-icon-blue', '📊') +
      '</div>' +

      // Barra global
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body">' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2)">' +
            '<span class="text-sm font-semibold">Orçamento total utilizado</span>' +
            '<span class="text-sm font-bold">' + pct + '%</span>' +
          '</div>' +
          UI.progressBar(pct, UI.corBarra(pct)) +
          '<div style="display:flex;justify-content:space-between;margin-top:var(--space-2)">' +
            '<span class="text-xs text-muted">' + UI.formatarMoeda(fin.gastoTotal) + ' gastos</span>' +
            '<span class="text-xs text-secondary">de ' + UI.formatarMoeda(fin.orcamentoTotal) + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Por categoria
      UI.renderSectionHeader('Por categoria', '', '') +
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body">' +
          fin.categorias.map(UI.renderCategoriaFinanceira).join('') +
        '</div>' +
      '</div>' +

      // Lista de despesas
      UI.renderSectionHeader('Despesas', '', '') +
      '<div class="card">' +
        '<div class="card-body" style="padding:0">' +
          fin.despesas.map(UI.renderDespesa).join('') +
        '</div>' +
        '<div class="card-footer">' +
          '<span class="text-sm text-secondary">' + fin.despesas.length + ' lançamentos</span>' +
          '<button class="btn btn-primary btn-sm" disabled style="opacity:0.5;cursor:not-allowed">+ Adicionar (em breve)</button>' +
        '</div>' +
      '</div>' +
    '</div>'
  );

  container.innerHTML = html;
}

// ==== PÁGINA: Rotas ====
function paginaRotas(params, container) {
  var rotas = Store.getRotas();
  var cb = rotas.combustivel;

  var html = (
    '<div class="page-section">' +

      // Trechos
      UI.renderSectionHeader('Trechos da viagem', '', '') +
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body" style="padding:0 var(--space-5)">' +
          rotas.trechos.map(UI.renderTrecho).join('') +
        '</div>' +
      '</div>' +

      // Combustível
      UI.renderSectionHeader('Estimativa de combustível', '', '') +
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-body">' +
          '<div class="stats-grid">' +
            UI.renderStatCard('Percurso', cb.percursoTotal, cb.percesoSub || 'Trecho estimado', 'stat-icon-blue', '🛣️') +
            UI.renderStatCard('Consumo', cb.consumoMedio, 'Média do veículo', 'stat-icon-green', '⛽') +
            UI.renderStatCard('Litros', cb.litrosNecessarios + ' L', 'Necessários', 'stat-icon-yellow', '🪣') +
            UI.renderStatCard('Custo', cb.custoEstimado, cb.precoCombustivel + '/L', 'stat-icon-blue', '💰') +
          '</div>' +
          '<p class="text-xs text-muted" style="margin-top:var(--space-4)">' + cb.observacao + '</p>' +
        '</div>' +
      '</div>' +

      // Dicas
      UI.renderSectionHeader('Dicas de rota', '', '') +
      '<div class="card">' +
        '<div class="card-body">' +
          '<ul style="display:flex;flex-direction:column;gap:var(--space-3)">' +
            rotas.dicas.map(function (d) {
              return '<li style="display:flex;gap:var(--space-3);align-items:flex-start"><span>💡</span><span class="text-sm text-secondary">' + d + '</span></li>';
            }).join('') +
          '</ul>' +
        '</div>' +
      '</div>' +
    '</div>'
  );

  container.innerHTML = html;
}

// ==== PÁGINA: Configurações ====
function paginaConfiguracoes(params, container) {
  var cfg = Store.getConfiguracoes();

  var html = (
    '<div class="page-section">' +
      UI.renderSectionHeader('Configurações', '', '') +

      // Perfil
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-header"><span class="font-semibold">👤 Perfil</span></div>' +
        '<div class="card-body">' +
          '<div class="expense-row">' +
            '<span class="text-sm text-secondary">Nome</span>' +
            '<span class="text-sm font-semibold">' + cfg.nomeUsuario + '</span>' +
          '</div>' +
          '<div class="expense-row">' +
            '<span class="text-sm text-secondary">E-mail</span>' +
            '<span class="text-sm">' + cfg.email + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Preferências
      '<div class="card" style="margin-bottom:var(--space-5)">' +
        '<div class="card-header"><span class="font-semibold">⚙️ Preferências</span></div>' +
        '<div class="card-body">' +
          '<div class="expense-row">' +
            '<span class="text-sm text-secondary">Moeda</span>' +
            '<span class="badge badge-info">' + cfg.moeda + '</span>' +
          '</div>' +
          '<div class="expense-row">' +
            '<span class="text-sm text-secondary">Idioma</span>' +
            '<span class="text-sm">' + cfg.idioma + '</span>' +
          '</div>' +
          '<div class="expense-row">' +
            '<span class="text-sm text-secondary">Notificações</span>' +
            '<span class="badge ' + (cfg.notificacoes ? 'badge-ok' : 'badge-neutral') + '">' + (cfg.notificacoes ? 'Ativo' : 'Inativo') + '</span>' +
          '</div>' +
          '<div class="expense-row">' +
            '<span class="text-sm text-secondary">Tema</span>' +
            '<span class="text-sm">' + cfg.tema + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // Sobre
      '<div class="card">' +
        '<div class="card-header"><span class="font-semibold">ℹ️ Sobre o app</span></div>' +
        '<div class="card-body">' +
          '<div class="expense-row">' +
            '<span class="text-sm text-secondary">Versão</span>' +
            '<span class="text-sm">MVP v0.1.0</span>' +
          '</div>' +
          '<div class="expense-row">' +
            '<span class="text-sm text-secondary">Dados</span>' +
            '<span class="text-sm">Mock local (sem banco)</span>' +
          '</div>' +
          '<div class="expense-row">' +
            '<span class="text-sm text-secondary">GitHub Pages</span>' +
            '<span class="badge badge-ok">Compatível</span>' +
          '</div>' +
        '</div>' +
        '<div class="card-footer">' +
          '<span class="text-xs text-muted">RotaBoa · 2026 · Todos os direitos reservados</span>' +
        '</div>' +
      '</div>' +

    '</div>'
  );

  container.innerHTML = html;
}

// ==== Helper: bind nos cards de viagem ====
function _bindTripCards(container) {
  var cards = container.querySelectorAll('.card-clickable[data-viagem-id]');
  cards.forEach(function (card) {
    card.addEventListener('click', function (e) {
      // Evita navegar se o clique foi num botão/link interno
      if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON') return;
      var id = card.getAttribute('data-viagem-id');
      Store.selecionarViagem(id);
      Router.navegar('#/viagem/' + id);
    });
  });
}

// ==== INICIALIZAÇÃO ====
(function inicializar() {

  // Registra todas as rotas
  Router.registrar('/inicio',           paginaInicio);
  Router.registrar('/viagens',          paginaViagens);
  Router.registrar('/viagem/:id',       paginaViagemDetalhe);
  Router.registrar('/roteiro',          paginaRoteiro);
  Router.registrar('/financeiro',       paginaFinanceiro);
  Router.registrar('/rotas',            paginaRotas);
  Router.registrar('/configuracoes',    paginaConfiguracoes);

  // Inicia o roteador
  Router.init(document.getElementById('page-container'));

  // Se não houver hash, redireciona para #/inicio
  if (!window.location.hash) {
    window.location.hash = '#/inicio';
  }

  // Registra o Service Worker (só funciona em HTTPS ou localhost)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').then(function (reg) {
        console.log('[RotaBoa] Service Worker registrado:', reg.scope);
      }).catch(function (err) {
        console.warn('[RotaBoa] Service Worker falhou:', err);
      });
    });
  }

})();
