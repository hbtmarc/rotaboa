// ===================================================
// packingCatalog.js v2 — Catalogo base de itens de bagagem
// ===================================================

var PackingCatalog = (function () {

  var _LS_CUSTOM  = 'rotaboa.bagagem.catalog.custom.v1';
  var _LS_HIDDEN  = 'rotaboa.bagagem.catalog.hidden.v1';

  var _customItems = (function () {
    try { return JSON.parse(localStorage.getItem(_LS_CUSTOM) || '[]'); } catch (e) { return []; }
  }());
  var _hiddenIds = (function () {
    try { return JSON.parse(localStorage.getItem(_LS_HIDDEN) || '[]'); } catch (e) { return []; }
  }());

  function _saveCustom() { try { localStorage.setItem(_LS_CUSTOM, JSON.stringify(_customItems)); } catch (e) {} }
  function _saveHidden() { try { localStorage.setItem(_LS_HIDDEN, JSON.stringify(_hiddenIds)); } catch (e) {} }

  var BASE = [
    // DOCUMENTOS
    { id:'doc-rg',            nome:'RG',                              emoji:'📄', categoria:'Documentos', subcategoria:'Identidade',     tags:['docs','identidade'],                sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'doc-cnh',           nome:'CNH',                             emoji:'📄', categoria:'Documentos', subcategoria:'Identidade',     tags:['docs','carro','identidade'],        sugestaoPara:['carro','estrada'],           qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'Obrigatoria se for dirigir' },
    { id:'doc-passaporte',    nome:'Passaporte',                      emoji:'📘', categoria:'Documentos', subcategoria:'Identidade',     tags:['docs','internacional'],             sugestaoPara:['internacional'],             qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'doc-carro',         nome:'Documento do carro (CRLV)',       emoji:'📄', categoria:'Documentos', subcategoria:'Veiculo',        tags:['docs','carro'],                     sugestaoPara:['carro','estrada'],           qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'doc-seguro-car',    nome:'Seguro do carro (apolice)',       emoji:'📄', categoria:'Documentos', subcategoria:'Veiculo',        tags:['docs','carro'],                     sugestaoPara:['carro','estrada'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'App da seguradora' },
    { id:'doc-plano',         nome:'Cartao do plano de saude',        emoji:'💳', categoria:'Documentos', subcategoria:'Saude',          tags:['docs','saude'],                     sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'doc-checkin',       nome:'Confirmacao de reserva',          emoji:'📋', categoria:'Documentos', subcategoria:'Hospedagem',     tags:['docs','hospedagem'],                sugestaoPara:['hospedagem'],                qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'Print ou e-mail offline' },
    { id:'doc-vacina',        nome:'Cartao de vacinacao',             emoji:'💉', categoria:'Documentos', subcategoria:'Saude',          tags:['docs','saude','internacional'],     sugestaoPara:['internacional','pet'],       qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'doc-emergencia',    nome:'Contatos de emergencia',          emoji:'📋', categoria:'Documentos', subcategoria:'Seguranca',      tags:['docs','emergencia'],                sugestaoPara:['trilha','natureza'],         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Util em areas sem sinal' },
    // DINHEIRO
    { id:'din-dinheiro',      nome:'Dinheiro (notas pequenas)',       emoji:'💵', categoria:'Dinheiro',   subcategoria:'Cash',           tags:['dinheiro'],                         sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'Feiras e mercadinhos' },
    { id:'din-credito',       nome:'Cartao de credito',               emoji:'💳', categoria:'Dinheiro',   subcategoria:'Cartao',         tags:['dinheiro','cartao'],                sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'din-debito',        nome:'Cartao de debito',                emoji:'💳', categoria:'Dinheiro',   subcategoria:'Cartao',         tags:['dinheiro','cartao'],                sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'din-prepago',       nome:'Cartao pre-pago / viagem',        emoji:'💳', categoria:'Dinheiro',   subcategoria:'Cartao',         tags:['dinheiro','cartao','internacional'],sugestaoPara:['internacional'],             qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'din-troco',         nome:'Troco (moedas)',                  emoji:'🪙', categoria:'Dinheiro',   subcategoria:'Cash',           tags:['dinheiro'],                         sugestaoPara:['carro','estrada'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Pedagios e estacionamentos' },
    // ROUPAS UNISSEX
    { id:'rou-camiseta',      nome:'Camisetas',                       emoji:'👕', categoria:'Roupas',     subcategoria:'Unissex',        tags:['roupa','calor'],                    sugestaoPara:['*'],                         qtdPadrao:3, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'rou-regata',        nome:'Regatas',                         emoji:'👕', categoria:'Roupas',     subcategoria:'Unissex',        tags:['roupa','calor','praia'],            sugestaoPara:['praia','calor'],             qtdPadrao:2, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-shorts',        nome:'Shorts',                          emoji:'🩳', categoria:'Roupas',     subcategoria:'Unissex',        tags:['roupa','calor'],                    sugestaoPara:['calor','praia'],             qtdPadrao:2, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-calca',         nome:'Calca comprida',                  emoji:'👖', categoria:'Roupas',     subcategoria:'Unissex',        tags:['roupa','frio','passeio'],           sugestaoPara:['frio','trilha'],             qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-legging',       nome:'Legging',                         emoji:'👖', categoria:'Roupas',     subcategoria:'Unissex',        tags:['roupa','trilha','esporte','frio'],  sugestaoPara:['trilha','esporte','frio'],   qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-pijama',        nome:'Pijama',                          emoji:'🌙', categoria:'Roupas',     subcategoria:'Unissex',        tags:['roupa','noite'],                    sugestaoPara:['hospedagem'],                qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-chinelo',       nome:'Chinelo',                         emoji:'🩴', categoria:'Roupas',     subcategoria:'Calcado',        tags:['roupa','calcado'],                  sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-tenis',         nome:'Tenis de passeio',                emoji:'👟', categoria:'Roupas',     subcategoria:'Calcado',        tags:['roupa','calcado','passeio'],        sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-meia',          nome:'Meias',                           emoji:'🧦', categoria:'Roupas',     subcategoria:'Unissex',        tags:['roupa'],                            sugestaoPara:['*'],                         qtdPadrao:3, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-oculos',        nome:'Oculos de sol',                   emoji:'🕶', categoria:'Roupas',     subcategoria:'Acessorio',      tags:['roupa','calor','praia'],            sugestaoPara:['praia','cachoeira','calor'], qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-bone',          nome:'Bone / chapeu',                   emoji:'🧢', categoria:'Roupas',     subcategoria:'Acessorio',      tags:['roupa','calor','trilha'],           sugestaoPara:['trilha','calor','praia'],    qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-cinto',         nome:'Cinto',                           emoji:'👔', categoria:'Roupas',     subcategoria:'Acessorio',      tags:['roupa','passeio','jantar'],         sugestaoPara:['jantar','evento'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-relogio',       nome:'Relogio',                         emoji:'⌚',     categoria:'Roupas',     subcategoria:'Acessorio',      tags:['roupa'],                            sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-mochila-dia',   nome:'Mochila do dia / daypack',        emoji:'🎒', categoria:'Roupas',     subcategoria:'Bolsa',          tags:['roupa','trilha'],                   sugestaoPara:['trilha','natureza'],         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // MASCULINO
    { id:'rou-cueca',         nome:'Cuecas',                          emoji:'🩲', categoria:'Roupas',     subcategoria:'Masculino',      tags:['roupa','masc','intimo'],            sugestaoPara:['*'],                         qtdPadrao:4, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'rou-camisa',        nome:'Camisa social / look',            emoji:'👔', categoria:'Roupas',     subcategoria:'Masculino',      tags:['roupa','masc','jantar','evento'],   sugestaoPara:['jantar','evento'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-polo',          nome:'Camisa polo',                     emoji:'👕', categoria:'Roupas',     subcategoria:'Masculino',      tags:['roupa','masc','passeio'],           sugestaoPara:['passeio'],                   qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-sunga',         nome:'Sunga',                           emoji:'🩲', categoria:'Roupas',     subcategoria:'Masculino',      tags:['roupa','masc','banho','praia'],     sugestaoPara:['praia','cachoeira','piscina'],qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-bermuda-trilha',nome:'Bermuda de trilha',               emoji:'🩳', categoria:'Roupas',     subcategoria:'Masculino',      tags:['roupa','masc','trilha'],            sugestaoPara:['trilha','natureza'],         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // FEMININO
    { id:'rou-calcinha',      nome:'Calcinhas',                       emoji:'🩲', categoria:'Roupas',     subcategoria:'Feminino',       tags:['roupa','fem','intimo'],             sugestaoPara:['*'],                         qtdPadrao:4, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'rou-sutia',         nome:'Sutia',                           emoji:'👙', categoria:'Roupas',     subcategoria:'Feminino',       tags:['roupa','fem','intimo'],             sugestaoPara:['*'],                         qtdPadrao:2, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'rou-sutia-esporte', nome:'Sutia esportivo',                 emoji:'👙', categoria:'Roupas',     subcategoria:'Feminino',       tags:['roupa','fem','esporte','trilha'],   sugestaoPara:['trilha','esporte'],          qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-vestido',       nome:'Vestido / look',                  emoji:'👗', categoria:'Roupas',     subcategoria:'Feminino',       tags:['roupa','fem','jantar','evento'],    sugestaoPara:['jantar','evento'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-sandalia',      nome:'Sandalia',                        emoji:'👡', categoria:'Roupas',     subcategoria:'Feminino',       tags:['roupa','fem','calcado'],            sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'rou-biquini',       nome:'Biquini',                         emoji:'👙', categoria:'Roupas',     subcategoria:'Feminino',       tags:['roupa','fem','banho','praia'],      sugestaoPara:['praia','cachoeira','piscina'],qtdPadrao:2, obrigatorioPadrao:false, observacaoPadrao:'' },
    // FRIO E CHUVA
    { id:'fri-casaco',        nome:'Casaco / jaqueta',                emoji:'🧥', categoria:'Frio e Chuva', subcategoria:'Frio',         tags:['frio','roupa','noite'],             sugestaoPara:['frio','serra','noite'],      qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Sao Thome esfria a noite' },
    { id:'fri-moletom',       nome:'Moletom / blusa de la',           emoji:'🧶', categoria:'Frio e Chuva', subcategoria:'Frio',         tags:['frio','roupa'],                     sugestaoPara:['frio','serra'],              qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'fri-corta-vento',   nome:'Corta-vento',                     emoji:'🧥', categoria:'Frio e Chuva', subcategoria:'Frio',         tags:['frio','roupa','trilha'],            sugestaoPara:['trilha','frio'],             qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Leve e compacto' },
    { id:'fri-meia-grossa',   nome:'Meia grossa',                     emoji:'🧦', categoria:'Frio e Chuva', subcategoria:'Frio',         tags:['frio','roupa'],                     sugestaoPara:['frio','serra','trilha'],     qtdPadrao:2, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'fri-luva',          nome:'Luva / gorro',                    emoji:'🧤', categoria:'Frio e Chuva', subcategoria:'Frio',         tags:['frio','roupa'],                     sugestaoPara:['frio'],                      qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'fri-capa',          nome:'Capa de chuva / poncho',          emoji:'🌧', categoria:'Frio e Chuva', subcategoria:'Chuva',        tags:['chuva','trilha','roupa'],           sugestaoPara:['chuva','trilha','natureza'], qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'fri-guarda',        nome:'Guarda-chuva compacto',           emoji:'☂',     categoria:'Frio e Chuva', subcategoria:'Chuva',        tags:['chuva'],                            sugestaoPara:['chuva'],                     qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'fri-termico',       nome:'Garrafa termica',                 emoji:'🧉', categoria:'Frio e Chuva', subcategoria:'Frio',         tags:['frio'],                             sugestaoPara:['frio','serra'],              qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Cafe / cha quente no frio' },
    { id:'fri-cobertor',      nome:'Cobertor de viagem compacto',     emoji:'🛏', categoria:'Frio e Chuva', subcategoria:'Conforto',     tags:['frio','carro'],                     sugestaoPara:['frio','carro'],              qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // BANHO E AGUA
    { id:'ban-toalha',        nome:'Toalha de banho',                 emoji:'🏊', categoria:'Banho e Agua', subcategoria:'Toalha',       tags:['banho','hospedagem'],               sugestaoPara:['hospedagem'],                qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'ban-microfibra',    nome:'Toalha de microfibra',            emoji:'🏊', categoria:'Banho e Agua', subcategoria:'Toalha',       tags:['banho','trilha','praia','cachoeira'],sugestaoPara:['trilha','praia','cachoeira'],qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Compacta, seca rapido' },
    { id:'ban-saco-imper',    nome:'Saco impermeavel',                emoji:'💧', categoria:'Banho e Agua', subcategoria:'Organizacao',  tags:['banho','trilha','cachoeira'],       sugestaoPara:['cachoeira','trilha','praia'],qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Roupa molhada' },
    { id:'ban-chinelo-agua',  nome:'Chinelo aquatico',                emoji:'🩴', categoria:'Banho e Agua', subcategoria:'Calcado',      tags:['banho','cachoeira','praia'],        sugestaoPara:['cachoeira','praia'],         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Pedras e superficies molhadas' },
    { id:'ban-oculos-nat',    nome:'Oculos de natacao',               emoji:'🥽', categoria:'Banho e Agua', subcategoria:'Acessorio',    tags:['banho','piscina','praia'],          sugestaoPara:['piscina'],                   qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // HIGIENE
    { id:'hig-escova',        nome:'Escova de dente + pasta',         emoji:'🪵', categoria:'Higiene', subcategoria:'Oral',             tags:['higiene'],                          sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'hig-fio-dental',    nome:'Fio dental',                      emoji:'🦷', categoria:'Higiene', subcategoria:'Oral',             tags:['higiene'],                          sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hig-enxaguante',    nome:'Enxaguante bucal',                emoji:'🪵', categoria:'Higiene', subcategoria:'Oral',             tags:['higiene'],                          sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hig-sabonete',      nome:'Sabonete',                        emoji:'🧼', categoria:'Higiene', subcategoria:'Corpo',            tags:['higiene'],                          sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'hig-shampoo',       nome:'Shampoo',                         emoji:'🧴', categoria:'Higiene', subcategoria:'Cabelo',           tags:['higiene','cabelo'],                 sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'hig-condicionador', nome:'Condicionador',                   emoji:'🧴', categoria:'Higiene', subcategoria:'Cabelo',           tags:['higiene','cabelo'],                 sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hig-desodorante',   nome:'Desodorante',                     emoji:'🧴', categoria:'Higiene', subcategoria:'Corpo',            tags:['higiene'],                          sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'hig-barbeador',     nome:'Barbeador / aparelho',            emoji:'🪲', categoria:'Higiene', subcategoria:'Masculino',        tags:['higiene','masc'],                   sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hig-creme-barb',    nome:'Creme de barbear',                emoji:'🧴', categoria:'Higiene', subcategoria:'Masculino',        tags:['higiene','masc'],                   sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hig-absorvente',    nome:'Absorvente',                      emoji:'🩸', categoria:'Higiene', subcategoria:'Feminino',         tags:['higiene','fem'],                    sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hig-lenco-umid',    nome:'Lenco umedecido',                 emoji:'🧻', categoria:'Higiene', subcategoria:'Praticidade',      tags:['higiene'],                          sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hig-papel',         nome:'Papel higienico extra',           emoji:'🧻', categoria:'Higiene', subcategoria:'Praticidade',      tags:['higiene','trilha'],                 sugestaoPara:['trilha','camping'],          qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Sem papel em trilhas' },
    { id:'hig-gel',           nome:'Alcool gel',                      emoji:'🧴', categoria:'Higiene', subcategoria:'Praticidade',      tags:['higiene'],                          sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hig-pente',         nome:'Pente / escova de cabelo',        emoji:'💆', categoria:'Higiene', subcategoria:'Cabelo',           tags:['higiene','cabelo'],                 sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hig-cortador-unha', nome:'Cortador de unhas',               emoji:'✂',     categoria:'Higiene', subcategoria:'Praticidade',      tags:['higiene'],                          sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hig-repelente',     nome:'Repelente',                       emoji:'🦟', categoria:'Higiene', subcategoria:'Protecao',         tags:['higiene','trilha','natureza'],      sugestaoPara:['trilha','natureza','cachoeira'],qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hig-algodao',       nome:'Cotonete / algodao',              emoji:'🧻', categoria:'Higiene', subcategoria:'Praticidade',      tags:['higiene'],                          sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hig-secador',       nome:'Secador de cabelo de viagem',     emoji:'💆', categoria:'Higiene', subcategoria:'Cabelo',           tags:['higiene','cabelo'],                 sugestaoPara:['hospedagem'],                qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Se a hospedagem nao fornecer' },
    // BELEZA
    { id:'bel-protetor',      nome:'Protetor solar FPS 50+',          emoji:'☀',     categoria:'Beleza', subcategoria:'Solar',             tags:['beleza','solar','trilha','praia'],  sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'bel-labial',        nome:'Protetor labial FPS',             emoji:'💄', categoria:'Beleza', subcategoria:'Pele',              tags:['beleza','solar'],                   sugestaoPara:['trilha','praia','frio'],     qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'bel-hidratante',    nome:'Hidratante corporal',             emoji:'🧴', categoria:'Beleza', subcategoria:'Pele',              tags:['beleza'],                           sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'bel-hidratante-f',  nome:'Hidratante facial',               emoji:'🧴', categoria:'Beleza', subcategoria:'Pele',              tags:['beleza','fem'],                     sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'bel-perfume',       nome:'Perfume',                         emoji:'🌸', categoria:'Beleza', subcategoria:'Fragrancia',        tags:['beleza','jantar','evento'],         sugestaoPara:['jantar','evento'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'bel-maquiagem',     nome:'Maquiagem compacta',              emoji:'💄', categoria:'Beleza', subcategoria:'Feminino',          tags:['beleza','fem','jantar'],            sugestaoPara:['jantar','evento'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Base, blush, rimel, batom' },
    { id:'bel-demaquilante',  nome:'Demaquilante',                    emoji:'🧴', categoria:'Beleza', subcategoria:'Feminino',          tags:['beleza','fem'],                     sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'bel-leavein',       nome:'Leave-in / finalizador',          emoji:'💆', categoria:'Beleza', subcategoria:'Cabelo',            tags:['beleza','cabelo'],                  sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'bel-elastico',      nome:'Elastico / grampinho',            emoji:'💆', categoria:'Beleza', subcategoria:'Cabelo',            tags:['beleza','cabelo'],                  sugestaoPara:['trilha','natureza'],         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'bel-esmalte',       nome:'Esmalte',                         emoji:'💅', categoria:'Beleza', subcategoria:'Feminino',          tags:['beleza','fem'],                     sugestaoPara:['jantar','evento'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'bel-bronzeador',    nome:'Bronzeador',                      emoji:'☀',     categoria:'Beleza', subcategoria:'Solar',             tags:['beleza','praia'],                   sugestaoPara:['praia'],                     qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'bel-pos-sol',       nome:'Hidratante pos-sol',              emoji:'🧴', categoria:'Beleza', subcategoria:'Solar',             tags:['beleza','praia','solar'],           sugestaoPara:['praia','calor'],             qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'bel-necessaire',    nome:'Necessaire',                      emoji:'👜', categoria:'Beleza', subcategoria:'Organizacao',       tags:['beleza','organizacao'],             sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // FARMACIA
    { id:'far-dipirona',      nome:'Dipirona / paracetamol',          emoji:'💊', categoria:'Farmacia', subcategoria:'Analgesico',      tags:['farmacia','saude'],                 sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'far-antiinfla',     nome:'Anti-inflamatorio',               emoji:'💊', categoria:'Farmacia', subcategoria:'Analgesico',      tags:['farmacia','saude'],                 sugestaoPara:['trilha'],                    qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'far-alergico',      nome:'Antialergico (loratadina)',        emoji:'💊', categoria:'Farmacia', subcategoria:'Alergia',         tags:['farmacia','saude'],                 sugestaoPara:['natureza','trilha'],         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'far-antiacido',     nome:'Antiacido',                       emoji:'💊', categoria:'Farmacia', subcategoria:'Digestivo',       tags:['farmacia','saude'],                 sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'far-enjoo',         nome:'Remedio para enjoo',              emoji:'💊', categoria:'Farmacia', subcategoria:'Viagem',          tags:['farmacia','saude','carro','serra'], sugestaoPara:['carro','estrada','serra'],   qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Dramin - tomar antes de entrar no carro' },
    { id:'far-antidiarreico', nome:'Antidiarreico',                   emoji:'💊', categoria:'Farmacia', subcategoria:'Digestivo',       tags:['farmacia','saude'],                 sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'far-bandaid',       nome:'Band-aid sortido',                emoji:'🩹', categoria:'Farmacia', subcategoria:'Primeiros Socorros', tags:['farmacia','trilha'],              sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'far-atadura',       nome:'Atadura elastica',                emoji:'🩹', categoria:'Farmacia', subcategoria:'Primeiros Socorros', tags:['farmacia','trilha'],              sugestaoPara:['trilha','esporte'],          qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'far-alcool70',      nome:'Alcool 70% / antisseptico',       emoji:'🧴', categoria:'Farmacia', subcategoria:'Primeiros Socorros', tags:['farmacia'],                       sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'far-pinca',         nome:'Pinca (espinhos / carrapatos)',   emoji:'🔧', categoria:'Farmacia', subcategoria:'Primeiros Socorros', tags:['farmacia','trilha'],              sugestaoPara:['trilha','natureza'],         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'far-termometro',    nome:'Termometro',                      emoji:'🌡', categoria:'Farmacia', subcategoria:'Diagnostico',     tags:['farmacia'],                         sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'far-reidratante',   nome:'Reidratante oral',                emoji:'💊', categoria:'Farmacia', subcategoria:'Hidratacao',      tags:['farmacia','trilha','esporte'],      sugestaoPara:['trilha','esporte'],          qtdPadrao:2, obrigatorioPadrao:false, observacaoPadrao:'Ampola ou po' },
    { id:'far-pomada',        nome:'Pomada cicatrizante',             emoji:'🧴', categoria:'Farmacia', subcategoria:'Primeiros Socorros', tags:['farmacia','trilha'],              sugestaoPara:['trilha','natureza'],         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // ELETRONICOS
    { id:'ele-celular',       nome:'Celular',                         emoji:'📱', categoria:'Eletronicos', subcategoria:'Dispositivo',  tags:['eletro'],                           sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'ele-carregador',    nome:'Carregador de celular',           emoji:'🔌', categoria:'Eletronicos', subcategoria:'Energia',      tags:['eletro'],                           sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'ele-powerbank',     nome:'Powerbank',                       emoji:'🔋', categoria:'Eletronicos', subcategoria:'Energia',      tags:['eletro','trilha'],                  sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Essencial em trilhas longas' },
    { id:'ele-cabo-usbc',     nome:'Cabo USB-C',                      emoji:'🔌', categoria:'Eletronicos', subcategoria:'Cabo',         tags:['eletro'],                           sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'ele-adaptador',     nome:'Adaptador de tomada',             emoji:'🔌', categoria:'Eletronicos', subcategoria:'Energia',      tags:['eletro','hospedagem'],              sugestaoPara:['hospedagem'],                qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Tipo N (padrao BR)' },
    { id:'ele-extensao',      nome:'Extensao / regua de tomadas',     emoji:'🔌', categoria:'Eletronicos', subcategoria:'Energia',      tags:['eletro','hospedagem','trabalho'],   sugestaoPara:['hospedagem','trabalho'],    qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'ele-fone',          nome:'Fone de ouvido',                  emoji:'🎧', categoria:'Eletronicos', subcategoria:'Audio',        tags:['eletro'],                           sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'ele-notebook',      nome:'Notebook + carregador',           emoji:'💻', categoria:'Eletronicos', subcategoria:'Dispositivo',  tags:['eletro','trabalho'],                sugestaoPara:['trabalho'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'ele-camera',        nome:'Camera fotografica',              emoji:'📷', categoria:'Eletronicos', subcategoria:'Fotografia',   tags:['eletro','foto'],                    sugestaoPara:['natureza','praia','evento'], qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'ele-carregvei',     nome:'Carregador veicular',             emoji:'🚗', categoria:'Eletronicos', subcategoria:'Energia',      tags:['eletro','carro'],                   sugestaoPara:['carro','estrada'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'ele-suporte-cel',   nome:'Suporte celular painel',          emoji:'🚗', categoria:'Eletronicos', subcategoria:'Carro',        tags:['eletro','carro'],                   sugestaoPara:['carro','estrada'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'GPS / Waze' },
    { id:'ele-smartwatch',    nome:'Smartwatch + carregador',         emoji:'⌚',     categoria:'Eletronicos', subcategoria:'Dispositivo',  tags:['eletro','esporte'],                 sugestaoPara:['esporte','trilha'],          qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'ele-caixinha',      nome:'Caixinha de som portatil',        emoji:'🔊', categoria:'Eletronicos', subcategoria:'Audio',        tags:['eletro'],                           sugestaoPara:['praia','camping'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'ele-drone',         nome:'Drone + baterias',                emoji:'🚁', categoria:'Eletronicos', subcategoria:'Fotografia',   tags:['eletro','foto'],                    sugestaoPara:['natureza','praia'],          qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'ele-gopro',         nome:'GoPro + acessorios',              emoji:'📷', categoria:'Eletronicos', subcategoria:'Fotografia',   tags:['eletro','foto','esporte'],          sugestaoPara:['trilha','praia','esporte'],  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'ele-hub-usb',       nome:'Hub USB',                         emoji:'🔌', categoria:'Eletronicos', subcategoria:'Periferico',   tags:['eletro','trabalho'],                sugestaoPara:['trabalho'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // CARRO
    { id:'car-agua-gal',      nome:'Galao de agua (5 L)',             emoji:'💧', categoria:'Carro', subcategoria:'Hidratacao',          tags:['carro','estrada'],                  sugestaoPara:['carro','estrada'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Emergencia e limpeza' },
    { id:'car-snacks',        nome:'Snacks de estrada',               emoji:'🍫', categoria:'Carro', subcategoria:'Alimentacao',         tags:['carro','estrada'],                  sugestaoPara:['carro','estrada'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'car-lixo',          nome:'Saco de lixo',                    emoji:'🗑', categoria:'Carro', subcategoria:'Organizacao',         tags:['carro'],                            sugestaoPara:['carro','estrada'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'car-pano',          nome:'Pano velho / toalha para areia',  emoji:'🧹', categoria:'Carro', subcategoria:'Organizacao',         tags:['carro','praia','trilha'],           sugestaoPara:['carro','trilha','praia'],   qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Banco sujo apos trilha ou praia' },
    { id:'car-estepe',        nome:'Estepe calibrado',                emoji:'🔧', categoria:'Carro', subcategoria:'Emergencia',          tags:['carro','seguranca'],                sugestaoPara:['carro'],                     qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'Verificar antes' },
    { id:'car-triangulo',     nome:'Triangulo',                       emoji:'⚠',     categoria:'Carro', subcategoria:'Emergencia',          tags:['carro','seguranca'],                sugestaoPara:['carro'],                     qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'car-macaco',        nome:'Macaco + chave de roda',          emoji:'🔧', categoria:'Carro', subcategoria:'Emergencia',          tags:['carro','seguranca'],                sugestaoPara:['carro'],                     qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'car-cabo-aux',      nome:'Cabo auxiliar (liga carro)',      emoji:'🔋', categoria:'Carro', subcategoria:'Emergencia',          tags:['carro','seguranca'],                sugestaoPara:['carro'],                     qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'car-almofada',      nome:'Almofada de viagem (carro)',      emoji:'🛏', categoria:'Carro', subcategoria:'Conforto',            tags:['carro','conforto'],                 sugestaoPara:['carro'],                     qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'car-roupa-seca',    nome:'Muda de roupa seca (carro)',      emoji:'👕', categoria:'Carro', subcategoria:'Organizacao',         tags:['carro','trilha','praia'],           sugestaoPara:['carro','trilha','praia'],   qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Reserva apos trilha / cachoeira' },
    { id:'car-mapa-off',      nome:'Mapa offline baixado (Google)',   emoji:'🗺', categoria:'Carro', subcategoria:'Navegacao',           tags:['carro','navegacao'],                sugestaoPara:['carro'],                     qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // TRILHA
    { id:'tri-lanterna',      nome:'Lanterna / head lamp',            emoji:'🔦', categoria:'Trilha', subcategoria:'Seguranca',          tags:['trilha','natureza'],                sugestaoPara:['trilha','natureza','camping'],qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'tri-canivete',      nome:'Canivete / faca',                 emoji:'🔪', categoria:'Trilha', subcategoria:'Seguranca',          tags:['trilha','natureza'],                sugestaoPara:['trilha','camping'],          qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'tri-apito',         nome:'Apito',                           emoji:'🔔', categoria:'Trilha', subcategoria:'Seguranca',          tags:['trilha','seguranca'],               sugestaoPara:['trilha'],                    qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Emergencia em trilha' },
    { id:'tri-garrafa',       nome:'Garrafa de agua (1,5 L)',         emoji:'💧', categoria:'Trilha', subcategoria:'Hidratacao',         tags:['trilha','agua'],                    sugestaoPara:['trilha','natureza'],         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'tri-snack',         nome:'Snacks energeticos / barrinha',   emoji:'🍫', categoria:'Trilha', subcategoria:'Alimentacao',        tags:['trilha','energia'],                 sugestaoPara:['trilha'],                    qtdPadrao:2, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'tri-tenis-trail',   nome:'Tenis trail / trekking',          emoji:'👟', categoria:'Trilha', subcategoria:'Calcado',            tags:['trilha','calcado'],                 sugestaoPara:['trilha','natureza'],         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'tri-meia-alta',     nome:'Meias altas (trilha)',            emoji:'🧦', categoria:'Trilha', subcategoria:'Roupa',              tags:['trilha','roupa'],                   sugestaoPara:['trilha'],                    qtdPadrao:2, obrigatorioPadrao:false, observacaoPadrao:'Evita arranhoes de vegetacao' },
    { id:'tri-mapa',          nome:'Mapa da trilha (impresso/offline)',emoji:'🗺',categoria:'Trilha', subcategoria:'Navegacao',          tags:['trilha'],                           sugestaoPara:['trilha'],                    qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Areas sem sinal' },
    { id:'tri-bastao',        nome:'Bastao de caminhada',             emoji:'🪄', categoria:'Trilha', subcategoria:'Equipamento',        tags:['trilha'],                           sugestaoPara:['trilha'],                    qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'tri-dryfit',        nome:'Camiseta dry-fit',                emoji:'👕', categoria:'Trilha', subcategoria:'Roupa',              tags:['trilha','roupa'],                   sugestaoPara:['trilha','esporte'],          qtdPadrao:2, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'tri-filtro-agua',   nome:'Filtro / purificador de agua',    emoji:'💧', categoria:'Trilha', subcategoria:'Hidratacao',         tags:['trilha','agua','camping'],          sugestaoPara:['trilha'],                    qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Para trilhas longas ou camping' },
    // HOSPEDAGEM
    { id:'hos-cadeado',       nome:'Cadeado (mochilao)',              emoji:'🔒', categoria:'Hospedagem', subcategoria:'Seguranca',      tags:['hospedagem'],                       sugestaoPara:['hostel','mochilao'],         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hos-chinelo-hig',   nome:'Chinelo de banho',                emoji:'🩴', categoria:'Hospedagem', subcategoria:'Higiene',        tags:['hospedagem'],                       sugestaoPara:['hospedagem'],                qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Para banheiro coletivo' },
    { id:'hos-travesseiro',   nome:'Travesseiro inflavel de viagem',  emoji:'🛏', categoria:'Hospedagem', subcategoria:'Conforto',       tags:['hospedagem','carro'],               sugestaoPara:['carro'],                     qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hos-prot-ouvido',   nome:'Protetor de ouvidos',             emoji:'🔇', categoria:'Hospedagem', subcategoria:'Conforto',       tags:['hospedagem'],                       sugestaoPara:['hospedagem'],                qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Roncos / barulho do hotel' },
    { id:'hos-mascara-dorm',  nome:'Mascara de dormir',               emoji:'😴', categoria:'Hospedagem', subcategoria:'Conforto',       tags:['hospedagem','carro'],               sugestaoPara:['hospedagem','carro'],        qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hos-saco-dormir',   nome:'Saco de dormir compacto',         emoji:'🛏', categoria:'Hospedagem', subcategoria:'Conforto',       tags:['hospedagem','camping','frio'],      sugestaoPara:['camping','frio'],            qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'hos-repelente-tom', nome:'Repelente eletrico (tomada)',     emoji:'🔌', categoria:'Hospedagem', subcategoria:'Higiene',        tags:['hospedagem','natureza'],            sugestaoPara:['hospedagem','natureza'],     qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Natureza / area rural' },
    // ALIMENTACAO
    { id:'com-agua',          nome:'Garrafa de agua',                 emoji:'💧', categoria:'Alimentacao', subcategoria:'Hidratacao',    tags:['agua','essencial'],                 sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:true,  observacaoPadrao:'' },
    { id:'com-snacks',        nome:'Snacks / petiscos',               emoji:'🍿', categoria:'Alimentacao', subcategoria:'Lanches',       tags:['snacks'],                           sugestaoPara:['*'],                         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'com-fruta',         nome:'Frutas',                          emoji:'🍎', categoria:'Alimentacao', subcategoria:'Lanches',       tags:['snacks','saudavel'],                sugestaoPara:['trilha'],                    qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'com-cafe',          nome:'Cafe soluvel / sache',            emoji:'☕',     categoria:'Alimentacao', subcategoria:'Bebida',        tags:['cafe','frio'],                      sugestaoPara:['frio','hospedagem'],         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'com-barrinha',      nome:'Barrinha de proteina',            emoji:'🍫', categoria:'Alimentacao', subcategoria:'Esporte',       tags:['snacks','esporte'],                 sugestaoPara:['trilha','esporte'],          qtdPadrao:2, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'com-caneca-term',   nome:'Caneca / copo termico',           emoji:'☕',     categoria:'Alimentacao', subcategoria:'Utensilio',     tags:['alimentacao','cafe'],               sugestaoPara:['frio','hospedagem'],         qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // PET
    { id:'pet-racao',         nome:'Racao do pet',                    emoji:'🐾', categoria:'Pet', subcategoria:'Alimentacao',           tags:['pet'],                              sugestaoPara:['pet'],                       qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'pet-vacinacao',     nome:'Carteirinha de vacinacao (pet)',  emoji:'📋', categoria:'Pet', subcategoria:'Documentos',            tags:['pet'],                              sugestaoPara:['pet'],                       qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'pet-coleira',       nome:'Coleira + guia',                  emoji:'🐾', categoria:'Pet', subcategoria:'Seguranca',             tags:['pet'],                              sugestaoPara:['pet'],                       qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'pet-cama',          nome:'Caminha / cobertor do pet',       emoji:'🛏', categoria:'Pet', subcategoria:'Conforto',              tags:['pet'],                              sugestaoPara:['pet'],                       qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'pet-tigela',        nome:'Tigela dobravel de agua',         emoji:'🐾', categoria:'Pet', subcategoria:'Alimentacao',           tags:['pet'],                              sugestaoPara:['pet'],                       qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'pet-shampoo',       nome:'Shampoo do pet',                  emoji:'🧴', categoria:'Pet', subcategoria:'Higiene',               tags:['pet'],                              sugestaoPara:['pet'],                       qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // CRIANCAS
    { id:'cri-fralda',        nome:'Fraldas',                         emoji:'👶', categoria:'Criancas', subcategoria:'Higiene',          tags:['crianca','bebe'],                   sugestaoPara:['crianca'],                   qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'cri-lencos',        nome:'Lencos umedecidos bebe',          emoji:'👶', categoria:'Criancas', subcategoria:'Higiene',          tags:['crianca','bebe'],                   sugestaoPara:['crianca'],                   qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'cri-remedio',       nome:'Remedio infantil',                emoji:'💊', categoria:'Criancas', subcategoria:'Saude',            tags:['crianca','saude'],                  sugestaoPara:['crianca'],                   qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'cri-protetor',      nome:'Protetor solar infantil FPS 50+', emoji:'☀',     categoria:'Criancas', subcategoria:'Protecao',         tags:['crianca','solar'],                  sugestaoPara:['crianca','praia'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'cri-brinquedo',     nome:'Brinquedo / livro (carro)',       emoji:'🧸', categoria:'Criancas', subcategoria:'Entretenimento',   tags:['crianca','carro'],                  sugestaoPara:['crianca','carro'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'cri-muda',          nome:'Mudas extras de roupa (crianca)', emoji:'👕', categoria:'Criancas', subcategoria:'Roupas',           tags:['crianca'],                          sugestaoPara:['crianca'],                   qtdPadrao:3, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'cri-banco',         nome:'Cadeirinha de carro',             emoji:'🪑', categoria:'Criancas', subcategoria:'Seguranca',        tags:['crianca','carro'],                  sugestaoPara:['crianca','carro'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Verificar instalacao antes' },
    // TRABALHO
    { id:'tra-mouse',         nome:'Mouse + mousepad',                emoji:'🖱', categoria:'Trabalho', subcategoria:'Periferico',       tags:['trabalho'],                         sugestaoPara:['trabalho'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'tra-headset',       nome:'Headset com microfone',           emoji:'🎧', categoria:'Trabalho', subcategoria:'Periferico',       tags:['trabalho'],                         sugestaoPara:['trabalho'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'Chamadas / reunioes' },
    { id:'tra-hd',            nome:'HD externo / pen drive',          emoji:'💾', categoria:'Trabalho', subcategoria:'Armazenamento',    tags:['trabalho'],                         sugestaoPara:['trabalho'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'tra-anotacoes',     nome:'Caderno / bloco de notas',        emoji:'📓', categoria:'Trabalho', subcategoria:'Papelaria',        tags:['trabalho'],                         sugestaoPara:['trabalho'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'tra-caneta',        nome:'Caneta',                          emoji:'🖊', categoria:'Trabalho', subcategoria:'Papelaria',        tags:['trabalho'],                         sugestaoPara:['trabalho'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // ACADEMIA
    { id:'aca-roupa',         nome:'Roupa de academia',               emoji:'🏋', categoria:'Academia', subcategoria:'Roupa',            tags:['academia','esporte'],               sugestaoPara:['academia'],                  qtdPadrao:2, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'aca-tenis',         nome:'Tenis de treino',                 emoji:'👟', categoria:'Academia', subcategoria:'Calcado',          tags:['academia','esporte'],               sugestaoPara:['academia'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'aca-toalha',        nome:'Toalha de treino',                emoji:'🏋', categoria:'Academia', subcategoria:'Higiene',          tags:['academia'],                         sugestaoPara:['academia'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'aca-suplemento',    nome:'Suplemento / whey',               emoji:'🥛', categoria:'Academia', subcategoria:'Nutricao',         tags:['academia','esporte'],               sugestaoPara:['academia'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // JIU-JITSU
    { id:'jiu-kimono',        nome:'Kimono + faixa',                  emoji:'🥋', categoria:'Jiu-jitsu', subcategoria:'Equipamento',     tags:['jiujitsu','esporte'],               sugestaoPara:['jiujitsu'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'jiu-rashguard',     nome:'Rashguard / shorts no-gi',        emoji:'🥋', categoria:'Jiu-jitsu', subcategoria:'Equipamento',     tags:['jiujitsu','esporte'],               sugestaoPara:['jiujitsu'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'jiu-protetor',      nome:'Protetor bucal',                  emoji:'🥋', categoria:'Jiu-jitsu', subcategoria:'Equipamento',     tags:['jiujitsu'],                         sugestaoPara:['jiujitsu'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'jiu-joelheira',     nome:'Joelheira / cotoveleira',         emoji:'🥋', categoria:'Jiu-jitsu', subcategoria:'Protecao',        tags:['jiujitsu','esporte'],               sugestaoPara:['jiujitsu'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'jiu-mochila-gi',    nome:'Mochila / bolsa de Kimono',       emoji:'🎒', categoria:'Jiu-jitsu', subcategoria:'Organizacao',     tags:['jiujitsu'],                         sugestaoPara:['jiujitsu'],                  qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // EVENTOS
    { id:'eve-look',          nome:'Look de jantar / evento',         emoji:'✨',     categoria:'Eventos', subcategoria:'Roupa',             tags:['jantar','evento'],                  sugestaoPara:['jantar','evento'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'eve-calcado',       nome:'Calcado social',                  emoji:'👠', categoria:'Eventos', subcategoria:'Calcado',           tags:['jantar','evento'],                  sugestaoPara:['jantar','evento'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'eve-acessorio',     nome:'Acessorios (colar, brincos)',     emoji:'💍', categoria:'Eventos', subcategoria:'Acessorio',         tags:['jantar','evento','fem'],            sugestaoPara:['jantar','evento'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'eve-convite',       nome:'Convite / ingresso',              emoji:'🎟', categoria:'Eventos', subcategoria:'Documentos',        tags:['evento'],                           sugestaoPara:['evento'],                    qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'eve-gravata',       nome:'Gravata / lenco (masc)',          emoji:'👔', categoria:'Eventos', subcategoria:'Acessorio',         tags:['jantar','evento','masc'],           sugestaoPara:['jantar','evento'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'eve-clutch',        nome:'Clutch / bolsa de mao',           emoji:'👛', categoria:'Eventos', subcategoria:'Bolsa',             tags:['jantar','evento','fem'],            sugestaoPara:['jantar','evento'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    // CAMPING
    { id:'cam-barraca',       nome:'Barraca',                         emoji:'⛺',     categoria:'Camping', subcategoria:'Equipamento',       tags:['camping'],                          sugestaoPara:['camping'],                   qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'cam-isolante',      nome:'Isolante termico / colchonete',   emoji:'🛏', categoria:'Camping', subcategoria:'Equipamento',       tags:['camping'],                          sugestaoPara:['camping'],                   qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'cam-fogareiro',     nome:'Fogareiro / isqueiro',            emoji:'🔥', categoria:'Camping', subcategoria:'Equipamento',       tags:['camping'],                          sugestaoPara:['camping'],                   qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'cam-isopor',        nome:'Isopor / caixa termica',          emoji:'🧊', categoria:'Camping', subcategoria:'Alimentacao',       tags:['camping','praia'],                  sugestaoPara:['camping','praia'],           qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'cam-descartavel',   nome:'Pratos / talheres descartaveis',  emoji:'🍽', categoria:'Camping', subcategoria:'Utensilio',         tags:['camping'],                          sugestaoPara:['camping'],                   qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
    { id:'cam-repelente-esp', nome:'Espiral repelente',               emoji:'🌀', categoria:'Camping', subcategoria:'Protecao',          tags:['camping','natureza'],               sugestaoPara:['camping','natureza'],        qtdPadrao:1, obrigatorioPadrao:false, observacaoPadrao:'' },
  ];

  // ================================================================
  // HIDE / RESTORE
  // ================================================================
  function hideItem(id) {
    if (_hiddenIds.indexOf(id) < 0) { _hiddenIds.push(id); _saveHidden(); }
  }
  function restoreItem(id) {
    _hiddenIds = _hiddenIds.filter(function (x) { return x !== id; });
    _saveHidden();
  }
  function restoreAll() { _hiddenIds = []; _saveHidden(); }
  function getHiddenIds() { return _hiddenIds.slice(); }
  function isHidden(id) { return _hiddenIds.indexOf(id) >= 0; }
  function getHiddenItems() { return BASE.filter(function (it) { return isHidden(it.id); }); }

  // ================================================================
  // CUSTOM ITEMS
  // ================================================================
  function criarItemCustom(campos) {
    var item = {
      id: 'custom-' + Date.now().toString(36),
      nome: campos.nome || '',
      emoji: campos.emoji || '📦',
      categoria: campos.categoria || 'Criados por mim',
      subcategoria: campos.subcategoria || '',
      tags: campos.tags || ['custom'],
      sugestaoPara: [],
      qtdPadrao: campos.qtd || 1,
      obrigatorioPadrao: false,
      observacaoPadrao: campos.observacao || '',
      custom: true,
    };
    _customItems.push(item);
    _saveCustom();
    return item;
  }
  function getCustomItems() { return _customItems.slice(); }
  function deleteCustomItem(id) {
    _customItems = _customItems.filter(function (x) { return x.id !== id; });
    _saveCustom();
  }

  // ================================================================
  // QUERIES
  // ================================================================
  function getAll(includeHidden) {
    var baseList = includeHidden ? BASE : BASE.filter(function (it) { return !isHidden(it.id); });
    return baseList.concat(_customItems);
  }

  function search(query, includeHidden) {
    var pool = getAll(includeHidden);
    if (!query) return pool;
    var q = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return pool.filter(function (item) {
      return (item.nome + ' ' + item.categoria + ' ' + (item.tags || []).join(' '))
        .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').indexOf(q) >= 0;
    });
  }

  function byCategoria(cat, includeHidden) {
    var pool = getAll(includeHidden);
    if (!cat || cat === 'Todos') return pool;
    if (cat === 'Criados por mim') return _customItems.slice();
    if (cat === '_ocultos') return getHiddenItems();
    return pool.filter(function (item) { return item.categoria === cat; });
  }

  function byTag(tag, includeHidden) {
    return getAll(includeHidden).filter(function (item) { return (item.tags || []).indexOf(tag) >= 0; });
  }

  function getCategorias() {
    var seen = {};
    BASE.forEach(function (it) { seen[it.categoria] = true; });
    return Object.keys(seen);
  }

  function sugerirParaViagem(viagem) {
    if (!viagem) return [];
    var destino = ((viagem.destinoPrincipal || '') + ' ' + (viagem.localizacaoCurta || '') +
                   ' ' + (viagem.destino || '') + ' ' + String(viagem.tags || '')).toLowerCase();
    var temCarro    = !!(destino.match(/estrada|carro|road|km/) || (viagem.rotas && viagem.rotas.length));
    var temNatureza = !!destino.match(/trilha|cachoeira|mata|eco|parque|serra|morro|trekking|natureza/);
    var temPraia    = !!destino.match(/praia|mar|litoral|piscina/);
    var temCachoeira= !!destino.match(/cachoeira/);
    var temFrio     = !!destino.match(/frio|neve|inverno|serra|montanha/);
    var temChuva    = !!destino.match(/chuva|temporal|inverno/);
    var temJantar   = !!destino.match(/jantar|restaurante|evento|festa|form/);
    var temHosp     = !!(viagem.hospedagem || destino.match(/hotel|pousada|hostel|airbnb/));
    var tags = [];
    if (temCarro)    { tags.push('carro'); tags.push('estrada'); }
    if (temNatureza) { tags.push('trilha'); tags.push('natureza'); }
    if (temPraia)    { tags.push('praia'); }
    if (temCachoeira){ tags.push('cachoeira'); }
    if (temFrio)     { tags.push('frio'); tags.push('serra'); }
    if (temChuva)    { tags.push('chuva'); }
    if (temJantar)   { tags.push('jantar'); }
    if (temHosp)     { tags.push('hospedagem'); }
    return getAll(false).filter(function (item) {
      if ((item.sugestaoPara || []).indexOf('*') >= 0) return true;
      return (item.sugestaoPara || []).some(function (t) { return tags.indexOf(t) >= 0; });
    });
  }

  return {
    getAll:            getAll,
    search:            search,
    byCategoria:       byCategoria,
    byTag:             byTag,
    getCategorias:     getCategorias,
    getHiddenItems:    getHiddenItems,
    getHiddenIds:      getHiddenIds,
    isHidden:          isHidden,
    hideItem:          hideItem,
    restoreItem:       restoreItem,
    restoreAll:        restoreAll,
    sugerirParaViagem: sugerirParaViagem,
    criarItemCustom:   criarItemCustom,
    getCustomItems:    getCustomItems,
    deleteCustomItem:  deleteCustomItem,
  };
}());
// end packingCatalog.js
