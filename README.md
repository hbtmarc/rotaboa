# RotaBoa 🗺️

Aplicativo web estático de planejamento de viagens. Roda direto no navegador — sem frameworks, sem build, sem servidor back-end.

---

## Estrutura do projeto

```
rotaboa/
├── index.html                  # Shell principal (SPA com hash routing)
├── 404.html                    # Página de erro estática
├── manifest.webmanifest        # PWA manifest
├── sw.js                       # Service Worker (cache offline)
├── assets/
│   ├── css/
│   │   ├── base.css            # Variáveis, reset e utilitários
│   │   ├── layout.css          # Header, main, bottom nav, grids
│   │   ├── components.css      # Botões, cards, badges, formulários
│   │   └── responsive.css      # Breakpoints mobile-first
│   ├── js/
│   │   ├── mockData.js         # Dados de exemplo (sem banco)
│   │   ├── store.js            # Estado global da aplicação
│   │   ├── ui.js               # Helpers de renderização HTML
│   │   ├── router.js           # Roteador por hash (#)
│   │   └── app.js              # Inicialização e páginas
│   └── img/
│       └── logo-placeholder.svg
└── README.md
```

---

## Rotas disponíveis

| Rota                | Descrição                          |
|---------------------|------------------------------------|
| `#/inicio`          | Dashboard com viagem selecionada   |
| `#/viagens`         | Lista de viagens                   |
| `#/viagem/:id`      | Detalhe de uma viagem              |
| `#/roteiro`         | Roteiro por dia                    |
| `#/financeiro`      | Resumo financeiro e despesas       |
| `#/rotas`           | Trechos e estimativa de combustível|
| `#/login`           | Login Firebase (email/senha/Google)|
| `#/config`          | Configuração do app e Firebase     |
| `#/configuracoes`   | Perfil e preferências              |

---

## Como testar localmente

### Opção 1 — Abrir direto no navegador
```
Arraste o arquivo index.html para o Chrome ou Firefox.
```

> ⚠️ O Service Worker só funciona via HTTPS ou `localhost`. Para testar offline e PWA, use a opção 2.

### Opção 2 — Servidor estático simples (recomendado)

**Com Python 3 (sem instalar nada extra):**
```bash
cd rotaboa
python3 -m http.server 8000
# Abra: http://localhost:8000
```

**Com VS Code Live Server:**
1. Instale a extensão *Live Server* (Ritwick Dey).
2. Abra `index.html` no editor.
3. Clique em **Go Live** na barra de status inferior.
4. O navegador abrirá em `http://127.0.0.1:5500`.

### Testando em mobile (iPhone/Android)
Com Python ou Live Server rodando, descubra o IP local da máquina:
```bash
ipconfig getifaddr en0   # macOS — ex: 192.168.1.100
```
Acesse `http://192.168.1.100:8000` pelo celular (mesmo Wi-Fi).

---

## GitHub Pages

1. Faça push para o branch `main` (ou `gh-pages`).
2. Acesse as configurações do repositório → Pages → Source: `main / root`.
3. O app estará disponível em `https://<usuario>.github.io/rotaboa/`.

---

## Tecnologias

- HTML5 semântico
- CSS3 com variáveis customizadas (sem pré-processadores)
- JavaScript vanilla ES5/ES6 (sem frameworks)
- PWA: Service Worker + Web Manifest
- Hash routing nativo

## Nota sobre custos de rota

- Custos de rotas no Financeiro são derivados de `rotaboa.routes.v1`.
- Eles não são duplicados em `rotaboa.expenses.v1`, que armazena apenas despesas manuais.

## Step 6 — Página Config e preparação Firebase

### O que foi implementado

- Nova página funcional de configuração em `#/config` (mantendo alias `#/configuracoes`).
- Seção **Modo de dados** com status de Local e Firebase preparado.
- Seção **Configuração Firebase** com campos, salvar, testar conexão e limpar configuração.
- Seção **Backup local** com exportar/importar JSON e limpar dados locais com confirmação.
- Badge de status no cabeçalho: `Local`, `Firebase configurado` e `Firebase online`.
- Preparação de cliente Firebase sem migrar persistência principal do app (continua localStorage).

### Arquivos alterados

- `index.html`
- `assets/js/app.js`
- `assets/js/firebaseClient.js` (novo)
- `README.md`

### Como validar

