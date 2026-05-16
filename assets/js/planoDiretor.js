// =====================================================================
// planoDiretor.js — Plano Diretor de Filmagem da Viagem
// Lê dados da viagem selecionada e gera um briefing visual estruturado.
// =====================================================================

var PlanoDiretorPage = (function () {

  // ---- Utilitários ----
  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _fmtData(iso) {
    if (!iso) return '-';
    try { return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR'); } catch (e) { return iso; }
  }

  function _fmtDataCurta(iso) {
    if (!iso) return '';
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch (e) { return iso; }
  }

  function _diaSemana(iso) {
    if (!iso) return '';
    var dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    try { return dias[new Date(iso + 'T12:00:00').getDay()] || ''; } catch (e) { return ''; }
  }

  function _diffDias(d1, d2) {
    try {
      var a = new Date(d1 + 'T12:00:00'), b = new Date(d2 + 'T12:00:00');
      return Math.round((b - a) / 86400000) + 1;
    } catch (e) { return 0; }
  }

  function _duracaoStr(min) {
    if (!min || min <= 0) return '';
    var h = Math.floor(min / 60), m = min % 60;
    if (h > 0 && m > 0) return h + 'h' + String(m).padStart(2, '0') + 'min';
    if (h > 0) return h + 'h';
    return m + 'min';
  }

  function _catLabel(cat) {
    var MAP = {
      refeicao: 'Refeição', passeio: 'Passeio', hospedagem: 'Hospedagem',
      transporte: 'Transporte', compra: 'Compra', natureza: 'Natureza',
      cultura: 'Cultura', esporte: 'Esporte', trilha: 'Trilha',
      praia: 'Praia', outro: 'Atividade',
    };
    return MAP[cat] || 'Atividade';
  }

  function _catEmoji(cat) {
    var MAP = {
      refeicao: '🍽️', passeio: '🚶', hospedagem: '🏨', transporte: '🚗',
      compra: '🛍️', natureza: '🌿', cultura: '🏛️', esporte: '⚽',
      trilha: '🥾', praia: '🏖️', outro: '📌',
    };
    return MAP[cat] || '📌';
  }

  function _tipoScena(cat) {
    var MAP = {
      natureza: 'Paisagem natural / Drone', trilha: 'POV / Ação / Drone',
      praia: 'Paisagem / Slow-motion', refeicao: 'Close de comida / Ambiente',
      cultura: 'Detalhe arquitetônico / Entrevista', passeio: 'Vlog / Câmera na mão',
      hospedagem: 'Establishing shot / Interiores', compra: 'Vlog / Reação',
      esporte: 'Ação / Câmera lenta', transporte: 'Timelapse / POV janela',
    };
    return MAP[cat] || 'Vlog geral';
  }

  function _shotSugerido(cat) {
    var MAP = {
      natureza: ['Wide da paisagem (drone ou teleobjetiva)', 'Close de texturas (folhas, água, pedras)', 'Silhueta de pessoa contra o horizonte'],
      trilha: ['POV da câmera na mão', 'Slow-motion dos pés caminhando', 'Drone acompanhando trilha'],
      praia: ['Wide do horizonte ao amanhecer/pôr do sol', 'Slow-motion das ondas', 'Drone sobre a praia'],
      refeicao: ['Close do prato sendo servido', 'Expressão de reação ao comer', 'Ambiente do restaurante — wide'],
      cultura: ['Detalhe da fachada / arquitetura', 'Pessoas interagindo com o lugar', 'Plano de contexto da cidade'],
      passeio: ['Câmera na mão seguindo o grupo', 'Expressões e reações espontâneas', 'Behind-the-scenes da viagem'],
      hospedagem: ['Chegada ao local — establishing shot', 'Vista da janela do quarto', 'Detalhes do ambiente'],
      compra: ['Reação ao ver / comprar o produto', 'Close do produto artesanal', 'Ambiente do mercado / loja'],
      esporte: ['Ação em câmera lenta', 'Wide do cenário do esporte', 'Expressões de esforço / diversão'],
      transporte: ['Timelapse na estrada', 'POV pela janela em movimento', 'Close das mãos no volante'],
    };
    return MAP[cat] || ['Wide do local', 'Detalhe do ambiente', 'Retrato / reação'];
  }

  // ---- Geração de conteúdo template ----
  function _gerarVisaoCreativa(viagem, itin) {
    var dest = viagem.destinoPrincipal || viagem.destino || 'o destino';
    var totalDias = (itin && itin.dias) ? itin.dias.length : 0;
    var totalAtiv = 0;
    var cats = {};
    if (itin && itin.dias) {
      itin.dias.forEach(function (d) {
        (d.atividades || []).forEach(function (a) {
          totalAtiv++;
          cats[a.categoria || 'outro'] = (cats[a.categoria || 'outro'] || 0) + 1;
        });
      });
    }
    var topCat = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; })[0] || 'passeio';
    var estilos = {
      natureza: 'mergulho contemplatho na natureza, com planos abertos e silêncio visual',
      trilha: 'aventura e descoberta, com câmera na mão e ritmo dinâmico',
      praia: 'relaxamento, cores vibrantes e slow-motion de elementos naturais',
      refeicao: 'gastronomia e cultura local, com close de pratos e atmosfera',
      cultura: 'imersão histórica e cultural, com planos de detalhe e entrevistas',
      passeio: 'registro documental leve, vlog de momentos autênticos',
      hospedagem: 'conforto e refúgio, planos de interiores e vistas privilegiadas',
    };
    var estilo = estilos[topCat] || 'registro autêntico da viagem, com variedade de ângulos e momentos';
    return (
      'Esta viagem para ' + dest + ' tem potencial para um vídeo de ' + totalDias + ' dias com foco em ' + estilo + '.\n\n' +
      'Com ' + totalAtiv + ' atividades planejadas, a narrativa visual deve privilegiar a experiência de quem assiste, transportando-a para os melhores momentos da jornada.\n\n' +
      'Tom sugerido: autêntico, imersivo e emocionalmente envolvente. Ritmo: dinâmico nos momentos de ação, contemplativo nos de paisagem. Paleta: natural, quente e saturada.'
    );
  }

  function _gerarLinhaNarrativa(viagem, itin) {
    var dest = viagem.destinoPrincipal || viagem.destino || 'o destino';
    var dias = (itin && itin.dias) ? itin.dias : [];
    if (dias.length === 0) return 'Defina o roteiro da viagem para gerar a linha narrativa automaticamente.';
    var linhas = [
      '① Abertura — Expectativa e preparação antes da viagem. Cenas de arrumação de mala, aeroporto ou estrada.',
      '② Chegada — Primeiras impressões de ' + dest + '. Establishing shots do destino.',
    ];
    dias.forEach(function (d, i) {
      var ativs = (d.atividades || []).filter(function (a) { return a.nome; });
      if (ativs.length === 0) return;
      var destaque = ativs[0].nome;
      linhas.push('③.' + (i + 1) + ' ' + _diaSemana(d.data) + ' (' + _fmtDataCurta(d.data) + ') — ' + destaque + (ativs.length > 1 ? ' + ' + (ativs.length - 1) + ' atividade(s)' : '') + '.');
    });
    linhas.push('④ Clímax — O momento mais marcante da viagem (definido na edição).');
    linhas.push('⑤ Encerramento — Despedida, reflexão e retorno. Cenas emocionais e de contemplação.');
    return linhas.join('\n');
  }

  function _gerarChecklistTecnico() {
    return [
      { id: 'ct-1',  texto: 'Câmera principal carregada e com cartão formatado', checked: false },
      { id: 'ct-2',  texto: 'Baterias reserva carregadas (mín. 3)', checked: false },
      { id: 'ct-3',  texto: 'Drone com baterias e hélices extras', checked: false },
      { id: 'ct-4',  texto: 'Tripé / gorillapod para planos estáticos', checked: false },
      { id: 'ct-5',  texto: 'ND filters (ND8, ND16, ND64)', checked: false },
      { id: 'ct-6',  texto: 'Microfone lapela + gravador para entrevistas', checked: false },
      { id: 'ct-7',  texto: 'Cartões SD reserva (mín. 128 GB)', checked: false },
      { id: 'ct-8',  texto: 'HD externo para backup diário no campo', checked: false },
      { id: 'ct-9',  texto: 'Gimbal carregado e calibrado', checked: false },
      { id: 'ct-10', texto: 'Action cam para POV (GoPro ou similar)', checked: false },
      { id: 'ct-11', texto: 'Lentes extras (wide, teleobjetiva)', checked: false },
      { id: 'ct-12', texto: 'Configurações de câmera revisadas (Picture Profile, FPS)', checked: false },
    ];
  }

  function _gerarPlanoEdicao(viagem, itin) {
    var dias = (itin && itin.dias) ? itin.dias : [];
    var totalAtiv = dias.reduce(function (s, d) { return s + (d.atividades || []).length; }, 0);
    var durMin = Math.max(3, Math.min(15, Math.round(totalAtiv * 0.8)));
    return (
      'Duração estimada do vídeo final: ' + durMin + '–' + (durMin + 3) + ' minutos\n\n' +
      'Estrutura de edição sugerida:\n' +
      '• 0:00–0:30 — Teaser com as melhores cenas (montagem rápida)\n' +
      '• 0:30–1:00 — Abertura com título e contexto do destino\n' +
      '• 1:00–' + (durMin - 2) + ':00 — Desenvolvimento cronológico por dia\n' +
      '• ' + (durMin - 2) + ':00–' + durMin + ':30 — Clímax: o momento mais marcante\n' +
      '• ' + durMin + ':30–fim — Encerramento emocional com trilha\n\n' +
      'Ritmo: cortes rápidos em atividades dinâmicas; planos longos em paisagens.\n' +
      'Música: trilha instrumental com variação de intensidade por segmento.\n' +
      'Color grade: paleta quente e saturada para viagens de natureza; desaturada fria para cidades históricas.'
    );
  }

  function _gerarGestaoMidia(itin) {
    var dias = (itin && itin.dias) ? itin.dias.length : 0;
    return (
      'Estimativa de mídia bruta: ~20–40 GB por dia de filmagem (' + dias + ' dias → ~' + (dias * 30) + ' GB)\n\n' +
      'Rotina de backup recomendada:\n' +
      '• Ao fim de cada dia: transferir do cartão para o HD externo\n' +
      '• Organizar em pastas: /Dia-01, /Dia-02... com subpastas /Camera, /Drone, /Phone\n' +
      '• Verificar integridade de ao menos 3 arquivos por pasta\n' +
      '• Manter 2 cópias: HD externo + nuvem (Google Drive / iCloud) se disponível\n\n' +
      'Software recomendado para edição: DaVinci Resolve (gratuito) ou Adobe Premiere.\n' +
      'Formato de exportação: H.264 / H.265 · 4K 30fps ou 1080p 60fps · bitrate ≥ 50 Mbps.'
    );
  }

  // ---- Estado do plano salvo ----
  var _tripId = null;
  var _planoSalvo = null;

  function _carregarPlano(tripId) {
    if (window.Store && typeof Store.getPlanoDiretor === 'function') {
      return Store.getPlanoDiretor(tripId) || null;
    }
    return null;
  }

  function _salvarPlano(tripId, dados) {
    if (window.Store && typeof Store.salvarPlanoDiretor === 'function') {
      Store.salvarPlanoDiretor(tripId, dados);
    }
  }

  // ---- Render principal ----
  function render(viagem, container) {
    _tripId = viagem.id;
    var itin = window.Store ? Store.getItinerario(viagem.id) : null;
    var trechos = window.Store ? Store.getTrechosRota(viagem.id) : [];
    var participantes = window.Store ? Store.getParticipantesViagem(viagem.id) : [];
    _planoSalvo = _carregarPlano(viagem.id);

    var dias = (itin && itin.dias) ? itin.dias : [];
    var totalAtiv = dias.reduce(function (s, d) { return s + (d.atividades || []).length; }, 0);
    var locais = [];
    var cats = {};
    dias.forEach(function (d) {
      (d.atividades || []).forEach(function (a) {
        if (a.local && locais.indexOf(a.local) === -1) locais.push(a.local);
        var c = a.categoria || 'outro';
        if (!cats[c]) cats[c] = { count: 0, ativs: [] };
        cats[c].count++;
        cats[c].ativs.push(a.nome || 'Atividade');
      });
    });

    var loc = viagem.localizacaoCurta || viagem.destinoPrincipal || viagem.destino || '';
    var datas = (viagem.dataInicio && viagem.dataFim)
      ? _fmtData(viagem.dataInicio) + ' – ' + _fmtData(viagem.dataFim)
      : viagem.dataInicio ? _fmtData(viagem.dataInicio) : '';
    var totalDias = (viagem.dataInicio && viagem.dataFim) ? _diffDias(viagem.dataInicio, viagem.dataFim) : dias.length;
    var partNomes = participantes.filter(function (p) { return p.ativo !== false; }).map(function (p) { return p.nome; });

    var visaoCreativaTemplate = _gerarVisaoCreativa(viagem, itin);
    var linhaNarrativaTemplate = _gerarLinhaNarrativa(viagem, itin);
    var checklistTemplate = _gerarChecklistTecnico();
    var planoEdicaoTemplate = _gerarPlanoEdicao(viagem, itin);
    var gestaoMidiaTemplate = _gerarGestaoMidia(itin);

    var visaoCreativa  = (_planoSalvo && _planoSalvo.visaoCreativa)  ? _planoSalvo.visaoCreativa  : visaoCreativaTemplate;
    var linhaNarrativa = (_planoSalvo && _planoSalvo.linhaNarrativa) ? _planoSalvo.linhaNarrativa : linhaNarrativaTemplate;
    var notasEdicao    = (_planoSalvo && _planoSalvo.notasEdicao)    ? _planoSalvo.notasEdicao    : planoEdicaoTemplate;
    var notasGestao    = (_planoSalvo && _planoSalvo.notasGestao)    ? _planoSalvo.notasGestao    : gestaoMidiaTemplate;
    var checklist      = (_planoSalvo && Array.isArray(_planoSalvo.checklist) && _planoSalvo.checklist.length > 0)
                         ? _planoSalvo.checklist : checklistTemplate;

    var html = '<div class="pd-page">';

    // ── Hero ──────────────────────────────────────────────────
    html += '<div class="pd-hero">' +
      '<div class="pd-hero-badge"><span>🎬</span><span>Plano Diretor</span></div>' +
      '<h1 class="pd-hero-title">' + _esc(viagem.nome || 'Viagem') + '</h1>' +
      '<div class="pd-hero-chips">' +
        (loc   ? '<span class="pd-hero-chip">📍 ' + _esc(loc)   + '</span>' : '') +
        (datas ? '<span class="pd-hero-chip">📅 ' + _esc(datas) + '</span>' : '') +
        (partNomes.length > 0 ? '<span class="pd-hero-chip">👥 ' + _esc(partNomes.join(', ')) + '</span>' : '') +
      '</div>' +
    '</div>';

    // ── KPI row ───────────────────────────────────────────────
    html += '<div class="pd-kpi-row">' +
      _kpiCard('📆', String(totalDias || '—'), 'Dias') +
      _kpiCard('📍', String(totalAtiv),         'Atividades') +
      _kpiCard('🗺️', String(trechos.length),    'Trechos') +
      _kpiCard('🎥', String(locais.length),      'Locais') +
    '</div>';

    // ── Actions bar ───────────────────────────────────────────
    html += '<div class="pd-actions">' +
      '<button class="pd-act-btn pd-act-primary" onclick="PlanoDiretorPage.copiarBriefing()">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
        '<span>Copiar briefing</span>' +
      '</button>' +
      '<button class="pd-act-btn" onclick="PlanoDiretorPage.exportarMarkdown()">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
        '<span>Exportar .md</span>' +
      '</button>' +
      '<button class="pd-act-btn" id="pd-btn-salvar" onclick="PlanoDiretorPage.salvar()">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' +
        '<span>Salvar plano</span>' +
      '</button>' +
      '<button class="pd-act-btn pd-act-danger" onclick="PlanoDiretorPage.resetar()">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.63"/></svg>' +
        '<span>Resetar</span>' +
      '</button>' +
    '</div>';

    // ── Visão criativa ────────────────────────────────────────
    html += _secaoEditavel('pd-sec-visao', '🎨', 'Visão criativa',
      'Tom, estilo visual e referências do vídeo.',
      visaoCreativa, 'visaoCreativa', 5);

    // ── Linha narrativa ───────────────────────────────────────
    html += _secaoEditavel('pd-sec-narrativa', '📖', 'Linha narrativa',
      'Estrutura: abertura → desenvolvimento → clímax → encerramento.',
      linhaNarrativa, 'linhaNarrativa', 7);

    // ── Timeline por dia ──────────────────────────────────────
    html += '<div class="pd-card" id="pd-sec-captacao">';
    html += '<div class="pd-card-header">' +
      '<span class="pd-card-icon">📅</span>' +
      '<h2 class="pd-card-title">Captação por dia</h2>' +
      '<span class="pd-card-badge">' + (dias.length ? dias.length + (dias.length === 1 ? ' dia' : ' dias') : 'sem roteiro') + '</span>' +
    '</div>';
    if (dias.length === 0) {
      html += '<div class="pd-empty"><span>📭</span><p>Adicione atividades ao roteiro para gerar o plano de captação.</p></div>';
    } else {
      html += '<div class="pd-timeline">';
      dias.forEach(function (d, di) {
        var ativs = d.atividades || [];
        var isLast = di === dias.length - 1;
        html += '<div class="pd-tl-day' + (isLast ? ' pd-tl-day--last' : '') + '">';
        html += '<div class="pd-tl-day-head">' +
          '<div class="pd-tl-dot"></div>' +
          '<span class="pd-tl-day-name">' + _esc(_diaSemana(d.data)) + '</span>' +
          '<span class="pd-tl-day-date">' + _esc(_fmtDataCurta(d.data)) + '</span>' +
          (ativs.length > 0 ? '<span class="pd-tl-day-count">' + ativs.length + '</span>' : '') +
        '</div>';
        html += '<div class="pd-tl-body">';
        if (ativs.length === 0) {
          html += '<p class="pd-tl-free">Dia livre — captação espontânea.</p>';
        } else {
          ativs.forEach(function (a) {
            html += '<div class="pd-tl-ativ">' +
              '<div class="pd-tl-ativ-emoji">' + _catEmoji(a.categoria) + '</div>' +
              '<div class="pd-tl-ativ-body">' +
                '<div class="pd-tl-ativ-name">' + _esc(a.nome || 'Atividade') + '</div>' +
                '<div class="pd-tl-ativ-meta">' +
                  (a.hora ? '<span>' + _esc(a.hora) + '</span>' : '') +
                  (a.duracaoMin ? '<span>' + _esc(_duracaoStr(a.duracaoMin)) + '</span>' : '') +
                  (a.local ? '<span>📍 ' + _esc(a.local) + '</span>' : '') +
                '</div>' +
                '<div class="pd-tl-ativ-chips">' +
                  '<span class="pd-chip pd-chip-cat">' + _esc(_catLabel(a.categoria)) + '</span>' +
                  '<span class="pd-chip pd-chip-scena">' + _esc(_tipoScena(a.categoria)) + '</span>' +
                '</div>' +
                (a.observacoes ? '<div class="pd-tl-ativ-obs">' + _esc(a.observacoes.substring(0, 120)) + (a.observacoes.length > 120 ? '…' : '') + '</div>' : '') +
              '</div>' +
            '</div>';
          });
        }
        html += '</div></div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // ── Shotlist ──────────────────────────────────────────────
    var catKeys = Object.keys(cats);
    html += '<div class="pd-card" id="pd-sec-shotlist">';
    html += '<div class="pd-card-header">' +
      '<span class="pd-card-icon">🎯</span>' +
      '<h2 class="pd-card-title">Shotlist por cena</h2>' +
      '<span class="pd-card-badge">' + catKeys.length + ' tipo' + (catKeys.length !== 1 ? 's' : '') + '</span>' +
    '</div>';
    if (catKeys.length === 0) {
      html += '<div class="pd-empty"><span>📭</span><p>Adicione atividades para gerar a shotlist.</p></div>';
    } else {
      html += '<div class="pd-shotlist-grid">';
      catKeys.forEach(function (c) {
        var shots = _shotSugerido(c);
        html += '<div class="pd-shot-card">' +
          '<div class="pd-shot-head">' +
            '<span class="pd-shot-emoji">' + _catEmoji(c) + '</span>' +
            '<div class="pd-shot-meta">' +
              '<span class="pd-shot-cat">' + _esc(_catLabel(c)) + '</span>' +
              '<span class="pd-shot-count">' + cats[c].count + 'x</span>' +
            '</div>' +
          '</div>' +
          '<ul class="pd-shot-list">' + shots.map(function (s) { return '<li>' + _esc(s) + '</li>'; }).join('') + '</ul>' +
          '<div class="pd-shot-footer">' + _esc(cats[c].ativs.slice(0, 3).join(', ')) + (cats[c].ativs.length > 3 ? '…' : '') + '</div>' +
        '</div>';
      });
      html += '</div>';
    }
    html += '</div>';

    // ── Checklist técnico ─────────────────────────────────────
    var clDone = checklist.filter(function (i) { return i.checked; }).length;
    var clTotal = checklist.length;
    html += '<div class="pd-card" id="pd-sec-checklist">';
    html += '<div class="pd-card-header">' +
      '<span class="pd-card-icon">⚙️</span>' +
      '<h2 class="pd-card-title">Checklist técnico</h2>' +
      '<span class="pd-card-badge" id="pd-checklist-pct">' + clDone + '/' + clTotal + '</span>' +
    '</div>';
    html += '<div class="pd-progress-wrap">' +
      '<progress class="pd-progress" id="pd-checklist-bar" max="' + clTotal + '" value="' + clDone + '"></progress>' +
      '<span class="pd-progress-lbl" id="pd-progress-lbl">' + (clTotal > 0 ? Math.round(clDone / clTotal * 100) : 0) + '%</span>' +
    '</div>';
    html += '<ul class="pd-checklist">';
    checklist.forEach(function (item) {
      html += '<li class="pd-check-item' + (item.checked ? ' pd-check-done' : '') + '">' +
        '<label class="pd-check-label">' +
          '<input type="checkbox" class="pd-check-input" data-id="' + _esc(item.id) + '"' + (item.checked ? ' checked' : '') +
            ' onchange="PlanoDiretorPage.toggleCheck(\'' + _esc(item.id) + '\')">' +
          '<span class="pd-check-box"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="2 6 5 9 10 3"/></svg></span>' +
          '<span class="pd-check-text">' + _esc(item.texto) + '</span>' +
        '</label>' +
      '</li>';
    });
    html += '</ul></div>';

    // ── Plano de edição ───────────────────────────────────────
    html += _secaoEditavel('pd-sec-edicao', '🎞️', 'Plano de edição',
      'Estrutura, duração estimada, ritmo e referências de cor e música.',
      notasEdicao, 'notasEdicao', 7);

    // ── Gestão de mídia ───────────────────────────────────────
    html += _secaoEditavel('pd-sec-midia', '💾', 'Gestão de mídia e backup',
      'Estimativa de armazenamento, rotina de backup e software.',
      notasGestao, 'notasGestao', 5);

    html += '</div>'; // .pd-page
    container.innerHTML = html;
  }

  function _kpiCard(emoji, value, label) {
    return (
      '<div class="pd-kpi">' +
        '<div class="pd-kpi-emoji">' + emoji + '</div>' +
        '<div class="pd-kpi-value">' + _esc(value) + '</div>' +
        '<div class="pd-kpi-label">' + _esc(label) + '</div>' +
      '</div>'
    );
  }

  function _statCard(label, value, emoji, sub) { return _kpiCard(emoji, String(value), label); }

  function _secaoEditavel(id, icon, titulo, placeholder, conteudo, campo, rows) {
    return (
      '<div class="pd-card" id="' + id + '">' +
        '<div class="pd-card-header">' +
          '<span class="pd-card-icon">' + icon + '</span>' +
          '<h2 class="pd-card-title">' + _esc(titulo) + '</h2>' +
        '</div>' +
        '<div class="pd-field-wrap">' +
          '<textarea class="pd-textarea" rows="' + rows + '" placeholder="' + _esc(placeholder) + '" ' +
            'data-campo="' + _esc(campo) + '" onchange="PlanoDiretorPage._onTextoChange(this)">' +
            _esc(conteudo) +
          '</textarea>' +
        '</div>' +
      '</div>'
    );
  }

  function _pctChecklist(lista) {
    if (!lista || lista.length === 0) return '';
    var done = lista.filter(function (i) { return i.checked; }).length;
    return done + '/' + lista.length + ' itens';
  }

  // ---- Ações públicas ----
  function _coletarEstadoAtual() {
    var dados = { updatedAt: new Date().toISOString() };
    // Textareas
    var textareas = document.querySelectorAll('.pd-page .pd-textarea');
    textareas.forEach(function (el) {
      var campo = el.dataset.campo;
      if (campo) dados[campo] = el.value;
    });
    // Checklist
    var checks = document.querySelectorAll('.pd-page .pd-check-input');
    var cl = [];
    checks.forEach(function (el) {
      var label = el.closest('.pd-check-item');
      var texto = label ? (label.querySelector('.pd-check-text') || {}).textContent || '' : '';
      cl.push({ id: el.dataset.id, texto: texto.trim(), checked: el.checked });
    });
    dados.checklist = cl;
    return dados;
  }

  return {
    render: render,

    _onTextoChange: function (el) {
      /* autosave light — marks local change, user still triggers full save */
    },

    toggleCheck: function (id) {
      var input = document.querySelector('.pd-page .pd-check-input[data-id="' + id + '"]');
      if (!input) return;
      var item = input.closest('.pd-check-item');
      if (item) {
        if (input.checked) item.classList.add('pd-check-done');
        else item.classList.remove('pd-check-done');
      }
      // Refresh progress counters
      var all = document.querySelectorAll('.pd-page .pd-check-input');
      var done = 0; var total = all.length;
      all.forEach(function (c) { if (c.checked) done++; });
      var pctEl = document.getElementById('pd-checklist-pct');
      var barEl = document.getElementById('pd-checklist-bar');
      var lblEl = document.getElementById('pd-progress-lbl');
      if (pctEl) pctEl.textContent = done + '/' + total;
      if (barEl) { barEl.value = done; barEl.max = total; }
      if (lblEl) lblEl.textContent = (total > 0 ? Math.round(done / total * 100) : 0) + '%';
    },

    salvar: function () {
      if (!_tripId) return;
      var dados = _coletarEstadoAtual();
      _salvarPlano(_tripId, dados);
      _planoSalvo = dados;
      var btn = document.getElementById('pd-btn-salvar');
      if (btn) { btn.querySelector('span').textContent = '✅ Salvo!'; setTimeout(function () { btn.querySelector('span').textContent = 'Salvar plano'; }, 2200); }
    },

    resetar: function () {
      if (!window.confirm('Resetar o plano? Os textos editados e checklist serão perdidos e o conteúdo gerado automaticamente será restaurado.')) return;
      _salvarPlano(_tripId, null);
      _planoSalvo = null;
      // Re-render
      var viagem = window.Store ? Store.getViagemSelecionada() : null;
      var container = document.getElementById('page-container');
      if (viagem && container) render(viagem, container);
    },

    copiarBriefing: function () {
      var txt = _gerarTextoCompleto();
      if (!navigator.clipboard) {
        var ta = document.createElement('textarea');
        ta.value = txt;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } else {
        navigator.clipboard.writeText(txt).catch(function () {});
      }
      var btn = document.querySelector('.pd-actions .pd-act-primary');
      if (btn) { btn.querySelector('span').textContent = '✅ Copiado!'; setTimeout(function () { btn.querySelector('span').textContent = 'Copiar briefing'; }, 2500); }
    },

    exportarMarkdown: function () {
      var txt = _gerarTextoCompleto();
      var blob = new Blob([txt], { type: 'text/markdown; charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      var viagem = window.Store ? Store.getViagemSelecionada() : null;
      a.download = 'plano-diretor-' + ((viagem && viagem.nome) ? viagem.nome.toLowerCase().replace(/\s+/g, '-') : 'viagem') + '.md';
      a.click();
      URL.revokeObjectURL(url);
    },
  };

  function _gerarTextoCompleto() {
    var viagem = window.Store ? Store.getViagemSelecionada() : null;
    var linhas = ['# 🎬 Plano Diretor de Filmagem'];
    if (viagem) {
      var loc = viagem.destinoPrincipal || viagem.destino || '';
      linhas.push('**Viagem:** ' + (viagem.nome || '-'));
      if (loc) linhas.push('**Destino:** ' + loc);
    }
    linhas.push('');
    // Textareas
    var textareas = document.querySelectorAll('.pd-page .pd-textarea');
    textareas.forEach(function (el) {
      var sec = el.closest('.pd-card');
      var titulo = sec ? (sec.querySelector('.pd-card-title') || {}).textContent || '' : '';
      if (titulo) linhas.push('## ' + titulo.trim());
      linhas.push(el.value);
      linhas.push('');
    });
    // Captação por dia
    var diaCards = document.querySelectorAll('.pd-tl-day');
    if (diaCards.length > 0) {
      linhas.push('## 📅 Captação por dia');
      diaCards.forEach(function (day) {
        var hdr = day.querySelector('.pd-tl-day-head');
        if (hdr) linhas.push('### ' + hdr.textContent.trim().replace(/\s+/g, ' '));
        var ativs = day.querySelectorAll('.pd-tl-ativ');
        ativs.forEach(function (row) {
          var nome = row.querySelector('.pd-tl-ativ-name');
          var chips = row.querySelectorAll('.pd-chip');
          var scena = chips.length > 1 ? chips[1].textContent.trim() : '';
          if (nome) linhas.push('- **' + nome.textContent.trim() + '**' + (scena ? ' — ' + scena : ''));
        });
        linhas.push('');
      });
    }
    // Checklist
    var checks = document.querySelectorAll('.pd-page .pd-check-item');
    if (checks.length > 0) {
      linhas.push('## ⚙️ Checklist técnico');
      checks.forEach(function (item) {
        var input = item.querySelector('input');
        var txt = (item.querySelector('.pd-check-text') || {}).textContent || '';
        linhas.push((input && input.checked ? '- [x] ' : '- [ ] ') + txt.trim());
      });
      linhas.push('');
    }
    return linhas.join('\n');
  }

})();
