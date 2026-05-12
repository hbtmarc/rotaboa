// ===================================================
// bagagem.js — Organizador de Mala v2
// trip.bagagem = { version:2, templateId, containers:[...] }
// Templates em Store.getBagagemTemplates()
// ===================================================

// ---- ID generator ----------------------------------
function _bagId() {
  return 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function _bagSlug(str) {
  return String(str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function _bagDias(viagem) {
  if (!viagem) return 3;
  try {
    var ms = new Date((viagem.dataFim || '') + 'T12:00:00') - new Date((viagem.dataInicio || '') + 'T12:00:00');
    return Math.max(1, Math.round(ms / 86400000) + 1 || 3);
  } catch (e) { return 3; }
}
function _bagNomesAtivos(viagem) {
  if (!viagem) return [];
  return (viagem.participantes || [])
    .filter(function (p) { return p.ativo !== false; })
    .map(function (p) { return (typeof p === 'string' ? p : (p.nome || '')).trim(); })
    .filter(Boolean);
}
function _bagQ(dias, r) { return Math.max(1, Math.ceil(dias * r)); }

// ---- Built-in templates ----------------------------
var BAG_BUILT_IN_TEMPLATES = (function () {
  function container(id, nome, emoji, desc, grupos) {
    return { id: id, nome: nome, emoji: emoji, descricao: desc, grupos: grupos };
  }
  function grupo(id, nome, itens) {
    return { id: id, nome: nome, itens: itens.map(function (n) {
      return { id: _bagId(), nome: n, qtd: 1, observacao: '', checked: false, obrigatorio: false, origem: 'template' };
    })};
  }
  // ---- Viagem curta ----
  var curta = {
    id: 'builtin-curta', nome: 'Viagem curta', descricao: 'Fim de semana ou 2–3 dias', tags: ['curta', 'geral'],
    builtin: true,
    containers: [
      container('mala', 'Mala', '🧳', 'Roupas e higiene', [
        grupo('roupas', 'Roupas', ['Camisetas (3)', 'Shorts (2)', 'Roupas íntimas (3)', 'Meias (3 pares)', 'Pijama', 'Chinelo']),
        grupo('higiene', 'Higiene', ['Escova + pasta', 'Sabonete', 'Shampoo', 'Desodorante']),
        grupo('compartilhado', 'Compartilhados', ['Toalha de banho', 'Protetor solar', 'Adaptador tomada']),
      ]),
      container('mochila', 'Mochila', '🎒', 'Documentos e eletrônicos', [
        grupo('docs', 'Documentos', ['RG / CNH', 'Cartão / dinheiro']),
        grupo('eletro', 'Eletrônicos', ['Celular + carregador', 'Powerbank', 'Fone de ouvido']),
        grupo('saude', 'Saúde', ['Dipirona', 'Band-aid', 'Antialérgico']),
      ]),
      container('carro', 'Carro', '🚗', 'Apoio logístico', [
        grupo('conforto', 'Conforto', ['Água (garrafa)', 'Snacks', 'Saco de lixo']),
        grupo('seguranca', 'Segurança', ['Estepe', 'Triângulo', 'Macaco']),
      ]),
    ]
  };
  // ---- Ecoturismo / trilha ----
  var eco = {
    id: 'builtin-eco', nome: 'Ecoturismo / Trilha', descricao: 'Natureza, trilhas e cachoeiras', tags: ['natureza', 'trilha'],
    builtin: true,
    containers: [
      container('mochila-dia', 'Mochila do dia', '🎒', 'Para a trilha', [
        grupo('protecao', 'Proteção', ['Protetor solar', 'Repelente', 'Boné / chapéu', 'Óculos de sol']),
        grupo('agua-snack', 'Hidratação', ['Garrafa de água (1,5 L)', 'Água extra', 'Snacks / barrinha']),
        grupo('roupa-trilha', 'Roupas trilha', ['Camiseta dry-fit', 'Calça longa / bermuda', 'Meias altas', 'Tênis trail']),
        grupo('seguranca', 'Segurança', ['Lanterna / head lamp', 'Canivete', 'Apito', 'Saco roupa molhada']),
      ]),
      container('mala', 'Mala', '🧳', 'Base no alojamento', [
        grupo('roupas', 'Roupas', ['Troca de roupa (3 dias)', 'Pijama', 'Sandália', 'Roupa de banho cachoeira']),
        grupo('higiene', 'Higiene', ['Toalha secagem rápida', 'Escova + pasta', 'Sabonete', 'Shampoo']),
      ]),
    ]
  };
  // ---- Praia / cachoeira ----
  var praia = {
    id: 'builtin-praia', nome: 'Praia / Cachoeira', descricao: 'Sol, água e diversão', tags: ['praia', 'cachoeira'],
    builtin: true,
    containers: [
      container('mochila-praia', 'Bolsa praia', '👜', 'Para o dia', [
        grupo('sol', 'Proteção solar', ['Protetor solar FPS 50+', 'Bronzeador', 'Óculos de sol', 'Boné']),
        grupo('agua', 'Na água', ['Roupa de banho (2)', 'Toalha', 'Chinelo aquático', 'Saco impermeável']),
        grupo('conforto', 'Conforto', ['Água (garrafa)', 'Snacks', 'Lenço umedecido']),
      ]),
      container('mala', 'Mala', '🧳', 'Hospedagem', [
        grupo('roupas', 'Roupas', ['Roupas casuais (3)', 'Look para jantar', 'Pijama', 'Sandália']),
        grupo('higiene', 'Higiene', ['Shampoo pós-sol', 'Hidratante', 'Escova + pasta', 'Desodorante']),
      ]),
    ]
  };
  // ---- Viagem de carro ----
  var carro = {
    id: 'builtin-carro', nome: 'Viagem de carro', descricao: 'Estradas e road trip', tags: ['carro', 'estrada'],
    builtin: true,
    containers: [
      container('carro', 'Carro', '🚗', 'Para a estrada', [
        grupo('conforto', 'Conforto', ['Galão de água (5 L)', 'Snacks estrada', 'Saco de lixo', 'Almofada viagem', 'Cobertor leve']),
        grupo('nav', 'Navegação', ['Suporte celular painel', 'Carregador veicular', 'Cabo USB-C + Lightning']),
        grupo('seg-vei', 'Segurança veicular', ['Estepe calibrado', 'Triângulo', 'Macaco + chave', 'Extintor', 'Cabo auxiliar']),
      ]),
      container('mochila', 'Mochila motorista', '🎒', 'De fácil acesso', [
        grupo('docs', 'Documentos', ['CNH', 'Documento do carro', 'Seguro', 'Cartão / dinheiro']),
        grupo('imediato', 'Acesso imediato', ['Óculos de sol', 'Garrafa de água', 'Snack', 'Remédio enjoo']),
      ]),
    ]
  };
  // ---- Casal fim de semana ----
  var casal = {
    id: 'builtin-casal', nome: 'Casal fim de semana', descricao: 'Dois dias, conforto e romance', tags: ['casal', 'curta'],
    builtin: true,
    containers: [
      container('mala', 'Mala compartilhada', '🧳', 'Roupas e higiene', [
        grupo('r-masc', 'Roupas (masc)', ['Camisetas (3)', 'Shorts (2)', 'Cuecas (3)', 'Pijama', 'Chinelo', 'Tênis']),
        grupo('r-fem', 'Roupas (fem)', ['Camisetas (3)', 'Shorts (2)', 'Vestido/look', 'Calcinha (3)', 'Sutiã (2)', 'Sandália']),
        grupo('hi-masc', 'Higiene (masc)', ['Escova + pasta', 'Desodorante', 'Barbeador', 'Perfume']),
        grupo('hi-fem', 'Higiene (fem)', ['Escova + pasta', 'Shampoo + condicionador', 'Leave-in', 'Desodorante', 'Maquiagem compacta', 'Perfume']),
        grupo('comp', 'Compartilhados', ['Toalhas (2)', 'Protetor solar', 'Repelente', 'Adaptador tomada']),
      ]),
      container('mochila', 'Mochila', '🎒', 'Documentos e eletrônicos', [
        grupo('docs', 'Documentos', ['RGs', 'Cartões / dinheiro', 'Seguro saúde']),
        grupo('eletro', 'Eletrônicos', ['Celulares + carregadores', 'Powerbank', 'Câmera']),
        grupo('saude', 'Saúde', ['Dipirona', 'Antiácido', 'Band-aid', 'Antialérgico']),
      ]),
    ]
  };
  // ---- São Thomé das Letras ----
  var saothome = {
    id: 'builtin-saothome', nome: 'São Thomé das Letras', descricao: '1 mala grande + 2 mochilas + apoio no carro', tags: ['natureza', 'trilha', 'cachoeira', 'frio', 'carro'],
    builtin: true,
    containers: [
      container('mala-grande', 'Mala grande', '🧳', 'Roupas e higiene de todos', [
        grupo('mg-marc-roupa', 'Roupas — Marcelino', ['Cuecas (4)', 'Camisetas (4)', 'Shorts (2)', 'Calça comprida (1)', 'Meia comum (3 pares)', 'Meia grossa / trilha (2 pares)', 'Pijama', 'Moletom / casaco frio', 'Tênis passeio', 'Chinelo']),
        grupo('mg-marc-hig', 'Higiene — Marcelino', ['Shampoo', 'Sabonete', 'Escova + pasta', 'Desodorante', 'Barbeador / aparelho', 'Perfume']),
        grupo('mg-luiza-roupa', 'Roupas — Luiza', ['Calcinhas (4)', 'Sutiã (2)', 'Camisetas (3)', 'Shorts / saia (2)', 'Calça comprida (1)', 'Vestido / look jantar (1)', 'Meia (3 pares)', 'Pijama', 'Casaco / blusa de frio', 'Sandália', 'Chinelo']),
        grupo('mg-luiza-hig', 'Higiene & beleza — Luiza', ['Shampoo', 'Condicionador', 'Leave-in / finalizador', 'Sabonete', 'Escova + pasta', 'Desodorante', 'Hidratante corporal', 'Absorvente / itens pessoais', 'Perfume', 'Maquiagem compacta (base, blush, rímel, batom)', 'Demaquilante']),
        grupo('mg-comp', 'Compartilhados', ['Toalha de banho Marcelino', 'Toalha de banho Luiza', 'Protetor solar FPS 50+ (frasco grande)', 'Repelente extra', 'Adaptador de tomada (tipo N)', 'Saco para roupa suja']),
      ]),
      container('mochila-marc', 'Mochila Marcelino', '🎒', 'Documentos, energia e farmácia', [
        grupo('mm-docs', 'Documentos & dinheiro', ['RG / CNH', 'Cartão de crédito / débito', 'Dinheiro trocado (mercadinhos de STL preferem)', 'Seguro saúde / SAMU anotado']),
        grupo('mm-eletro', 'Energia & conectividade', ['Celular', 'Carregador celular', 'Powerbank', 'Cabo USB-C', 'Fone de ouvido']),
        grupo('mm-seguranca', 'Segurança pessoal', ['Lanterna / head lamp', 'Canivete', 'Apito']),
        grupo('mm-trilha', 'Trilha do dia', ['Garrafa de água (1,5 L)', 'Snacks / barrinha energética', 'Protetor solar (frasco pequeno)', 'Repelente de insetos', 'Boné / chapéu', 'Óculos de sol', 'Saco para roupa molhada']),
        grupo('mm-farmacia', 'Mini farmácia', ['Dipirona', 'Anti-inflamatório', 'Antialérgico (loratadina)', 'Remédio para enjoo (serra!)', 'Band-aid', 'Álcool gel', 'Protetor labial FPS']),
      ]),
      container('mochila-luiza', 'Mochila Luiza', '👜', 'Itens pessoais e conforto', [
        grupo('ml-docs', 'Documentos & celular', ['RG', 'Celular', 'Carregador / cabo']),
        grupo('ml-trilha', 'Trilha & cachoeira', ['Garrafa de água (1 L)', 'Toalha de secagem rápida (compacta)', 'Roupa de banho (para cachoeira — usar sob a roupa)', 'Troca de roupa seca (1 conjunto)', 'Saco impermeável para roupa molhada', 'Chinelo aquático']),
        grupo('ml-cuidados', 'Cuidados pessoais', ['Protetor solar FPS 50+ (frasco pessoal)', 'Hidratante facial / labial', 'Espelho compacto', 'Elástico / grampinho de cabelo', 'Lenço umedecido', 'Absorvente (bolsa)']),
        grupo('ml-hig-rapida', 'Higiene rápida', ['Escova de dente + pasta viagem', 'Desodorante roll-on', 'Perfume pequeno']),
      ]),
      container('carro', 'Carro', '🚗', 'Estrada BH → STL e logística', [
        grupo('car-estrada', 'Estrada (BH → STL ~340 km)', ['Galão de água (5 L)', 'Snacks de estrada', 'Saco de lixo', 'Suporte celular painel', 'Carregador veicular', 'Cabo USB-C + Lightning', 'Almofada viagem']),
        grupo('car-apoio', 'Apoio & conforto', ['Toalha velha / pano (assento sujo de trilha)', 'Capa de chuva ou poncho', 'Jaqueta de fácil acesso (frio na descida)', 'Muda de roupa seca reserva']),
        grupo('car-seg', 'Segurança veicular', ['Estepe calibrado', 'Triângulo', 'Macaco + chave de roda', 'Extintor', 'Cabo auxiliar']),
      ]),
    ]
  };

  return [curta, eco, praia, carro, casal, saothome];
}());

// ---- Smart suggestions engine ----------------------
function _gerarSugestoes(viagem) {
  if (!viagem) return [];
  var sugestoes = [];
  var dias  = _bagDias(viagem);
  var destino = ((viagem.destinoPrincipal || '') + ' ' + (viagem.localizacaoCurta || '') + ' ' +
                 (viagem.destino || '') + ' ' + (viagem.tags || '')).toLowerCase();
  var nomes = _bagNomesAtivos(viagem);
  var temCarro   = destino.match(/estrada|carro|road|km/);
  var temNatureza = destino.match(/trilha|cachoeira|mata|eco|parque|serra|morro|trekking|caminhada/);
  var temPraia   = destino.match(/praia|mar|litoral|piscina|cachoeira/);
  var temFrio    = destino.match(/frio|neve|inverno|serra|montanha|temperatura/);
  var temChuva   = destino.match(/chuva|temporal|inverno/);
  var qtdPessoas = nomes.length || 1;

  function sug(nome, grupo, motivo) {
    sugestoes.push({ id: _bagId(), nome: nome, grupo: grupo, motivo: motivo, qtd: 1, observacao: '', checked: false, obrigatorio: false, origem: 'sugestao' });
  }

  // Sempre
  sug('Protetor solar FPS 50+', 'Saúde', 'Recomendado para qualquer viagem');
  sug('Carregador de celular', 'Eletrônicos', 'Essencial');
  if (dias >= 2) sug('Powerbank', 'Eletrônicos', 'Mais de 1 dia de viagem');
  if (dias >= 3) sug('Remédio para enjoo', 'Saúde', 'Para viagens longas');
  if (qtdPessoas > 1) sug('Toalhas (' + qtdPessoas + ')', 'Roupas', 'Uma por pessoa');

  if (temNatureza) {
    sug('Repelente de insetos', 'Saúde', 'Área de mata / cachoeira');
    sug('Tênis trail / trekking', 'Roupas', 'Trilhas e terrenos irregulares');
    sug('Garrafa de água (1,5 L)', 'Hidratação', 'Trilhas exigem hidratação constante');
    sug('Head lamp / lanterna', 'Segurança', 'Para trilhas e madrugada');
    sug('Saco para roupa molhada', 'Organização', 'Cachoeira / trilha molhada');
    sug('Snacks energéticos', 'Alimentação', 'Para trilhas longas');
  }
  if (temPraia) {
    sug('Roupa de banho extra', 'Roupas', 'Praia / cachoeira');
    sug('Chinelo de borracha', 'Roupas', 'Para pedras e água');
    sug('Toalha de praia', 'Roupas', 'Para praia ou piscina');
    sug('Óculos de sol', 'Acessórios', 'Sol da praia');
  }
  if (temFrio) {
    sug('Agasalho / casaco pesado', 'Roupas', 'Destino frio');
    sug('Meia grossa', 'Roupas', 'Temperatura baixa');
    sug('Garrafa térmica', 'Acessórios', 'Bebidas quentes no frio');
  }
  if (temChuva) {
    sug('Capa de chuva', 'Roupas', 'Previsão de chuva');
    sug('Guarda-chuva compacto', 'Acessórios', 'Chuvas eventuais');
  }
  if (temCarro) {
    sug('Galão de água (carro)', 'Carro', 'Estrada longa');
    sug('Snacks de estrada', 'Alimentação', 'Para a viagem de carro');
    sug('Suporte celular painel', 'Carro', 'Navegação GPS');
    sug('Carregador veicular', 'Eletrônicos', 'Manter celular carregado');
    sug('Saco de lixo (carro)', 'Organização', 'Manter o carro limpo');
  }

  return sugestoes;
}

// ---- Migration v1 → v2 ----------------------------
function _migrarBagagemV1(bag, viagem) {
  // v1 format: { version:1, items:{key:true}, customItems:[] }
  if (!bag || bag.version === 2) return bag;
  // Create a simple single-container v2 from v1 checklist keys
  var container = {
    id: 'mala', nome: 'Itens', emoji: '🧳', descricao: 'Migrado da versão anterior',
    grupos: [{
      id: 'geral', nome: 'Geral',
      itens: Object.keys(bag.items || {}).filter(function (k) { return bag.items[k]; }).map(function (k) {
        var nome = k.split('|').pop().replace(/-/g, ' ');
        return { id: _bagId(), nome: nome, qtd: 1, observacao: '', checked: true, obrigatorio: false, origem: 'template' };
      })
    }]
  };
  return { version: 2, templateId: null, containers: [container] };
}

// ---- Get/set helpers --------------------------------
function _bagGetV2(tripId) {
  var raw = Store.getBagagem(tripId);
  if (!raw) return { version: 2, templateId: null, containers: [] };
  if (raw.version !== 2) return _migrarBagagemV1(raw) || { version: 2, templateId: null, containers: [] };
  return raw;
}
function _bagSaveV2(tripId, bag) {
  Store.setBagagem(tripId, bag);
}

// ---- Counts -----------------------------------------
function _cntGrupo(grp) {
  var total = 0, done = 0;
  (grp.itens || []).forEach(function (it) { total++; if (it.checked) done++; });
  return { total: total, done: done };
}
function _cntContainer(c) {
  var total = 0, done = 0;
  (c.grupos || []).forEach(function (g) { var r = _cntGrupo(g); total += r.total; done += r.done; });
  return { total: total, done: done };
}
function _cntAll(bag) {
  var total = 0, done = 0;
  (bag.containers || []).forEach(function (c) { var r = _cntContainer(c); total += r.total; done += r.done; });
  return { total: total, done: done };
}

// ---- Progress bar -----------------------------------
function _bag_bar(pct, light) {
  var fill = pct === 100 ? '#10b981' : (light ? 'rgba(255,255,255,.65)' : '#2563eb');
  return '<div class="bag-progress-track"><div class="bag-progress-fill" style="width:' + pct + '%;background:' + fill + '"></div></div>';
}

// ===================================================
// BagagemPage IIFE
// ===================================================
var BagagemPage = (function () {
  var _tripId   = null;
  var _viagem   = null;
  var _filter   = 'todos';
  var _search   = '';

  // ---- Store bridge -----------------------------------
  function _getBag() { return _bagGetV2(_tripId); }
  function _saveBag(bag) { _bagSaveV2(_tripId, bag); }

  // ---- Deep-clone helper ------------------------------
  function _cloneContainers(bag) {
    return JSON.parse(JSON.stringify(bag.containers || []));
  }

  // ---- Item visibility --------------------------------
  function _itemVisible(item, filter, search) {
    if (search && item.nome.toLowerCase().indexOf(search.toLowerCase()) === -1) return false;
    if (filter === 'marcados'   && !item.checked)    return false;
    if (filter === 'pendentes'  &&  item.checked)    return false;
    if (filter === 'obrigatorios' && !item.obrigatorio) return false;
    if (filter === 'sugestoes'  && item.origem !== 'sugestao') return false;
    return true;
  }
  function _grupoHasVisible(grp, filter, search) {
    return (grp.itens || []).some(function (it) { return _itemVisible(it, filter, search); });
  }
  function _containerHasVisible(c, filter, search) {
    return (c.grupos || []).some(function (g) { return _grupoHasVisible(g, filter, search); });
  }

  // ---- HTML: progress bar inline ----------------------
  function _inlineBar(pct) {
    return '<span class="bag-inline-bar"><span class="bag-inline-fill" style="width:' + pct + '%"></span></span>';
  }

  // ---- HTML: item row ---------------------------------
  function _renderItem(item, cId, gId) {
    var vis  = _itemVisible(item, _filter, _search);
    var hidCls = vis ? '' : ' bag-hidden';
    var doneCls = item.checked ? ' bag-item-done' : '';
    var obrigCls = item.obrigatorio ? ' bag-item-obrig' : '';
    return (
      '<div class="bag-item' + doneCls + obrigCls + hidCls + '" data-id="' + item.id + '">' +
        '<label class="bag-item-check">' +
          '<input type="checkbox" class="bag-cb"' + (item.checked ? ' checked' : '') +
            ' onchange="BagagemPage.toggleItem(\'' + cId + '\',\'' + gId + '\',\'' + item.id + '\')" />' +
        '</label>' +
        '<div class="bag-item-body">' +
          '<span class="bag-item-nome">' + _esc(item.nome) + '</span>' +
          (item.qtd > 1 ? '<span class="bag-item-qtd">×' + item.qtd + '</span>' : '') +
          (item.obrigatorio ? '<span class="bag-item-badge bag-badge-obrig">✦</span>' : '') +
          (item.origem === 'sugestao' ? '<span class="bag-item-badge bag-badge-sug">💡</span>' : '') +
          (item.observacao ? '<span class="bag-item-obs">' + _esc(item.observacao) + '</span>' : '') +
        '</div>' +
        '<div class="bag-item-actions">' +
          '<button class="bag-act-btn" title="Editar" onclick="BagagemPage.editarItem(\'' + cId + '\',\'' + gId + '\',\'' + item.id + '\')">✏️</button>' +
          '<button class="bag-act-btn bag-act-del" title="Excluir" onclick="BagagemPage.excluirItem(\'' + cId + '\',\'' + gId + '\',\'' + item.id + '\')">🗑️</button>' +
        '</div>' +
      '</div>'
    );
  }

  // ---- HTML: group ------------------------------------
  function _renderGrupo(grp, c) {
    var r   = _cntGrupo(grp);
    var pct = r.total ? Math.round(r.done / r.total * 100) : 0;
    var hasVis = _grupoHasVisible(grp, _filter, _search);
    var hidCls = hasVis ? '' : ' bag-hidden';
    var itensHtml = (grp.itens || []).map(function (it) { return _renderItem(it, c.id, grp.id); }).join('');
    return (
      '<details class="bag-grupo' + hidCls + '" open>' +
        '<summary class="bag-grupo-hdr">' +
          '<span class="bag-grupo-nome">' + _esc(grp.nome) + '</span>' +
          '<span class="bag-grupo-meta">' + r.done + '/' + r.total + '</span>' +
          _inlineBar(pct) +
          '<span class="bag-grupo-actions" onclick="event.stopPropagation()">' +
            '<button class="btn btn-ghost btn-xs bag-sec-btn" onclick="BagagemPage.marcarTudo(\'' + c.id + '\',\'' + grp.id + '\')">' +
              (r.done === r.total ? 'Desmarcar' : 'Marcar tudo') +
            '</button>' +
            '<button class="btn btn-ghost btn-xs bag-sec-btn" onclick="BagagemPage.limparSecao(\'' + c.id + '\',\'' + grp.id + '\')">Limpar</button>' +
            '<button class="btn btn-ghost btn-xs bag-sec-btn bag-sec-add" onclick="BagagemPage.abrirItemModal(\'' + c.id + '\',\'' + grp.id + '\')">+ Item</button>' +
          '</span>' +
        '</summary>' +
        '<div class="bag-grupo-itens">' + itensHtml + '</div>' +
      '</details>'
    );
  }

  // ---- HTML: container card ---------------------------
  function _renderContainer(c) {
    var r   = _cntContainer(c);
    var pct = r.total ? Math.round(r.done / r.total * 100) : 0;
    var hasVis = _containerHasVisible(c, _filter, _search);
    var hidCls = hasVis ? '' : ' bag-hidden';
    var gruposHtml = (c.grupos || []).map(function (g) { return _renderGrupo(g, c); }).join('');
    return (
      '<div class="card bag-container-card' + hidCls + '" id="bagc-' + c.id + '">' +
        '<div class="bag-container-hdr">' +
          '<div class="bag-container-title">' +
            '<span class="bag-container-emoji">' + (c.emoji || '📦') + '</span>' +
            '<span class="bag-container-nome">' + _esc(c.nome) + '</span>' +
          '</div>' +
          '<span class="bag-container-count">' + r.done + '/' + r.total + '</span>' +
        '</div>' +
        _bag_bar(pct) +
        '<div class="bag-grupos">' + gruposHtml + '</div>' +
      '</div>'
    );
  }

  // ---- HTML: filter chips -----------------------------
  function _chips() {
    var list = [
      ['todos','Todos'],['pendentes','Pendentes'],['marcados','Marcados'],
      ['obrigatorios','✦ Obrigatórios'],['sugestoes','💡 Sugestões']
    ];
    return list.map(function (ch) {
      return '<button class="bag-chip' + (ch[0] === _filter ? ' bag-chip-active' : '') +
        '" onclick="BagagemPage.setFilter(\'' + ch[0] + '\')">' + ch[1] + '</button>';
    }).join('');
  }

  // ---- Escape helper ----------------------------------
  function _esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ---- Full page render -------------------------------
  function _buildPage(bag) {
    var all  = _cntAll(bag);
    var pct  = all.total ? Math.round(all.done / all.total * 100) : 0;
    var loc  = _viagem.localizacaoCurta || _viagem.destinoPrincipal || _viagem.destino || '';
    var datas = (_viagem.dataInicio && _viagem.dataFim)
      ? (_viagem.dataInicio.split('-').reverse().join('/') + ' – ' + _viagem.dataFim.split('-').reverse().join('/'))
      : '';
    var containersHtml = (bag.containers || []).map(_renderContainer).join('');
    var hasContent = containersHtml.trim() !== '';

    // Determine if all containers are hidden (search/filter)
    var allHidden = (bag.containers || []).length > 0 &&
      !(bag.containers || []).some(function (c) { return _containerHasVisible(c, _filter, _search); });

    return (
      // Hero
      '<div class="bag-hero">' +
        '<div class="bag-hero-inner">' +
          '<div class="bag-hero-icon">🧳</div>' +
          '<div class="bag-hero-texts">' +
            '<h1 class="bag-hero-title">Bagagem</h1>' +
            '<p class="bag-hero-trip">' + _esc(_viagem.nome || '') + '</p>' +
            (loc ? '<p class="bag-hero-sub">' + _esc(loc) + (datas ? '&nbsp;·&nbsp;' + datas : '') + '</p>' : '') +
          '</div>' +
          '<button class="btn btn-ghost btn-xs bag-troca-btn" onclick="TripSwitcher.abrir()">⇄ Trocar</button>' +
        '</div>' +
        '<div class="bag-hero-prog-row">' +
          '<span class="bag-hero-prog-lbl">' + all.done + ' / ' + all.total + ' itens</span>' +
          '<span class="bag-hero-prog-pct">' + pct + '%</span>' +
        '</div>' +
        _bag_bar(pct, true) +
        '<div class="bag-hero-actions">' +
          '<button class="btn btn-ghost btn-xs bag-hero-act-btn" onclick="BagagemPage.abrirItemModal(null,null)">+ Adicionar item</button>' +
          '<button class="btn btn-ghost btn-xs bag-hero-act-btn" onclick="BagagemPage.abrirTemplateModal()">📋 Templates</button>' +
          '<button class="btn btn-ghost btn-xs bag-hero-act-btn" onclick="BagagemPage.abrirSugModal()">💡 Sugestões</button>' +
        '</div>' +
      '</div>' +
      // Toolbar
      '<div class="bag-toolbar">' +
        '<div class="bag-search-wrap">' +
          '<span class="bag-si">🔍</span>' +
          '<input id="bag-search" type="search" class="bag-search" placeholder="Buscar item..." ' +
            'value="' + _esc(_search) + '" oninput="BagagemPage.onSearch(this.value)" />' +
        '</div>' +
        '<div class="bag-chips" id="bag-chips">' + _chips() + '</div>' +
      '</div>' +
      // Containers
      '<div id="bag-containers">' +
        (all.total === 0 ? _emptyState() : (allHidden ? _noResults() : (hasContent ? containersHtml : _emptyState()))) +
      '</div>' +
      // Modo de uso
      _modoDeUso() +
      // Reset button
      '<div class="bag-global-actions">' +
        '<button class="btn btn-ghost btn-sm bag-reset-btn" onclick="BagagemPage.resetarLista()">🔄 Resetar lista da viagem</button>' +
      '</div>'
    );
  }

  function _emptyState() {
    return (
      '<div class="fin-empty" style="padding:var(--space-8)">' +
        '<div style="font-size:2.5rem;margin-bottom:var(--space-3)">🧳</div>' +
        '<p class="font-semibold" style="margin-bottom:var(--space-2)">Lista vazia</p>' +
        '<p class="text-sm text-secondary" style="margin-bottom:var(--space-4)">Aplicar um template ou adicionar itens manualmente.</p>' +
        '<button class="btn btn-primary btn-sm" onclick="BagagemPage.abrirTemplateModal()">📋 Aplicar template</button>' +
      '</div>'
    );
  }
  function _noResults() {
    return (
      '<div class="fin-empty" style="padding:var(--space-6)">' +
        '<p class="font-semibold">Nenhum item encontrado</p>' +
        '<p class="text-sm text-secondary">Tente outra palavra ou mude o filtro.</p>' +
      '</div>'
    );
  }

  function _modoDeUso() {
    var s = [
      { t: 'Chegada', tx: 'Pijama, chinelos, escovas, pasta e roupa do próximo dia de fácil acesso.' },
      { t: 'Passeio', tx: 'Mochila com água, protetor, repelente, powerbank, toalha e saco de roupa molhada.' },
      { t: 'Jantar', tx: 'Looks, calçados secos, casacos e maquiagem separados.' },
      { t: 'Volta',  tx: 'Mala no carro; mochila com documentos, dinheiro e eletrônicos.' },
    ];
    return (
      '<div class="card bag-modo-card">' +
        '<div class="bag-modo-hdr">📋 Modo de uso</div>' +
        '<div class="bag-uso-grid">' +
        s.map(function (x) {
          return '<div class="bag-uso-item"><div class="bag-uso-t">' + x.t + '</div><div class="bag-uso-tx">' + x.tx + '</div></div>';
        }).join('') +
        '</div></div>'
    );
  }

  // ---- Refresh helpers --------------------------------
  function _refreshContainers() {
    var bag = _getBag();
    var el  = document.getElementById('bag-containers');
    if (!el) return;
    var all = _cntAll(bag);
    var pct = all.total ? Math.round(all.done / all.total * 100) : 0;
    var allHidden = all.total > 0 &&
      !(bag.containers || []).some(function (c) { return _containerHasVisible(c, _filter, _search); });
    var html = (bag.containers || []).map(_renderContainer).join('');
    el.innerHTML = all.total === 0 ? _emptyState() : (allHidden ? _noResults() : html);
    // Update hero progress
    var lbl = document.querySelector('.bag-hero-prog-lbl');
    if (lbl) lbl.textContent = all.done + ' / ' + all.total + ' itens';
    var pctEl = document.querySelector('.bag-hero-prog-pct');
    if (pctEl) pctEl.textContent = pct + '%';
    var fill = document.querySelector('.bag-hero .bag-progress-fill');
    if (fill) { fill.style.width = pct + '%'; fill.style.background = pct === 100 ? '#10b981' : 'rgba(255,255,255,.65)'; }
  }
  function _refreshChips() {
    var el = document.getElementById('bag-chips');
    if (el) el.innerHTML = _chips();
  }

  // ---- Modal: add/edit item ---------------------------
  // ---- Catalog picker state ---------------------------
  var _pickerFilter  = 'Todos';
  var _pickerSearch  = '';
  var _pickerDestCId = null;
  var _pickerDestGId = null;

  // ---- Chip map (display label → categoria / special key) ----
  var _CHIPS = [
    { label: 'Sugestões', key: '__sug__' },
    { label: 'Essenciais', key: '__ess__' },
    { label: 'Documentos', key: 'Documentos' },
    { label: 'Roupas', key: 'Roupas' },
    { label: 'Higiene', key: 'Higiene' },
    { label: 'Beleza', key: 'Beleza' },
    { label: 'Farmácia', key: 'Farmacia' },
    { label: 'Eletrônicos', key: 'Eletronicos' },
    { label: 'Carro', key: 'Carro' },
    { label: 'Trilha', key: 'Trilha' },
    { label: 'Frio/Chuva', key: 'Frio e Chuva' },
    { label: 'Banho/Água', key: 'Banho e Agua' },
    { label: 'Hospedagem', key: 'Hospedagem' },
    { label: 'Alimentação', key: 'Alimentacao' },
    { label: 'Eventos', key: 'Eventos' },
    { label: 'Camping', key: 'Camping' },
    { label: 'Jiu-jitsu', key: 'Jiu-jitsu' },
    { label: 'Academia', key: 'Academia' },
    { label: 'Trabalho', key: 'Trabalho' },
    { label: 'Pet', key: 'Pet' },
    { label: 'Crianças', key: 'Criancas' },
    { label: 'Criados por mim', key: 'Criados por mim' },
    { label: '🙈 Ocultos', key: '_ocultos' },
    { label: 'Todos', key: 'Todos' },
  ];

  function _catalogResults() {
    var cat  = PackingCatalog || null;
    if (!cat) return [];
    var key  = _pickerFilter;
    var list;
    if (key === '__sug__') {
      list = cat.sugerirParaViagem(_viagem);
    } else if (key === '__ess__') {
      list = cat.getAll().filter(function (it) { return it.obrigatorioPadrao; });
    } else if (key === '__praia__') {
      list = cat.byTag('praia').concat(cat.byTag('cachoeira')).filter(function (it, i, a) {
        return a.findIndex(function (x) { return x.id === it.id; }) === i;
      });
    } else if (key === '_ocultos') {
      list = cat.getHiddenItems ? cat.getHiddenItems() : [];
    } else if (key === 'Criados por mim') {
      list = cat.getCustomItems();
    } else {
      list = cat.byCategoria(key === 'Todos' ? null : key);
    }
    if (_pickerSearch) {
      var q = _pickerSearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      list = list.filter(function (it) {
        return (it.nome + ' ' + it.categoria + ' ' + (it.tags || []).join(' '))
          .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .indexOf(q) >= 0;
      });
    }
    return list;
  }

  function _itemAlreadyAdded(nome) {
    var bag = _getBag();
    var nomeLower = nome.toLowerCase();
    return (bag.containers || []).some(function (c) {
      return (c.grupos || []).some(function (g) {
        return (g.itens || []).some(function (it) { return it.nome.toLowerCase() === nomeLower; });
      });
    });
  }

  function _renderPickerRows(results) {
    if (!results.length) {
      return '<div class="bpk-empty">Nenhum item encontrado para este filtro.</div>';
    }
    var isOcultos = (_pickerFilter === '_ocultos');
    return results.map(function (it) {
      var added = _itemAlreadyAdded(it.nome);
      var hideBtn = '';
      if (!it.custom) {
        if (isOcultos) {
          hideBtn = '<button type="button" class="bpk-hide-btn bpk-restore-btn" title="Restaurar no catálogo" ' +
            'onclick="event.preventDefault();event.stopPropagation();BagagemPage._pickerRestoreItem(\'' + it.id + '\')">' +
            '👁 Restaurar</button>';
        } else {
          hideBtn = '<button type="button" class="bpk-hide-btn" title="Ocultar do catálogo" ' +
            'onclick="event.preventDefault();event.stopPropagation();BagagemPage._pickerHideItem(\'' + it.id + '\')">' +
            '🙈</button>';
        }
      }
      return (
        '<label class="bpk-row' + (added ? ' bpk-row-added' : '') + '" title="' + _esc(it.observacaoPadrao || '') + '">' +
          '<input type="checkbox" class="bpk-cb" value="' + it.id + '"' + (added ? ' disabled checked' : '') + ' />' +
          '<span class="bpk-emoji">' + (it.emoji || '\uD83D\uDCE6') + '</span>' +
          '<span class="bpk-info">' +
            '<span class="bpk-nome">' + _esc(it.nome) + '</span>' +
            '<span class="bpk-meta">' + _esc(it.subcategoria || it.categoria) + (it.qtdPadrao > 1 ? ' · ×' + it.qtdPadrao : '') + '</span>' +
          '</span>' +
          (it.obrigatorioPadrao ? '<span class="bpk-badge bpk-badge-obrig" title="Obrigatório">✦</span>' : '') +
          (added ? '<span class="bpk-badge bpk-badge-ok">✓</span>' : '') +
          hideBtn +
        '</label>'
      );
    }).join('');
  }

  function _pickerHideItem(id) {
    if (PackingCatalog && PackingCatalog.hideItem) {
      PackingCatalog.hideItem(id);
      var body = document.getElementById('bpk-results');
      if (body) body.innerHTML = _renderPickerRows(_catalogResults());
    }
  }

  function _pickerRestoreItem(id) {
    if (PackingCatalog && PackingCatalog.restoreItem) {
      PackingCatalog.restoreItem(id);
      var body = document.getElementById('bpk-results');
      if (body) body.innerHTML = _renderPickerRows(_catalogResults());
    }
  }

  function _buildPickerModal(cId, gId) {
    var bag  = _getBag();
    _pickerDestCId = cId || (bag.containers.length ? bag.containers[0].id : null);
    _pickerDestGId = gId || (_pickerDestCId && bag.containers[0] && bag.containers[0].grupos.length ? bag.containers[0].grupos[0].id : null);

    // Container/group selects
    var cOpts = '', gOpts = '';
    (bag.containers || []).forEach(function (c) {
      cOpts += '<option value="' + c.id + '"' + (c.id === _pickerDestCId ? ' selected' : '') + '>' + _esc(c.emoji || '') + ' ' + _esc(c.nome) + '</option>';
    });
    if (!cOpts) cOpts = '<option value="">Nova mala</option>';

    if (_pickerDestCId) {
      var selC = (bag.containers || []).find(function (x) { return x.id === _pickerDestCId; });
      if (selC) (selC.grupos || []).forEach(function (g) {
        gOpts += '<option value="' + g.id + '"' + (g.id === _pickerDestGId ? ' selected' : '') + '>' + _esc(g.nome) + '</option>';
      });
    }
    if (!gOpts) gOpts = '<option value="">Novo grupo</option>';

    var chips = _CHIPS.map(function (ch) {
      return '<button type="button" class="bag-chip bpk-chip' + (ch.key === _pickerFilter ? ' bag-chip-active' : '') +
        '" onclick="BagagemPage._pickerChip(\'' + ch.key + '\')">' + ch.label + '</button>';
    }).join('');

    var results = _catalogResults();

    return (
      '<div class="bag-modal-overlay" id="bag-item-modal" onclick="_bagModalOverlayClick(\'bag-item-modal\',event)">' +
        '<div class="bag-modal bag-modal-xl">' +
          '<div class="bag-modal-hdr">' +
            '<span>+ Adicionar itens</span>' +
            '<button class="modal-close" onclick="BagagemPage.fecharItemModal()">✕</button>' +
          '</div>' +
          // Destino selector
          '<div class="bpk-dest-bar">' +
            '<span class="bpk-dest-lbl">Para:</span>' +
            '<select id="bpk-csel" class="form-select bpk-sel-sm" onchange="BagagemPage._pickerContChange()">' + cOpts + '</select>' +
            '<select id="bpk-gsel" class="form-select bpk-sel-sm">' + gOpts + '</select>' +
          '</div>' +
          // Search
          '<div class="bpk-search-wrap">' +
            '<span class="bag-si">🔍</span>' +
            '<input id="bpk-search" type="search" class="bag-search bpk-search" placeholder="Buscar item…"' +
              ' value="' + _esc(_pickerSearch) + '" oninput="BagagemPage._pickerSearch(this.value)" />' +
          '</div>' +
          // Chips
          '<div class="bpk-chips" id="bpk-chips">' + chips + '</div>' +
          // Results
          '<div class="bag-modal-body bpk-body" id="bpk-body">' +
            _renderPickerRows(results) +
          '</div>' +
          // Footer
          '<div class="bag-modal-footer bpk-footer">' +
            '<button class="btn btn-ghost btn-sm" onclick="BagagemPage.fecharItemModal()">Fechar</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="BagagemPage._pickerCriarItem()">✏️ Criar item</button>' +
            '<button class="btn btn-outline btn-sm" onclick="BagagemPage._pickerAdicionarEssenciais()">✦ Essenciais</button>' +
            '<button class="btn btn-primary btn-sm" onclick="BagagemPage._pickerAdicionarSelecionados()">Adicionar selecionados</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _abrirItemModal(cId, gId, item) {
    if (item) {
      // EDIT mode — keep the simple form
      var bag  = _getBag();
      var cOpts = '<option value="">— container —</option>';
      var gOpts = '<option value="">— grupo —</option>';
      (bag.containers || []).forEach(function (c) {
        cOpts += '<option value="' + c.id + '"' + (c.id === cId ? ' selected' : '') + '>' + _esc(c.nome) + '</option>';
        if (c.id === cId) {
          (c.grupos || []).forEach(function (g) {
            gOpts += '<option value="' + g.id + '"' + (g.id === gId ? ' selected' : '') + '>' + _esc(g.nome) + '</option>';
          });
        }
      });
      var html = (
        '<div class="bag-modal-overlay" id="bag-item-modal" onclick="_bagModalOverlayClick(\'bag-item-modal\',event)">' +
          '<div class="bag-modal">' +
            '<div class="bag-modal-hdr">' +
              '<span>Editar item</span>' +
              '<button class="modal-close" onclick="BagagemPage.fecharItemModal()">✕</button>' +
            '</div>' +
            '<div class="bag-modal-body">' +
              '<div class="form-group">' +
                '<label class="form-label">Container</label>' +
                '<select id="bim-container" class="form-select" onchange="BagagemPage._updateGrupoSelect()">' + cOpts + '</select>' +
              '</div>' +
              '<div class="form-group">' +
                '<label class="form-label">Grupo</label>' +
                '<select id="bim-grupo" class="form-select">' + gOpts + '</select>' +
              '</div>' +
              '<div class="form-group">' +
                '<label class="form-label">Nome <span class="text-required">*</span></label>' +
                '<input id="bim-nome" type="text" class="form-input" value="' + _esc(item.nome) + '" />' +
              '</div>' +
              '<div class="form-row">' +
                '<div class="form-group"><label class="form-label">Quantidade</label><input id="bim-qtd" type="number" class="form-input" value="' + item.qtd + '" min="1" max="99" /></div>' +
                '<div class="form-group form-group-check"><label class="form-check-label"><input id="bim-obrig" type="checkbox"' + (item.obrigatorio ? ' checked' : '') + ' /> Obrigatório</label></div>' +
              '</div>' +
              '<div class="form-group">' +
                '<label class="form-label">Observação</label>' +
                '<input id="bim-obs" type="text" class="form-input" value="' + _esc(item.observacao) + '" placeholder="Marca, comprar antes…" />' +
              '</div>' +
            '</div>' +
            '<div class="bag-modal-footer">' +
              '<button class="btn btn-ghost" onclick="BagagemPage.fecharItemModal()">Cancelar</button>' +
              '<button class="btn btn-primary" onclick="BagagemPage.salvarItem(\'' + item.id + '\',\'' + (cId||'') + '\',\'' + (gId||'') + '\')">Salvar</button>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
      var div = document.createElement('div');
      div.innerHTML = html;
      document.body.appendChild(div.firstChild);
      setTimeout(function () { var n = document.getElementById('bim-nome'); if (n) { n.focus(); n.select(); } }, 50);
      return;
    }

    // ADD mode — full catalog picker
    _pickerSearch  = '';
    _pickerFilter  = '__sug__';
    _pickerDestCId = cId || null;
    _pickerDestGId = gId || null;
    var div = document.createElement('div');
    div.innerHTML = _buildPickerModal(cId, gId);
    document.body.appendChild(div.firstChild);
    setTimeout(function () { var s = document.getElementById('bpk-search'); if (s) s.focus(); }, 50);
  }

  // Picker public helpers (called from inline handlers)
  function _pickerChip(key) {
    _pickerFilter = key;
    var chips = document.getElementById('bpk-chips');
    if (chips) chips.innerHTML = _CHIPS.map(function (ch) {
      return '<button type="button" class="bag-chip bpk-chip' + (ch.key === _pickerFilter ? ' bag-chip-active' : '') +
        '" onclick="BagagemPage._pickerChip(\'' + ch.key + '\')">' + ch.label + '</button>';
    }).join('');
    var body = document.getElementById('bpk-body');
    if (body) body.innerHTML = _renderPickerRows(_catalogResults());
  }

  function _pickerSearchFn(val) {
    _pickerSearch = val || '';
    var body = document.getElementById('bpk-body');
    if (body) body.innerHTML = _renderPickerRows(_catalogResults());
  }
  // alias used by inline oninput handler — see public API export

  function _pickerContChange() {
    var cSel = document.getElementById('bpk-csel');
    _pickerDestCId = cSel ? cSel.value : null;
    var bag = _getBag();
    var selC = (bag.containers || []).find(function (x) { return x.id === _pickerDestCId; });
    var gOpts = '';
    if (selC) (selC.grupos || []).forEach(function (g) {
      gOpts += '<option value="' + g.id + '">' + _esc(g.nome) + '</option>';
    });
    if (!gOpts) gOpts = '<option value="">Novo grupo</option>';
    var gSel = document.getElementById('bpk-gsel');
    if (gSel) gSel.innerHTML = gOpts;
    _pickerDestGId = gSel ? (gSel.options[0] && gSel.options[0].value) : null;
  }

  function _pickerGetSelected() {
    var modal = document.getElementById('bag-item-modal');
    if (!modal) return [];
    var checked = modal.querySelectorAll('.bpk-cb:checked:not(:disabled)');
    var ids = [];
    checked.forEach(function (cb) { ids.push(cb.value); });
    return ids;
  }

  function _pickerAddItems(ids) {
    if (!ids.length) { alert('Selecione ao menos um item.'); return; }
    var cSel = document.getElementById('bpk-csel');
    var gSel = document.getElementById('bpk-gsel');
    var cId  = cSel ? cSel.value : _pickerDestCId;
    var gId  = gSel ? gSel.value : _pickerDestGId;
    var allItems = PackingCatalog.getAll();
    var bag = _getBag();
    if (!bag.containers) bag.containers = [];
    var c = (bag.containers || []).find(function (x) { return x.id === cId; });
    if (!c) {
      c = { id: _bagId(), nome: 'Itens', emoji: '📦', descricao: '', grupos: [] };
      bag.containers.push(c);
    }
    var g = (c.grupos || []).find(function (x) { return x.id === gId; });
    if (!g) {
      g = { id: _bagId(), nome: 'Geral', itens: [] };
      c.grupos.push(g);
    }
    var added = 0;
    ids.forEach(function (id) {
      var cat = allItems.find(function (x) { return x.id === id; });
      if (!cat) return;
      var dup = (g.itens || []).some(function (it) { return it.nome.toLowerCase() === cat.nome.toLowerCase(); });
      if (!dup) {
        g.itens.push({ id: _bagId(), nome: cat.nome, qtd: cat.qtdPadrao || 1, observacao: cat.observacaoPadrao || '', checked: false, obrigatorio: cat.obrigatorioPadrao || false, origem: cat.custom ? 'custom' : 'catalogo' });
        added++;
      }
    });
    _saveBag(bag);
    fecharItemModal();
    _refreshContainers();
    if (added > 0) {
      var msg = document.createElement('div');
      msg.className = 'bag-toast';
      msg.textContent = added + ' item' + (added > 1 ? 'ns adicionados' : ' adicionado') + ' ✓';
      document.body.appendChild(msg);
      setTimeout(function () { msg.classList.add('bag-toast-show'); }, 10);
      setTimeout(function () { msg.classList.remove('bag-toast-show'); setTimeout(function () { msg.remove(); }, 300); }, 2200);
    }
  }

  function _pickerAdicionarSelecionados() { _pickerAddItems(_pickerGetSelected()); }

  function _pickerAdicionarEssenciais() {
    var ess = PackingCatalog.getAll().filter(function (it) { return it.obrigatorioPadrao; }).map(function (it) { return it.id; });
    _pickerAddItems(ess);
  }

  function _pickerCriarItem() {
    fecharItemModal();
    // Open a small create-custom-item dialog
    var html = (
      '<div class="bag-modal-overlay" id="bag-custom-modal" onclick="_bagModalOverlayClick(\'bag-custom-modal\',event)">' +
        '<div class="bag-modal">' +
          '<div class="bag-modal-hdr">' +
            '<span>✏️ Criar item personalizado</span>' +
            '<button class="modal-close" onclick="(function(){var e=document.getElementById(\'bag-custom-modal\');if(e)e.remove();})()">✕</button>' +
          '</div>' +
          '<div class="bag-modal-body">' +
            '<div class="form-group">' +
              '<label class="form-label">Nome <span class="text-required">*</span></label>' +
              '<input id="bcust-nome" type="text" class="form-input" placeholder="Ex: Creme de massagem" />' +
            '</div>' +
            '<div class="form-row">' +
              '<div class="form-group"><label class="form-label">Emoji</label><input id="bcust-emoji" type="text" class="form-input" value="📦" maxlength="4" style="max-width:60px" /></div>' +
              '<div class="form-group"><label class="form-label">Qtd padrão</label><input id="bcust-qtd" type="number" class="form-input" value="1" min="1" max="99" /></div>' +
            '</div>' +
            '<div class="form-group">' +
              '<label class="form-label">Observação</label>' +
              '<input id="bcust-obs" type="text" class="form-input" placeholder="Marca, onde comprar…" />' +
            '</div>' +
            '<p class="text-xs text-secondary" style="margin-top:var(--space-2)">Este item será salvo no seu catálogo pessoal e adicionado à lista.</p>' +
          '</div>' +
          '<div class="bag-modal-footer">' +
            '<button class="btn btn-ghost" onclick="(function(){var e=document.getElementById(\'bag-custom-modal\');if(e)e.remove();})()">Cancelar</button>' +
            '<button class="btn btn-primary" onclick="BagagemPage._pickerSalvarCustom()">Salvar e adicionar</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
    setTimeout(function () { var n = document.getElementById('bcust-nome'); if (n) n.focus(); }, 50);
  }

  function _pickerSalvarCustom() {
    var nome  = (document.getElementById('bcust-nome') || {}).value || '';
    var emoji = (document.getElementById('bcust-emoji') || {}).value || '📦';
    var qtd   = parseInt((document.getElementById('bcust-qtd') || {}).value || 1, 10) || 1;
    var obs   = (document.getElementById('bcust-obs') || {}).value || '';
    if (!nome.trim()) { alert('Informe o nome do item.'); return; }
    var custom = PackingCatalog.criarItemCustom({ nome: nome.trim(), emoji: emoji.trim(), qtd: qtd, observacao: obs });
    var el = document.getElementById('bag-custom-modal'); if (el) el.remove();
    // Add to bag immediately
    var bag = _getBag();
    if (!bag.containers) bag.containers = [];
    var c = bag.containers[0] || (function () {
      var nc = { id: _bagId(), nome: 'Itens', emoji: '📦', descricao: '', grupos: [] }; bag.containers.push(nc); return nc;
    }());
    var g = c.grupos[0] || (function () {
      var ng = { id: _bagId(), nome: 'Geral', itens: [] }; c.grupos.push(ng); return ng;
    }());
    g.itens.push({ id: _bagId(), nome: custom.nome, qtd: custom.qtdPadrao, observacao: custom.observacaoPadrao, checked: false, obrigatorio: false, origem: 'custom' });
    _saveBag(bag);
    _refreshContainers();
  }

  // ---- Modal: templates -------------------------------

  function _abrirTemplateModal() {
    var custom = Store.getBagagemTemplates();
    var all    = BAG_BUILT_IN_TEMPLATES.concat(custom);
    var tplHtml = all.map(function (t) {
      var totalItens = 0;
      (t.containers || []).forEach(function (c) {
        (c.grupos || []).forEach(function (g) { totalItens += (g.itens || []).length; });
      });
      return (
        '<div class="bag-tpl-card">' +
          '<div class="bag-tpl-info">' +
            '<div class="bag-tpl-nome">' + _esc(t.nome) + '</div>' +
            '<div class="bag-tpl-desc">' + _esc(t.descricao || '') + ' &mdash; ' + totalItens + ' itens</div>' +
          '</div>' +
          '<div class="bag-tpl-acts">' +
            '<button class="btn btn-primary btn-xs" onclick="BagagemPage.aplicarTemplate(\'' + t.id + '\')">Aplicar</button>' +
            '<button class="btn btn-ghost btn-xs" onclick="BagagemPage.duplicarTemplate(\'' + t.id + '\')">Duplicar</button>' +
            (!t.builtin ? '<button class="btn btn-ghost btn-xs bag-tpl-del" onclick="BagagemPage.excluirTemplate(\'' + t.id + '\')">🗑️</button>' : '') +
          '</div>' +
        '</div>'
      );
    }).join('');
    var html = (
      '<div class="bag-modal-overlay" id="bag-tpl-modal" onclick="_bagModalOverlayClick(\'bag-tpl-modal\',event)">' +
        '<div class="bag-modal bag-modal-lg">' +
          '<div class="bag-modal-hdr">' +
            '<span>📋 Gerenciar templates</span>' +
            '<button class="modal-close" onclick="BagagemPage.fecharTemplateModal()">✕</button>' +
          '</div>' +
          '<div class="bag-modal-body">' +
            '<p class="text-sm text-secondary" style="margin-bottom:var(--space-3)">Aplicar um template substitui a lista atual. Salvar como template cria um modelo reutilizável.</p>' +
            tplHtml +
          '</div>' +
          '<div class="bag-modal-footer">' +
            '<button class="btn btn-ghost" onclick="BagagemPage.fecharTemplateModal()">Fechar</button>' +
            '<button class="btn btn-outline btn-sm" onclick="BagagemPage.salvarComoTemplate()">💾 Salvar lista atual como template</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
  }

  // ---- Modal: suggestions -----------------------------
  function _abrirSugModal() {
    var sugs = _gerarSugestoes(_viagem);
    var rows = sugs.map(function (s) {
      return (
        '<div class="bag-sug-row">' +
          '<div class="bag-sug-info">' +
            '<span class="bag-sug-nome">💡 ' + _esc(s.nome) + '</span>' +
            '<span class="bag-sug-motivo">' + _esc(s.motivo) + '</span>' +
          '</div>' +
          '<button class="btn btn-ghost btn-xs" onclick="BagagemPage.adicionarSugestao(' + JSON.stringify(s).replace(/'/g,'&#39;') + ')">Adicionar</button>' +
        '</div>'
      );
    }).join('');
    var html = (
      '<div class="bag-modal-overlay" id="bag-sug-modal" onclick="_bagModalOverlayClick(\'bag-sug-modal\',event)">' +
        '<div class="bag-modal bag-modal-lg">' +
          '<div class="bag-modal-hdr">' +
            '<span>💡 Sugestões inteligentes</span>' +
            '<button class="modal-close" onclick="BagagemPage.fecharSugModal()">✕</button>' +
          '</div>' +
          '<div class="bag-modal-body bag-sug-body">' + (rows || '<p class="text-secondary">Nenhuma sugestão disponível.</p>') + '</div>' +
          '<div class="bag-modal-footer">' +
            '<button class="btn btn-ghost" onclick="BagagemPage.fecharSugModal()">Fechar</button>' +
            '<button class="btn btn-primary btn-sm" onclick="BagagemPage.adicionarTodasSugestoes()">Adicionar todas</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
    window._bagSugestoes = sugs;
  }

  function _bagModalOverlayClick(id, e) {
    if (e.target && e.target.id === id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    }
  }
  window._bagModalOverlayClick = _bagModalOverlayClick;

  // ---- Get/ensure default container for new items ----
  function _ensureContainer(bag, cId, gId) {
    var c = (bag.containers || []).find(function (x) { return x.id === cId; });
    if (!c) { c = { id: _bagId(), nome: 'Itens', emoji: '📦', descricao: '', grupos: [] }; bag.containers.push(c); }
    var g = (c.grupos || []).find(function (x) { return x.id === gId; });
    if (!g) { g = { id: _bagId(), nome: 'Geral', itens: [] }; c.grupos.push(g); }
    return { c: c, g: g };
  }

  // ===== Public API =====================================
  function toggleItem(cId, gId, itemId) {
    var bag = _getBag();
    var c = (bag.containers || []).find(function (x) { return x.id === cId; });
    if (!c) return;
    var g = (c.grupos || []).find(function (x) { return x.id === gId; });
    if (!g) return;
    var it = (g.itens || []).find(function (x) { return x.id === itemId; });
    if (!it) return;
    it.checked = !it.checked;
    _saveBag(bag);
    // Patch DOM: label
    var lbl = document.querySelector('.bag-item[data-id="' + itemId + '"]');
    if (lbl) lbl.classList.toggle('bag-item-done', it.checked);
    // Patch group counts
    var r = _cntGrupo(g);
    var pct = r.total ? Math.round(r.done / r.total * 100) : 0;
    var det = document.querySelector('details.bag-grupo');
    // Find details containing this item
    var detEl = lbl && lbl.closest('details.bag-grupo');
    if (detEl) {
      var meta = detEl.querySelector('.bag-grupo-meta');
      if (meta) meta.textContent = r.done + '/' + r.total;
      var f2 = detEl.querySelector('.bag-inline-fill');
      if (f2) f2.style.width = pct + '%';
      var btn = detEl.querySelector('.bag-sec-btn');
      if (btn) btn.textContent = r.done === r.total ? 'Desmarcar' : 'Marcar tudo';
    }
    // Patch container counts
    var cr = _cntContainer(c);
    var cpct = cr.total ? Math.round(cr.done / cr.total * 100) : 0;
    var cardEl = document.getElementById('bagc-' + cId);
    if (cardEl) {
      var cnt = cardEl.querySelector('.bag-container-count');
      if (cnt) cnt.textContent = cr.done + '/' + cr.total;
      var cf = cardEl.querySelector('.bag-progress-fill');
      if (cf) cf.style.width = cpct + '%';
    }
    // Patch hero
    var all = _cntAll(bag);
    var apct = all.total ? Math.round(all.done / all.total * 100) : 0;
    var heroLbl = document.querySelector('.bag-hero-prog-lbl');
    if (heroLbl) heroLbl.textContent = all.done + ' / ' + all.total + ' itens';
    var heroP = document.querySelector('.bag-hero-prog-pct');
    if (heroP) heroP.textContent = apct + '%';
    var heroF = document.querySelector('.bag-hero .bag-progress-fill');
    if (heroF) { heroF.style.width = apct + '%'; heroF.style.background = apct === 100 ? '#10b981' : 'rgba(255,255,255,.65)'; }
  }

  function marcarTudo(cId, gId) {
    var bag = _getBag();
    var c = (bag.containers || []).find(function (x) { return x.id === cId; });
    if (!c) return;
    var g = (c.grupos || []).find(function (x) { return x.id === gId; });
    if (!g) return;
    var allDone = (g.itens || []).every(function (it) { return it.checked; });
    (g.itens || []).forEach(function (it) { it.checked = !allDone; });
    _saveBag(bag);
    _refreshContainers();
  }

  function limparSecao(cId, gId) {
    var bag = _getBag();
    var c = (bag.containers || []).find(function (x) { return x.id === cId; });
    if (!c) return;
    var g = (c.grupos || []).find(function (x) { return x.id === gId; });
    if (!g) return;
    (g.itens || []).forEach(function (it) { it.checked = false; });
    _saveBag(bag);
    _refreshContainers();
  }

  function resetarLista() {
    if (!_tripId) return;
    if (!confirm('Resetar toda a lista de bagagem desta viagem?\n\nTodos os itens serão desmarcados.')) return;
    var bag = _getBag();
    (bag.containers || []).forEach(function (c) {
      (c.grupos || []).forEach(function (g) {
        (g.itens || []).forEach(function (it) { it.checked = false; });
      });
    });
    _saveBag(bag);
    _refreshContainers();
  }

  function setFilter(f) {
    _filter = f;
    _refreshChips();
    _refreshContainers();
  }

  function onSearch(val) {
    _search = val || '';
    _refreshContainers();
  }

  function abrirItemModal(cId, gId, item) {
    _abrirItemModal(cId, gId, item);
  }

  function fecharItemModal() {
    var el = document.getElementById('bag-item-modal');
    if (el) el.remove();
  }

  function _updateGrupoSelect() {
    var bag = _getBag();
    var cId = document.getElementById('bim-container') && document.getElementById('bim-container').value;
    var sel = document.getElementById('bim-grupo');
    if (!sel) return;
    var opts = '<option value="">— grupo —</option>';
    (bag.containers || []).forEach(function (c) {
      if (c.id !== cId) return;
      (c.grupos || []).forEach(function (g) {
        opts += '<option value="' + g.id + '">' + _esc(g.nome) + '</option>';
      });
    });
    sel.innerHTML = opts;
  }

  function salvarItem(editingId, origCId, origGId) {
    var nome  = (document.getElementById('bim-nome') || {}).value || '';
    var qtd   = parseInt((document.getElementById('bim-qtd') || {}).value || 1, 10) || 1;
    var obs   = (document.getElementById('bim-obs') || {}).value || '';
    var obrig = !!(document.getElementById('bim-obrig') || {}).checked;
    var cId   = (document.getElementById('bim-container') || {}).value || origCId;
    var gId   = (document.getElementById('bim-grupo') || {}).value || origGId;
    if (!nome.trim()) { alert('Informe o nome do item.'); return; }

    var bag = _getBag();
    if (!bag.containers) bag.containers = [];

    if (editingId) {
      // Edit in-place
      var found = false;
      (bag.containers || []).forEach(function (c) {
        (c.grupos || []).forEach(function (g) {
          var idx = (g.itens || []).findIndex(function (it) { return it.id === editingId; });
          if (idx >= 0) {
            g.itens[idx] = Object.assign({}, g.itens[idx], { nome: nome.trim(), qtd: qtd, observacao: obs, obrigatorio: obrig });
            found = true;
          }
        });
      });
    } else {
      // Create new
      var existingC = (bag.containers || []).find(function (x) { return x.id === cId; });
      if (!existingC) {
        existingC = { id: _bagId(), nome: 'Itens', emoji: '📦', descricao: '', grupos: [] };
        bag.containers.push(existingC);
        cId = existingC.id;
      }
      var existingG = (existingC.grupos || []).find(function (x) { return x.id === gId; });
      if (!existingG) {
        existingG = { id: _bagId(), nome: 'Geral', itens: [] };
        existingC.grupos.push(existingG);
      }
      existingG.itens.push({ id: _bagId(), nome: nome.trim(), qtd: qtd, observacao: obs, checked: false, obrigatorio: obrig, origem: 'manual' });
    }

    _saveBag(bag);
    fecharItemModal();
    _refreshContainers();
  }

  function editarItem(cId, gId, itemId) {
    var bag = _getBag();
    var c = (bag.containers || []).find(function (x) { return x.id === cId; });
    if (!c) return;
    var g = (c.grupos || []).find(function (x) { return x.id === gId; });
    if (!g) return;
    var item = (g.itens || []).find(function (x) { return x.id === itemId; });
    if (!item) return;
    _abrirItemModal(cId, gId, item);
  }

  function excluirItem(cId, gId, itemId) {
    if (!confirm('Excluir este item?')) return;
    var bag = _getBag();
    var c = (bag.containers || []).find(function (x) { return x.id === cId; });
    if (!c) return;
    var g = (c.grupos || []).find(function (x) { return x.id === gId; });
    if (!g) return;
    g.itens = (g.itens || []).filter(function (x) { return x.id !== itemId; });
    _saveBag(bag);
    _refreshContainers();
  }

  function abrirTemplateModal() { _abrirTemplateModal(); }
  function fecharTemplateModal() { var el = document.getElementById('bag-tpl-modal'); if (el) el.remove(); }

  function aplicarTemplate(tplId) {
    var all = BAG_BUILT_IN_TEMPLATES.concat(Store.getBagagemTemplates());
    var tpl = all.find(function (t) { return t.id === tplId; });
    if (!tpl) return;
    if (!confirm('Aplicar "' + tpl.nome + '"? A lista atual será substituída.')) return;
    // Deep clone template containers, assign new IDs
    var containers = JSON.parse(JSON.stringify(tpl.containers || []));
    containers.forEach(function (c) {
      (c.grupos || []).forEach(function (g) {
        (g.itens || []).forEach(function (it) { it.id = _bagId(); it.checked = false; });
      });
    });
    _saveBag({ version: 2, templateId: tplId, containers: containers });
    fecharTemplateModal();
    render(_viagem, document.getElementById('page-container'));
  }

  function duplicarTemplate(tplId) {
    var all = BAG_BUILT_IN_TEMPLATES.concat(Store.getBagagemTemplates());
    var tpl = all.find(function (t) { return t.id === tplId; });
    if (!tpl) return;
    var nome = prompt('Nome do novo template:', tpl.nome + ' (cópia)');
    if (!nome) return;
    var clone = JSON.parse(JSON.stringify(tpl));
    clone.id   = _bagId();
    clone.nome = nome.trim();
    clone.builtin = false;
    Store.saveBagagemTemplate(clone);
    fecharTemplateModal();
    _abrirTemplateModal();
  }

  function excluirTemplate(tplId) {
    if (!confirm('Excluir este template?')) return;
    Store.deleteBagagemTemplate(tplId);
    fecharTemplateModal();
    _abrirTemplateModal();
  }

  function salvarComoTemplate() {
    var nome = prompt('Nome do template:');
    if (!nome) return;
    var bag  = _getBag();
    var desc = prompt('Descrição breve (opcional):') || '';
    var clone = JSON.parse(JSON.stringify({ containers: bag.containers || [] }));
    // Reset checked state in template
    (clone.containers || []).forEach(function (c) {
      (c.grupos || []).forEach(function (g) {
        (g.itens || []).forEach(function (it) { it.checked = false; it.id = _bagId(); });
      });
    });
    Store.saveBagagemTemplate({ id: _bagId(), nome: nome.trim(), descricao: desc, tags: [], builtin: false, containers: clone.containers });
    alert('Template "' + nome.trim() + '" salvo com sucesso!');
    fecharTemplateModal();
  }

  function abrirSugModal() { _abrirSugModal(); }
  function fecharSugModal() { var el = document.getElementById('bag-sug-modal'); if (el) el.remove(); delete window._bagSugestoes; }

  function adicionarSugestao(sug) {
    var bag = _getBag();
    if (!bag.containers) bag.containers = [];
    // Add to first container's first group or create default
    var c = bag.containers[0] || (function () {
      var nc = { id: _bagId(), nome: 'Itens', emoji: '📦', descricao: '', grupos: [] };
      bag.containers.push(nc); return nc;
    }());
    var g = c.grupos[0] || (function () {
      var ng = { id: _bagId(), nome: 'Sugestões', itens: [] };
      c.grupos.push(ng); return ng;
    }());
    // Avoid duplicates by name
    var dup = (g.itens || []).some(function (it) { return it.nome.toLowerCase() === sug.nome.toLowerCase(); });
    if (!dup) {
      g.itens.push(Object.assign({}, sug, { id: _bagId() }));
      _saveBag(bag);
    }
    // Remove this suggestion row from modal
    var btn = event && event.target;
    if (btn) { var row = btn.closest('.bag-sug-row'); if (row) { btn.textContent = '✓ Adicionado'; btn.disabled = true; } }
  }

  function adicionarTodasSugestoes() {
    var sugs = window._bagSugestoes || [];
    sugs.forEach(function (s) { adicionarSugestao(s); });
    fecharSugModal();
    _refreshContainers();
  }

  function filtrarContainer(id) {
    // kept for compat — not used in v2
  }

  function render(viagem, container) {
    _tripId  = viagem ? viagem.id : null;
    _viagem  = viagem || null;
    _filter  = 'todos';
    _search  = '';
    var bag  = viagem ? _getBag() : { version: 2, templateId: null, containers: [] };
    container.innerHTML = _buildPage(bag);
  }

  return {
    render:              render,
    toggleItem:          toggleItem,
    marcarTudo:          marcarTudo,
    limparSecao:         limparSecao,
    resetarLista:        resetarLista,
    setFilter:           setFilter,
    onSearch:            onSearch,
    abrirItemModal:      abrirItemModal,
    fecharItemModal:     fecharItemModal,
    _updateGrupoSelect:  _updateGrupoSelect,
    salvarItem:          salvarItem,
    editarItem:          editarItem,
    excluirItem:         excluirItem,
    abrirTemplateModal:  abrirTemplateModal,
    fecharTemplateModal: fecharTemplateModal,
    aplicarTemplate:     aplicarTemplate,
    duplicarTemplate:    duplicarTemplate,
    excluirTemplate:     excluirTemplate,
    salvarComoTemplate:  salvarComoTemplate,
    abrirSugModal:       abrirSugModal,
    fecharSugModal:      fecharSugModal,
    adicionarSugestao:   adicionarSugestao,
    adicionarTodasSugestoes: adicionarTodasSugestoes,
    filtrarContainer:    filtrarContainer,
    // Picker (catalog add item)
    _pickerChip:          _pickerChip,
    _pickerSearch:        _pickerSearchFn,
    _pickerContChange:    _pickerContChange,
    _pickerAdicionarSelecionados: _pickerAdicionarSelecionados,
    _pickerAdicionarEssenciais:  _pickerAdicionarEssenciais,
    _pickerCriarItem:     _pickerCriarItem,
    _pickerSalvarCustom:  _pickerSalvarCustom,
    _pickerHideItem:      _pickerHideItem,
    _pickerRestoreItem:   _pickerRestoreItem,
    // backwards compat
    resetar:             resetarLista,
  };
}());

// end of bagagem.js
