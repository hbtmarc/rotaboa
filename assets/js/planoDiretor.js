// =====================================================================
// planoDiretor.js — Diretor de Filmagem por Viagem (v3)
// =====================================================================
var PlanoDiretorPage = (function () {

  function _esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _fmtData(iso) {
    if (!iso) return '-';
    try { return new Date(iso+'T12:00:00').toLocaleDateString('pt-BR'); } catch(e) { return iso; }
  }
  function _fmtDataCurta(iso) {
    if (!iso) return '';
    try { return new Date(iso+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}); }
    catch(e) { return iso; }
  }
  function _diaSemana(iso) {
    if (!iso) return '';
    var dias=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
    try { return dias[new Date(iso+'T12:00:00').getDay()]||''; } catch(e) { return ''; }
  }
  function _diffDias(d1,d2) {
    try { var a=new Date(d1+'T12:00:00'),b=new Date(d2+'T12:00:00'); return Math.round((b-a)/86400000)+1; }
    catch(e){ return 0; }
  }
  function _duracaoStr(min) {
    if (!min||min<=0) return '';
    var h=Math.floor(min/60),m=min%60;
    if(h>0&&m>0) return h+'h'+String(m).padStart(2,'0')+'min';
    return h>0 ? h+'h' : m+'min';
  }
  function _catLabel(cat) {
    var M={refeicao:'Refeição',passeio:'Passeio',hospedagem:'Hospedagem',transporte:'Transporte',
           compra:'Compras',natureza:'Natureza',cultura:'Cultura',esporte:'Esporte',
           trilha:'Trilha',praia:'Praia',outro:'Atividade'};
    return M[cat]||'Atividade';
  }
  function _catEmoji(cat) {
    var M={refeicao:'🍽️',passeio:'🚶',hospedagem:'🏨',transporte:'🚗',compra:'🛍️',
           natureza:'🌿',cultura:'🏛️',esporte:'⚽',trilha:'🥾',praia:'🏖️',outro:'📌'};
    return M[cat]||'📌';
  }

  // ─── Captação por atividade ────────────────────────────────────────
  function _captacaoDados(a) {
    var cat = a.categoria||'outro';
    var local = a.local||'';
    var obs   = a.observacoes||'';
    var T = {
      natureza:{antes:'Wide panorâmico ao chegar. Drone se disponível.',durante:'Detalhes de flora, fauna e texturas. Silhuetas na paisagem.',depois:'Golden hour — planos contemplativos no final.',enquad:'Regra dos terços com céu ou linha d\'água. Grande angular.',audio:'Som ambiente (vento, pássaros, água). Nat. sound, sem trilha adicionada.',detalhes:'Folhas com luz de fundo, reflexo n\'água, textura de pedra.',transicao:'Reveal de câmera do chão ao céu. Pan lento para próxima cena.',must:'Plano com escala humana vs. natureza.'},
      trilha:{antes:'Wide do trail head. Close de botas e mochila — preparação.',durante:'POV câmera na mão. Slow-mo dos pés. Drone acompanhando o grupo.',depois:'Chegada ao destino. Expressão de conquista. Vista do topo.',enquad:'POV de câmera baixa seguindo o passo. Teleobjetiva do grupo de longe.',audio:'Respiração, passos, galhos quebrando. Evitar trilha em cenas de esforço.',detalhes:'Botas no lodo, cantil, mãos apoiadas na pedra, vegetação em plano.',transicao:'Timelapse da trilha percorrida. Corte no ritmo da música.',must:'Shot do grupo no ponto mais alto ou chegando ao destino.'},
      praia:{antes:'Praia vazia ao amanhecer — drone de cima. Horário dourado.',durante:'Slow-mo de ondas. Pessoas na água. Brincadeiras e risadas.',depois:'Pôr do sol com silhuetas. Reflexo da luz na areia molhada.',enquad:'Horizonte no terço inferior. Câmera baixa no nível da areia.',audio:'Mar e ondas — gravar por 1min. Windshield no microfone.',detalhes:'Areia entre os dedos, concha, espuma da onda, óculos de sol.',transicao:'Wave wipe — onda cobrindo câmera. Dissolve para cena seguinte.',must:'Slow-mo de onda quebrando ou silhueta no pôr do sol.'},
      refeicao:{antes:'Chegada ao restaurante — fachada e ambiente. Menu sendo aberto.',durante:'Close do prato sendo servido. Expressões de reação ao comer.',depois:'Conversa à mesa. Ambiente e movimento do local.',enquad:'Top-down para pratos. 45° para bebidas e expressões. Bokeh no fundo.',audio:'Ambiente do restaurante, murmúrios, talheres.',detalhes:'Textura do prato, vapor saindo, close de utensílios, mise en place.',transicao:'Close do copo sendo colocado — cut para próxima cena.',must:'Primeiro garfo no prato — expressão de satisfação.'},
      cultura:{antes:'Fachada do local em wide. Placa ou indicação do lugar.',durante:'Detalhes arquitetônicos, obras de arte, interação das pessoas.',depois:'Contexto urbano ao redor — câmera revelando a cidade.',enquad:'Linhas geométricas do edifício. Teleobjetiva em detalhes arquitetônicos.',audio:'Passos em mármore, guia explicando, eco do espaço interno.',detalhes:'Detalhe de escultura, azulejo, vitral, mosaico, porta antiga.',transicao:'Pan de detalhe para wide. Corte entre elemento antigo e moderno.',must:'Plano que mostre escala do patrimônio com pessoas como referência.'},
      passeio:{antes:'Saída do ponto de partida — grupo se reunindo.',durante:'Câmera na mão acompanhando. Momentos espontâneos e reações.',depois:'Sorriso de encerramento. Selfie do grupo.',enquad:'Câmera na mão com leve shakiness. Foco em expressões.',audio:'Conversa natural. Não cortar o áudio ambiente.',detalhes:'Mãos apontando para algo, close de olho admirando, mapa consultado.',transicao:'Jump cut de caminhada. Corte com match de movimento.',must:'Momento espontâneo de riso ou surpresa.'},
      hospedagem:{antes:'Chegada — fachada, entrada, recepção.',durante:'Vista do quarto e varanda. Detalhes de amenidades e cama arrumada.',depois:'Golden hour pela janela. Silhueta relaxando.',enquad:'Establishing shot amplo. Slow tilt do teto para a cama.',audio:'Silêncio do quarto — room tone. Som externo pela janela aberta.',detalhes:'Chave do quarto, toalha dobrada, vista da piscina, café da manhã.',transicao:'Porta abrindo para próxima cena. Timelapse do dia pela janela.',must:'Shot da vista do quarto (se boa) e momento de check-in.'},
      compra:{antes:'Fachada do mercado/loja. Movimento e cores dos produtos.',durante:'Reação ao escolher o produto. Textura e close do artesanato.',depois:'Produto comprado "apresentado" para câmera com sorriso.',enquad:'Câmera na altura do produto. Close das mãos segurando.',audio:'Barulho do mercado, voz do vendedor, negociação.',detalhes:'Close de artesanato, tecido, cerâmica, feirantes ao fundo.',transicao:'Sacola sendo carregada — walking shot de saída.',must:'Reação genuína ao ver preço ou qualidade do produto.'},
      esporte:{antes:'Aquecimento e preparação. Equipamento esportivo em close.',durante:'Ação em câmera lenta. Expressões de esforço e diversão.',depois:'Comemoração, cansaço, conclusão da atividade.',enquad:'GoPro em ação. Teleobjetiva de longe para plano cinematográfico.',audio:'Respiração, impacto, aplausos ou bola no arco.',detalhes:'Close do equipamento, tênis, raquete, bola, suor na testa.',transicao:'Slow-mo freeze frame no auge da ação.',must:'Momento de maior tensão ou comemoração.'},
      transporte:{antes:'Veículo chegando ou saída do local de origem.',durante:'POV pela janela. Timelapse de quilômetros percorridos.',depois:'Chegada ao destino — reação de quem está dentro.',enquad:'GoPro no capô ou janela. Close das mãos no volante.',audio:'Motor, estrada, rádio interno. Silêncio para contemplação.',detalhes:'GPS navegando, placa de cidade, amanhecer pela janela, café na mão.',transicao:'Timelapse acelerado. Mapa animado de rota.',must:'Shot da estrada aberta ou panorama da paisagem passando.'},
    };
    var base = T[cat]||{antes:'Wide panorâmico do local antes de entrar.',durante:'Câmera na mão acompanhando a atividade.',depois:'Plano de encerramento com o grupo.',enquad:'Variado — teste wide e close antes de cada cena.',audio:'Som ambiente natural sem trilha adicionada.',detalhes:'Texturas do local, rostos, elementos característicos.',transicao:'Pan ou tilt de saída para próxima cena.',must:'O momento único e irreproduzível desta atividade.'};
    if (obs) base.must = base.must+(obs.length<60?' · Nota: '+obs:'');
    if (local) base.antes = base.antes+' · Local: '+local+'.';
    return base;
  }

  // ─── Shotlist por atividade ────────────────────────────────────────
  function _shotlistAtiv(a) {
    var cat  = a.categoria||'outro';
    var nome = a.nome||_catLabel(cat);
    var local = a.local ? ' em '+a.local : '';
    var dayDate = '';
    var WIDE = {
      natureza:  ['Establishing wide de '+nome+local,'Drone altitude média sobre o local','Grande angular com elemento humano na cena'],
      trilha:    ['Wide do trail head e trilha à frente','Drone rastreando o grupo na trilha','Wide do destino final visto de longe'],
      praia:     ['Drone de cima da praia — paralelo ao mar','Wide do horizonte no nível da areia','Wide panorâmico do litoral'],
      refeicao:  ['Wide do ambiente do restaurante'+local,'Establishing shot da mesa posta','Plano geral do espaço e movimento'],
      cultura:   ['Wide da fachada completa'+local,'Plano contrapicado da arquitetura','Wide com fluxo de visitantes'],
      passeio:   ['Wide do grupo caminhando'+local,'Establishing shot do ponto turístico','Plano de contexto da cidade ao fundo'],
      hospedagem:['Wide da fachada e entrada'+local,'Establishing do lobby ou recepção','Wide do quarto ao abrir a porta'],
      compra:    ['Wide do mercado'+local,'Plano geral das bancas e produtos','Establishing com movimento de compradores'],
      esporte:   ['Wide do campo'+local,'Plano geral da atividade esportiva','Drone com visão do espaço total'],
      transporte:['Wide da estrada aberta','Plano geral do veículo em movimento','Establishing shot da cidade de chegada'],
    };
    var DET = {
      natureza:  ['Close de folha ou flor com desfoque de fundo','Textura de pedra / casca de árvore','Reflexo n\'água parada'],
      trilha:    ['Close de botas no solo / lama / brita','Detalhe de mochila, cantil, bússola','Mãos agarrando pedra ou galho'],
      praia:     ['Close de areia escorrendo entre os dedos','Concha ou pedra no plano macro','Espuma da onda em plano baixo'],
      refeicao:  ['Close do prato sendo servido — vapor incluso','Detalhe de textura e cor do prato','Close de bebida com condensação'],
      cultura:   ['Detalhe de azulejo, entalhes ou escultura','Mosaico ou vitral com luz natural','Close em inscrição ou data histórica'],
      passeio:   ['Detalhe de ingresso, mapa ou guia','Close das mãos apontando para atração','Elemento decorativo do local'],
      hospedagem:['Close da chave ou cartão magnético','Detalhe da cama — travesseiro, lençol','Amenidade do hotel (sabonete, touca)'],
      compra:    ['Close do produto artesanal em mãos','Detalhe de textura / trabalho manual','Etiqueta de preço ou embalagem local'],
      esporte:   ['Close do equipamento esportivo','Detalhe dos pés em ação','Suor na testa, expressão de esforço'],
      transporte:['Close do GPS navegando','Placa de estrada com destino','Mãos no volante, close do painel'],
    };
    var PEOP = {
      natureza:  ['Silhueta de pessoa contra o horizonte','Retrato aberto com paisagem ao fundo','Expressão de admiração e contemplação'],
      trilha:    ['Expressão de esforço na subida','Comemoração ao chegar no topo','Olhar de determinação durante a trilha'],
      praia:     ['Risadas na água — câmera baixa','Expressão de relaxamento deitado na areia','Grupo brincando — câmera discreta'],
      refeicao:  ['Expressão de surpresa ao ver o prato','Satisfação no primeiro garfo','Conversa animada à mesa'],
      cultura:   ['Expressão de fascínio diante do patrimônio','Turista tirando foto (câmera atrás)','Interação com guia ou local'],
      passeio:   ['Reação espontânea ao ver algo inesperado','Selfie do grupo no ponto turístico','Riso e descontração em movimento'],
      hospedagem:['Expressão de satisfação ao entrar no quarto','Pessoa olhando a vista da janela','Check-in — momento de chegada'],
      compra:    ['Expressão ao descobrir o produto','Interação com vendedor local','Orgulho ao mostrar a compra'],
      esporte:   ['Expressão de vitória ou comemoração','Concentração antes da jogada','Abraço de equipe pós-atividade'],
      transporte:['Expressão contemplativa olhando pela janela','Pessoas dormindo ou rindo no carro','Olho fixo no caminho'],
    };
    var MOV = {
      natureza:  ['Pan lento acompanhando o horizonte','Câmera seguindo pássaro ou animal','Dolly-in para elemento central'],
      trilha:    ['POV câmera baixa acompanhando os passos','Slow-mo dos pés no solo','Drone tracking lateral do grupo'],
      praia:     ['Slow-mo de onda quebrando (120fps+)','Câmera seguindo criança correndo na areia','Pan reverso do mar para a margem'],
      refeicao:  ['Garçom trazendo o prato — câmera acompanha','Câmera girando ao redor da mesa','Zoom lento no prato principal'],
      cultura:   ['Câmera subindo em reveal da fachada','Traveling lateral pelo corredor interno','Pan de detalhe para wide da obra'],
      passeio:   ['Follow shot acompanhando o grupo','Câmera na mão entrando na atração','Pan de rua ou praça em movimento'],
      hospedagem:['Tilt lento da janela para a vista','Câmera entrando pela porta (POV)','Pan ao redor do quarto revelando o ambiente'],
      compra:    ['Câmera passando pelas bancas do mercado','Slow-mo de troca de moeda / pagamento','Tracking shot pela loja'],
      esporte:   ['Slow-mo da jogada principal','GoPro em primeira pessoa durante ação','Câmera circular ao redor do atleta'],
      transporte:['Timelapse pelo para-brisa','POV pela janela lateral','Drone tracking sobre o veículo'],
    };
    var AMB = {
      natureza:  ['Gravar 30s de som ambiente — silêncio','Vento nas árvores — microfone direcional','Pássaros ao amanhecer'],
      trilha:    ['Passos no cascalho ou folhas secas','Respiração do grupo — microfone próximo','Riacho ou cachoeira ao fundo'],
      praia:     ['Ondas quebrando — gravar 1min sem corte','Vento salino — proteção de vento no mic','Risadas e chamados ao mar'],
      refeicao:  ['Barulho de talheres, conversa ao redor','Cozinha ao fundo — som de preparo','Música ambiente do restaurante'],
      cultura:   ['Passos em piso histórico (mármore/pedra)','Eco e reverb do espaço interno','Guia explicando — áudio limpo se possível'],
      passeio:   ['Barulho de rua, multidão, comércio','Voz da guia ao fundo','Língua local / sotaque característico'],
      hospedagem:['Room tone do quarto — 10s de silêncio','Som externo pela janela aberta','Porta abrindo e fechando'],
      compra:    ['Barulho vivo do mercado ou feira','Voz do vendedor e negociação','Moeda trocando de mãos'],
      esporte:   ['Impacto da bola, raquete ou movimento','Torcida ou encorajamento do grupo','Respiração e esforço físico'],
      transporte:['Motor e vento — janela levemente aberta','Rádio interno ou música local','Pneu em estrada de terra'],
    };
    var TRANS = {
      natureza:  ['Reveal de câmera do chão subindo ao céu','Corte de detalhe natural para wide'],
      trilha:    ['Jump cut de chegada ao próximo ponto','Dissolve de trilha para destino final'],
      praia:     ['Onda cobrindo a lente — cut para próxima','Fade no pôr do sol para próxima cena'],
      refeicao:  ['Close do copo sendo colocado na mesa','Garçom se afastando — câmera vai ao grupo'],
      cultura:   ['Close de detalhe — wide revelando patrimônio','Porta se abrindo para o interior'],
      passeio:   ['Jump cut de caminhada à chegada','Match cut de gesto entre dois lugares'],
      hospedagem:['Porta do quarto fechando — fade','Vista da janela ao amanhecer'],
      compra:    ['Sacola sendo carregada — walking shot','Corte do produto para próxima atividade'],
      esporte:   ['Slow-mo freeze frame no auge da ação','Fade de encerramento com conclusão'],
      transporte:['Timelapse acelerado — cut de chegada','Placa da cidade — establishing shot'],
    };
    return {
      wide:      WIDE[cat]||['Establishing wide de '+nome,'Drone ou grande angular do local','Wide com grupo para escala'],
      detalhe:   DET[cat] ||['Close de textura do lugar','Detalhe característico de '+nome,'Macro de elemento central'],
      pessoas:   PEOP[cat]||['Expressão de reação em '+nome,'Retrato aberto no contexto','Interação espontânea'],
      movimento: MOV[cat] ||['Câmera seguindo ação principal','Slow-mo do momento marcante','Pan revelando o ambiente'],
      ambiente:  AMB[cat] ||['Gravar 30s de som ambiente limpo','Capturar som característico','Room tone do local'],
      transicao: TRANS[cat]||['Pan de saída para próxima cena','Corte direto no ritmo da música'],
    };
  }

  // ─── Conteúdo Resumo ──────────────────────────────────────────────
  function _gerarConceito(viagem, itin) {
    var dest  = viagem.destinoPrincipal||viagem.destino||'o destino';
    var dias  = (itin&&itin.dias)?itin.dias:[];
    var total = dias.reduce(function(s,d){ return s+(d.atividades||[]).length; },0);
    var cats  = {};
    dias.forEach(function(d){ (d.atividades||[]).forEach(function(a){ var c=a.categoria||'outro'; cats[c]=(cats[c]||0)+1; }); });
    var topCat=Object.keys(cats).sort(function(a,b){ return cats[b]-cats[a]; })[0]||'passeio';
    var CONC={
      natureza:'Mergulho contemplativo na natureza — silêncio visual, planos abertos, presença humana como referência de escala.',
      trilha:'Aventura e descoberta — câmera na mão, ritmo físico crescente, recompensa visual no topo.',
      praia:'Leveza, cores saturadas e ritmo natural do mar — slow-motion como linguagem principal.',
      refeicao:'Gastronomia como portal cultural — texturas, aromas implícitos e convívio à mesa.',
      cultura:'Imersão histórica — linhas arquitetônicas, luz natural e detalhe como narrativa.',
      passeio:'Documentário leve de viagem — momento autêntico, câmera discreta, espontaneidade.',
      hospedagem:'Refúgio e conforto — interiores, vistas privilegiadas e ritmo contemplativo.',
      transporte:'Jornada como narrativa — a estrada como personagem, o destino como recompensa.',
    };
    return 'Conceito central: '+(CONC[topCat]||'Registro autêntico e imersivo da jornada.')+'\n\nViagem para '+dest+' · '+dias.length+' dias · '+total+' atividades planejadas.\n\nEsta produção deve transmitir ao espectador a experiência subjetiva da viagem — não apenas o que foi visto, mas o que foi sentido.';
  }

  function _gerarTomEmocional(viagem, itin) {
    var dias=(itin&&itin.dias)?itin.dias:[];
    var cats={};
    dias.forEach(function(d){ (d.atividades||[]).forEach(function(a){ var c=a.categoria||'outro'; cats[c]=(cats[c]||0)+1; }); });
    var keys=Object.keys(cats).sort(function(a,b){ return cats[b]-cats[a]; });
    var TOM={
      natureza:'Contemplativo e sereno. Respeito diante do grandioso.',
      trilha:'Determinado e aventureiro. Tensão física resolvida em conquista.',
      praia:'Leve e alegre. Brincadeiras, risadas e relaxamento total.',
      refeicao:'Alegre e sensorial. Descoberta gastronômica e conexão social.',
      cultura:'Reverente e curioso. Admiração pelo tempo, arte e história.',
      passeio:'Descontraído e presente. Liberdade de explorar no próprio ritmo.',
      hospedagem:'Aconchegante. Descanso merecido após os dias intensos.',
      esporte:'Energético e competitivo. Adrenalina e diversão física.',
      transporte:'Antecipação crescente. A viagem começa antes de chegar.',
    };
    var linhas=keys.slice(0,3).map(function(c){ return '• '+_catLabel(c)+': '+(TOM[c]||'Autêntico e observacional.'); });
    return 'Tom emocional por tipo de atividade:\n'+linhas.join('\n')+'\n\nRitmo visual: planos longos nas paisagens, cortes rápidos nas atividades físicas, dissolves nas transições de dia.';
  }

  function _gerarCenasChave(viagem, itin) {
    var dias=(itin&&itin.dias)?itin.dias:[];
    if (!dias.length) return 'Adicione atividades ao roteiro para identificar as cenas-chave.';
    var linhas=['Cenas prioritárias por dia:\n'];
    dias.forEach(function(d,i){
      var ativs=(d.atividades||[]).filter(function(a){ return a.nome; });
      if (!ativs.length) return;
      var principal=ativs[0];
      var extra=ativs.slice(1).map(function(a){ return a.nome; }).join(', ');
      linhas.push('Dia '+(i+1)+' · '+_fmtDataCurta(d.data)+' ('+_diaSemana(d.data)+')');
      linhas.push('  📽 Cena-chave: '+principal.nome+(principal.local?' · '+principal.local:''));
      if (extra) linhas.push('  + Complementares: '+extra);
      linhas.push('');
    });
    return linhas.join('\n');
  }

  function _gerarRiscos(viagem, itin) {
    var dias=(itin&&itin.dias)?itin.dias:[];
    var total=dias.reduce(function(s,d){ return s+(d.atividades||[]).length; },0);
    return [
      '⚠ Golden hour: planejar filmagem de natureza, praia e paisagem entre 6h–8h e 17h–19h.',
      '⚠ Som: confirmar se o local permite gravação de áudio antes de entrar.',
      '⚠ Luz interna: cultura e hospedagem exigem ISO alto ou iluminação auxiliar.',
      '⚠ Drone: verificar regulamentação DECEA/ANAC e restrição do local antes de voar.',
      '⚠ Bateria: ~1h de filmagem por bateria. '+total+' atividades = mín. '+Math.ceil(total/3)+' baterias.',
      '⚠ Cartão: ~4–8 GB/hora em 4K. Levar cartão limpo reserva sempre.',
      '⚠ Clima: verificar previsão 24h antes. Proteção para câmera em dias chuvosos.',
    ].join('\n');
  }

  function _gerarPrioridades(itin) {
    var dias=(itin&&itin.dias)?itin.dias:[];
    if (!dias.length) return 'Defina atividades para identificar momentos prioritários.';
    var prio=[];
    var HIGH=['natureza','trilha','praia','cultura','esporte'];
    dias.forEach(function(d){
      (d.atividades||[]).forEach(function(a){
        if (HIGH.indexOf(a.categoria)!==-1||(a.observacoes&&a.observacoes.length>20)) {
          prio.push({nome:a.nome||'Atividade',cat:a.categoria,data:d.data,hora:a.hora,local:a.local});
        }
      });
    });
    if (!prio.length) dias.forEach(function(d){ (d.atividades||[]).forEach(function(a){ if(a.nome) prio.push({nome:a.nome,cat:a.categoria,data:d.data,hora:a.hora,local:a.local}); }); });
    return prio.slice(0,8).map(function(p,i){
      return (i+1)+'. '+p.nome+(p.local?' · '+p.local:'')+(p.data?' · '+_fmtDataCurta(p.data):'')+(p.hora?' às '+p.hora:'')+' · '+_catEmoji(p.cat)+' '+_catLabel(p.cat);
    }).join('\n');
  }

  // ─── Checklist grupos ─────────────────────────────────────────────
  function _gerarChecklistGrupos() {
    return [
      {id:'cam',label:'Câmera Principal',emoji:'📷',items:[
        {id:'c1',texto:'Câmera principal com corpo limpo e sensor sem poeira',checked:false},
        {id:'c2',texto:'Lente principal montada e com proteção UV',checked:false},
        {id:'c3',texto:'Lente wide extra (16–35mm ou similar)',checked:false},
        {id:'c4',texto:'Teleobjetiva (70–200mm ou equivalente)',checked:false},
        {id:'c5',texto:'Filtros ND: ND8, ND16, ND64 e polarizador',checked:false},
        {id:'c6',texto:'Configurações de câmera revisadas (perfil de cor, FPS)',checked:false},
      ]},
      {id:'bat',label:'Baterias e Carregamento',emoji:'🔋',items:[
        {id:'b1',texto:'Baterias da câmera (mín. 3) — 100% carregadas',checked:false},
        {id:'b2',texto:'Carregador duplo de baterias + adaptador de tomada',checked:false},
        {id:'b3',texto:'Power bank (mín. 20.000 mAh) para carregamento em campo',checked:false},
        {id:'b4',texto:'Cabo USB-C ou Lightning para celular',checked:false},
        {id:'b5',texto:'Carregador veicular se houver deslocamento de carro',checked:false},
      ]},
      {id:'mem',label:'Cartões e Armazenamento',emoji:'💾',items:[
        {id:'m1',texto:'Cartão SD principal (mín. 128 GB UHS-II)',checked:false},
        {id:'m2',texto:'Cartão SD reserva (mín. 64 GB)',checked:false},
        {id:'m3',texto:'HD externo para backup diário em campo',checked:false},
        {id:'m4',texto:'Cabo de dados para transferência rápida',checked:false},
        {id:'m5',texto:'Cartões formatados antes de sair (backup prévio feito)',checked:false},
      ]},
      {id:'aud',label:'Áudio',emoji:'🎙️',items:[
        {id:'a1',texto:'Microfone lapela (clip-on) com espuma e windshield',checked:false},
        {id:'a2',texto:'Microfone direcional de câmera (shotgun)',checked:false},
        {id:'a3',texto:'Proteção de vento (blimp/deadcat) para externas',checked:false},
        {id:'a4',texto:'Gravador de campo (se necessário entrevistas)',checked:false},
        {id:'a5',texto:'Cabo de extensão de áudio (P2 ou XLR se aplicável)',checked:false},
      ]},
      {id:'drn',label:'Drone',emoji:'🚁',items:[
        {id:'d1',texto:'Drone carregado e com firmware atualizado',checked:false},
        {id:'d2',texto:'Baterias do drone (mín. 3) — 100% carregadas',checked:false},
        {id:'d3',texto:'Hélices reserva (1 set extra)',checked:false},
        {id:'d4',texto:'Filtros ND para drone',checked:false},
        {id:'d5',texto:'Regulação DECEA/ANAC verificada para o destino',checked:false},
        {id:'d6',texto:'Aplicativo de drone atualizado e logado na conta',checked:false},
      ]},
      {id:'est',label:'Estabilização',emoji:'🎬',items:[
        {id:'e1',texto:'Gimbal carregado, atualizado e calibrado',checked:false},
        {id:'e2',texto:'Tripé com cabeça fluida para vídeo',checked:false},
        {id:'e3',texto:'Gorillapod ou mini tripé para planos de detalhe',checked:false},
        {id:'e4',texto:'Monopé para locais com muito movimento',checked:false},
      ]},
      {id:'cel',label:'Celular e Action Cam',emoji:'📱',items:[
        {id:'p1',texto:'Celular com espaço de armazenamento liberado',checked:false},
        {id:'p2',texto:'App de câmera pro (Filmic, Blackmagic Cam) instalado',checked:false},
        {id:'p3',texto:'Action cam (GoPro ou similar) carregada',checked:false},
        {id:'p4',texto:'Acessórios de fixação da action cam (chest mount, head mount)',checked:false},
        {id:'p5',texto:'Botão de shutter remoto (bluetooth) para selfies',checked:false},
      ]},
      {id:'kit',label:'Kit Diário de Campo',emoji:'🎒',items:[
        {id:'k1',texto:'Pano de limpeza de óptica',checked:false},
        {id:'k2',texto:'Saco plástico ou rain cover para câmera',checked:false},
        {id:'k3',texto:'Tampa de lente e protetor de câmera',checked:false},
        {id:'k4',texto:'Mochila ou bag de câmera adequada',checked:false},
        {id:'k5',texto:'Lanterna pequena (filmagens no escuro)',checked:false},
        {id:'k6',texto:'Bloco de notas para anotação de takes e locações',checked:false},
      ]},
    ];
  }

  // ─── Conteúdo Edição ──────────────────────────────────────────────
  function _gerarEstruturaEdicao(viagem, itin) {
    var dias=(itin&&itin.dias)?itin.dias:[];
    var total=dias.reduce(function(s,d){ return s+(d.atividades||[]).length; },0);
    var durMin=Math.max(4,Math.min(18,Math.round(total*0.9)));
    var cats={};
    dias.forEach(function(d){ (d.atividades||[]).forEach(function(a){ var c=a.categoria||'outro'; cats[c]=(cats[c]||0)+1; }); });
    var catKeys=Object.keys(cats).sort(function(a,b){ return cats[b]-cats[a]; });
    var COLOR={
      natureza:'Quente e saturado. Lift verde-amarelo nas sombras.',
      trilha:'Cinemático frio/quente. Crush nas sombras, céu azul intenso.',
      praia:'High-key saturado. Teal & orange clássico para o mar.',
      refeicao:'Cores quentes. Skin tones realistas e apetitosos.',
      cultura:'Dessaturado elegante. Alto contraste em pedra e fachadas.',
      passeio:'Natural e vivo. Correção mínima — look documental.',
    };
    var colorPrincipal=COLOR[catKeys[0]]||'Natural com leve lift quente nas sombras.';
    return {durMin:durMin,colorPrincipal:colorPrincipal,totalDias:dias.length,totalAtiv:total,catKeys:catKeys};
  }

  function _gerarMusicaEdicao(catKeys) {
    var MUS={
      natureza:'Ambient/instrumental orgânico. Slow build. Referências: Ludovico Einaudi, Explosions in the Sky.',
      trilha:'Folk/indie aventureiro. Energia crescente com ápice na conquista. Referências: Of Monsters and Men.',
      praia:'Tropical/indie pop. Leve, rítmico, alegre. Referências: Tame Impala, Jack Johnson.',
      refeicao:'Jazz suave ou bossa nova. Ambiente cálido e sofisticado.',
      cultura:'Orquestral ou piano solo. Gravidade e respeito ao legado histórico.',
      passeio:'Indie pop ou folk. Energia de descoberta. BPM 90–120.',
      esporte:'Hip-hop/eletrônico com alto BPM. Cortes no beat. 120–140 BPM.',
      transporte:'Americana/road trip. Guitarra limpa, voz de fundo.',
    };
    return MUS[catKeys[0]||'passeio']||'Trilha instrumental adaptada ao ritmo da viagem.';
  }

  // ─── Conteúdo Backup ──────────────────────────────────────────────
  function _gerarEstruturaPastas(itin) {
    var dias=(itin&&itin.dias)?itin.dias:[];
    var linhas=['/VIAGEM_NOME/'];
    dias.forEach(function(d,i){
      var label='Dia-'+String(i+1).padStart(2,'0')+(d.data?'_'+d.data:'');
      linhas.push('  /'+label+'/');
      linhas.push('    /Camera_Principal/');
      linhas.push('    /Drone/');
      linhas.push('    /Celular/');
      linhas.push('    /ActionCam/');
    });
    linhas.push('  /Proxies/');
    linhas.push('  /Selects/');
    linhas.push('  /Exports/');
    return linhas.join('\n');
  }

  // ─── Estado ───────────────────────────────────────────────────────
  var _tripId=null,_planoSalvo=null,_viagem=null,_itin=null;
  var _trechos=[],_participantes=[],_activeTab='resumo',_clSearch='';
  var _LS_TAB='rotaboa.pd.tab.';

  function _getStoredTab(id){ try{ return localStorage.getItem(_LS_TAB+id)||'resumo'; }catch(e){ return 'resumo'; } }
  function _saveStoredTab(id,t){ try{ localStorage.setItem(_LS_TAB+id,t); }catch(e){} }
  function _carregarPlano(tripId){ if(window.Store&&typeof Store.getPlanoDiretor==='function') return Store.getPlanoDiretor(tripId)||null; return null; }
  function _salvarPlano(tripId,dados){ if(window.Store&&typeof Store.salvarPlanoDiretor==='function') Store.salvarPlanoDiretor(tripId,dados); }

  function _computeData() {
    var dias=(_itin&&_itin.dias)?_itin.dias:[];
    var locais=[],cats={};
    dias.forEach(function(d){
      (d.atividades||[]).forEach(function(a){
        if(a.local&&locais.indexOf(a.local)===-1) locais.push(a.local);
        var c=a.categoria||'outro';
        if(!cats[c]) cats[c]={count:0,ativs:[]};
        cats[c].count++;
        cats[c].ativs.push(a.nome||'Atividade');
      });
    });
    var totalAtiv=dias.reduce(function(s,d){ return s+(d.atividades||[]).length; },0);
    var loc=_viagem.localizacaoCurta||_viagem.destinoPrincipal||_viagem.destino||'';
    var datas=(_viagem.dataInicio&&_viagem.dataFim)?_fmtData(_viagem.dataInicio)+' – '+_fmtData(_viagem.dataFim):(_viagem.dataInicio?_fmtData(_viagem.dataInicio):'');
    var totalDias=(_viagem.dataInicio&&_viagem.dataFim)?_diffDias(_viagem.dataInicio,_viagem.dataFim):dias.length;
    var partNomes=_participantes.filter(function(p){ return p.ativo!==false; }).map(function(p){ return p.nome; });
    return {dias:dias,totalAtiv:totalAtiv,locais:locais,cats:cats,loc:loc,datas:datas,totalDias:totalDias,partNomes:partNomes};
  }

  function _get(campo,fallback){ return (_planoSalvo&&_planoSalvo[campo])?_planoSalvo[campo]:fallback; }
  function _getChecklistGrupos() {
    if (_planoSalvo&&_planoSalvo.checklistGrupos) return _planoSalvo.checklistGrupos;
    return _gerarChecklistGrupos();
  }

  // ─── Render ───────────────────────────────────────────────────────
  function render(viagem, container) {
    _tripId=viagem.id; _viagem=viagem;
    _itin=window.Store?Store.getItinerario(viagem.id):null;
    _trechos=window.Store?Store.getTrechosRota(viagem.id):[];
    _participantes=window.Store?Store.getParticipantesViagem(viagem.id):[];
    _planoSalvo=_carregarPlano(viagem.id);
    _activeTab=_getStoredTab(viagem.id);
    var html='<div class="pd-root"><div class="pd-sticky-head">'+_renderToolbar()+_renderTabNav()+'</div><div class="pd-body" id="pd-body">'+_renderActiveTab()+'</div></div>';
    container.innerHTML=html;
  }

  function _renderToolbar() {
    var nome=_viagem?(_viagem.nome||'Viagem'):'Viagem';
    var grupos=_getChecklistGrupos();
    var done=0,total=0;
    grupos.forEach(function(g){ g.items.forEach(function(it){ total++; if(it.checked) done++; }); });
    return '<div class="pd-toolbar" id="pd-toolbar">'+
      '<a class="pd-back-btn" href="#/inicio" aria-label="Voltar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></a>'+
      '<div class="pd-tb-info"><span class="pd-tb-title">'+_esc(nome)+'</span>'+(total>0?'<span class="pd-tb-badge">'+done+'/'+total+'</span>':'')+' </div>'+
      '<div class="pd-tb-acts">'+
        _tbBtn('pd-btn-copiar','Copiar','PlanoDiretorPage.copiarBriefing()','<path d="M20 9H11a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 0 2 2v1"/>')+
        _tbBtn('pd-btn-export','Exportar','PlanoDiretorPage.exportarMarkdown()','<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>')+
        _tbBtn('pd-btn-salvar','Salvar','PlanoDiretorPage.salvar()','<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>')+
        _tbBtn('pd-btn-reset','Resetar','PlanoDiretorPage.resetar()','<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.63"/>','pd-tb-btn--danger')+
      '</div></div>';
  }

  function _tbBtn(id,label,onclick,svgPath,extraClass) {
    return '<button id="'+id+'" class="pd-tb-btn'+(extraClass?' '+extraClass:'')+'" onclick="'+onclick+'" aria-label="'+label+'" title="'+label+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">'+svgPath+'</svg><span>'+label+'</span></button>';
  }

  var _TABS=[{id:'resumo',label:'Resumo'},{id:'captacao',label:'Captação'},{id:'shotlist',label:'Shotlist'},{id:'checklist',label:'Checklist'},{id:'edicao',label:'Edição'},{id:'backup',label:'Backup'}];

  function _renderTabNav() {
    var html='<nav class="pd-tabs" role="tablist" aria-label="Seções do plano">';
    _TABS.forEach(function(t){ html+='<button class="pd-tab'+(_activeTab===t.id?' pd-tab--active':'')+'" data-tab="'+t.id+'" role="tab" aria-selected="'+(_activeTab===t.id?'true':'false')+'" onclick="PlanoDiretorPage.switchTab(\''+t.id+'\')">'+t.label+'</button>'; });
    return html+'</nav>';
  }

  function _renderActiveTab() {
    var d=_computeData();
    if(_activeTab==='resumo')    return _tabResumo(d);
    if(_activeTab==='captacao')  return _tabCaptacao(d);
    if(_activeTab==='shotlist')  return _tabShotlist(d);
    if(_activeTab==='checklist') return _tabChecklist(d);
    if(_activeTab==='edicao')    return _tabEdicao(d);
    if(_activeTab==='backup')    return _tabBackup(d);
    return _tabResumo(d);
  }

  // ══════ TAB: RESUMO ═══════════════════════════════════════════════
  function _tabResumo(d) {
    var partStr=d.partNomes.length>0?d.partNomes.join(', '):'';
    var h='<div class="pd-tab-pane pd-tab-resumo">';
    h+='<div class="pd-mini-hero">'+
         '<div class="pd-mini-hero-left">'+
           '<div class="pd-mini-badge">🎬 Diretor de Filmagem</div>'+
           '<h1 class="pd-mini-title">'+_esc(_viagem.nome||'Viagem')+'</h1>'+
           '<div class="pd-mini-chips">'+
             (d.loc?'<span class="pd-chip-info">📍 '+_esc(d.loc)+'</span>':'')+
             (d.datas?'<span class="pd-chip-info">📅 '+_esc(d.datas)+'</span>':'')+
             (d.totalDias?'<span class="pd-chip-info">📆 '+d.totalDias+' dias</span>':'')+
             (partStr?'<span class="pd-chip-info">👥 '+_esc(partStr)+'</span>':'')+
           '</div>'+
         '</div>'+
       '</div>';
    h+='<div class="pd-kpi-grid">'+
      _kpiCard('📅',String(d.totalDias||'—'),'Dias')+
      _kpiCard('📍',String(d.totalAtiv),'Atividades')+
      _kpiCard('🗺️',String(_trechos.length),'Trechos')+
      _kpiCard('🎥',String(d.locais.length),'Locais')+
    '</div>';
    h+=_dirCard('pd-dir-conceito','🎨','Conceito e narrativa',_get('conceito',_gerarConceito(_viagem,_itin)));
    h+=_dirCard('pd-dir-tom','🎭','Tom emocional e ritmo',_get('tom',_gerarTomEmocional(_viagem,_itin)));
    h+=_dirCard('pd-dir-cenas','📽','Cenas-chave por dia',_get('cenasChave',_gerarCenasChave(_viagem,_itin)));
    h+=_dirCard('pd-dir-prio','⭐','Momentos prioritários',_get('prioridades',_gerarPrioridades(_itin)));
    h+=_dirCard('pd-dir-riscos','⚠️','Riscos e alertas',_get('riscos',_gerarRiscos(_viagem,_itin)));
    return h+'</div>';
  }

  // ══════ TAB: CAPTAÇÃO ════════════════════════════════════════════
  function _tabCaptacao(d) {
    var h='<div class="pd-tab-pane pd-tab-captacao">';
    if (!d.dias.length) return h+_emptyState('📭','Adicione atividades ao roteiro para gerar o plano de captação.')+'</div>';
    d.dias.forEach(function(day,di){
      var ativs=day.atividades||[];
      var dayId='pd-day-'+di;
      h+='<div class="pd-day-card" id="'+dayId+'">'+
           '<div class="pd-day-head">'+
             '<div class="pd-day-head-left"><span class="pd-day-dot"></span><span class="pd-day-name">'+_esc(_diaSemana(day.data))+'</span><span class="pd-day-date">'+_esc(_fmtDataCurta(day.data))+'</span></div>'+
             '<div class="pd-day-head-right"><span class="pd-day-count">'+ativs.length+'</span></div>'+
           '</div>'+
           '<div class="pd-day-body">';
      if (!ativs.length) {
        h+='<p class="pd-day-free">Dia livre — captação documental espontânea.</p>';
      } else {
        ativs.forEach(function(a){
          var info=_captacaoDados(a);
          h+='<div class="pd-ativ-card">'+
               '<div class="pd-ativ-card-head">'+
                 '<span class="pd-ativ-card-emoji">'+_catEmoji(a.categoria)+'</span>'+
                 '<div class="pd-ativ-card-meta">'+
                   '<div class="pd-ativ-card-name">'+_esc(a.nome||'Atividade')+'</div>'+
                   '<div class="pd-ativ-card-chips">'+
                     '<span class="pd-chip pd-chip--cat">'+_esc(_catLabel(a.categoria))+'</span>'+
                     (a.hora?'<span class="pd-chip pd-chip--time">⏱ '+_esc(a.hora)+'</span>':'')+
                     (a.duracaoMin?'<span class="pd-chip pd-chip--time">'+_esc(_duracaoStr(a.duracaoMin))+'</span>':'')+
                     (a.local?'<span class="pd-chip pd-chip--local">📍 '+_esc(a.local)+'</span>':'')+
                   '</div>'+
                 '</div>'+
               '</div>'+
               '<div class="pd-ativ-card-fields">'+
                 _captField('⏮','Antes',info.antes)+
                 _captField('⏺','Durante',info.durante)+
                 _captField('⏭','Depois',info.depois)+
                 _captField('🖼','Enquadramento',info.enquad)+
                 _captField('🎙','Áudio / Som',info.audio)+
                 _captField('🔍','Detalhes',info.detalhes)+
                 _captField('✂','Transição sugerida',info.transicao)+
               '</div>'+
               '<div class="pd-ativ-must"><span class="pd-must-label">🎯 Must capture:</span><span class="pd-must-text">'+_esc(info.must)+'</span></div>'+
               (a.observacoes?'<div class="pd-ativ-obs">📝 '+_esc(a.observacoes.substring(0,200))+(a.observacoes.length>200?'…':'')+'</div>':'')+
             '</div>';
        });
      }
      h+='</div></div>';
    });
    return h+'</div>';
  }

  function _captField(icon,label,text) {
    return '<div class="pd-cpt-field"><span class="pd-cpt-icon">'+icon+'</span><div class="pd-cpt-text"><span class="pd-cpt-label">'+_esc(label)+'</span><span class="pd-cpt-val">'+_esc(text)+'</span></div></div>';
  }

  // ══════ TAB: SHOTLIST ════════════════════════════════════════════
  function _tabShotlist(d) {
    var h='<div class="pd-tab-pane pd-tab-shotlist">';
    var allAtivs=[];
    d.dias.forEach(function(day,di){ (day.atividades||[]).forEach(function(a){ allAtivs.push({a:a,dayIdx:di,dayData:day.data}); }); });
    if (!allAtivs.length) return h+_emptyState('📭','Adicione atividades para gerar a shotlist.')+'</div>';
    allAtivs.forEach(function(item,idx){
      var a=item.a;
      var nome=a.nome||_catLabel(a.categoria);
      var shots=_shotlistAtiv(a);
      var shotId='pd-shot-'+idx;
      h+='<div class="pd-shot-card" id="'+shotId+'">'+
           '<div class="pd-shot-card-head" onclick="PlanoDiretorPage.toggleShot(\''+shotId+'\')">'+
             '<div class="pd-shot-head-left">'+
               '<span class="pd-shot-emoji">'+_catEmoji(a.categoria)+'</span>'+
               '<div>'+
                 '<div class="pd-shot-name">'+_esc(nome)+'</div>'+
                 '<div class="pd-shot-meta">'+
                   '<span class="pd-chip pd-chip--cat pd-chip--xs">'+_esc(_catLabel(a.categoria))+'</span>'+
                   (item.dayData?'<span class="pd-chip pd-chip--xs">'+_esc(_fmtDataCurta(item.dayData))+'</span>':'')+
                   (a.local?'<span class="pd-chip pd-chip--xs">📍 '+_esc(a.local)+'</span>':'')+
                 '</div>'+
               '</div>'+
             '</div>'+
             '<svg class="pd-shot-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'+
           '</div>'+
           '<div class="pd-shot-body">'+
             _shotGroup('🌅','Wide / Estabelecimento',shots.wide)+
             _shotGroup('🔍','Detalhe / Textura',shots.detalhe)+
             _shotGroup('👤','Pessoas / Reação',shots.pessoas)+
             _shotGroup('🎬','Movimento / Ação',shots.movimento)+
             _shotGroup('🔊','Ambiente / Som',shots.ambiente)+
             _shotGroup('✂️','Transição',shots.transicao)+
           '</div>'+
         '</div>';
    });
    return h+'</div>';
  }

  function _shotGroup(icon,label,items) {
    return '<div class="pd-shot-group"><div class="pd-shot-group-head"><span>'+icon+'</span><span>'+_esc(label)+'</span></div><ul class="pd-shot-ul">'+items.map(function(s){ return '<li>'+_esc(s)+'</li>'; }).join('')+'</ul></div>';
  }

  // ══════ TAB: CHECKLIST ══════════════════════════════════════════
  function _tabChecklist(d) {
    var grupos=_getChecklistGrupos();
    var totalDone=0,totalAll=0;
    grupos.forEach(function(g){ g.items.forEach(function(it){ totalAll++; if(it.checked) totalDone++; }); });
    var pct=totalAll>0?Math.round(totalDone/totalAll*100):0;
    var h='<div class="pd-tab-pane pd-tab-checklist">';
    h+='<div class="pd-cl-top">'+
         '<div class="pd-cl-progress-row">'+
           '<div class="pd-cl-progress-bar-wrap"><div class="pd-cl-progress-bar" id="pd-cl-bar" style="width:'+pct+'%"></div></div>'+
           '<span class="pd-cl-pct" id="pd-cl-pct">'+pct+'%</span>'+
           '<span class="pd-cl-count" id="pd-cl-count">'+totalDone+'/'+totalAll+'</span>'+
         '</div>'+
         '<div class="pd-cl-search-row">'+
           '<div class="pd-cl-search-wrap">'+
             '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'+
             '<input type="text" class="pd-cl-search" id="pd-cl-search" placeholder="Buscar item..." value="'+_esc(_clSearch)+'" oninput="PlanoDiretorPage.searchChecklist(this.value)">'+
           '</div>'+
           '<div class="pd-cl-global-acts">'+
             '<button class="pd-cl-act-btn" onclick="PlanoDiretorPage.marcarTudo()">Tudo</button>'+
             '<button class="pd-cl-act-btn pd-cl-act-btn--outline" onclick="PlanoDiretorPage.limparChecklist()">Limpar</button>'+
           '</div>'+
         '</div>'+
       '</div>';
    grupos.forEach(function(grupo){
      var gDone=grupo.items.filter(function(it){ return it.checked; }).length;
      var gTotal=grupo.items.length;
      var gPct=gTotal>0?Math.round(gDone/gTotal*100):0;
      var gId='pd-clg-'+grupo.id;
      var filteredItems=grupo.items.filter(function(it){
        if(!_clSearch) return true;
        return it.texto.toLowerCase().indexOf(_clSearch.toLowerCase())>=0;
      });
      if (!filteredItems.length) return;
      h+='<div class="pd-cl-group" id="'+gId+'">'+
           '<div class="pd-cl-group-head" onclick="PlanoDiretorPage.toggleClGroup(\''+gId+'\')">'+
             '<div class="pd-cl-group-left">'+
               '<span class="pd-cl-group-emoji">'+grupo.emoji+'</span>'+
               '<span class="pd-cl-group-label">'+_esc(grupo.label)+'</span>'+
               '<span class="pd-cl-group-badge'+(gDone===gTotal&&gTotal>0?' pd-cl-group-badge--done':'')+'">'+gDone+'/'+gTotal+'</span>'+
             '</div>'+
             '<div class="pd-cl-group-right">'+
               '<div class="pd-cl-mini-bar"><div style="width:'+gPct+'%"></div></div>'+
               '<svg class="pd-cl-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>'+
             '</div>'+
           '</div>'+
           '<div class="pd-cl-group-body">'+
             '<div class="pd-cl-group-acts">'+
               '<button class="pd-cl-act-btn pd-cl-act-btn--sm" onclick="PlanoDiretorPage.marcarGrupo(\''+grupo.id+'\',true)">Marcar grupo</button>'+
               '<button class="pd-cl-act-btn pd-cl-act-btn--sm pd-cl-act-btn--outline" onclick="PlanoDiretorPage.marcarGrupo(\''+grupo.id+'\',false)">Limpar</button>'+
             '</div>'+
             '<ul class="pd-checklist">';
      filteredItems.forEach(function(item){
        h+='<li class="pd-check-item'+(item.checked?' pd-check-done':'')+'" data-grupo="'+_esc(grupo.id)+'" data-id="'+_esc(item.id)+'">'+
             '<label class="pd-check-label">'+
               '<input type="checkbox" class="pd-check-input" data-id="'+_esc(item.id)+'" data-grupo="'+_esc(grupo.id)+'"'+(item.checked?' checked':'')+' onchange="PlanoDiretorPage.toggleCheck(\''+_esc(item.id)+'\',\''+_esc(grupo.id)+'\')">'+
               '<span class="pd-check-box"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="2 6 5 9 10 3"/></svg></span>'+
               '<span class="pd-check-text">'+_esc(item.texto)+'</span>'+
             '</label>'+
           '</li>';
      });
      h+='</ul></div></div>';
    });
    return h+'</div>';
  }

  // ══════ TAB: EDIÇÃO ══════════════════════════════════════════════
  function _tabEdicao(d) {
    var data=_gerarEstruturaEdicao(_viagem,_itin);
    var durMin=data.durMin;
    var musica=_gerarMusicaEdicao(data.catKeys);
    var segs=[
      {t:'0:00',label:'Teaser',desc:'Melhores planos em montagem rápida — chamariz para o vídeo.'},
      {t:'0:30',label:'Abertura / título',desc:'Estabelecer destino, datas e quem está na viagem.'},
      {t:'1:00',label:'Desenvolvimento',desc:d.dias.length+' dias de viagem — sequência cronológica de '+d.totalAtiv+' atividades.'},
      {t:(durMin-2)+':00',label:'Clímax',desc:'Momento mais marcante da viagem (definir na edição).'},
      {t:durMin+':30',label:'Encerramento',desc:'Despedida, reflexão, trilha final com fade lento.'},
    ];
    var broll=['Planos de estabelecimento de cada cidade / local','Timelapse de transições de dia (céu, luz mudando)','Detalhes do destino: comida local, comércio, sinalização','Momentos de deslocamento: aeroporto, estrada, embarcações','Cotidiano dos moradores locais (com discrição e respeito)'];
    var specs=[{label:'Plataforma',value:'YouTube / Instagram Reels'},{label:'Resolução',value:'4K 2160p ou 1080p 60fps'},{label:'Codec',value:'H.264 / H.265'},{label:'Bitrate',value:'≥ 50 Mbps (4K) · 20 Mbps (1080p)'},{label:'Áudio',value:'AAC 320kbps ou PCM estéreo'},{label:'Aspecto',value:'16:9 YouTube · 9:16 Reels'},{label:'Color grade',value:data.colorPrincipal}];
    var h='<div class="pd-tab-pane pd-tab-edicao">';
    h+='<div class="pd-kpi-grid">'+
      _kpiCard('⏱',durMin+'–'+(durMin+3)+' min','Duração est.')+
      _kpiCard('🎞',String(d.totalAtiv),'Atividades')+
      _kpiCard('📆',String(d.dias.length),'Dias footage')+
      _kpiCard('🎬',String(d.totalAtiv*3),'Takes est.')+
    '</div>';
    h+='<div class="pd-note-card"><div class="pd-note-head">🎞 Estrutura Narrativa</div><div class="pd-seg-list">';
    segs.forEach(function(s,i){
      h+='<div class="pd-seg"><div class="pd-seg-time">'+s.t+'</div><div class="pd-seg-connector"><div class="pd-seg-dot"></div>'+(i<segs.length-1?'<div class="pd-seg-line"></div>':'')+'</div><div class="pd-seg-body"><div class="pd-seg-name">'+_esc(s.label)+'</div><div class="pd-seg-desc">'+_esc(s.desc)+'</div></div></div>';
    });
    h+='</div></div>';
    h+='<div class="pd-note-card"><div class="pd-note-head">🎵 Direção Musical</div>'+_textBlock(musica)+'</div>';
    h+='<div class="pd-note-card"><div class="pd-note-head">🎨 Color Grade e Pacing</div>'+_textBlock('Color grade: '+data.colorPrincipal+'\n\nPacing:\n• Atividades físicas: cortes a cada 2–3 segundos, no beat da música.\n• Paisagens: planos de 5–10 segundos, transições com dissolve.\n• Diálogo e interação: cortes de 4–8 segundos.\n\nLegendas:\n• Nome do destino no início de cada segmento de dia.\n• Data e local nos establishing shots.\n• Citação final no encerramento.')+'</div>';
    h+='<div class="pd-note-card"><div class="pd-note-head">📽 Sugestões de B-Roll</div><ul class="pd-broll-list">'+broll.map(function(b){ return '<li>'+_esc(b)+'</li>'; }).join('')+'</ul></div>';
    h+='<div class="pd-note-card"><div class="pd-note-head">📤 Especificações de Exportação</div><div class="pd-spec-grid">'+specs.map(function(s){ return '<div class="pd-spec-item"><div class="pd-spec-label">'+_esc(s.label)+'</div><div class="pd-spec-value">'+_esc(s.value)+'</div></div>'; }).join('')+'</div></div>';
    return h+'</div>';
  }

  // ══════ TAB: BACKUP ══════════════════════════════════════════════
  function _tabBackup(d) {
    var gbEst=d.dias.length*30;
    var gbHD=Math.ceil(gbEst*2.2);
    var pastas=_gerarEstruturaPastas(_itin);
    var riscos=[{sev:'alto',ico:'🔴',txt:'Cartão corrompido: NUNCA formate sem confirmar 2 cópias válidas.'},{sev:'alto',ico:'🔴',txt:'HD único: sempre manter cópia em 2 locais físicos diferentes.'},{sev:'medio',ico:'🟡',txt:'Superaquecimento: evitar HD sem ventilação em climas quentes.'},{sev:'medio',ico:'🟡',txt:'Nomenclatura incorreta: arquivos sem data/dia geram confusão na edição.'},{sev:'baixo',ico:'🟢',txt:'Falta de espaço: reservar 20% do HD como buffer sempre.'}];
    var rotina=['Ao fim do dia: transferir cartão SD para o HD externo principal.','Criar pasta /Dia-XX — NUNCA misturar dias.','Verificar integridade: reproduzir ao menos 3 arquivos por pasta.','Anotar no diário: o que foi filmado, condições e observações.','Segunda cópia em nuvem (Drive/iCloud) se internet disponível.','Somente após confirmar 2 cópias: formatar o cartão SD.','Carregar baterias da câmera e drone para o dia seguinte.'];
    var verificacao=['Reproduzir 3 arquivos aleatórios — confirmar áudio e imagem OK.','Confirmar tamanho total da pasta conforme estimado.','Verificar se a segunda cópia foi concluída com sucesso.','Formatar cartão SD somente após confirmação dupla.','Carregar todas as baterias para o dia seguinte.','Anotar no diário: número de clips, condições, destaques do dia.'];
    var h='<div class="pd-tab-pane pd-tab-backup">';
    h+='<div class="pd-kpi-grid">'+
      _kpiCard('💾','~'+gbEst+' GB','Bruto est.')+
      _kpiCard('📦',String(d.dias.length),'Dias footage')+
      _kpiCard('🗜','~'+gbHD+' GB','Com 2 cópias')+
      _kpiCard('⏱',String(d.dias.length)+' noites','Rotinas backup')+
    '</div>';
    h+='<div class="pd-note-card"><div class="pd-note-head">🔁 Rotina Diária de Backup</div><ol class="pd-step-ol">'+rotina.map(function(l){ return '<li class="pd-step-li">'+_esc(l)+'</li>'; }).join('')+'</ol></div>';
    h+='<div class="pd-note-card"><div class="pd-note-head">📁 Estrutura de Pastas</div><pre class="pd-folder-struct">'+_esc(pastas)+'</pre></div>';
    h+='<div class="pd-note-card"><div class="pd-note-head">✅ Verificação Pós-Backup</div><ul class="pd-step-ol">'+verificacao.map(function(l){ return '<li class="pd-step-li">'+_esc(l)+'</li>'; }).join('')+'</ul></div>';
    h+='<div class="pd-note-card"><div class="pd-note-head">☁️ Workflow Nuvem / HD</div>'+_textBlock('Opção A — Apenas HD externo (sem internet):\n• HD externo 1: cópia principal (organizada).\n• HD externo 2 ou cartões SD como backup secundário.\n\nOpção B — HD + Nuvem (internet disponível):\n• Upload dos melhores takes para Google Drive / iCloud.\n• Pasta /Selects para upload rápido das prioridades.\n• Material completo no HD para upload pós-viagem.\n\nSoftware recomendado:\n• Transferência: Finder / rsync no terminal.\n• Verificação: VLC para reprodução, DiskDigger para recuperação.\n• Edição: DaVinci Resolve (gratuito) ou Adobe Premiere.')+'</div>';
    h+='<div class="pd-note-card"><div class="pd-note-head">⚠️ Alertas de Risco</div><ul class="pd-risk-list">'+riscos.map(function(r){ return '<li class="pd-risk-item pd-risk--'+r.sev+'">'+r.ico+' '+_esc(r.txt)+'</li>'; }).join('')+'</ul></div>';
    return h+'</div>';
  }

  // ─── Helpers UI ───────────────────────────────────────────────────
  function _kpiCard(emoji,value,label){
    return '<div class="pd-kpi"><div class="pd-kpi-emoji">'+emoji+'</div><div class="pd-kpi-value">'+_esc(value)+'</div><div class="pd-kpi-label">'+_esc(label)+'</div></div>';
  }
  function _emptyState(icon,msg){
    return '<div class="pd-empty"><span>'+icon+'</span><p>'+_esc(msg)+'</p></div>';
  }
  function _dirCard(id,icon,titulo,conteudo){
    return '<div class="pd-dir-card" id="'+id+'"><div class="pd-dir-head"><span class="pd-dir-icon">'+icon+'</span><span class="pd-dir-title">'+_esc(titulo)+'</span></div>'+_textBlock(conteudo)+'</div>';
  }
  function _textBlock(text){
    var paras=String(text||'').split('\n');
    var html='<div class="pd-text-block">';
    paras.forEach(function(line){
      var t=line.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      if(!t.trim()){ html+='<div class="pd-text-spacer"></div>'; }
      else if(/^[\u2460-\u2473\u24F5-\u24FE①-⑨•\-–»→]/.test(line.trim())||/^\d+[:.)]/.test(line.trim())){ html+='<p class="pd-text-item">'+t+'</p>'; }
      else { html+='<p class="pd-text-para">'+t+'</p>'; }
    });
    return html+'</div>';
  }

  // ─── Coleta estado ────────────────────────────────────────────────
  function _coletarEstadoAtual(){
    var dados={updatedAt:new Date().toISOString()};
    dados.conceito    =_get('conceito',    _gerarConceito(_viagem,_itin));
    dados.tom         =_get('tom',         _gerarTomEmocional(_viagem,_itin));
    dados.cenasChave  =_get('cenasChave',  _gerarCenasChave(_viagem,_itin));
    dados.riscos      =_get('riscos',      _gerarRiscos(_viagem,_itin));
    dados.prioridades =_get('prioridades', _gerarPrioridades(_itin));
    var checklistGrupos=_getChecklistGrupos();
    document.querySelectorAll('.pd-body .pd-check-input').forEach(function(el){
      var gId=el.dataset.grupo, iId=el.dataset.id;
      if(!gId||!iId) return;
      var g=null;
      for(var i=0;i<checklistGrupos.length;i++) if(checklistGrupos[i].id===gId){ g=checklistGrupos[i]; break; }
      if(!g) return;
      var it=null;
      for(var j=0;j<g.items.length;j++) if(g.items[j].id===iId){ it=g.items[j]; break; }
      if(it) it.checked=el.checked;
    });
    dados.checklistGrupos=checklistGrupos;
    return dados;
  }

  function _refreshCLProgress(){
    var all=document.querySelectorAll('.pd-body .pd-check-input');
    var done=0,total=all.length;
    all.forEach(function(c){ if(c.checked) done++; });
    var bar=document.getElementById('pd-cl-bar');
    var pct=document.getElementById('pd-cl-pct');
    var count=document.getElementById('pd-cl-count');
    var badge=document.querySelector('.pd-tb-badge');
    var pctVal=total>0?Math.round(done/total*100):0;
    if(bar) bar.style.width=pctVal+'%';
    if(pct) pct.textContent=pctVal+'%';
    if(count) count.textContent=done+'/'+total;
    if(badge) badge.textContent=done+'/'+total;
    var grupos=_getChecklistGrupos();
    grupos.forEach(function(g){
      var gSlot=document.getElementById('pd-clg-'+g.id);
      if(!gSlot) return;
      var gAll=gSlot.querySelectorAll('.pd-check-input');
      var gDone=0;
      gAll.forEach(function(c){ if(c.checked) gDone++; });
      var gBadge=gSlot.querySelector('.pd-cl-group-badge');
      var gMini=gSlot.querySelector('.pd-cl-mini-bar div');
      if(gBadge){ gBadge.textContent=gDone+'/'+gAll.length; gBadge.classList.toggle('pd-cl-group-badge--done',gDone===gAll.length&&gAll.length>0); }
      if(gMini) gMini.style.width=(gAll.length>0?Math.round(gDone/gAll.length*100):0)+'%';
    });
  }

  function _gerarTextoCompleto(){
    var d=_computeData();
    var grupos=_getChecklistGrupos();
    var linhas=['# 🎬 Plano Diretor de Filmagem'];
    if(d.loc) linhas.push('**Destino:** '+d.loc);
    if(d.datas) linhas.push('**Datas:** '+d.datas);
    linhas.push('');
    linhas.push('## 🎨 Conceito e Narrativa'); linhas.push(_get('conceito',_gerarConceito(_viagem,_itin))); linhas.push('');
    linhas.push('## 🎭 Tom Emocional'); linhas.push(_get('tom',_gerarTomEmocional(_viagem,_itin))); linhas.push('');
    if(d.dias.length){
      linhas.push('## 📅 Captação por Atividade');
      d.dias.forEach(function(day){
        linhas.push('### '+_diaSemana(day.data)+' — '+_fmtDataCurta(day.data));
        (day.atividades||[]).forEach(function(a){
          linhas.push('#### '+_catEmoji(a.categoria)+' '+(a.nome||_catLabel(a.categoria)));
          var info=_captacaoDados(a);
          linhas.push('- **Antes:** '+info.antes);
          linhas.push('- **Durante:** '+info.durante);
          linhas.push('- **Depois:** '+info.depois);
          linhas.push('- **Enquadramento:** '+info.enquad);
          linhas.push('- **Áudio:** '+info.audio);
          linhas.push('- **Must capture:** '+info.must);
          linhas.push('');
        });
      });
      linhas.push('## 🎯 Shotlist por Atividade');
      d.dias.forEach(function(day){
        (day.atividades||[]).forEach(function(a){
          var sh=_shotlistAtiv(a);
          linhas.push('### '+_catEmoji(a.categoria)+' '+(a.nome||_catLabel(a.categoria)));
          var grps={wide:'Wide',detalhe:'Detalhe',pessoas:'Pessoas/Reação',movimento:'Movimento',ambiente:'Ambiente/Som',transicao:'Transição'};
          Object.keys(grps).forEach(function(k){ linhas.push('**'+grps[k]+':**'); (sh[k]||[]).forEach(function(s){ linhas.push('- '+s); }); });
          linhas.push('');
        });
      });
    }
    linhas.push('## ⚙️ Checklist Técnico');
    grupos.forEach(function(g){
      linhas.push('### '+g.emoji+' '+g.label);
      g.items.forEach(function(i){ linhas.push((i.checked?'- [x] ':'- [ ] ')+i.texto); });
      linhas.push('');
    });
    return linhas.join('\n');
  }

  // ─── API pública ──────────────────────────────────────────────────
  return {
    render: render,

    switchTab: function(tabId){
      _activeTab=tabId;
      _saveStoredTab(_tripId,tabId);
      document.querySelectorAll('.pd-tab').forEach(function(b){
        var active=b.dataset.tab===tabId;
        b.classList.toggle('pd-tab--active',active);
        b.setAttribute('aria-selected',active?'true':'false');
      });
      var body=document.getElementById('pd-body');
      if(body) body.innerHTML=_renderActiveTab();
    },

    toggleShot: function(shotId){
      var el=document.getElementById(shotId);
      if(el) el.classList.toggle('pd-shot-card--open');
    },

    toggleClGroup: function(groupId){
      var el=document.getElementById(groupId);
      if(el) el.classList.toggle('pd-cl-group--open');
    },

    toggleCheck: function(id,grupoId){
      var input=document.querySelector('.pd-body .pd-check-input[data-id="'+id+'"]');
      if(!input) return;
      var item=input.closest('.pd-check-item');
      if(item) input.checked?item.classList.add('pd-check-done'):item.classList.remove('pd-check-done');
      _refreshCLProgress();
    },

    marcarGrupo: function(grupoId,state){
      var gEl=document.getElementById('pd-clg-'+grupoId);
      if(!gEl) return;
      gEl.querySelectorAll('.pd-check-input').forEach(function(el){
        el.checked=state;
        var li=el.closest('.pd-check-item');
        if(li) state?li.classList.add('pd-check-done'):li.classList.remove('pd-check-done');
      });
      _refreshCLProgress();
    },

    marcarTudo: function(){
      document.querySelectorAll('.pd-body .pd-check-input').forEach(function(el){
        el.checked=true;
        var li=el.closest('.pd-check-item');
        if(li) li.classList.add('pd-check-done');
      });
      _refreshCLProgress();
    },

    limparChecklist: function(){
      document.querySelectorAll('.pd-body .pd-check-input').forEach(function(el){
        el.checked=false;
        var li=el.closest('.pd-check-item');
        if(li) li.classList.remove('pd-check-done');
      });
      _refreshCLProgress();
    },

    searchChecklist: function(val){
      _clSearch=val;
      var body=document.getElementById('pd-body');
      if(body&&_activeTab==='checklist') body.innerHTML=_tabChecklist(_computeData());
    },

    salvar: function(){
      if(!_tripId) return;
      var dados=_coletarEstadoAtual();
      _salvarPlano(_tripId,dados);
      _planoSalvo=dados;
      var btn=document.getElementById('pd-btn-salvar');
      if(btn){ var sp=btn.querySelector('span'); if(sp){ sp.textContent='Salvo!'; setTimeout(function(){ sp.textContent='Salvar'; },2200); } }
    },

    resetar: function(){
      if(!window.confirm('Resetar o plano? Checklist e dados serão perdidos.')) return;
      _salvarPlano(_tripId,null);
      _planoSalvo=null;
      var viagem=window.Store?Store.getViagemSelecionada():null;
      var container=document.getElementById('page-container');
      if(viagem&&container) render(viagem,container);
    },

    copiarBriefing: function(){
      var txt=_gerarTextoCompleto();
      var btn=document.getElementById('pd-btn-copiar');
      var sp=btn?btn.querySelector('span'):null;
      var fallback=function(){ var ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); };
      try{ if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).catch(fallback); else fallback(); }catch(e){ fallback(); }
      if(sp){ sp.textContent='Copiado!'; setTimeout(function(){ sp.textContent='Copiar'; },2500); }
    },

    exportarMarkdown: function(){
      var txt=_gerarTextoCompleto();
      var nome=(_viagem&&_viagem.nome)?_viagem.nome.toLowerCase().replace(/\s+/g,'-'):'viagem';
      var blob=new Blob([txt],{type:'text/markdown; charset=utf-8'});
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=url; a.download='plano-diretor-'+nome+'.md'; a.click();
      URL.revokeObjectURL(url);
    },
  };

})();
