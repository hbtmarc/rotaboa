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
  function renderTripCard(viagem, idSelecionado) {
    var pct = calcularPorcentagem(viagem.gastoAtual, viagem.orcamento);
    var cor = corBarra(pct);
    var tags = (viagem.tags || []).map(function (t) {
      return '<span class="chip">' + t + '</span>';
    }).join('');
    var eSelecionada = viagem.id === idSelecionado;

    return (
      '<div class="card trip-card card-clickable" data-viagem-id="' + viagem.id + '">' +
        /* Barra azul indica a viagem atualmente selecionada */
        (eSelecionada ? '<div class="trip-card-selected-bar"></div>' : '') +
        '<div class="trip-card-cover trip-card-cover-' + viagem.capa + '">' +
          '<div class="trip-card-title">' + viagem.nome + '</div>' +
        '</div>' +
        '<div class="trip-card-body">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-2)">' +
            '<span class="text-sm text-secondary">📍 ' + (viagem.localizacaoCurta || viagem.destinoPrincipal || viagem.destino || '') + '</span>' +
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
        '<div class="card-footer" style="flex-wrap:wrap;gap:var(--space-2)">' +
          '<a href="#/viagem/' + viagem.id + '" class="btn btn-primary btn-sm" onclick="TripActions.abrirDetalhes(\'' + viagem.id + '\');return false;">Detalhes</a>' +
          '<button class="btn btn-ghost btn-sm" onclick="TripActions.editar(\'' + viagem.id + '\')">Editar</button>' +
          '<button class="btn btn-ghost btn-sm" style="color:var(--color-danger)" onclick="TripActions.excluir(\'' + viagem.id + '\')">Excluir</button>' +
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

  // ---- Renderiza linha de despesa (mock — mantido para retrocompatibilidade) ----
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

  // ---- Mapa de categorias de despesas ----
  var _despCatMeta = {
    transporte:  { emoji: '🚗', nome: 'Transporte'  },
    hospedagem:  { emoji: '🏨', nome: 'Hospedagem'  },
    alimentacao: { emoji: '🍽️', nome: 'Alimentação' },
    passeios:    { emoji: '🎡', nome: 'Passeios'    },
    compras:     { emoji: '🛍️', nome: 'Compras'     },
    outros:      { emoji: '📌', nome: 'Outros'      },
  };

  // ---- Renderiza cartão de despesa funcional (com editar/excluir) ----
  function renderDespesaItem(desp, tripId) {
    var cat   = _despCatMeta[desp.categoria] || _despCatMeta.outros;
    var eRota = desp.origem === 'rota' || !!desp.routeSegmentId;
    var data  = '';
    if (desp.data) {
      var p = desp.data.split('-');
      data = p[2] + '/' + p[1] + '/' + p[0];
    }
    var partic = (desp.participantes && desp.participantes.length)
      ? desp.participantes.length
      : 1;
    var porPessoa = partic > 0 ? (Number(desp.valor) / partic) : Number(desp.valor);
    var splitLabel = partic > 1
      ? '<span class="desp-split">' + cat.emoji + ' ' + formatarMoeda(porPessoa) + '/pessoa (' + partic + ' pessoas)</span>'
      : '';
    var badgeRota = eRota
      ? '<span class="badge badge-info">Gerado por rota</span>'
      : '';
    var acaoEditar = eRota ? 'Editar rota' : 'Editar';
    var acaoExcluir = eRota ? 'Excluir rota' : 'Excluir';

    return (
      '<div class="desp-card" data-desp-id="' + desp.id + '">' +
        '<div class="desp-card-top">' +
          '<div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap">' +
            '<span class="desp-cat-chip">' + cat.emoji + ' ' + cat.nome + '</span>' +
            badgeRota +
          '</div>' +
          '<span class="desp-date">' + data + '</span>' +
        '</div>' +
        '<div class="desp-card-main">' +
          '<div class="desp-desc">' + desp.descricao + '</div>' +
          '<div class="desp-valor">' + formatarMoeda(Number(desp.valor)) + '</div>' +
        '</div>' +
        '<div class="desp-card-sub">' +
          '<span class="desp-pagante">💳 ' + (desp.quemPagou || '—') + '</span>' +
          splitLabel +
        '</div>' +
        (desp.observacoes ? '<div class="desp-obs">' + desp.observacoes + '</div>' : '') +
        '<div class="desp-actions">' +
          '<button class="desp-btn" onclick="DespesaActions.editar(\'' + tripId + '\',\'' + desp.id + '\')">✏️ <span>' + acaoEditar + '</span></button>' +
          '<button class="desp-btn desp-btn-delete" onclick="DespesaActions.excluir(\'' + tripId + '\',\'' + desp.id + '\')">🗑️ <span>' + acaoExcluir + '</span></button>' +
        '</div>' +
      '</div>'
    );
  }

  // ---- Linha de barra de categoria financeira ----
  function renderBarraCategoria(cat) {
    var largura = Math.min(100, cat.pct || 0);
    return (
      '<div class="fin-cat-row">' +
        '<div class="fin-cat-label">' +
          '<span>' + cat.emoji + ' ' + cat.nome + '</span>' +
          '<span class="fin-cat-valor">' + formatarMoeda(cat.valor) + '</span>' +
        '</div>' +
        '<div class="fin-bar-track">' +
          '<div class="fin-bar-fill" style="width:' + largura + '%"></div>' +
        '</div>' +
        '<div class="fin-cat-pct">' + (cat.pct || 0) + '% do orçamento</div>' +
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

  var _tipoMetaRota = {
    aereo:     { emoji: '✈️', nome: 'Aéreo' },
    carro:     { emoji: '🚗', nome: 'Carro' },
    van:       { emoji: '🚐', nome: 'Van' },
    onibus:    { emoji: '🚌', nome: 'Ônibus' },
    trem:      { emoji: '🚆', nome: 'Trem' },
    barco:     { emoji: '⛵', nome: 'Barco' },
    caminhada: { emoji: '🚶', nome: 'Caminhada' },
    outro:     { emoji: '🧭', nome: 'Outro' },
  };

  function renderTrechoItem(trecho, tripId) {
    var meta = _tipoMetaRota[trecho.tipo] || _tipoMetaRota.outro;
    var distanciaTxt = (Number(trecho.distanciaKm) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    var litrosTxt = (Number(trecho.litrosEstimados) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });

    return (
      '<div class="rota-card" data-trecho-id="' + trecho.id + '">' +
        '<div class="rota-card-top">' +
          '<span class="rota-type-chip">' + meta.emoji + ' ' + meta.nome + '</span>' +
          '<span class="rota-distance">' + distanciaTxt + ' km</span>' +
        '</div>' +
        '<div class="rota-main">' +
          '<div class="rota-route">' + trecho.origem + ' → ' + trecho.destino + '</div>' +
          '<div class="rota-total">' + formatarMoeda(trecho.custoTotal || 0) + '</div>' +
        '</div>' +
        '<div class="rota-sub">' +
          '<span>🕒 ' + (trecho.duracaoEstimada || '—') + '</span>' +
          '<span>⛽ ' + litrosTxt + ' L</span>' +
          '<span>👥 ' + formatarMoeda(trecho.custoPorPessoa || 0) + '/pessoa</span>' +
        '</div>' +
        (trecho.observacoes ? '<div class="rota-obs">' + trecho.observacoes + '</div>' : '') +
        '<div class="rota-actions">' +
          '<button class="desp-btn" onclick="TrechoActions.editar(\'' + tripId + '\',\'' + trecho.id + '\')">✏️ <span>Editar</span></button>' +
          '<button class="desp-btn desp-btn-delete" onclick="TrechoActions.excluir(\'' + tripId + '\',\'' + trecho.id + '\')">🗑️ <span>Excluir</span></button>' +
        '</div>' +
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

  // ---- Renderiza header de seção ----
  function renderSectionHeader(titulo, acao, href) {
    return (
      '<div class="section-header">' +
        '<h2 class="section-title">' + titulo + '</h2>' +
        (acao && href ? '<a href="' + href + '" class="section-action">' + acao + '</a>' : '') +
      '</div>'
    );
  }

  // ================================================================
  // Itinerário
  // ================================================================

  // ---- Formata data ISO → "10/07/2026 · Qui" ----
  function _formatarDataRoteiro(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    var semana = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    var d = new Date(iso + 'T12:00:00');
    return p[2] + '/' + p[1] + '/' + p[0] + ' · ' + semana[d.getDay()];
  }

  // ---- Formata data ISO → "10/07" ----
  function _formatarDataCurta(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '/' + p[1];
  }

  // ---- Mapa de categoria → emoji + classe CSS ----
  var _catMeta = {
    deslocamento: { emoji: '🚗', cls: 'cat-deslocamento', label: 'Deslocamento' },
    hospedagem:   { emoji: '🏨', cls: 'cat-hospedagem',   label: 'Hospedagem'   },
    alimentacao:  { emoji: '🍽️', cls: 'cat-alimentacao',  label: 'Alimentação'  },
    passeio:      { emoji: '🎡', cls: 'cat-passeio',      label: 'Passeio'      },
    compra:       { emoji: '🛍️', cls: 'cat-compra',       label: 'Compra'       },
    livre:        { emoji: '🌴', cls: 'cat-livre',        label: 'Livre'        },
    outro:        { emoji: '📌', cls: 'cat-outro',        label: 'Outro'        },
  };

  // ---- Badge de status de atividade ----
  function badgeAtividade(status) {
    var mapa = {
      planejado:  'badge-neutral',
      reservado:  'badge-reservado',
      confirmado: 'badge-confirmado',
      feito:      'badge-feito',
      cancelado:  'badge-cancelado',
    };
    return mapa[status] || 'badge-neutral';
  }

  // ---- Texto legível do status de atividade ----
  function textoStatusAtividade(status) {
    var mapa = {
      planejado:  'Planejado',
      reservado:  'Reservado',
      confirmado: 'Confirmado',
      feito:      'Feito',
      cancelado:  'Cancelado',
    };
    return mapa[status] || status;
  }

  // ---- Renderiza uma atividade ----
  function renderAtividade(ativ, tripId) {
    var catKey = ativ.categoria || 'outro';
    var cat    = _catMeta[catKey] || _catMeta.outro;
    var feito  = ativ.status === 'feito';
    var borderCls = 'cat-border-' + catKey;
    var chipCls   = 'cat-' + catKey;

    var local = ativ.local
      ? '<span class="itin-activity-local">📍 ' + ativ.local + '</span>'
      : '';
    var custo = (ativ.custoEstimado > 0)
      ? '<span class="itin-activity-cost">💰 ' + formatarMoeda(ativ.custoEstimado) + '</span>'
      : '';
    var badgeCls = badgeAtividade(ativ.status);
    var badge = '<span class="badge ' + badgeCls + '" style="font-size:10px;padding:2px 7px">' + textoStatusAtividade(ativ.status) + '</span>';
    var obs = ativ.observacoes
      ? '<div class="itin-activity-obs">' + ativ.observacoes + '</div>'
      : '';
    var details = (local || custo || badge)
      ? '<div class="itin-activity-details">' + local + custo + badge + '</div>'
      : '';

    var doneLabel   = feito ? 'Desfazer' : 'Concluir';
    var doneEmoji   = feito ? '↩' : '✓';
    var doneCls     = 'itin-act-btn btn-done';

    return (
      '<div class="itin-activity ' + borderCls + (feito ? ' feito' : '') + '" data-ativ-id="' + ativ.id + '">' +
        '<div class="itin-activity-top">' +
          '<span class="itin-activity-time">' + (ativ.hora || '--:--') + '</span>' +
          '<span class="itin-cat-chip ' + chipCls + '">' + cat.emoji + ' ' + cat.label + '</span>' +
          '<div class="itin-activity-actions">' +
            '<button class="' + doneCls + '" title="' + doneLabel + '" onclick="AtividadeActions.toggle(\'' + tripId + '\',\'' + ativ.id + '\')">' +
              doneEmoji + '<span class="act-label">' + doneLabel + '</span>' +
            '</button>' +
            '<button class="itin-act-btn" title="Editar" onclick="AtividadeActions.editar(\'' + tripId + '\',\'' + ativ.id + '\')">' +
              '✏️<span class="act-label">Editar</span>' +
            '</button>' +
            '<button class="itin-act-btn btn-delete" title="Excluir" onclick="AtividadeActions.excluir(\'' + tripId + '\',\'' + ativ.id + '\')">' +
              '🗑️<span class="act-label">Excluir</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="itin-activity-name">' + ativ.nome + '</div>' +
        details +
        obs +
      '</div>'
    );
  }

  // ---- Renderiza um dia do itinerário ----
  function renderDiaItinerario(dia, numDia, tripId) {
    var lista = dia.atividades || [];
    var n = lista.length;
    var atividades = lista.map(function (a) {
      return renderAtividade(a, tripId);
    }).join('');

    var countText = n === 0 ? 'Nenhuma' : n + ' atividade' + (n !== 1 ? 's' : '');
    var vazio = n === 0
      ? '<div class="itin-empty-day">📭 Nenhuma atividade planejada para este dia.</div>'
      : '';

    return (
      '<div class="itin-day">' +
        '<div class="itin-day-header">' +
          '<span class="itin-day-num">' + numDia + '</span>' +
          '<div class="itin-day-info">' +
            '<div class="itin-day-date">' + _formatarDataRoteiro(dia.data) + '</div>' +
            (dia.titulo ? '<div class="itin-day-titulo">' + dia.titulo + '</div>' : '') +
          '</div>' +
          '<span class="itin-day-count">' + countText + '</span>' +
        '</div>' +
        vazio + atividades +
        '<button class="itin-add-btn" onclick="AtividadeModal.abrir(\'' + tripId + '\',\'' + dia.data + '\')">' +
          '＋ Adicionar atividade' +
        '</button>' +
      '</div>'
    );
  }

  // ---- Preview de atividades (detalhe da viagem) ----
  function renderPreviewAtividade(ativ) {
    var cat      = _catMeta[ativ.categoria] || _catMeta.outro;
    var badgeCls = badgeAtividade ? badgeAtividade(ativ.status) : '';
    var statusBadge = ativ.status && ativ.status !== 'planejado'
      ? '<span class="badge ' + badgeCls + '" style="font-size:10px;padding:2px 7px;flex-shrink:0">' + textoStatusAtividade(ativ.status) + '</span>'
      : '';
    return (
      '<div class="preview-activity">' +
        '<div class="preview-activity-time">' + (ativ.hora || '--:--') + '</div>' +
        '<div class="preview-activity-dot ' + cat.cls + '"></div>' +
        '<div class="preview-activity-info">' +
          '<div class="preview-activity-name">' + cat.emoji + ' ' + ativ.nome + '</div>' +
          '<div class="preview-activity-sub">' + _formatarDataCurta(ativ._data || '') + '</div>' +
        '</div>' +
        '<div class="preview-activity-status">' + statusBadge + '</div>' +
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
    renderDespesaItem: renderDespesaItem,
    renderBarraCategoria: renderBarraCategoria,
    renderCategoriaFinanceira: renderCategoriaFinanceira,
    renderTrecho: renderTrecho,
    renderTrechoItem: renderTrechoItem,
    renderStatCard: renderStatCard,
    renderEmptyState: renderEmptyState,
    renderSectionHeader: renderSectionHeader,
    // Itinerário
    renderAtividade: renderAtividade,
    renderDiaItinerario: renderDiaItinerario,
    renderPreviewAtividade: renderPreviewAtividade,
    badgeAtividade: badgeAtividade,
    textoStatusAtividade: textoStatusAtividade,
  };

})();