1. Abrir `#/config` e conferir que a página carrega sem erros no console.
2. Preencher configuração Firebase, clicar em **Salvar configuração** e recarregar a página.
3. Conferir badge do header: `Firebase configurado` após salvar.
4. Clicar em **Testar conexão** e validar retorno de sucesso ou mensagem amigável de erro.
5. Clicar em **Limpar configuração** e confirmar badge `Local`.
6. Clicar em **Exportar backup JSON** e validar download do arquivo.
7. Clicar em **Importar backup JSON** e validar restauração dos dados locais.
8. Clicar em **Limpar dados locais** e validar confirmação via modal.
9. Navegar nas páginas existentes e confirmar funcionamento normal.

### Observação importante

- Persistência Firebase está **preparada**, mas **ainda não está ativa como banco principal**.
- O `Store` continua usando localStorage normalmente.

## Step 7 — Autenticação Firebase (sem migrar dados)

### O que foi implementado

- Nova rota `#/login` com autenticação por email/senha, criação de conta e login com Google.
- Logout e escuta de sessão (`onAuthStateChanged`) para manter usuário autenticado após recarregar.
- Cabeçalho com estado de autenticação:
	- deslogado: botão **Entrar**
	- logado: badge com usuário + botão **Sair**
- Aviso sutil em `#/config`, `#/financeiro`, `#/rotas` e `#/roteiro` quando Firebase está configurado, mas sem usuário autenticado.

### Arquivos alterados

- `assets/js/firebaseClient.js`
- `assets/js/app.js`
- `README.md`

### Observação importante

- A autenticação foi adicionada, mas os dados do app **continuam locais**.
- O `Store` segue usando localStorage como fonte principal.

## Step 8 — Gate de Auth, modo offline e sync preparado

### O que foi implementado

- Gate de acesso por hash route: a única rota pública é `#/login`.
- Inicialização do app aguarda resolução do estado de autenticação antes de liberar rotas privadas.
- Modo offline local com botão **Usar offline neste dispositivo** na tela de login.
- Badge de cabeçalho em modo offline: `Modo offline`.
- Ação **Sair do modo offline** na página `#/config`.
- Preparação de sincronização com Firestore em `users/{uid}/appState/main`.
- Novo `SyncService` com:
	- `syncLocalToCloud()`
	- `getSyncStatus()`
	- `markPendingSync()`
- CRUD local continua igual (localStorage), mas ações de escrita marcam sync pendente.

### Checklist de validação

1. Sem erros de console na abertura da aplicação.
2. Usuário deslogado não acessa rotas privadas direto por hash (redireciona para `#/login`).
3. Login com Google abre o app normalmente.
4. Botão **Usar offline neste dispositivo** abre o app sem exigir login.
5. Em modo offline, criação/edição/exclusão continuam locais em localStorage.
6. Ao logar online, estado local é enviado para Firestore (`users/{uid}/appState/main`).
7. Ao recuperar conexão (`online`), sincronização é tentada novamente.
8. Página `#/config` não exibe mais campos de credenciais Firebase.
9. Textos de interface permanecem em PT-BR.

## Step 9 — Refino de UX em Auth e Config

### O que foi refinado

- Cabeçalho sem status técnico: exibe badge apenas em `Modo offline` ou `Sincronização pendente`.
- Usuário autenticado/offline é redirecionado de `#/login` para `#/inicio`.
- Página `#/config` reorganizada em seções de produto:
	- **Conta**
	- **Sincronização**
	- **Dados locais**
	- **Preferências**
- Preferências locais adicionadas:
	- Página inicial padrão
	- Mostrar valores financeiros na tela inicial
	- Confirmações antes de excluir

### Checklist de validação

1. Login com Google redireciona para `#/inicio`.
2. Usuário logado não permanece em `#/login`.
3. Cabeçalho não exibe `Firebase online` ou termos técnicos.
4. `#/config` não expõe credenciais nem rótulos técnicos de Firebase.
5. Modo offline continua funcionando com dados locais.
6. Status de sincronização é compreensível para usuário final.
7. Preferências são salvas e aplicadas sem quebrar o CRUD atual.
8. Sem erros de console.

## Step 10 — Refino visual global (header, mobile e consistência)

### O que foi refinado

- Header mais limpo, sem badge técnico fixo.
- Topo mobile compacto, sem quebra de layout entre 360px e 430px.
- Navegação inferior mantida como principal no mobile, com melhor alinhamento e respiro.
- Conteúdo com padding inferior seguro para não ficar atrás da bottom nav.
- Cartões, botões, espaçamentos e grids com padrão visual mais consistente.
- Indicadores de sincronização priorizados em `#/config`, com feedback discreto por toast.

