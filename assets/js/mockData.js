// ===================================================
// mockData.js — Dados de exemplo para o MVP
// Nenhuma conexão com banco de dados aqui.
// ===================================================

var MockData = {

  // ---- Lista de viagens ----
  viagens: [
    {
      id: 'viagem-1',
      nome: 'Chapada Diamantina',
      destino: 'Lençóis, BA',
      dataInicio: '2026-07-10',
      dataFim: '2026-07-17',
      status: 'planejando',       // planejando | em-andamento | concluida
      orcamento: 4500,
      gastoAtual: 1850,
      participantes: 3,
      capa: 'alt-1',              // controla o gradiente do card
      descricao: 'Trek pela Chapada, cachoeiras e noites estreladas no Pai Inácio.',
      tags: ['natureza', 'trilha', 'cachoeira'],
    },
    {
      id: 'viagem-2',
      nome: 'Rio de Janeiro Clássico',
      destino: 'Rio de Janeiro, RJ',
      dataInicio: '2026-08-20',
      dataFim: '2026-08-25',
      status: 'planejando',
      orcamento: 6000,
      gastoAtual: 2100,
      participantes: 2,
      capa: 'alt-2',
      descricao: 'Cristo Redentor, Pão de Açúcar, praias e muito bom gosto carioca.',
      tags: ['praia', 'cidade', 'cultura'],
    },
    {
      id: 'viagem-3',
      nome: 'Bonito & Pantanal',
      destino: 'Bonito, MS',
      dataInicio: '2026-09-05',
      dataFim: '2026-09-12',
      status: 'planejando',
      orcamento: 8000,
      gastoAtual: 3200,
      participantes: 4,
      capa: 'alt-3',
      descricao: 'Flutuação no Rio da Prata, Gruta do Lago Azul e safari no Pantanal.',
      tags: ['natureza', 'fauna', 'flutuação'],
    },
  ],

  // ---- Roteiro por dia (para a viagem selecionada: viagem-1) ----
  roteiro: [
    {
      dia: 1,
      data: '10/07/2026',
      label: 'Chegada a Lençóis',
      itens: [
        { hora: '08:00', titulo: 'Voo São Paulo → Salvador', descricao: 'Embarque no Aeroporto de Guarulhos (GRU)' },
        { hora: '11:30', titulo: 'Transfer Salvador → Lençóis', descricao: 'Van compartilhada, ~5 horas de viagem' },
        { hora: '18:00', titulo: 'Check-in na pousada', descricao: 'Pousada Lua Nova — Centro histórico' },
        { hora: '20:00', titulo: 'Jantar no Restaurante Cozinha Aberta', descricao: 'Culinária baiana regional' },
      ],
    },
    {
      dia: 2,
      data: '11/07/2026',
      label: 'Trilha Morro do Pai Inácio',
      itens: [
        { hora: '07:00', titulo: 'Café da manhã na pousada', descricao: '' },
        { hora: '08:30', titulo: 'Trilha até o cume do Pai Inácio', descricao: 'Vista panorâmica de 360º da Chapada — ~3h de caminhada' },
        { hora: '13:00', titulo: 'Almoço em Palmeiras', descricao: 'Parada no retorno' },
        { hora: '16:00', titulo: 'Cachoeira Serrano', descricao: 'Banho na pedra, entrada R$ 20/pessoa' },
        { hora: '19:30', titulo: 'Descanso e jantar livre', descricao: '' },
      ],
    },
    {
      dia: 3,
      data: '12/07/2026',
      label: 'Vale do Pati',
      itens: [
        { hora: '06:30', titulo: 'Saída para o Vale do Pati', descricao: 'Trilha de 2 dias, caminhada média/difícil' },
        { hora: '12:00', titulo: 'Almoço na casa de moradores locais', descricao: 'Experiência gastronômica da comunidade' },
        { hora: '16:00', titulo: 'Acampamento noturno', descricao: 'Estrutura simples, céu aberto' },
      ],
    },
  ],

  // ---- Resumo financeiro (viagem-1) ----
  financeiro: {
    orcamentoTotal: 4500,
    gastoTotal: 1850,
    categorias: [
      { nome: 'Transporte', emoji: '✈️', valor: 720, orcamento: 1200 },
      { nome: 'Hospedagem', emoji: '🏨', valor: 630, orcamento: 1500 },
      { nome: 'Alimentação', emoji: '🍽️', valor: 280, orcamento: 700 },
      { nome: 'Passeios', emoji: '🎒', valor: 150, orcamento: 600 },
      { nome: 'Compras', emoji: '🛍️', valor: 70,  orcamento: 300 },
    ],
    despesas: [
      { descricao: 'Passagem aérea GRU-SSA', categoria: 'Transporte', emoji: '✈️', valor: 480 },
      { descricao: 'Transfer Salvador-Lençóis', categoria: 'Transporte', emoji: '🚌', valor: 120 },
      { descricao: 'Pousada Lua Nova (3 noites)', categoria: 'Hospedagem', emoji: '🏨', valor: 630 },
      { descricao: 'Jantar Cozinha Aberta', categoria: 'Alimentação', emoji: '🍽️', valor: 85 },
      { descricao: 'Almoço Palmeiras', categoria: 'Alimentação', emoji: '🥘', valor: 65 },
      { descricao: 'Cachoeira Serrano (3x)', categoria: 'Passeios', emoji: '💧', valor: 60 },
      { descricao: 'Guia Trilha Pai Inácio', categoria: 'Passeios', emoji: '🧭', valor: 90 },
    ],
  },

  // ---- Rotas / Combustível ----
  rotas: {
    trechos: [
      {
        origem: 'São Paulo, SP',
        destino: 'Salvador, BA',
        modo: 'Aéreo ✈️',
        distancia: '1.975 km',
        duracao: '3h20',
        custoPessoa: 'R$ 480',
      },
      {
        origem: 'Salvador, BA',
        destino: 'Lençóis, BA',
        modo: 'Van 🚐',
        distancia: '420 km',
        duracao: '5h',
        custoPessoa: 'R$ 120',
      },
    ],
    combustivel: {
      percursoTotal: '420 km (trecho van)',
      consumoMedio: '10 km/L',
      precoCombustivel: 'R$ 6,20/L',
      litrosNecessarios: 42,
      custoEstimado: 'R$ 260,40',
      observacao: 'Estimativa para van compartilhada (participantes pagam proporcionalmente).',
    },
    dicas: [
      'Alugar carro próprio em Lençóis permite mais liberdade para trilhas.',
      'Verifique o estado das estradas de terra antes de partir.',
      'Aplicativo Waze funciona bem até Palmeiras — depois use guia local.',
    ],
  },

  // ---- Configurações (mock) ----
  configuracoes: {
    nomeUsuario: 'Marcelino',
    email: 'marcelino@exemplo.com',
    moeda: 'BRL',
    idioma: 'pt-BR',
    notificacoes: true,
    tema: 'claro',
  },
};
