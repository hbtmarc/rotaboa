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

  function contarParticipantesAtivos(viagem) {
    if (!viagem) return 1;
    if (Array.isArray(viagem.participantes)) {
      var ativos = viagem.participantes.filter(function (p) {
        return p && p.ativo !== false && String(p.nome || '').trim();
      }).length;
      return Math.max(1, ativos);
    }
    return Math.max(1, Number(viagem.participantes) || 1);
  }

  // ---- Formata data ISO curta → "22/05/26" ----
  function _fmtDataCurta(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0].slice(2);
  }

  // ---- Renderiza um card de viagem (redesenhado) ----
  function renderTripCard(viagem, idSelecionado) {
    var gastoAtual = Number(viagem.gastoAtualCalculado !== undefined ? viagem.gastoAtualCalculado : viagem.gastoAtual) || 0;
    var pct = calcularPorcentagem(gastoAtual, viagem.orcamento);
    var cor = corBarra(pct);
    var totalParticipantes = contarParticipantesAtivos(viagem);
    var nomesParticipantes = Array.isArray(viagem.participantes)
      ? viagem.participantes
          .filter(function (p) { return p && p.ativo !== false; })
          .map(function (p) { return String(p.nome || '').trim(); })
          .filter(Boolean)
      : [];
    var nomesPreview = nomesParticipantes.length <= 2
      ? nomesParticipantes.join(', ')
      : nomesParticipantes.slice(0, 2).join(', ') + ' e mais ' + (nomesParticipantes.length - 2);
    var tags = (viagem.tags || []).slice(0, 3).map(function (t) {
      return '<span class="chip chip-sm">' + t + '</span>';
    }).join('');
    var eSelecionada = viagem.id === idSelecionado;
    var loc   = viagem.localizacaoCurta || viagem.destinoPrincipal || viagem.destino || '';
    var datas = viagem.dataInicio ? _fmtDataCurta(viagem.dataInicio) + ' → ' + _fmtDataCurta(viagem.dataFim) : '';

    return (
      '<div class="card trip-card card-clickable' + (eSelecionada ? ' trip-card-selecionada' : '') + '" data-viagem-id="' + viagem.id + '">' +
        '<div class="trip-card-cover trip-card-cover-' + viagem.capa + '">' +
          '<div class="trip-card-cover-top">' +
            (eSelecionada ? '<span class="trip-card-sel-badge">✓ Selecionada</span>' : '<span></span>') +
            '<span class="badge ' + badgeStatus(viagem.status) + '">' + textoStatus(viagem.status) + '</span>' +
          '</div>' +
          '<div class="trip-card-title">' + viagem.nome + '</div>' +
        '</div>' +
        '<div class="trip-card-body">' +
          '<div class="trip-card-meta-line">' +
            (loc  ? '<span class="trip-card-meta-item">📍 ' + loc  + '</span>' : '') +
            (datas ? '<span class="trip-card-meta-item">📅 ' + datas + '</span>' : '') +
          '</div>' +
          '<div class="trip-card-meta-line" style="margin-top:var(--space-1)">' +
            '<span class="trip-card-meta-item">👥 ' + totalParticipantes + ' pessoa' + (totalParticipantes !== 1 ? 's' : '') +
              (nomesPreview ? ' (' + nomesPreview + ')' : '') +
            '</span>' +
          '</div>' +
          '<div class="trip-card-budget">' +
            '<div class="trip-card-budget-row">' +
              '<span class="text-xs text-secondary">💸 ' + formatarMoeda(gastoAtual) + ' de ' + formatarMoeda(viagem.orcamento) + '</span>' +
              '<span class="text-xs font-bold ' + (pct >= 90 ? 'text-danger' : pct >= 70 ? 'text-warn' : 'text-ok') + '">' + pct + '%</span>' +
            '</div>' +
            progressBar(pct, cor) +
          '</div>' +
          (tags ? '<div class="trip-card-tags">' + tags + '</div>' : '') +
        '</div>' +
        '<div class="card-footer">' +
          '<a href="#/viagem/' + viagem.id + '" class="btn btn-primary btn-sm" onclick="TripActions.abrirDetalhes(\'' + viagem.id + '\');return false;">Detalhes</a>' +
          '<button class="btn btn-ghost btn-sm" onclick="TripActions.editar(\'' + viagem.id + '\');event.stopPropagation()">Editar</button>' +
          '<button class="btn btn-ghost btn-sm" style="color:var(--color-danger)" onclick="TripActions.excluir(\'' + viagem.id + '\');event.stopPropagation()">Excluir</button>' +
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

  // ---- Mapa de categorias de despesas (inclui aliases de atividade) ----
  var _despCatMeta = {
    transporte:   { emoji: '🚗', nome: 'Transporte'  },
    deslocamento: { emoji: '🚗', nome: 'Transporte'  },
    hospedagem:   { emoji: '🏨', nome: 'Hospedagem'  },
    alimentacao:  { emoji: '🍽️', nome: 'Alimentação' },
    restaurante:  { emoji: '🍽️', nome: 'Restaurante' },
    passeios:     { emoji: '🎡', nome: 'Passeios'    },
    passeio:      { emoji: '🎡', nome: 'Passeio'     },
    aventura:     { emoji: '🧗', nome: 'Aventura'    },
    cachoeira:    { emoji: '💧', nome: 'Cachoeira'   },
    cultura:      { emoji: '🏛️', nome: 'Cultura'     },
    evento:       { emoji: '🎟️', nome: 'Evento'      },
    natureza:     { emoji: '🌿', nome: 'Natureza'    },
    noturno:      { emoji: '🌇', nome: 'Noturno'     },
    praia:        { emoji: '🏖️', nome: 'Praia'       },
    trilha:       { emoji: '🥾', nome: 'Trilha'      },
    compras:      { emoji: '🛍️', nome: 'Compras'     },
    compra:       { emoji: '🛍️', nome: 'Compra'      },
    descanso:     { emoji: '😴', nome: 'Descanso'    },
    emergencia:   { emoji: '🚑', nome: 'Emergência'  },
    livre:        { emoji: '🌴', nome: 'Livre'       },
    outros:       { emoji: '📌', nome: 'Outros'      },
  };

  // ---- Renderiza cartão de despesa funcional (com editar/excluir) ----
  function renderDespesaItem(desp, tripId) {
    var cat   = _despCatMeta[desp.categoria] || _despCatMeta.outros;
    var eRota     = desp.origem === 'rota' || !!desp.routeSegmentId;
    var eRoteiro  = desp.origem === 'roteiro' && !!desp.linkedSource;
    var data = '';
    if (desp.data) {
      var p = desp.data.split('-');
      var _sem = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      var _dObj = new Date(desp.data + 'T12:00:00');
      data = _sem[_dObj.getDay()] + ', ' + p[2] + '/' + p[1] + '/' + p[0].slice(2);
    }
    var rateioNomes = (desp.participantesRateioNomes && desp.participantesRateioNomes.length)
      ? desp.participantesRateioNomes
      : [];
    var partic = rateioNomes.length
      ? rateioNomes.length
      : 1;
    var porPessoa = partic > 0 ? (Number(desp.valor) / partic) : Number(desp.valor);
    var splitLabel = partic > 1
      ? '<span class="desp-split">' + cat.emoji + ' ' + formatarMoeda(porPessoa) + '/pessoa (' + partic + ' pessoas)</span>'
      : '';
    var parcelas = Math.max(1, Number(desp.totalParcelas) || 1);
    var detalheParcelas = '';
    if (parcelas > 1) {
      var lista = Array.isArray(desp.parcelas) ? desp.parcelas : [];
      var primeira = lista.length > 0 ? Number(lista[0]) : (Number(desp.valor) / parcelas);
      var ultima = lista.length > 0 ? Number(lista[lista.length - 1]) : primeira;
      detalheParcelas = '<div class="text-xs text-muted" style="margin-top:var(--space-1)">🧩 ' + parcelas + 'x de ' + formatarMoeda(primeira) + (Math.abs(ultima - primeira) >= 0.01 ? ' (última de ' + formatarMoeda(ultima) + ')' : '') + '</div>';
    }
    var badgeRota    = eRota    ? '<span class="badge badge-info">Gerado por rota</span>'    : '';
    var badgeRoteiro = eRoteiro ? '<span class="badge badge-roteiro">Do roteiro</span>' : '';
    var acaoEditar  = eRota ? 'Editar rota'  : 'Editar';
    var acaoExcluir = eRota ? 'Excluir rota' : 'Excluir';

    return (
      '<div class="desp-card" data-desp-id="' + desp.id + '">' +
        '<div class="desp-card-top">' +
          '<div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap">' +
            '<span class="desp-cat-chip">' + cat.emoji + ' ' + cat.nome + '</span>' +
            badgeRota +
            badgeRoteiro +
          '</div>' +
          '<span class="desp-date">' + data + '</span>' +
        '</div>' +
        '<div class="desp-card-main">' +
          '<div class="desp-desc">' + desp.descricao + '</div>' +
          '<div class="desp-valor">' + formatarMoeda(Number(desp.valor)) + '</div>' +
        '</div>' +
        '<div class="desp-card-sub">' +
          '<span class="desp-pagante">💳 ' + (desp.quemPagouNome || '—') + '</span>' +
          splitLabel +
        '</div>' +
        detalheParcelas +
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

  // ---- Parses duration string → total minutes ----
  function _parseDurMinutes(str) {
    if (!str) return null;
    var s = String(str).trim().toLowerCase();
    var hm = s.match(/^(\d+)\s*h\s*(\d+)\s*(?:min|m)?$/);
    if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
    var ho = s.match(/^(\d+)\s*h$/);
    if (ho) return parseInt(ho[1], 10) * 60;
    var mi = s.match(/^(\d+)\s*(?:min|m)$/);
    if (mi) return parseInt(mi[1], 10);
    var col = s.match(/^(\d+):(\d{2})$/);
    if (col) return parseInt(col[1], 10) * 60 + parseInt(col[2], 10);
    var n = parseInt(s, 10);
    return (!isNaN(n) && n > 0) ? n : null;
  }

  // ---- Calculates arrival from departure date/time + duration ----
  function _calcArrival(dateISO, timeHHMM, durationStr) {
    if (!dateISO || !timeHHMM) return null;
    var mins = _parseDurMinutes(durationStr);
    if (!mins || mins <= 0) return null;
    var parts = timeHHMM.split(':');
    var depMins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    var arrMins = depMins + mins;
    var extraDays = Math.floor(arrMins / (24 * 60));
    arrMins = arrMins % (24 * 60);
    var hh = String(Math.floor(arrMins / 60)).padStart(2, '0');
    var mm = String(arrMins % 60).padStart(2, '0');
    var arrDate = dateISO;
    if (extraDays > 0) {
      var d = new Date(dateISO + 'T12:00:00');
      d.setDate(d.getDate() + extraDays);
      arrDate = d.toISOString().slice(0, 10);
    }
    return { data: arrDate, horario: hh + ':' + mm, nextDay: extraDays > 0 };
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
    var fonte = String(trecho.routeSource || trecho.calculoModo || 'manual').toLowerCase();
    var badgeFonte = fonte === 'google'
      ? '<span class="badge badge-info">Google Maps</span>'
      : '<span class="badge badge-neutral">Manual</span>';
    var directionChip = trecho.direction === 'ida'
      ? '<span class="trecho-chip-dir trecho-chip-ida">Ida ➡</span>'
      : trecho.direction === 'volta'
      ? '<span class="trecho-chip-dir trecho-chip-volta">↩ Volta</span>'
      : '';

    var dataHoraChip = (function () {
      if (!trecho.data) return '';
      var partes = String(trecho.data).split('-');
      var dataTxt = partes.length === 3 ? partes[2] + '/' + partes[1] + '/' + partes[0] : trecho.data;
      return dataTxt + (trecho.horario ? ' · ' + trecho.horario : '');
    }());

    // Saída/chegada line
    var saidaChegadaTxt = (function () {
      var saida = trecho.horario ? 'Saída ' + trecho.horario : '';
      var cheg = '';
      if (trecho.chegadaHorario) {
        cheg = 'Chegada ' + trecho.chegadaHorario;
        if (trecho.data && trecho.chegadaData && trecho.chegadaData !== trecho.data) {
          cheg += ' (+1 dia)';
        }
      } else if (trecho.data && trecho.horario && trecho.duracaoEstimada) {
        var _arr = _calcArrival(trecho.data, trecho.horario, trecho.duracaoEstimada);
        if (_arr) {
          cheg = 'Chegada ' + _arr.horario + (_arr.nextDay ? ' (+1 dia)' : '');
        }
      }
      return [saida, cheg].filter(Boolean).join(' · ');
    }());

    return (
      '<div class="rota-card" data-trecho-id="' + trecho.id + '">' +
        '<div class="rota-card-top">' +
          '<div style="display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap">' +
            '<span class="rota-type-chip">' + meta.emoji + ' ' + meta.nome + '</span>' +
            badgeFonte +
            directionChip +
            (dataHoraChip ? '<span class="text-xs text-muted" style="margin-left:var(--space-1)">' + dataHoraChip + '</span>' : '') +
          '</div>' +
          '<span class="rota-distance">' + distanciaTxt + ' km</span>' +
        '</div>' +
        (saidaChegadaTxt ? '<div class="rota-time-row">' + saidaChegadaTxt + '</div>' : '') +
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
    alimentacao:  { emoji: '🍽️', cls: 'cat-alimentacao',  label: 'Alimentação'  },
    aventura:     { emoji: '🧗', cls: 'cat-aventura',     label: 'Aventura'     },
    cachoeira:    { emoji: '💧', cls: 'cat-cachoeira',    label: 'Cachoeira'    },
    compra:       { emoji: '🛍️', cls: 'cat-compra',       label: 'Compra'       },
    cultura:      { emoji: '🏛️', cls: 'cat-cultura',      label: 'Cultura'      },
    descanso:     { emoji: '😴', cls: 'cat-descanso',     label: 'Descanso'     },
    deslocamento: { emoji: '🚗', cls: 'cat-deslocamento', label: 'Deslocamento' },
    emergencia:   { emoji: '🚑', cls: 'cat-emergencia',   label: 'Emergência'   },
    evento:       { emoji: '🎟️', cls: 'cat-evento',       label: 'Evento'       },
    hospedagem:   { emoji: '🏨', cls: 'cat-hospedagem',   label: 'Hospedagem'   },
    livre:        { emoji: '🌴', cls: 'cat-livre',        label: 'Livre'        },
    natureza:     { emoji: '🌿', cls: 'cat-natureza',     label: 'Natureza'     },
    noturno:      { emoji: '🌇', cls: 'cat-noturno',      label: 'Noturno'      },
    outro:        { emoji: '📌', cls: 'cat-outro',        label: 'Outro'        },
    passeio:      { emoji: '🎡', cls: 'cat-passeio',      label: 'Passeio'      },
    praia:        { emoji: '🏖️', cls: 'cat-praia',        label: 'Praia'        },
    restaurante:  { emoji: '🍽️', cls: 'cat-restaurante',  label: 'Restaurante'  },
    trilha:       { emoji: '🥾', cls: 'cat-trilha',       label: 'Trilha'       },
  };

  // ============================================================
  // Timeline helpers
  // ============================================================
  function _horaToMin(h) {
    var parts = String(h || '').split(':');
    if (parts.length !== 2) return -1;
    var hh = parseInt(parts[0], 10);
    var mm = parseInt(parts[1], 10);
    if (isNaN(hh) || isNaN(mm)) return -1;
    return hh * 60 + mm;
  }

  function _minToHHMM(min) {
    if (min == null || min < 0) return '--:--';
    var m = ((min % 1440) + 1440) % 1440;
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }

  function _duracaoStr(min) {
    if (!min || min <= 0) return '';
    var h = Math.floor(min / 60);
    var m = min % 60;
    if (h > 0 && m > 0) return h + 'h ' + m + 'min';
    if (h > 0) return h + 'h';
    return m + 'min';
  }

  // endTime for any timeline item: hora + duracaoMin. Returns { hhmm, nextDay }
  function _itemEndTime(hora, duracaoMin) {
    var start = _horaToMin(hora);
    if (start < 0 || !duracaoMin || duracaoMin <= 0) return null;
    var end = start + duracaoMin;
    return { hhmm: _minToHHMM(end), nextDay: end >= 1440, endMin: end };
  }

  // Build a free-slot label between two timeline items (endMin, nextStartMin both in minutes)
  function _freeSlotHtml(endMin, nextStartMin) {
    var gap = nextStartMin - endMin;
    if (gap < 15) return '';
    // endMin may be ≥ 1440 (next day), wrap for display
    var fromHHMM = _minToHHMM(endMin);
    var toHHMM   = _minToHHMM(nextStartMin);
    var durLabel = _duracaoStr(gap);
    return (
      '<div class="itin-free-slot">' +
        '<span class="itin-free-dot"></span>' +
        '<span class="itin-free-label">Livre ' + fromHHMM + ' → ' + toHHMM +
          '<span class="itin-free-dur"> · ' + durLabel + '</span>' +
        '</span>' +
      '</div>'
    );
  }

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
  // meta: { conflito: bool }
  function renderAtividade(ativ, tripId, meta) {
    var catKey = ativ.categoria || 'outro';
    var cat    = _catMeta[catKey] || _catMeta.outro;
    var feito  = ativ.status === 'feito';
    var borderCls = 'cat-border-' + catKey;
    var chipCls   = 'cat-' + catKey;
    meta = meta || {};

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

    // Link externo (site, Instagram, Maps…)
    var linkHtml = '';
    if (ativ.link) {
      var _lurl = String(ativ.link);
      var _ldomain = '';
      try { _ldomain = new URL(_lurl).hostname.replace(/^www\./, ''); } catch(e) { _ldomain = _lurl.replace(/^https?:\/\/(www\.)?/,'').split('/')[0]; }
      var _licon = '🔗';
      var _lplatform = 'link';
      if (_ldomain.indexOf('instagram.com') !== -1)         { _licon = '📷'; _lplatform = 'instagram'; }
      else if (_ldomain.indexOf('facebook.com') !== -1)     { _licon = '👥'; _lplatform = 'facebook'; }
      else if (_ldomain.indexOf('maps.app.goo') !== -1 || _ldomain.indexOf('google.com/maps') !== -1 || _ldomain.indexOf('maps.google') !== -1) { _licon = '🗺️'; _lplatform = 'maps'; }
      else if (_ldomain.indexOf('tripadvisor') !== -1)      { _licon = '🦉'; _lplatform = 'tripadvisor'; }
      else if (_ldomain.indexOf('ifood') !== -1)            { _licon = '🛵'; _lplatform = 'ifood'; }
      else if (_ldomain.indexOf('rappi') !== -1)            { _licon = '🛵'; _lplatform = 'rappi'; }
      var _llabel = _ldomain || 'Ver link';
      if (_lplatform === 'instagram') {
        var _igSlug = _lurl.replace(/.*instagram\.com\//, '').replace(/[\/\?#].*/, '');
        if (_igSlug) _llabel = '@' + _igSlug;
      }
      var _lname = _lplatform.charAt(0).toUpperCase() + _lplatform.slice(1);
      linkHtml = (
        '<div class="itin-link-row">' +
          '<a href="' + _lurl + '" target="_blank" rel="noopener noreferrer" ' +
             'class="itin-activity-link itin-activity-link--' + _lplatform + '" ' +
             'title="' + _llabel.replace(/"/g,'&quot;') + '">' +
            '<span class="link-badge">' + _licon + '</span>' +
            '<span class="link-body">' +
              '<span class="link-platform-name">' + _lname + '</span>' +
              '<span class="link-handle">' + _llabel.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</span>' +
            '</span>' +
            '<svg class="link-ext-svg" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">' +
              '<path d="M2 10L10 2M10 2H5M10 2V7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
            '</svg>' +
          '</a>' +
        '</div>'
      );
    }

    // Duração + calculated end time
    var durStr = _duracaoStr(ativ.duracaoMin);
    var endInfo = _itemEndTime(ativ.hora, ativ.duracaoMin);
    var timeRowHtml = '';
    if (durStr || endInfo) {
      var durSpan = durStr ? '<span class="itin-act-dur">⏱ ' + durStr + '</span>' : '';
      var endSpan = endInfo
        ? '<span class="itin-act-end">até ' + endInfo.hhmm + (endInfo.nextDay ? '<span class="itin-act-nextday"> +1 dia</span>' : '') + '</span>'
        : '';
      timeRowHtml = '<div class="itin-activity-timerow">' + durSpan + endSpan + '</div>';
    }

    // Conflict notice
    var conflictHtml = meta.conflito
      ? '<div class="itin-conflict">⚠ Conflito de horário</div>'
      : '';

    // Locked indicator
    var lockHtml = ativ.locked ? '<span class="itin-lock" title="Horário fixo">🔒</span>' : '';

    var details = (local || custo || badge)
      ? '<div class="itin-activity-details">' + local + custo + badge + '</div>'
      : '';

    var doneLabel = feito ? 'Desfazer' : 'Concluir';
    var doneEmoji = feito ? '↩' : '✓';

    return (
      '<div class="itin-activity ' + borderCls + (feito ? ' feito' : '') + (meta.conflito ? ' has-conflict' : '') + '" data-ativ-id="' + ativ.id + '">' +
        '<div class="itin-activity-top">' +
          '<div class="itin-activity-time-block">' +
            '<span class="itin-activity-time">' + (ativ.hora || '--:--') + '</span>' +
            lockHtml +
          '</div>' +
          '<span class="itin-cat-chip ' + chipCls + '">' + cat.emoji + ' ' + cat.label + '</span>' +
          '<div class="itin-activity-actions">' +
            '<button class="itin-act-btn btn-done ' + (feito ? 'done-active' : '') + '" title="' + doneLabel + '" onclick="AtividadeActions.toggle(\'' + tripId + '\',\'' + ativ.id + '\')">' +
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
        conflictHtml +
        '<div class="itin-activity-name">' + ativ.nome + '</div>' +
        details +
        obs +
        linkHtml +
        timeRowHtml +
        '<button class="itin-reajustar-btn" title="Reajustar timeline a partir daqui" onclick="ReajustarModal.abrir(\'' + tripId + '\',\'' + ativ.id + '\',\'' + (meta.data || ativ._data || '') + '\')">' +
          '⟳ Reajustar a partir daqui' +
        '</button>' +
      '</div>'
    );
  }

  // ---- Constrói URL do Google Maps Directions para um trecho ----
  function _buildGoogleMapsUrl(trecho) {
    var origem  = String(trecho.origem  || '').trim();
    var destino = String(trecho.destino || '').trim();
    if (!origem || !destino) return '';
    var modoMap = { carro: 'driving', moto: 'driving', caminhada: 'walking', caminhando: 'walking' };
    var travelmode = modoMap[trecho.tipo] || 'driving';
    var url = 'https://www.google.com/maps/dir/?api=1' +
      '&origin=' + encodeURIComponent(origem) +
      '&destination=' + encodeURIComponent(destino) +
      '&travelmode=' + travelmode +
      '&dir_action=navigate';
    if (trecho.originPlaceId)      url += '&origin_place_id='      + encodeURIComponent(trecho.originPlaceId);
    if (trecho.destinationPlaceId) url += '&destination_place_id=' + encodeURIComponent(trecho.destinationPlaceId);
    return url;
  }

  // ---- Renderiza link "Ver rota" que abre Google Maps ----
  function _renderVerRotaLink(trecho) {
    var url = _buildGoogleMapsUrl(trecho);
    if (!url) return '<span class="itin-rota-link itin-rota-link--disabled" title="Endereço incompleto">Ver rota</span>';
    return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="itin-rota-link" title="Ver rota no Google Maps">Ver rota</a>';
  }

  // ---- Renderiza um trecho de rota no contexto do roteiro ----
  function renderTrechoNoRoteiro(trecho, tripId) {
    var origem  = String(trecho.origem  || '?');
    var destino = String(trecho.destino || '?');
    var icones  = { carro: '🚗', moto: '🏍️', aviao: '✈️', onibus: '🚌', trem: '🚆', barco: '⛵', bicicleta: '🚲', caminhando: '🚶' };
    var ico     = icones[trecho.tipo] || '🚗';
    var hora    = String(trecho.horario || '').trim();

    var dir = trecho.direction || trecho.direcao || '';
    var dirLabel = dir === 'ida' ? 'Ida' : dir === 'volta' ? 'Volta' : '';
    var lugar    = dir === 'volta' ? origem : (dir === 'ida' ? destino : (origem + ' → ' + destino));
    var tituloFull = (hora ? hora + ' · ' : '') + (dirLabel ? dirLabel + ' · ' : '') + lugar;

    var distStr = trecho.distanciaKm
      ? (Number(trecho.distanciaKm).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km')
      : '';
    var durStr = trecho.duracaoEstimada || '';

    // Arrival line for roteiro — only show same-day arrival
    var chegadaStr = (function () {
      var chegH = trecho.chegadaHorario;
      var chegD = trecho.chegadaData;
      if (!chegH && trecho.data && trecho.horario && trecho.duracaoEstimada) {
        var _a = _calcArrival(trecho.data, trecho.horario, trecho.duracaoEstimada);
        if (_a) { chegH = _a.horario; chegD = _a.data; }
      }
      if (!chegH) return '';
      // Cross-day: arrival will appear on the arrival day as a milestone
      if (chegD && trecho.data && chegD !== trecho.data) return '';
      return 'Chegada ' + chegH;
    }());

    var sub = [chegadaStr, distStr, durStr].filter(Boolean).join(' · ');

    return (
      '<div class="itin-row rota-row">' +
        '<div class="itin-row-icon">' + ico + '</div>' +
        '<div class="itin-row-main">' +
          '<div class="itin-row-title">' + tituloFull + '</div>' +
          (sub ? '<div class="itin-row-sub">' + sub + '</div>' : '') +
        '</div>' +
        '<div class="itin-row-action">' +
          _renderVerRotaLink(trecho) +
        '</div>' +
      '</div>'
    );
  }

  // ---- Renderiza milestone de chegada de rota cross-day ----
  function renderChegadaMilestone(trecho) {
    var hora = trecho._chegadaHorario || trecho.chegadaHorario || '?';
    var dir  = trecho.direction || '';
    var lugar = dir === 'volta'
      ? String(trecho.origem  || '?')
      : String(trecho.destino || '?');
    var dirLabel = dir === 'ida' ? 'Ida' : dir === 'volta' ? 'Volta' : '';
    var titulo = hora + ' · Chegada' + (dirLabel ? ' (' + dirLabel + ')' : '') + ' em ' + lugar;
    var depPartes = (trecho.data || '').split('-');
    var depDataTxt = depPartes.length === 3 ? depPartes[2] + '/' + depPartes[1] + '/' + depPartes[0] : trecho.data;
    var distStr = trecho.distanciaKm
      ? (Number(trecho.distanciaKm).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' km')
      : '';
    var durStr = trecho.duracaoEstimada || '';
    var sub = [
      depDataTxt ? 'Saída ' + (trecho.horario || '') + (depDataTxt ? ' · ' + depDataTxt : '') : '',
      distStr, durStr
    ].filter(Boolean).join(' · ');
    var icones = { aereo: '✈️', carro: '🚗', van: '🚐', onibus: '🚌', trem: '🚆', barco: '⛵', caminhada: '🚶', outro: '🧭' };
    var ico = icones[trecho.tipo] || '🚗';
    return (
      '<div class="itin-row chegada-row">' +
        '<div class="itin-row-icon">' + ico + '</div>' +
        '<div class="itin-row-main">' +
          '<div class="itin-row-title">' + titulo + '</div>' +
          (sub ? '<div class="itin-row-sub">' + sub + '</div>' : '') +
        '</div>' +
        '<div class="itin-row-action">' +
          _renderVerRotaLink(trecho) +
        '</div>' +
      '</div>'
    );
  }

  // ---- Renderiza entrada de hospedagem (check-in/check-out) no roteiro ----
  function renderHospedagemEntry(entry) {
    var isIn    = entry.tipo === 'check-in';
    var emoji   = isIn ? '🏨' : '🚪';
    var label   = isIn ? 'Check-in' : 'Check-out';
    var rowCls  = isIn ? 'hosp-in' : 'hosp-out';
    var nome    = entry.nome ? ' · ' + entry.nome : '';
    var hora    = entry.hora || '--:--';
    return (
      '<div class="itin-row ' + rowCls + '">' +
        '<div class="itin-row-icon">' + emoji + '</div>' +
        '<div class="itin-row-main">' +
          '<div class="itin-row-title">' + label + nome + '</div>' +
          '<div class="itin-row-sub">' + hora + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // ---- Renderiza um dia do itinerário ----
  function renderDiaItinerario(dia, numDia, tripId) {
    var lista    = dia.atividades || [];
    var trechos  = dia.trechos   || [];
    var hospEntradas = (dia.hospedagem || []).slice();
    var chegadas = dia.chegadas  || [];

    // ---- Normalise all items into a unified schema ----
    // { tipo, hora, duracaoMin, flexivel, locked, item }
    var allItems = [];

    var diaData = dia.data || '';

    lista.forEach(function (a) {
      allItems.push({
        tipo: 'atividade',
        hora: a.hora || '00:00',
        duracaoMin: a.duracaoMin || 0,
        flexivel: !a.locked,
        locked: !!a.locked,
        item: a,
      });
    });

    trechos.forEach(function (t) {
      var durMin = (function () {
        var s = String(t.duracaoEstimada || '');
        var m;
        m = s.match(/^(\d+)h\s*(\d+)min$/i);  if (m) return +m[1]*60 + +m[2];
        m = s.match(/^(\d+)h$/i);              if (m) return +m[1]*60;
        m = s.match(/^(\d+)min$/i);            if (m) return +m[1];
        m = s.match(/^(\d+):(\d+)$/);          if (m) return +m[1]*60 + +m[2];
        return 0;
      }());
      allItems.push({
        tipo: 'rota',
        hora: t.horario || '08:00',
        duracaoMin: durMin,
        flexivel: false,
        locked: true,
        item: t,
      });
    });

    hospEntradas.forEach(function (h) {
      allItems.push({
        tipo: 'hosp',
        hora: h.hora || '00:00',
        duracaoMin: 0,
        flexivel: false,
        locked: true,
        item: h,
      });
    });

    chegadas.forEach(function (c) {
      allItems.push({
        tipo: 'chegada',
        hora: c._chegadaHorario || '00:00',
        duracaoMin: 0,
        flexivel: false,
        locked: true,
        item: c,
      });
    });

    // ---- Sort by hora ----
    allItems.sort(function (a, b) {
      if (a.hora < b.hora) return -1;
      if (a.hora > b.hora) return  1;
      var prio = { chegada: 0, hosp: 1, rota: 2, atividade: 3 };
      return (prio[a.tipo] || 9) - (prio[b.tipo] || 9);
    });

    // ---- Build unified HTML ----
    var timelineHtml = '';
    var prevEndMin = -1; // running end pointer

    allItems.forEach(function (entry, i) {
      var startMin = _horaToMin(entry.hora);
      var endMin   = startMin >= 0 ? startMin + (entry.duracaoMin || 0) : startMin;

      // Detect conflict (overlaps with previous item by > 5 min)
      var conflito = (prevEndMin > 0 && startMin >= 0 && startMin < prevEndMin - 5);

      // Free-slot pill (only when no conflict and gap ≥ 15 min)
      if (!conflito && prevEndMin >= 0 && startMin >= 0 && startMin > prevEndMin + 14) {
        timelineHtml += _freeSlotHtml(prevEndMin, startMin);
      }

      // Render the item
      if (entry.tipo === 'atividade') {
        timelineHtml += renderAtividade(entry.item, tripId, { conflito: conflito, data: diaData });
      } else if (entry.tipo === 'hosp') {
        timelineHtml += renderHospedagemEntry(entry.item);
      } else if (entry.tipo === 'chegada') {
        timelineHtml += renderChegadaMilestone(entry.item);
      } else {
        timelineHtml += renderTrechoNoRoteiro(entry.item, tripId);
      }

      // Advance pointer (handle cross-midnight: keep running total)
      if (startMin >= 0) {
        prevEndMin = Math.max(prevEndMin, endMin >= 0 ? endMin : startMin);
      }
    });

    // Trailing free-slot hint ("Livre a partir de …") when day still has time left
    if (prevEndMin >= 0 && prevEndMin < 23 * 60 && prevEndMin < 1440) {
      timelineHtml += (
        '<div class="itin-free-slot itin-free-tail">' +
          '<span class="itin-free-dot"></span>' +
          '<span class="itin-free-label">Livre a partir de ' + _minToHHMM(prevEndMin) + '</span>' +
        '</div>'
      );
    }

    var vazio = allItems.length === 0
      ? '<div class="itin-empty-day">📭 Sem itens planejados para este dia.</div>'
      : '';

    return (
      '<div class="itin-day">' +
        '<div class="itin-day-header">' +
          '<span class="itin-day-num">' + numDia + '</span>' +
          '<div class="itin-day-info">' +
            '<div class="itin-day-date">' + _formatarDataRoteiro(dia.data) + '</div>' +
            (dia.titulo ? '<div class="itin-day-titulo">' + dia.titulo + '</div>' : '') +
          '</div>' +
        '</div>' +
        (timelineHtml
          ? '<div class="itin-timeline">' + timelineHtml + '</div>'
          : '') +
        vazio +
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