### Checklist de validação

1. Desktop em largura ≥ 1024px sem quebra no header.
2. Mobile em 430px, 390px e 375px sem scroll horizontal.
3. Header não quebra e permanece compacto no mobile.
4. Bottom nav não cobre conteúdo das páginas.
5. Indicador de sync aparece no contexto de Configuração e feedback breve após ação.
6. Rotas continuam operando normalmente.
7. CRUD, auth, offline e sync permanecem com o mesmo comportamento funcional.
8. Sem erros no console.

## Step 11 — Auto sync seguro + Dashboard Inicio robusto

### O que foi implementado

- `SyncService.startAutoSync()` e `SyncService.stopAutoSync()` com ciclo de 60 segundos.
- Auto sync acionado após sessão pronta, ao voltar online, ao voltar para aba visível e após mudanças locais pendentes.
- Lock interno para evitar chamadas duplicadas enquanto uma sincronização está em andamento.
- Feedback curto por toast: `Sincronizado`, `Sincronização pendente`, `Sem conexão`.
- Página `#/inicio` redesenhada como dashboard:
	- hero com ações principais
	- KPIs de painel
	- card compacto da viagem selecionada
	- próximas atividades
	- resumo financeiro
	- resumo de rotas
	- viagens em destaque
- Ajustes de responsividade focados em 430px, 390px e 375px.

### Checklist de validação

1. Desktop ≥ 1024px sem quebras no painel e no header.
2. Mobile 430px, 390px e 375px sem scroll horizontal.
3. Auto sync não dispara chamadas duplicadas em paralelo.

## Step 12 — Participantes reais, parcelas e limpeza de mock

### O que foi implementado

- Remoção do fallback de seed automático de viagens mock.
- Limpeza segura de viagens mock conhecidas (`viagem-1`, `viagem-2`, `viagem-3`) e dados associados (itinerário, despesas e rotas) sem apagar viagens do usuário.
- Modelo de participantes por viagem em formato real:
	- `participantes: [{ id, nome, ativo }]`
	- migração automática de registros antigos com número de participantes.
- `TripModal` com gestão de participantes:
	- adicionar/remover participante
	- marcar ativo/inativo
	- validação de nome obrigatório, nome único e ao menos 1 ativo.
- `DespesaModal` atualizado:
	- campo **Quem pagou** com select dos participantes ativos
	- rateio por checkboxes com nomes reais
	- bloqueio de nova despesa quando não há participantes ativos
	- modo de pagamento **À vista / Parcelado**
	- cálculo de parcelas com ajuste de centavos na última parcela.
- Cards e resumos financeiros:
	- detalhe de parcelamento no card da despesa
	- nova linha **Compromisso parcelado** em `#/financeiro` e no resumo de `#/inicio`
	- KPIs continuam baseados no valor total da despesa.

### Checklist de validação

1. Com localStorage limpo, o app abre sem viagens pré-semeadas.
2. Ao editar viagem antiga (formato numérico), participantes aparecem em lista com nomes e estado ativo.
3. Não é possível salvar viagem com nomes vazios, duplicados ou sem participantes ativos.
4. Sem participantes ativos, o botão de nova despesa exibe aviso e não abre criação.
5. Em despesa parcelada, o resumo mostra parcelas e última parcela ajustada por centavos.
6. Após recarregar a página, participantes e parcelamento persistem corretamente.
7. No financeiro, `Compromisso parcelado` é exibido e os totais/KPIs continuam coerentes com o valor total lançado.
4. Pendência de sincronização é limpa após sync com sucesso.
5. Rotas `Inicio`, `Viagens`, `Roteiro`, `Financeiro`, `Rotas` e `Config` seguem funcionais.
6. Modo offline continua utilizável.
7. Sem erros no console.

---

## Roadmap

- [ ] Prompt 2: Autenticação e persistência (Supabase/Firebase)
- [ ] Prompt 3: CRUD completo de viagens e roteiros
- [ ] Prompt 4: Mapas e cálculo de rotas real
- [ ] Prompt 5: Colaboração entre usuários

---

> MVP gerado em 10/05/2026 · Dados fictícios para desenvolvimento.
Planejador de viagens com roteiro, finanças, rotas e organização de passeios.
