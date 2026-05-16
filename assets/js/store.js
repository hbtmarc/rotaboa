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
  var _LS_ROUTES   = 'rotaboa.routes.v1';
  var _LS_BAG_TEMPLATES = 'rotaboa.bagagem.templates.v1';
  var _LS_PLANOS_DIRETORES = 'rotaboa.planosDiretores.v1';
  var _rotasLegacySemTripIdLogado = false;

  // Config defaults injetados pelo app.js para cálculo de custo de rotas
  var _configDefaults = { consumoPadrao: 0, precoCombustivelPadrao: 0 };

  var _MOCK_TRIP_IDS = {
    'viagem-1': true,
    'viagem-2': true,
    'viagem-3': true,
  };

  function _gerarParticipanteId() {
    return 'part-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
  }

  function _normalizarNomeParticipante(nome) {
    return String(nome || '').trim().replace(/\s+/g, ' ');
  }

  // ---- Duration string → minutes (shared helper) ----
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

  // ---- Computes arrival date/time from departure + duration ----
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

  function _normalizarListaParticipantes(lista, fallbackQtd) {
    var base = [];

    if (Array.isArray(lista) && lista.length > 0) {
      base = lista.map(function (p) {
        if (typeof p === 'string') {
          return { id: _gerarParticipanteId(), nome: _normalizarNomeParticipante(p), ativo: true };
        }
        var nome = _normalizarNomeParticipante(p && p.nome);
        return {
          id: p && p.id ? String(p.id) : _gerarParticipanteId(),
          nome: nome,
          ativo: p && p.ativo !== false,
        };
      });
    } else {
      var qtd = Math.max(1, Number(fallbackQtd) || 1);
      for (var i = 1; i <= qtd; i++) {
        base.push({ id: _gerarParticipanteId(), nome: 'Pessoa ' + i, ativo: true });
      }
    }

    var usados = {};
    var limpos = base.map(function (p, idx) {
      var nomeBase = _normalizarNomeParticipante(p.nome) || ('Pessoa ' + (idx + 1));
      var chave = nomeBase.toLowerCase();
      var nomeFinal = nomeBase;
      var sufixo = 2;
      while (usados[chave]) {
        nomeFinal = nomeBase + ' ' + sufixo;
        chave = nomeFinal.toLowerCase();
        sufixo++;
      }
      usados[chave] = true;
      return {
        id: p.id || _gerarParticipanteId(),
        nome: nomeFinal,
        ativo: p.ativo !== false,
      };
    });

    if (!limpos.some(function (p) { return p.ativo; }) && limpos.length > 0) {
      limpos[0].ativo = true;
    }

    return limpos;
  }

  function _contarParticipantesAtivos(viagem) {
    if (!viagem) return 1;
    if (Array.isArray(viagem.participantes)) {
      var ativos = viagem.participantes.filter(function (p) {
        return p && p.ativo !== false && _normalizarNomeParticipante(p.nome);
      }).length;
      return Math.max(1, ativos);
    }
    return Math.max(1, Number(viagem.participantes) || 1);
  }

  function _nomesParticipantesAtivos(viagem) {
    if (!viagem) return ['Pessoa 1'];
    if (Array.isArray(viagem.participantes)) {
      var nomes = viagem.participantes
        .filter(function (p) { return p && p.ativo !== false; })
        .map(function (p) { return _normalizarNomeParticipante(p.nome); })
        .filter(Boolean);
      if (nomes.length > 0) return nomes;
    }
    var n = Math.max(1, Number(viagem.participantes) || 1);
    var arr = [];
    for (var i = 1; i <= n; i++) arr.push('Pessoa ' + i);
    return arr;
  }

  function _participantesAtivosComId(viagem) {
    if (!viagem) return [];
    if (Array.isArray(viagem.participantes)) {
      var ativos = viagem.participantes
        .filter(function (p) { return p && p.ativo !== false; })
        .map(function (p) {
          return {
            id: String(p.id || ''),
            nome: _normalizarNomeParticipante(p.nome),
          };
        })
        .filter(function (p) { return p.id && p.nome; });
      if (ativos.length > 0) return ativos;
    }
    var nomes = _nomesParticipantesAtivos(viagem);
    return nomes.map(function (nome, idx) {
      return { id: 'legacy-' + (idx + 1), nome: nome };
    });
  }

  function _indiceParticipantesPorNome(viagem) {
    var mapa = {};
    _participantesAtivosComId(viagem).forEach(function (p) {
      mapa[_normalizarNomeParticipante(p.nome).toLowerCase()] = p.id;
    });
    return mapa;
  }

  function _indiceParticipantesPorId(viagem) {
    var mapa = {};
    _participantesAtivosComId(viagem).forEach(function (p) {
      mapa[p.id] = p.nome;
    });
    return mapa;
  }

  function _resolverParticipanteIdSeguro(viagem, valorEntrada, contextoAviso) {
    var valor = String(valorEntrada || '').trim();
    if (!valor) return '';
    var porId = _indiceParticipantesPorId(viagem);
    if (porId[valor]) return valor;

    var porNome = _indiceParticipantesPorNome(viagem);
    var idPorNome = porNome[_normalizarNomeParticipante(valor).toLowerCase()];
    if (idPorNome) return idPorNome;

    var ativos = _participantesAtivosComId(viagem);
    if (ativos.length > 0) {
      console.warn('[Store] Participante não encontrado para', contextoAviso || 'despesa', '-', valor, 'usando fallback seguro.');
      return ativos[0].id;
    }
    return '';
  }

  function _limparViagensMockConhecidas(viagens) {
    if (!Array.isArray(viagens) || viagens.length === 0) return { viagens: [], mudou: false };
    var filtradas = viagens.filter(function (v) {
      return !_MOCK_TRIP_IDS[v && v.id];
    });
    return { viagens: filtradas, mudou: filtradas.length !== viagens.length };
  }

  function _limparColecoesPorViagens(viagens, itinerarios, despesas, rotas) {
    var idsValidos = {};
    (viagens || []).forEach(function (v) { idsValidos[v.id] = true; });

    function _filtrarMapa(mapa, fnItem) {
      var mudou = false;
      var saida = {};
      Object.keys(mapa || {}).forEach(function (tid) {
        if (!idsValidos[tid]) {
          mudou = true;
          return;
        }
        var lista = mapa[tid];
        if (Array.isArray(lista)) {
          var novaLista = lista.filter(function (item) { return fnItem(item, tid); });
          if (novaLista.length !== lista.length) mudou = true;
          saida[tid] = novaLista;
        } else {
          saida[tid] = lista;
        }
      });
      return { mapa: saida, mudou: mudou };
    }

    var it = _filtrarMapa(itinerarios || {}, function () { return true; });
    var de = _filtrarMapa(despesas || {}, function (d, tid) { return d && (!d.tripId || d.tripId === tid); });
    var ro = _filtrarMapa(rotas || {}, function (t, tid) { return t && t.tripId === tid; });

    return {
      itinerarios: it.mapa,
      despesas: de.mapa,
      rotas: ro.mapa,
      mudou: it.mudou || de.mudou || ro.mudou,
    };
  }

  // ---- Migra viagem antiga (campo destino → destinoPrincipal + localizacaoCurta) ----
  function _migrarViagem(v) {
    v = Object.assign({}, v);
    if (!v.destinoPrincipal && !v.localizacaoCurta) {
      // Viagem salva no formato antigo: usa destino para ambos os campos
      v.destinoPrincipal = v.destino || '';
      v.localizacaoCurta = v.destino || '';
    }
    // Garante que localizacaoCurta tenha fallback
    if (!v.localizacaoCurta) v.localizacaoCurta = v.destinoPrincipal || v.destino || '';
    if (!v.destinoPrincipal) v.destinoPrincipal = v.localizacaoCurta || v.destino || '';
    v.participantes = _normalizarListaParticipantes(v.participantes, v.participantes);
    return v;
  }

  // ---- Carrega viagens do localStorage ----
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
    return [];
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

  // Sincroniza os dias do itinerário ao novo período da viagem:
  // - Adiciona dias que ainda não existem
  // - Remove dias fora do novo intervalo (atividades são descartadas)
  // - Reordena cronologicamente
  function _sincronizarDiasItinerario(tripId, viagem) {
    if (!viagem || !viagem.dataInicio || !viagem.dataFim) return;
    if (!_itinerarios[tripId]) {
      _itinerarios[tripId] = { dias: _gerarDias(viagem) };
      return;
    }
    var diasNovos = _gerarDias(viagem);
    var datasNovas = diasNovos.map(function (d) { return d.data; });
    // Mantém dias que estão dentro do novo intervalo
    var diasFiltrados = _itinerarios[tripId].dias.filter(function (d) {
      return datasNovas.indexOf(d.data) !== -1;
    });
    // Adiciona dias que faltam (sem atividades)
    var datasExistentes = diasFiltrados.map(function (d) { return d.data; });
    diasNovos.forEach(function (dNovo) {
      if (datasExistentes.indexOf(dNovo.data) === -1) {
        diasFiltrados.push(dNovo);
      }
    });
    diasFiltrados.sort(function (a, b) { return a.data.localeCompare(b.data); });
    _itinerarios[tripId].dias = diasFiltrados;
  }
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

  function _isDespesaGeradaPorRota(d) {
    if (!d || typeof d !== 'object') return false;
    var origem = String(d.origem || d.source || '').trim().toLowerCase();
    var desc = String(d.descricao || '').trim().toLowerCase();
    if (d.routeSegmentId || d.routeExpenseId) return true;
    if (origem === 'rota') return true;
    if (desc.indexOf('rota:') === 0) return true;
    return false;
  }

  function _limparDespesasGeradasPorRota(despesas, viagens) {
    var idsValidos = {};
    (viagens || []).forEach(function (v) { idsValidos[v.id] = true; });
    var mudou = false;
    var limpo = {};

    Object.keys(despesas || {}).forEach(function (tid) {
      if (!idsValidos[tid]) { mudou = true; return; }
      var lista = Array.isArray(despesas[tid]) ? despesas[tid] : [];
      var antes = lista.length;
      var filtrada = lista.filter(function (d) {
        var comTripCorreta = d && (!d.tripId || d.tripId === tid);
        return comTripCorreta && !_isDespesaGeradaPorRota(d);
      }).map(function (d) {
        if (d.tripId === tid) return d;
        mudou = true;
        return Object.assign({}, d, { tripId: tid });
      });

      if (antes !== filtrada.length) mudou = true;
      limpo[tid] = filtrada;
    });

    return { mudou: mudou, despesas: limpo };
  }

  function _logRotasLegacySemTripIdUmaVez() {
    if (_rotasLegacySemTripIdLogado) return;
    _rotasLegacySemTripIdLogado = true;
    console.info('[rotas] rotas antigas sem tripId ignoradas');
  }

  // ---- Carrega trechos de rotas do localStorage (isolados por viagem) ----
  function _carregarRotas(viagens, selectedId) {
    try {
      var raw = localStorage.getItem(_LS_ROUTES);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      var idsValidos = {};
      var ignoradasSemTripId = 0;
      (viagens || []).forEach(function (v) { idsValidos[v.id] = true; });

      // Migração legado: array global -> objeto por tripId (somente itens com tripId válido)
      if (Array.isArray(parsed)) {
        var migradoArray = {};
        parsed.forEach(function (t) {
          if (t && !t.tripId) { ignoradasSemTripId++; return; }
          if (!t || !t.tripId || !idsValidos[t.tripId]) return;
          if (!migradoArray[t.tripId]) migradoArray[t.tripId] = [];
          migradoArray[t.tripId].push(Object.assign({}, t, { tripId: t.tripId }));
        });
        if (ignoradasSemTripId > 0) _logRotasLegacySemTripIdUmaVez();
        try { localStorage.setItem(_LS_ROUTES, JSON.stringify(migradoArray)); } catch (e) {}
        return migradoArray;
      }

      // Formato atual: objeto keyed por tripId
      if (parsed && typeof parsed === 'object') {
        var normalizado = {};
        Object.keys(parsed).forEach(function (tid) {
          if (!idsValidos[tid]) return;
          var lista = Array.isArray(parsed[tid]) ? parsed[tid] : [];
          normalizado[tid] = lista.filter(function (t) {
            if (t && !t.tripId) { ignoradasSemTripId++; return false; }
            return t && t.tripId && t.tripId === tid && idsValidos[t.tripId];
          }).map(function (t) {
            return Object.assign({}, t, { tripId: tid });
          });
        });
        if (ignoradasSemTripId > 0) _logRotasLegacySemTripIdUmaVez();
        try { localStorage.setItem(_LS_ROUTES, JSON.stringify(normalizado)); } catch (e) {}
        return normalizado;
      }
    } catch (e) {
      console.warn('[Store] Falha ao ler rotas:', e);
    }
    return {};
  }

  // ---- Persiste trechos ----
  function _salvarRotas() {
    try {
      localStorage.setItem(_LS_ROUTES, JSON.stringify(_rotasTrechos));
    } catch (e) { console.warn('[Store] Falha ao salvar rotas:', e); }
  }

  function _hojeISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function _round2(n) {
    var v = Number(n);
    if (!isFinite(v)) return 0;
    return Math.round((v + Number.EPSILON) * 100) / 100;
  }

  function _labelsParticipantes(tripId) {
    var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
    return _nomesParticipantesAtivos(viagem);
  }

  function _normalizarTrecho(tripId, dados, idFixo) {
    var distancia = Math.max(0, Number(dados.distanciaKm) || 0);
    var consumo = Math.max(0, Number(dados.consumoKmL) || 0);
    var preco = Math.max(0, Number(dados.precoCombustivelLitro) || 0);
    var fixo = Math.max(0, Number(dados.custoFixo) || 0);
    // Aplica defaults do config quando o trecho tem distância mas não tem consumo/preço
    var _tipoT = String(dados.tipo || 'outro').toLowerCase();
    var _useCar = ['carro', 'van', 'onibus'].indexOf(_tipoT) !== -1;
    if (distancia > 0 && _useCar) {
      if (consumo === 0 && _configDefaults.consumoPadrao > 0) consumo = _configDefaults.consumoPadrao;
      if (preco === 0 && _configDefaults.precoCombustivelPadrao > 0) preco = _configDefaults.precoCombustivelPadrao;
    }
    var litros = consumo > 0 ? (distancia / consumo) : 0;
    var custoComb = litros * preco;
    var custoTotal = fixo + custoComb;
    var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
    var participantes = _contarParticipantesAtivos(viagem);

    return Object.assign({}, dados, {
      id: idFixo || dados.id || _gerarTrechoId(),
      tripId: tripId,
      origem: String(dados.origem || '').trim(),
      destino: String(dados.destino || '').trim(),
      tipo: dados.tipo || 'outro',
      distanciaKm: distancia,
      duracaoEstimada: String(dados.duracaoEstimada || '').trim(),
      consumoKmL: consumo,
      precoCombustivelLitro: preco,
      custoFixo: fixo,
      observacoes: String(dados.observacoes || '').trim(),
      litrosEstimados: _round2(litros),
      custoCombustivel: _round2(custoComb),
      custoTotal: _round2(custoTotal),
      custoPorPessoa: _round2(custoTotal / participantes),
      calculoModo: dados.calculoModo || 'manual',
      routeSource: dados.routeSource || (dados.calculoModo === 'google' ? 'google' : 'manual'),
    });
  }

  function _normalizarDespesaManual(tripId, dados, idFixo) {
    var base = Object.assign({}, dados);
    delete base.routeSegmentId;
    delete base.routeExpenseId;
    delete base.source;
    if (String(base.origem || '').trim().toLowerCase() === 'rota') delete base.origem;

    var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
    var participantesAtivos = _participantesAtivosComId(viagem);
    var idsValidos = {};
    participantesAtivos.forEach(function (p) { idsValidos[p.id] = true; });

    var quemPagouId = _resolverParticipanteIdSeguro(
      viagem,
      base.quemPagouId || base.quemPagou,
      'quemPagou'
    );

    var entradaRateio = [];
    if (Array.isArray(base.participantesRateioIds) && base.participantesRateioIds.length > 0) {
      entradaRateio = base.participantesRateioIds.slice();
    } else if (Array.isArray(base.participantes) && base.participantes.length > 0) {
      entradaRateio = base.participantes.slice();
    }

    var participantesRateioIds = entradaRateio.map(function (entrada) {
      return _resolverParticipanteIdSeguro(viagem, entrada, 'participantesRateioIds');
    }).filter(Boolean).filter(function (id, idx, arr) {
      return idsValidos[id] && arr.indexOf(id) === idx;
    });

    if (participantesRateioIds.length === 0) {
      participantesRateioIds = participantesAtivos.map(function (p) { return p.id; });
    }

    var totalParcelas = Math.max(1, Math.floor(Number(base.totalParcelas) || 1));
    var valorTotal = _round2(Number(base.valor) || 0);
    var parcelas = [];
    if (totalParcelas > 1 && valorTotal > 0) {
      var totalCentavos = Math.round(valorTotal * 100);
      var parcelaBase = Math.floor(totalCentavos / totalParcelas);
      for (var i = 1; i <= totalParcelas; i++) {
        var centavos = i === totalParcelas
          ? (totalCentavos - (parcelaBase * (totalParcelas - 1)))
          : parcelaBase;
        parcelas.push(_round2(centavos / 100));
      }
    }

    return Object.assign({}, base, {
      id: idFixo || base.id || _gerarDespesaId(),
      tripId: tripId,
      categoria: base.categoria || 'outros',
      descricao: String(base.descricao || '').trim(),
      valor: valorTotal,
      data: base.data || _hojeISO(),
      quemPagouId: quemPagouId,
      participantesRateioIds: participantesRateioIds,
      observacoes: String(base.observacoes || '').trim(),
      tipoPagamento: totalParcelas > 1 ? 'parcelado' : 'avista',
      totalParcelas: totalParcelas,
      parcelas: parcelas,
      valorParcela: parcelas.length > 0 ? parcelas[0] : valorTotal,
    });
  }

  // ---- Linked expense helpers ----
  // Mapeia categorias de atividade para as categorias canônicas de despesa.
  function _mapCategoria(cat) {
    var _m = {
      restaurante:  'alimentacao',
      alimentacao:  'alimentacao',
      hospedagem:   'hospedagem',
      deslocamento: 'transporte',
      transporte:   'transporte',
      passeio:      'passeios',
      aventura:     'passeios',
      cachoeira:    'passeios',
      cultura:      'passeios',
      evento:       'passeios',
      natureza:     'passeios',
      noturno:      'passeios',
      praia:        'passeios',
      trilha:       'passeios',
      compra:       'compras',
      compras:      'compras',
      descanso:     'outros',
      emergencia:   'outros',
      livre:        'outros',
      outro:        'outros',
      outros:       'outros',
    };
    return _m[String(cat || '').toLowerCase()] || 'outros';
  }

  // Cria ou atualiza uma despesa vinculada a uma atividade/rota pelo linkedSource.
  function _upsertLinkedExpense(tripId, linkedSource, dados) {
    if (!tripId || !linkedSource || !linkedSource.id) return;
    if (!_despesas[tripId]) _despesas[tripId] = [];
    var idx = _despesas[tripId].findIndex(function (d) {
      return d && d.linkedSource &&
        d.linkedSource.type === linkedSource.type &&
        d.linkedSource.id === linkedSource.id;
    });
    var despData = Object.assign({}, dados, { linkedSource: linkedSource, origem: 'roteiro' });
    if (idx !== -1) {
      _despesas[tripId][idx] = _normalizarDespesaManual(
        tripId, Object.assign({}, _despesas[tripId][idx], despData), _despesas[tripId][idx].id
      );
    } else {
      _despesas[tripId].push(_normalizarDespesaManual(tripId, despData, _gerarDespesaId()));
    }
    _despesas[tripId].sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
    _salvarDespesas();
  }

  // Remove a despesa vinculada a uma atividade/rota pelo linkedSource.
  function _removeLinkedExpense(tripId, sourceType, sourceId) {
    if (!tripId || !sourceType || !sourceId) return;
    if (!_despesas[tripId]) return;
    var antes = _despesas[tripId].length;
    _despesas[tripId] = _despesas[tripId].filter(function (d) {
      return !(d && d.linkedSource &&
        d.linkedSource.type === sourceType &&
        d.linkedSource.id === sourceId);
    });
    if (_despesas[tripId].length !== antes) _salvarDespesas();
  }

  // Sincroniza a despesa vinculada a uma atividade (upsert ou remove conforme custo).
  function _syncAtividadeExpense(tripId, ativ, dataISO) {
    if (!ativ || !ativ.id || !tripId) return;
    var custo = _round2(Number(ativ.custoEstimado) || 0);
    if (custo > 0) {
      var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
      var partic = _participantesAtivosComId(viagem);
      _upsertLinkedExpense(tripId, { type: 'atividade', id: ativ.id, tripId: tripId }, {
        categoria: _mapCategoria(ativ.categoria),
        descricao: String(ativ.nome || 'Atividade').trim(),
        valor: custo,
        data: dataISO || ativ.data || _hojeISO(),
        quemPagouId: partic.length > 0 ? partic[0].id : '',
        participantesRateioIds: partic.map(function (p) { return p.id; }),
      });
    } else {
      _removeLinkedExpense(tripId, 'atividade', ativ.id);
    }
  }

  // Reconcilia as despesas vinculadas de TODAS as atividades com custo > 0.
  // Chamada no carregarEstadoCompleto para garantir que atividades antigas sejam sincronizadas.
  function _sincronizarTodasAtividades() {
    var _saved = false;
    _state.viagens.forEach(function (viagem) {
      var tid = viagem && viagem.id;
      if (!tid) return;
      var itin = _itinerarios[tid];
      if (!itin || !Array.isArray(itin.dias)) return;
      itin.dias.forEach(function (dia) {
        if (!Array.isArray(dia.atividades)) return;
        dia.atividades.forEach(function (ativ) {
          if (!ativ || !ativ.id) return;
          var custo = _round2(Number(ativ.custoEstimado) || 0);
          if (custo > 0) {
            var viag = _state.viagens.find(function (v) { return v.id === tid; });
            var partic = _participantesAtivosComId(viag);
            if (!_despesas[tid]) _despesas[tid] = [];
            var source = { type: 'atividade', id: ativ.id, tripId: tid };
            var catCorreta = _mapCategoria(ativ.categoria);
            var existente = _despesas[tid].find(function (d) {
              return d && d.linkedSource &&
                d.linkedSource.type === 'atividade' &&
                d.linkedSource.id === ativ.id;
            });
            // Sempre faz upsert para corrigir categoria errada em despesas legadas
            var despData = {
              categoria: catCorreta,
              descricao: String(ativ.nome || 'Atividade').trim(),
              valor: custo,
              data: dia.data || _hojeISO(),
              quemPagouId: partic.length > 0 ? partic[0].id : '',
              participantesRateioIds: partic.map(function (p) { return p.id; }),
              linkedSource: source,
              origem: 'roteiro',
            };
            if (existente) {
              // Atualiza apenas se algo mudou (evita save desnecessário)
              if (existente.categoria !== catCorreta || existente.valor !== custo || existente.descricao !== despData.descricao) {
                var idx = _despesas[tid].indexOf(existente);
                _despesas[tid][idx] = _normalizarDespesaManual(tid, Object.assign({}, existente, despData), existente.id);
                _saved = true;
              }
            } else {
              _despesas[tid].push(_normalizarDespesaManual(tid, despData, _gerarDespesaId()));
              _saved = true;
            }
          }
        });
      });
    });
    if (_saved) {
      _salvarDespesas();
    }
  }

  function _gerarDespesasVirtuaisRotas(tripId) {
    var trechos = (_rotasTrechos[tripId] || []).filter(function (t) {
      return t && t.tripId === tripId;
    });

    var virtuais = trechos.map(function (trecho) {
      var normalizado = _normalizarTrecho(tripId, trecho, trecho.id);
      var total = _round2(normalizado.custoTotal);
      if (total <= 0) return null;
      return {
        id: 'route-expense-' + trecho.id,
        tripId: tripId,
        routeSegmentId: trecho.id,
        origem: 'rota',
        categoria: 'transporte',
        descricao: 'Rota: ' + normalizado.origem + ' → ' + normalizado.destino,
        routeDirection: trecho.direction || '',
        routeTipo: normalizado.tipo || 'outro',
        valor: total,
        data: trecho.data || _hojeISO(),
        quemPagouId: '',
        participantesRateioIds: _participantesAtivosComId(_state.viagens.find(function (v) { return v.id === tripId; })).map(function (p) { return p.id; }),
        observacoes: '',
      };
    }).filter(Boolean);

    virtuais.sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
    return virtuais;
  }

  // ---- Gera ID de trecho ----
  function _gerarTrechoId() {
    return 'trecho-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
  }

  function _parseDuracaoMinutos(txt) {
    var s = String(txt || '').trim().toLowerCase();
    if (!s) return 0;
    var horas = 0;
    var mins = 0;
    var h = s.match(/(\d+)\s*h/);
    var m = s.match(/(\d+)\s*m/);
    if (h) horas = Number(h[1]) || 0;
    if (m) mins = Number(m[1]) || 0;
    if (!h && !m) {
      var soNum = Number(s.replace(',', '.'));
      return Number.isFinite(soNum) ? Math.round(soNum * 60) : 0;
    }
    return (horas * 60) + mins;
  }

  function _fmtDuracaoTotal(minutos) {
    var m = Math.max(0, Math.round(Number(minutos) || 0));
    var h = Math.floor(m / 60);
    var r = m % 60;
    if (h && r) return h + 'h ' + r + 'min';
    if (h) return h + 'h';
    return r + 'min';
  }

  function _toCents(valor) {
    return Math.round((Number(valor) || 0) * 100);
  }

  function _fromCents(valorCentavos) {
    return _round2((Number(valorCentavos) || 0) / 100);
  }

  function _somarMes(iso, meses) {
    var base = String(iso || _hojeISO());
    var d = new Date(base + 'T12:00:00');
    if (Number.isNaN(d.getTime())) d = new Date(_hojeISO() + 'T12:00:00');
    d.setMonth(d.getMonth() + (Number(meses) || 0));
    return d.toISOString().slice(0, 10);
  }

  function _chaveMes(iso) {
    return String(iso || '').slice(0, 7);
  }

  function _labelMesPtBr(chave) {
    var meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    var p = String(chave || '').split('-');
    var ano = p[0] || '';
    var mesIdx = Math.max(1, Math.min(12, Number(p[1]) || 1)) - 1;
    return meses[mesIdx] + '/' + ano;
  }

  function _ratearCentavosComAjuste(totalCentavos, participantesIds) {
    var ids = Array.isArray(participantesIds) ? participantesIds.slice() : [];
    if (!ids.length) return {};
    var total = Math.max(0, Math.round(Number(totalCentavos) || 0));
    var base = Math.floor(total / ids.length);
    var resto = total - (base * ids.length);
    var out = {};
    ids.forEach(function (id, idx) {
      out[id] = base + (idx === ids.length - 1 ? resto : 0);
    });
    return out;
  }

  function _parcelasCentavosComAjuste(despesa) {
    var totalParcelas = Math.max(1, Math.floor(Number(despesa.totalParcelas) || 1));
    var totalCentavos = _toCents(despesa.valor);
    if (totalParcelas === 1) return [totalCentavos];

    var lista = [];
    if (Array.isArray(despesa.parcelas) && despesa.parcelas.length === totalParcelas) {
      lista = despesa.parcelas.map(function (v) { return _toCents(v); });
      var somaLista = lista.reduce(function (acc, c) { return acc + c; }, 0);
      var diff = totalCentavos - somaLista;
      if (lista.length > 0 && diff !== 0) lista[lista.length - 1] += diff;
      return lista;
    }

    var base = Math.floor(totalCentavos / totalParcelas);
    for (var i = 0; i < totalParcelas; i++) {
      lista.push(i === totalParcelas - 1
        ? (totalCentavos - (base * (totalParcelas - 1)))
        : base);
    }
    return lista;
  }

  function _inicializarMesParticipante(participante) {
    return {
      participanteId: participante.id,
      nome: participante.nome,
      pagouCents: 0,
      suaParteCents: 0,
      aReceberCents: 0,
      aPagarCents: 0,
      saldoCents: 0,
    };
  }

  var _itinerarios = _carregarItinerarios();

  // ---- Inicializa estado a partir do localStorage ----
  var _viagens    = _carregarViagens();
  var _cleanupMocks = _limparViagensMockConhecidas(_viagens);
  _viagens = _cleanupMocks.viagens;
  if (_cleanupMocks.mudou) {
    try { localStorage.setItem(_LS_TRIPS, JSON.stringify(_viagens)); } catch (e) {}
  }
  var _selectedId = _carregarSelectedId(_viagens);

  // Despesas carregadas DEPOIS de viagens/selectedId para permitir migração com fallback
  var _despesas = _carregarDespesas(_viagens, _selectedId);
  var _rotasTrechos = _carregarRotas(_viagens, _selectedId);
  var _cleanup = _limparDespesasGeradasPorRota(_despesas, _viagens);
  _despesas = _cleanup.despesas;
  if (_cleanup.mudou) _salvarDespesas();
  var _cleanupColecoes = _limparColecoesPorViagens(_viagens, _itinerarios, _despesas, _rotasTrechos);
  _itinerarios = _cleanupColecoes.itinerarios;
  _despesas = _cleanupColecoes.despesas;
  _rotasTrechos = _cleanupColecoes.rotas;
  if (_cleanupColecoes.mudou) {
    try { localStorage.setItem(_LS_ITIN, JSON.stringify(_itinerarios)); } catch (e) {}
    try { localStorage.setItem(_LS_EXPENSES, JSON.stringify(_despesas)); } catch (e) {}
    try { localStorage.setItem(_LS_ROUTES, JSON.stringify(_rotasTrechos)); } catch (e) {}
  }

  var _state = {
    viagemSelecionadaId: _selectedId,
    viagens: _viagens,
    roteiro: MockData.roteiro,        // Mock por enquanto — Prompt 3 tornará dinâmico
    financeiro: MockData.financeiro,  // idem
    rotas: {},
    configuracoes: Object.assign({}, MockData.configuracoes),
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

  function _enriquecerDespesaComNomes(tripId, despesa) {
    var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
    var porId = _indiceParticipantesPorId(viagem);
    var nomesRateio = (despesa.participantesRateioIds || []).map(function (id) {
      return porId[id];
    }).filter(Boolean);
    var paganteNome = despesa.quemPagouId ? (porId[despesa.quemPagouId] || '') : '';

    if (_isDespesaGeradaPorRota(despesa)) {
      paganteNome = 'Rota';
      if (nomesRateio.length === 0) {
        nomesRateio = _nomesParticipantesAtivos(viagem);
      }
    }

    return Object.assign({}, despesa, {
      quemPagouNome: paganteNome,
      participantesRateioNomes: nomesRateio,
    });
  }

  function _migrarDespesasParaParticipantesId() {
    var mudou = false;
    Object.keys(_despesas || {}).forEach(function (tripId) {
      if (!Array.isArray(_despesas[tripId])) return;
      _despesas[tripId] = _despesas[tripId].map(function (d) {
        if (!d || _isDespesaGeradaPorRota(d)) return d;
        var normalizada = _normalizarDespesaManual(tripId, d, d.id);
        var alterou = JSON.stringify(normalizada) !== JSON.stringify(d);
        if (alterou) mudou = true;
        return normalizada;
      });
    });
    return mudou;
  }

  function _marcarSyncPendente() {
    try {
      if (window.SyncService && typeof window.SyncService.markPendingSync === 'function') {
        window.SyncService.markPendingSync();
      }
    } catch (e) {}
  }

  var _despesasMigradas = _migrarDespesasParaParticipantesId();
  if (_despesasMigradas) _salvarDespesas();

  // ---- Bagagem templates ----
  var _bagTemplates = (function () {
    try {
      var raw = localStorage.getItem(_LS_BAG_TEMPLATES);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }());

  function _salvarBagTemplates() {
    try { localStorage.setItem(_LS_BAG_TEMPLATES, JSON.stringify(_bagTemplates)); } catch (e) {}
  }

  // ---- Planos Diretores (por tripId) ----
  var _planosDiretores = (function () {
    try {
      var raw = localStorage.getItem(_LS_PLANOS_DIRETORES);
      return (raw ? JSON.parse(raw) : null) || {};
    } catch (e) { return {}; }
  }());

  function _salvarPlanosDiretores() {
    try { localStorage.setItem(_LS_PLANOS_DIRETORES, JSON.stringify(_planosDiretores)); } catch (e) {}
  }

  // ---- API pública ----
  return {

    getState: function () { return _state; },

    subscribe: function (fn) { _listeners.push(fn); },

    // Injeta defaults de configuração (consumo/preço combustível) para cálculos de custo
    setConfigDefaults: function (prefs) {
      _configDefaults = {
        consumoPadrao:          Math.max(0, Number(prefs && prefs.consumoPadrao) || 0),
        precoCombustivelPadrao: Math.max(0, Number(prefs && prefs.precoCombustivelPadrao) || 0),
      };
    },

    // ---- Bagagem ----
    getBagagem: function (tripId) {
      var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
      if (!viagem) return null;
      return viagem.bagagem || null;
    },

    setBagagem: function (tripId, bag) {
      var idx = _state.viagens.findIndex(function (v) { return v.id === tripId; });
      if (idx === -1) return false;
      _state.viagens[idx] = Object.assign({}, _state.viagens[idx], {
        bagagem: Object.assign({}, bag, { updatedAt: new Date().toISOString() }),
      });
      _salvarViagens();
      _marcarSyncPendente();
      _notificar();
      return true;
    },

    // ---- Bagagem Templates ----
    getBagagemTemplates: function () { return _bagTemplates.slice(); },

    // ---- Plano Diretor ----
    getPlanoDiretor: function (tripId) {
      if (!tripId) return null;
      return _planosDiretores[tripId] || null;
    },
    salvarPlanoDiretor: function (tripId, dados) {
      if (!tripId) return;
      if (!dados) {
        delete _planosDiretores[tripId];
      } else {
        _planosDiretores[tripId] = Object.assign({}, dados, { tripId: tripId, updatedAt: new Date().toISOString() });
      }
      _salvarPlanosDiretores();
      _marcarSyncPendente();
    },

    saveBagagemTemplate: function (tpl) {
      var idx = _bagTemplates.findIndex(function (t) { return t.id === tpl.id; });
      if (idx >= 0) { _bagTemplates[idx] = tpl; }
      else { _bagTemplates.push(tpl); }
      _salvarBagTemplates();
      _marcarSyncPendente();
      return true;
    },

    deleteBagagemTemplate: function (id) {
      _bagTemplates = _bagTemplates.filter(function (t) { return t.id !== id; });
      _salvarBagTemplates();
      _marcarSyncPendente();
      return true;
    },

    // ---- Leitura ----
    getViagens:        function () { return _state.viagens; },
    getRoteiro:        function () { return _state.roteiro; },
    getFinanceiro:     function () { return _state.financeiro; },
    getRotas:          function (tripId) {
      if (!tripId) return [];
      return (_rotasTrechos[tripId] || []).filter(function (t) {
        return t && t.tripId === tripId;
      }).slice();
    },
    getConfiguracoes:  function () { return _state.configuracoes; },

    getGoogleMapsApiKey: function () {
      return 'AIzaSyDS4rKFaIDfnbKj3MoUA1WXXjfl3kfmvGI';
    },

    getViagemSelecionada: function () {
      if (!_state.viagens.length) return null;
      return _state.viagens.find(function (v) {
        return v.id === _state.viagemSelecionadaId;
      }) || _state.viagens[0];
    },

    getParticipantesViagem: function (tripId) {
      var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
      if (!viagem) return [];
      return _normalizarListaParticipantes(viagem.participantes, viagem.participantes).slice();
    },

    // ---- Seleção ----
    selecionarViagem: function (id) {
      _state.viagemSelecionadaId = id;
      _salvarSelectedId();
      _marcarSyncPendente();
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
      }, dados, {
        participantes: _normalizarListaParticipantes(dados && dados.participantes, dados && dados.participantes),
      });

      _state.viagens.push(novaViagem);

      // Seleciona automaticamente se for a primeira viagem
      if (_state.viagens.length === 1) {
        _state.viagemSelecionadaId = novaViagem.id;
        _salvarSelectedId();
      }
      _salvarViagens();
      _marcarSyncPendente();
      _notificar();
      return novaViagem;
    },

    // ---- Editar viagem ----
    editarViagem: function (id, dados) {
      var idx = _state.viagens.findIndex(function (v) { return v.id === id; });
      if (idx === -1) return false;
      var participantesEntrada = dados && dados.participantes !== undefined
        ? dados.participantes
        : _state.viagens[idx].participantes;
      // Preserva campos que o formulário não edita (gastoAtual, capa, id)
      _state.viagens[idx] = Object.assign({}, _state.viagens[idx], dados, {
        participantes: _normalizarListaParticipantes(participantesEntrada, participantesEntrada),
      });
      // Sincroniza dias do itinerário com o novo período da viagem
      _sincronizarDiasItinerario(id, _state.viagens[idx]);
      _salvarViagens();
      _salvarItinerarios();
      _marcarSyncPendente();
      _notificar();
      return true;
    },

    // ---- Excluir viagem ----
    excluirViagem: function (id) {
      _state.viagens = _state.viagens.filter(function (v) { return v.id !== id; });
      delete _itinerarios[id];
      delete _despesas[id];
      delete _rotasTrechos[id];
      // Corrige seleção se a viagem excluída era a atual
      if (_state.viagemSelecionadaId === id) {
        _state.viagemSelecionadaId = _state.viagens.length > 0 ? _state.viagens[0].id : null;
        _salvarSelectedId();
      }
      _salvarViagens();
      _salvarItinerarios();
      _salvarDespesas();
      _salvarRotas();
      _marcarSyncPendente();
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
      } else if (!Array.isArray(_itinerarios[tripId].dias)) {
        // Dado corrompido/inesperado do RTDB — regera dias
        _itinerarios[tripId].dias = _gerarDias(viagem);
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

      // Garante que todos os dias têm array atividades (robustez contra dados legados/RTDB)
      _itinerarios[tripId].dias.forEach(function (d) {
        if (!Array.isArray(d.atividades)) d.atividades = [];
      });

      // Injeta trechos de rota em cada dia (somente leitura — não persiste)
      var trechosViagem = (_rotasTrechos[tripId] || []).filter(function (t) {
        return t && t.tripId === tripId;
      });
      var trechosPorData = {};
      trechosViagem.forEach(function (t) {
        var d = t.data || '';
        if (!d) return;
        if (!trechosPorData[d]) trechosPorData[d] = [];
        trechosPorData[d].push(t);
      });

      // Build cross-day arrival milestones index (key = chegadaData)
      var chegadasPorData = {};
      trechosViagem.forEach(function (t) {
        if (!t.data || !t.horario) return;
        var chegH = t.chegadaHorario;
        var chegD = t.chegadaData;
        if (!chegH || !chegD) {
          var arr = _calcArrival(t.data, t.horario, t.duracaoEstimada);
          if (arr && arr.nextDay) { chegH = arr.horario; chegD = arr.data; }
        }
        if (chegD && chegD !== t.data) {
          if (!chegadasPorData[chegD]) chegadasPorData[chegD] = [];
          chegadasPorData[chegD].push(Object.assign({}, t, {
            _chegadaHorario: chegH,
            _chegadaData:    chegD,
          }));
        }
      });

      // Injeta entradas de hospedagem (check-in/check-out) por data — somente leitura
      var despesasTrip = (_despesas[tripId] || []).filter(function (d) {
        return d && d.tripId === tripId && d.categoria === 'hospedagem' && d.hospedagem;
      });
      var hospedagemPorData = {};
      despesasTrip.forEach(function (d) {
        var h = d.hospedagem;
        if (h.checkInDate) {
          if (!hospedagemPorData[h.checkInDate]) hospedagemPorData[h.checkInDate] = [];
          hospedagemPorData[h.checkInDate].push({
            tipo:      'check-in',
            despesaId: d.id,
            nome:      h.nome || d.descricao || '',
            hora:      h.checkInTime  || '14:00',
          });
        }
        if (h.checkOutDate) {
          if (!hospedagemPorData[h.checkOutDate]) hospedagemPorData[h.checkOutDate] = [];
          hospedagemPorData[h.checkOutDate].push({
            tipo:      'check-out',
            despesaId: d.id,
            nome:      h.nome || d.descricao || '',
            hora:      h.checkOutTime || '11:00',
          });
        }
      });

      var resultado = {
        dias: _itinerarios[tripId].dias.map(function (dia) {
          return Object.assign({}, dia, {
            trechos:    (trechosPorData[dia.data]     || []).slice(),
            hospedagem: (hospedagemPorData[dia.data]  || []).slice(),
            chegadas:   (chegadasPorData[dia.data]    || []).slice(),
          });
        }),
      };

      return resultado;
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
      _marcarSyncPendente();
      // Vincula despesa financeira se há custo
      _syncAtividadeExpense(tripId, ativ, dataISO);
      return ativ;
    },

    // Edita atividade — suporta mover de dia se dados.data mudar
    editarAtividade: function (tripId, atividadeId, dados) {
      var raw = _itinerarios[tripId];
      if (!raw) return false;
      var diaOrigem = null, idxOrigem = -1;
      raw.dias.forEach(function (d) {
        var i = (d.atividades || []).findIndex(function (a) { return a.id === atividadeId; });
        if (i !== -1) { diaOrigem = d; idxOrigem = i; }
      });
      if (!diaOrigem) return false;
      var ativOriginal = diaOrigem.atividades[idxOrigem];
      var novaData = dados.data;
      var ativAtualizada;
      if (novaData && novaData !== diaOrigem.data) {
        // Move para outro dia
        diaOrigem.atividades.splice(idxOrigem, 1);
        ativAtualizada = Object.assign({}, ativOriginal, dados);
        var diaDestino = raw.dias.find(function (d) { return d.data === novaData; });
        if (diaDestino) {
          if (!diaDestino.atividades) diaDestino.atividades = [];
          diaDestino.atividades.push(ativAtualizada);
          diaDestino.atividades.sort(function (a, b) { return (a.hora || '').localeCompare(b.hora || ''); });
        }
      } else {
        ativAtualizada = Object.assign({}, ativOriginal, dados);
        diaOrigem.atividades[idxOrigem] = ativAtualizada;
        diaOrigem.atividades.sort(function (a, b) { return (a.hora || '').localeCompare(b.hora || ''); });
      }
      _salvarItinerarios();
      _marcarSyncPendente();
      // Atualiza despesa vinculada (upsert/remove conforme novo custo)
      _syncAtividadeExpense(tripId, ativAtualizada, novaData || diaOrigem.data);
      return true;
    },

    // Exclui atividade (busca em todos os dias)
    excluirAtividade: function (tripId, atividadeId) {
      var raw = _itinerarios[tripId];
      if (!raw) return false;
      raw.dias.forEach(function (d) {
        d.atividades = (d.atividades || []).filter(function (a) { return a.id !== atividadeId; });
      });
      _salvarItinerarios();
      _marcarSyncPendente();
      // Remove despesa vinculada
      _removeLinkedExpense(tripId, 'atividade', atividadeId);
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
      _marcarSyncPendente();
      return true;
    },

    // Retorna as próximas N atividades não-feitas/não-canceladas de uma viagem
    getProximasAtividades: function (tripId, max) {
      var itin = this.getItinerario(tripId);
      if (!itin || !Array.isArray(itin.dias)) return [];
      var todas = [];
      itin.dias.forEach(function (d) {
        if (!d || !Array.isArray(d.atividades)) return;
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
      if (!tripId) return [];
      var manuais = (_despesas[tripId] || []).filter(function (d) {
        return d && d.tripId === tripId && !_isDespesaGeradaPorRota(d);
      }).slice();
      var virtuais = _gerarDespesasVirtuaisRotas(tripId);
      var merged = manuais.concat(virtuais).map(function (d) {
        return _enriquecerDespesaComNomes(tripId, d);
      });
      merged.sort(function (a, b) { return (a.data || '').localeCompare(b.data || ''); });
      return merged;
    },

    // Adiciona despesa
    adicionarDespesa: function (tripId, dados) {
      if (!_despesas[tripId]) _despesas[tripId] = [];
      var desp = _normalizarDespesaManual(tripId, dados, _gerarDespesaId());
      _despesas[tripId].push(desp);
      _despesas[tripId].sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
      _salvarDespesas();
      _marcarSyncPendente();
      _notificar();
      return desp;
    },

    // Edita despesa
    editarDespesa: function (tripId, despesaId, dados) {
      if (!_despesas[tripId]) return false;
      var idx = _despesas[tripId].findIndex(function (d) { return d.id === despesaId; });
      if (idx === -1) return false;
      _despesas[tripId][idx] = _normalizarDespesaManual(tripId, Object.assign({}, _despesas[tripId][idx], dados), despesaId);
      _despesas[tripId].sort(function (a, b) { return (b.data || '').localeCompare(a.data || ''); });
      _salvarDespesas();
      _marcarSyncPendente();
      _notificar();
      return true;
    },

    // Exclui despesa
    excluirDespesa: function (tripId, despesaId) {
      if (!tripId || !despesaId) return false;

      var virtual = _gerarDespesasVirtuaisRotas(tripId).find(function (d) {
        return d.id === despesaId;
      });

      if (virtual && virtual.routeSegmentId) {
        return this.excluirTrechoRota(tripId, virtual.routeSegmentId);
      }

      if (String(despesaId).indexOf('route-expense-') === 0) {
        return this.excluirTrechoRota(tripId, String(despesaId).replace('route-expense-', ''));
      }

      if (!_despesas[tripId]) return false;
      var antes = _despesas[tripId].length;
      _despesas[tripId] = _despesas[tripId].filter(function (d) { return d.id !== despesaId; });
      var mudou = _despesas[tripId].length !== antes;
      if (mudou) {
        _salvarDespesas();
        _marcarSyncPendente();
        _notificar();
      }
      return mudou;
    },

    // Resumo financeiro calculado a partir das despesas reais (isolado por viagem)
    getResumoFinanceiro: function (tripId) {
      var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
      var orcamento = viagem ? (Number(viagem.orcamento) || 0) : 0;
      var lista = this.getDespesas(tripId);

      var totalGasto = lista.reduce(function (acc, d) { return acc + (Number(d.valor) || 0); }, 0);

      // Agrupa por categoria — normaliza aliases de atividade → categoria canônica
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
        var k = _mapCategoria(d.categoria || 'outros');
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

      var despesasParceladas = lista.filter(function (d) {
        return Number(d.totalParcelas) > 1;
      });
      var compromissoParcelado = despesasParceladas.reduce(function (acc, d) {
        return acc + (Number(d.valor) || 0);
      }, 0);

      return {
        orcamento:   orcamento,
        totalGasto:  totalGasto,
        saldo:       orcamento - totalGasto,
        pct:         orcamento > 0 ? Math.min(100, Math.round((totalGasto / orcamento) * 100)) : 0,
        categorias:  categorias,
        despesas:    lista,
        compromissoParcelado: compromissoParcelado,
        qtdParceladas: despesasParceladas.length,
      };
    },

    getBalancoMensal: function (tripId) {
      var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
      if (!viagem) return { meses: [] };

      var participantes = _participantesAtivosComId(viagem);
      if (!participantes.length) return { meses: [] };

      var nPartic = participantes.length;
      var despesas = this.getDespesas(tripId);
      var mapaMeses = {};

      function garantirMes(chave) {
        if (!mapaMeses[chave]) {
          mapaMeses[chave] = {
            chave: chave,
            label: _labelMesPtBr(chave),
            totalMesCents: 0,
            despesas: [],
          };
        }
        return mapaMeses[chave];
      }

      despesas.forEach(function (despesa) {
        if (!despesa || !despesa.tripId || despesa.tripId !== tripId) return;
        var dataBase = despesa.data || _hojeISO();
        var parcelasCentavos = _parcelasCentavosComAjuste(despesa);
        parcelasCentavos.forEach(function (valorParcelaCentavos, idxParcela) {
          var dataParcela = _somarMes(dataBase, idxParcela);
          var chave = _chaveMes(dataParcela);
          var mes = garantirMes(chave);
          mes.totalMesCents += valorParcelaCentavos;
          mes.despesas.push({
            despesaId: despesa.id,
            descricao: despesa.descricao,
            categoria: despesa.categoria,
            dataParcela: dataParcela,
            parcelaAtual: idxParcela + 1,
            totalParcelas: parcelasCentavos.length,
            valorParcela: _fromCents(valorParcelaCentavos),
            quemPagouId: despesa.quemPagouId || '',
            origemRota: !!(despesa.routeSegmentId || despesa.origem === 'rota'),
            routeDirection: despesa.routeDirection || '',
            routeTipo: despesa.routeTipo || '',
          });
        });
      });

      var participantesAtivos = participantes.map(function (p) {
        return { id: p.id, nome: p.nome };
      });

      var meses = Object.keys(mapaMeses).sort().map(function (chave) {
        var mes = mapaMeses[chave];
        // Integer division: distribute remainder to first participants
        var base = Math.floor(mes.totalMesCents / nPartic);
        var resto = mes.totalMesCents % nPartic;
        var partePorPessoaCents = base + (resto > 0 ? 1 : 0); // Use ceil for display simplicity
        return {
          chave: mes.chave,
          label: mes.label,
          totalMes: _fromCents(mes.totalMesCents),
          totalMesCents: mes.totalMesCents,
          participantesAtivos: participantesAtivos,
          partePorPessoa: _fromCents(partePorPessoaCents),
          partePorPessoaCents: partePorPessoaCents,
          despesas: mes.despesas,
        };
      });

      return { meses: meses };
    },

    // ================================================================
    // Rotas por viagem
    // ================================================================

    getTrechosRota: function (tripId) {
      if (!tripId) return [];
      return (_rotasTrechos[tripId] || []).filter(function (t) {
        return t && t.tripId === tripId;
      }).slice();
    },

    adicionarTrechoRota: function (tripId, dados) {
      if (!tripId) return null;
      if (!_rotasTrechos[tripId]) _rotasTrechos[tripId] = [];
      var trecho = _normalizarTrecho(tripId, dados, _gerarTrechoId());
      if (!trecho || trecho.tripId !== tripId) return null;
      _rotasTrechos[tripId].push(trecho);
      _salvarRotas();
      _marcarSyncPendente();
      _notificar();
      return trecho;
    },

    editarTrechoRota: function (tripId, trechoId, dados) {
      if (!tripId || !trechoId) return false;
      if (!_rotasTrechos[tripId]) return false;
      var idx = _rotasTrechos[tripId].findIndex(function (t) {
        return t && t.id === trechoId && t.tripId === tripId;
      });
      if (idx === -1) return false;
      var atual = _rotasTrechos[tripId][idx];
      var trecho = _normalizarTrecho(tripId, Object.assign({}, atual, dados), trechoId);
      if (!trecho || trecho.tripId !== tripId) return false;
      _rotasTrechos[tripId][idx] = trecho;
      _salvarRotas();
      _marcarSyncPendente();
      _notificar();
      return true;
    },

    excluirTrechoRota: function (tripId, trechoId) {
      if (!tripId || !trechoId) return false;
      if (!_rotasTrechos[tripId]) return false;
      var antes = _rotasTrechos[tripId].length;
      _rotasTrechos[tripId] = _rotasTrechos[tripId].filter(function (t) {
        return !(t && t.id === trechoId && t.tripId === tripId);
      });
      if (_rotasTrechos[tripId].length === antes) return false;
      _salvarRotas();
      _marcarSyncPendente();
      _notificar();
      return true;
    },

    excluirTrecho: function (tripId, trechoId) {
      return this.excluirTrechoRota(tripId, trechoId);
    },

    // Exclui todos os trechos de um grupo ida/volta
    excluirTrechosPorGrupo: function (tripId, groupId) {
      if (!tripId || !groupId) return false;
      if (!_rotasTrechos[tripId]) return false;
      var antes = _rotasTrechos[tripId].length;
      _rotasTrechos[tripId] = _rotasTrechos[tripId].filter(function (t) {
        return !(t && t.tripId === tripId && t.roundTripGroupId === groupId);
      });
      if (_rotasTrechos[tripId].length === antes) return false;
      _salvarRotas();
      _marcarSyncPendente();
      _notificar();
      return true;
    },

    // Retorna o trecho irmão (volta↔ida) de um grupo round-trip
    getTrechoIrmao: function (tripId, trechoId) {
      if (!tripId || !trechoId || !_rotasTrechos[tripId]) return null;
      var trecho = null;
      _rotasTrechos[tripId].forEach(function (t) { if (t && t.id === trechoId) trecho = t; });
      if (!trecho || !trecho.roundTripGroupId) return null;
      var groupId = trecho.roundTripGroupId;
      var irmao = null;
      _rotasTrechos[tripId].forEach(function (t) {
        if (t && t.id !== trechoId && t.roundTripGroupId === groupId) irmao = t;
      });
      return irmao;
    },

    // Exporta o estado completo em memória (para persistência no RTDB)
    exportarEstadoCompleto: function () {
      return {
        trips: _state.viagens.slice(),
        selectedTripId: _state.viagemSelecionadaId || null,
        itineraries: JSON.parse(JSON.stringify(_itinerarios || {})),
        expenses: JSON.parse(JSON.stringify(_despesas || {})),
        routes: JSON.parse(JSON.stringify(_rotasTrechos || {})),
        planosDiretores: JSON.parse(JSON.stringify(_planosDiretores || {})),
        updatedAt: new Date().toISOString(),
      };
    },

    // Hidrata o estado em memória + localStorage a partir de um payload do RTDB
    carregarEstadoCompleto: function (payload) {
      if (!payload || typeof payload !== 'object') return false;
      try {
        // Normaliza e limpa viagens
        var viagens = Array.isArray(payload.trips) ? payload.trips.map(_migrarViagem) : [];
        var cleanMocks = _limparViagensMockConhecidas(viagens);
        viagens = cleanMocks.viagens;

        // Valida selectedId
        var selectedId = payload.selectedTripId || null;
        if (selectedId && !viagens.find(function (v) { return v.id === selectedId; })) {
          selectedId = viagens.length > 0 ? viagens[0].id : null;
        }

        var itinerarios = (payload.itineraries && typeof payload.itineraries === 'object') ? payload.itineraries : {};
        var despesas    = (payload.expenses    && typeof payload.expenses    === 'object') ? payload.expenses    : {};
        var rotas       = (payload.routes      && typeof payload.routes      === 'object') ? payload.routes      : {};

        // Garante que cada dia nos itinerários tenha um array atividades
        Object.keys(itinerarios).forEach(function (tid) {
          var itin = itinerarios[tid];
          if (itin && Array.isArray(itin.dias)) {
            itin.dias.forEach(function (d) {
              if (!Array.isArray(d.atividades)) d.atividades = [];
            });
          }
        });

        // Limpa coleções órfãs
        var cleanCol = _limparColecoesPorViagens(viagens, itinerarios, despesas, rotas);
        itinerarios = cleanCol.itinerarios;
        despesas    = cleanCol.despesas;
        rotas       = cleanCol.rotas;

        // Aplica ao estado em memória
        _state.viagens = viagens;
        _state.viagemSelecionadaId = selectedId;
        _itinerarios   = itinerarios;
        _despesas      = despesas;
        _rotasTrechos  = rotas;
        if (payload.planosDiretores && typeof payload.planosDiretores === 'object') {
          _planosDiretores = payload.planosDiretores;
          _salvarPlanosDiretores();
        }

        // Persiste nos LS keys existentes (cache de sessão)
        _salvarViagens();
        _salvarSelectedId();
        _salvarItinerarios();
        _salvarDespesas();
        _salvarRotas();

        // Reconcilia despesas de atividades que existiam antes da feature de sync
        _sincronizarTodasAtividades();

        _notificar();
        return true;
      } catch (e) {
        console.warn('[Store] carregarEstadoCompleto falhou:', e);
        return false;
      }
    },

    getResumoRotas: function (tripId) {
      if (!tripId) {
        return {
          trechos: [],
          totalKm: 0,
          totalDuracaoMin: 0,
          totalDuracaoTexto: _fmtDuracaoTotal(0),
          totalLitros: 0,
          custoTotal: 0,
          custoPorPessoa: 0,
          participantes: 1,
        };
      }
      var viagem = _state.viagens.find(function (v) { return v.id === tripId; });
      var participantes = _contarParticipantesAtivos(viagem);
      var lista = this.getRotas(tripId).filter(function (t) {
        return t && t.tripId === tripId;
      }).map(function (t) {
        var distancia = Number(t.distanciaKm) || 0;
        var consumo = Number(t.consumoKmL) || 0;
        var preco = Number(t.precoCombustivelLitro) || 0;
        var fixo = Number(t.custoFixo) || 0;
        var _tipoR = String(t.tipo || '').toLowerCase();
        var _useCarR = ['carro', 'van', 'onibus'].indexOf(_tipoR) !== -1;
        if (distancia > 0 && _useCarR) {
          if (consumo === 0 && _configDefaults.consumoPadrao > 0) consumo = _configDefaults.consumoPadrao;
          if (preco === 0 && _configDefaults.precoCombustivelPadrao > 0) preco = _configDefaults.precoCombustivelPadrao;
        }
        var litros = consumo > 0 ? (distancia / consumo) : 0;
        var custoComb = litros * preco;
        var custoTotal = fixo + custoComb;
        return Object.assign({}, t, {
          distanciaKm: distancia,
          consumoKmL: consumo,
          precoCombustivelLitro: preco,
          custoFixo: fixo,
          litrosEstimados: litros,
          custoCombustivel: custoComb,
          custoTotal: custoTotal,
          custoPorPessoa: custoTotal / participantes,
          duracaoMinutos: _parseDuracaoMinutos(t.duracaoEstimada),
        });
      });

      var totalKm = lista.reduce(function (acc, t) { return acc + t.distanciaKm; }, 0);
      var totalMin = lista.reduce(function (acc, t) { return acc + t.duracaoMinutos; }, 0);
      var totalLitros = lista.reduce(function (acc, t) { return acc + t.litrosEstimados; }, 0);
      var custoTotal = lista.reduce(function (acc, t) { return acc + t.custoTotal; }, 0);

      return {
        trechos: lista,
        totalKm: totalKm,
        totalDuracaoMin: totalMin,
        totalDuracaoTexto: _fmtDuracaoTotal(totalMin),
        totalLitros: totalLitros,
        custoTotal: custoTotal,
        custoPorPessoa: custoTotal / participantes,
        participantes: participantes,
      };
    },
  };

})();
