// ===================================================
// app.js — Inicialização e renderização das páginas
// Cada página é uma função que retorna HTML como string
// e é passada para o Router.
// ===================================================

// ==== PÁGINA: Início ====
function paginaInicio(params, container) {
  var viagem = Store.getViagemSelecionada();

  // Estado vazio — nenhuma viagem criada ainda
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

  var pct    = UI.calcularPorcentagem(viagem.gastoAtual, viagem.orcamento);
  var fin    = Store.getFinanceiro();
  var config = Store.getConfiguracoes();

  var html = (
    '<div class="hero-banner">' +
      '<div class="hero-eyebrow">Olá, ' + config.nomeUsuario + ' 👋</div>' +
      '<h1 class="hero-title">Pronto para a próxima aventura?</h1>' +
      '<p class="hero-subtitle">Viagem selecionada: <strong>' + viagem.nome + '</strong></p>' +
      '<div class="hero-actions">' +
        '<a href="#/viagens" class="btn btn-white">Ver viagens</a>' +
        '<a href="#/roteiro" class="btn btn-outline-white">Roteiro</a>' +
      '</div>' +
    '</div>' +

    '<div class="page-section">' +
      UI.renderSectionHeader('Visão Geral', '', '') +
      '<div class="stats-grid">' +
        UI.renderStatCard('Orçamento', UI.formatarMoeda(viagem.orcamento), 'Total planejado', 'stat-icon-blue', '💰') +
        UI.renderStatCard('Gastos', UI.formatarMoeda(viagem.gastoAtual), pct + '% do orçamento', 'stat-icon-yellow', '💸') +
        UI.renderStatCard('Saldo', UI.formatarMoeda(viagem.orcamento - viagem.gastoAtual), 'Disponível', 'stat-icon-green', '✅') +
        UI.renderStatCard('Pessoas', String(viagem.participantes), viagem.localizacaoCurta || viagem.destinoPrincipal || viagem.destino || '', 'stat-icon-blue', '👥') +
      '</div>' +
    '</div>' +

    '<div class="page-section">' +
      UI.renderSectionHeader('Viagem selecionada', 'Trocar', '#/viagens') +
      '<div class="card">' +
        '<div class="card-body">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">' +
            '<div style="min-width:0">' +
              '<div style="font-weight:700;font-size:var(--text-xl);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + viagem.nome + '</div>' +
              '<div class="text-sm text-secondary" style="margin-top:2px">📍 ' + (viagem.localizacaoCurta || viagem.destinoPrincipal || viagem.destino || '') + '</div>' +
            '</div>' +
            '<span class="badge ' + UI.badgeStatus(viagem.status) + '" style="flex-shrink:0;margin-left:var(--space-2)">' + UI.textoStatus(viagem.status) + '</span>' +
          '</div>' +
          '<p class="text-sm text-secondary" style="margin-bottom:var(--space-4)">' + (viagem.descricao || '') + '</p>' +
          '<div>' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:var(--space-2)">' +
              '<span class="text-sm text-secondary">Progresso do orçamento</span>' +
              '<span class="text-sm font-semibold">' + pct + '%</span>' +
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
    '</div>' +

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

  var pct = UI.calcularPorcentagem(viagem.gastoAtual, viagem.orcamento);
  var proximas = Store.getProximasAtividades(id, 3);

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

    previewRoteiro
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

  var html = (
    '<div class="page-section">' +

      // Cabeçalho
      '<div class="section-header" style="margin-bottom:var(--space-4)">' +
        '<h2 class="section-title">Roteiro</h2>' +
        '<button class="btn btn-primary btn-sm" onclick="AtividadeModal.abrir(\'' + viagem.id + '\', null)">+ Nova atividade</button>' +
      '</div>' +

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
  var fin = Store.getFinanceiro();
  var saldo = fin.orcamentoTotal - fin.gastoTotal;
  var pct = UI.calcularPorcentagem(fin.gastoTotal, fin.orcamentoTotal);
  var viagem = Store.getViagemSelecionada();
  if (!viagem) {
    container.innerHTML = UI.renderEmptyState('Nenhuma viagem selecionada', 'Crie ou selecione uma viagem primeiro.');
    return;
  }

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
            UI.renderStatCard('Trecho', cb.percursoTotal, cb.percursoSub || 'Trecho de van', 'stat-icon-blue', '🛣️') +
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

// ==== Helper: clique no corpo do card navega para detalhe ====
function _bindTripCards(container) {
  var cards = container.querySelectorAll('.card-clickable[data-viagem-id]');
  cards.forEach(function (card) {
    card.addEventListener('click', function (e) {
      // Ignora cliques em elementos interativos internos
      if (e.target.closest('a, button')) return;
      var id = card.getAttribute('data-viagem-id');
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
        '<div class="form-group">' +
          '<label class="form-label" for="f-partic">Participantes</label>' +
          '<input id="f-partic" class="form-input" type="number" min="1" step="1" placeholder="2" value="' + _esc(val('participantes', 1)) + '">' +
        '</div>' +
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

    return ok;
  }

  // ---- API pública ----
  return {

    init: _inject,

    // Abre modal para criar (sem id) ou editar (com id)
    abrir: function (id) {
      _editandoId = id || null;
      var viagem = id ? Store.getViagens().find(function (v) { return v.id === id; }) : null;

      document.getElementById('trip-modal-title').textContent = id ? 'Editar viagem' : 'Nova viagem';
      document.getElementById('trip-modal-save').textContent  = id ? 'Salvar alterações' : 'Salvar viagem';
      document.getElementById('trip-modal-body').innerHTML    = _renderForm(viagem);

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
        participantes: Number(document.getElementById('f-partic').value) || 1,
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
    ConfirmModal.abrir(id, nome);
  },
};

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

// ==== INICIALIZAÇÃO ====
(function inicializar() {

  // Injeta modais no DOM antes de qualquer coisa
  TripModal.init();
  ConfirmModal.init();
  AtividadeModal.init();

  // Registra todas as rotas
  Router.registrar('/inicio',        paginaInicio);
  Router.registrar('/viagens',       paginaViagens);
  Router.registrar('/viagem/:id',    paginaViagemDetalhe);
  Router.registrar('/roteiro',       paginaRoteiro);
  Router.registrar('/financeiro',    paginaFinanceiro);
  Router.registrar('/rotas',         paginaRotas);
  Router.registrar('/configuracoes', paginaConfiguracoes);

  // Inicia o roteador
  Router.init(document.getElementById('page-container'));

  if (!window.location.hash) {
    window.location.hash = '#/inicio';
  }

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
