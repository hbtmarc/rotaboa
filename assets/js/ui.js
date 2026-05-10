// ===================================================
// ui.js — Funções auxiliares de renderização
// Responsável por criar HTML a partir dos dados.
// ===================================================

var UI = (function () {

  // ---- Formata valor em Reais ----
  function formatarMoeda(valor) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  // ---- Calcula porcentagem (0-100) ----
  function calcularPorcentagem(parte, total) {
    if (!total || total === 0) return 0;
    return Math.min(Math.round((parte / total) * 100), 100);
  }

  // ---- Retorna classe de badge conforme status ----
  function badgeStatus(status) {
    var mapa = {
      'planejando':    'badge-info',
      'em-andamento':  'badge-ok',
      'concluida':     'badge-neutral',
    };
    return mapa[status] || 'badge-neutral';
  }

  // ---- Texto legível do status ----
  function textoStatus(status) {
    var mapa = {
      'planejando':    'Planejando',
      'em-andamento':  'Em andamento',
      'concluida':     'Concluída',
    };
    return mapa[status] || status;
  }

  // ---- Barra de progresso ----
  function progressBar(porcentagem, cor) {
    cor = cor || '';
    return (
      '<div class="progress-bar-wrap">' +
        '<div class="progress-bar-fill ' + cor + '" style="width:' + porcentagem + '%"></div>' +
      '</div>'
    );
  }

  // ---- Cor da barra conforme gasto ----
  function corBarra(porcentagem) {
    if (porcentagem >= 90) return 'progress-bar-fill-red';
    if (porcentagem >= 70) return 'progress-bar-fill-yellow';
    return 'progress-bar-fill-green';
  }

  // ---- Renderiza um card de viagem ----
  function renderTripCard(viagem) {
    var pct = calcularPorcentagem(viagem.gastoAtual, viagem.orcamento);
    var cor = corBarra(pct);
    var tags = (viagem.tags || []).map(function (t) {
      return '<span class="chip">' + t + '</span>';
    }).join('');

    return (
      '<div class="card trip-card card-clickable" data-viagem-id="' + viagem.id + '">' +
        '<div class="trip-card-cover trip-card-cover-' + viagem.capa + '">' +
          '<div class="trip-card-title">' + viagem.nome + '</div>' +
        '</div>' +
        '<div class="trip-card-body">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2)">' +
            '<span class="text-sm text-secondary">📍 ' + viagem.destino + '</span>' +
            '<span class="badge ' + badgeStatus(viagem.status) + '">' + textoStatus(viagem.status) + '</span>' +
          '</div>' +
          '<p class="text-xs text-muted" style="margin-bottom:var(--space-3)">📅 ' + viagem.dataInicio + ' → ' + viagem.dataFim + '</p>' +
          '<div style="margin-bottom:var(--space-2)">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:var(--space-1)">' +
              '<span class="text-xs text-secondary">Orçamento usado</span>' +
              '<span class="text-xs font-semibold">' + pct + '%</span>' +
            '</div>' +
            progressBar(pct, cor) +
          '</div>' +
          '<div style="display:flex;justify-content:space-between;margin-top:var(--space-2)">' +
            '<span class="text-xs text-muted">' + formatarMoeda(viagem.gastoAtual) + ' gastos</span>' +
            '<span class="text-xs text-secondary">de ' + formatarMoeda(viagem.orcamento) + '</span>' +
          '</div>' +
          '<div class="trip-card-meta" style="margin-top:var(--space-3)">' +
            tags +
            '<span class="chip">👥 ' + viagem.participantes + ' pessoas</span>' +
          '</div>' +
        '</div>' +
        '<div class="card-footer">' +
          '<a href="#/viagem/' + viagem.id + '" class="btn btn-primary btn-sm">Ver detalhes</a>' +
          '<button class="btn btn-ghost btn-sm" onclick="Store.selecionarViagem(\'' + viagem.id + '\')">Selecionar</button>' +
        '</div>' +
      '</div>'
    );
  }

  // ---- Renderiza item de itinerário ----
  function renderItinerarioItem(item) {
    return (
      '<div class="itinerary-item">' +
        (item.hora ? '<div class="itinerary-item-time">' + item.hora + '</div>' : '') +
        '<div class="itinerary-item-title">' + item.titulo + '</div>' +
        (item.descricao ? '<div class="itinerary-item-desc">' + item.descricao + '</div>' : '') +
      '</div>'
    );
  }

  // ---- Renderiza um dia do roteiro ----
  function renderDiaRoteiro(dia) {
    var itens = dia.itens.map(renderItinerarioItem).join('');
    return (
      '<div class="itinerary-day">' +
        '<div class="itinerary-day-header">' +
          '<div class="itinerary-day-number">' + dia.dia + '</div>' +
          '<div>' +
            '<div class="itinerary-day-label">' + dia.label + '</div>' +
            '<div class="itinerary-day-date">' + dia.data + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="itinerary-items">' + itens + '</div>' +
      '</div>'
    );
  }

  // ---- Renderiza linha de despesa ----
  function renderDespesa(despesa) {
    return (
      '<div class="expense-row">' +
        '<div class="expense-row-left">' +
          '<div class="expense-icon">' + despesa.emoji + '</div>' +
          '<div>' +
            '<div class="expense-name">' + despesa.descricao + '</div>' +
            '<div class="expense-cat">' + despesa.categoria + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="expense-amount">' + formatarMoeda(despesa.valor) + '</div>' +
      '</div>'
    );
  }

  // ---- Renderiza categoria financeira ----
  function renderCategoriaFinanceira(cat) {
    var pct = calcularPorcentagem(cat.valor, cat.orcamento);
    var cor = corBarra(pct);
    return (
      '<div style="margin-bottom:var(--space-4)">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:var(--space-1)">' +
          '<span class="text-sm">' + cat.emoji + ' ' + cat.nome + '</span>' +
          '<span class="text-sm font-semibold">' + formatarMoeda(cat.valor) + ' <span class="text-muted">/ ' + formatarMoeda(cat.orcamento) + '</span></span>' +
        '</div>' +
        progressBar(pct, cor) +
        '<div style="text-align:right;margin-top:2px"><span class="text-xs text-muted">' + pct + '% do orçamento</span></div>' +
      '</div>'
    );
  }

  // ---- Renderiza trecho de rota ----
  function renderTrecho(trecho) {
    return (
      '<div class="route-summary-row">' +
        '<div class="route-step-icon">' + (trecho.modo.includes('✈️') ? '✈️' : '🚐') + '</div>' +
        '<div class="route-step-info">' +
          '<div class="route-step-label">' + trecho.origem + ' → ' + trecho.destino + '</div>' +
          '<div class="route-step-detail">' + trecho.modo + ' · ' + trecho.distancia + ' · ' + trecho.duracao + '</div>' +
        '</div>' +
        '<div class="route-step-value">' + trecho.custoPessoa + '</div>' +
      '</div>'
    );
  }

  // ---- Renderiza stat card ----
  function renderStatCard(label, valor, sub, iconClass, emoji) {
    return (
      '<div class="stat-card">' +
        '<div class="stat-card-icon ' + iconClass + '">' + emoji + '</div>' +
        '<div class="stat-card-label">' + label + '</div>' +
        '<div class="stat-card-value">' + valor + '</div>' +
        (sub ? '<div class="stat-card-sub">' + sub + '</div>' : '') +
      '</div>'
    );
  }

  // ---- Empty state genérico ----
  function renderEmptyState(titulo, descricao) {
    return (
      '<div class="empty-state">' +
        '<div class="empty-state-icon">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">' +
            '<path d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"/>' +
          '</svg>' +
        '</div>' +
        '<div class="empty-state-title">' + titulo + '</div>' +
        '<div class="empty-state-desc">' + descricao + '</div>' +
      '</div>'
    );
  }

  // ---- Header de seção ----
  function renderSectionHeader(titulo, acao, href) {
    return (
      '<div class="section-header">' +
        '<h2 class="section-title">' + titulo + '</h2>' +
        (acao && href ? '<a href="' + href + '" class="section-action">' + acao + '</a>' : '') +
      '</div>'
    );
  }

  // API pública
  return {
    formatarMoeda: formatarMoeda,
    calcularPorcentagem: calcularPorcentagem,
    progressBar: progressBar,
    corBarra: corBarra,
    badgeStatus: badgeStatus,
    textoStatus: textoStatus,
    renderTripCard: renderTripCard,
    renderDiaRoteiro: renderDiaRoteiro,
    renderDespesa: renderDespesa,
    renderCategoriaFinanceira: renderCategoriaFinanceira,
    renderTrecho: renderTrecho,
    renderStatCard: renderStatCard,
    renderEmptyState: renderEmptyState,
    renderSectionHeader: renderSectionHeader,
  };

})();
