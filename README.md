# RotaBoa 🗺️

Aplicativo web progressivo (PWA) de planejamento de viagens. Roda direto no navegador — sem frameworks, sem build, sem servidor back-end. Dados sincronizados com Firebase Realtime Database (RTDB) por usuário autenticado, com suporte a modo offline.

---

## Estrutura do projeto

```
rotaboa/
├── index.html                  # Shell principal (SPA com hash routing)
├── 404.html                    # Página de erro estática (GitHub Pages)
├── manifest.webmanifest        # PWA manifest (ícones, tema, display)
├── sw.js                       # Service Worker — cache offline
├── assets/
│   ├── css/
│   │   ├── base.css            # Variáveis CSS, reset e utilitários
│   │   ├── layout.css          # Header, main, bottom nav, grids, safe-area
│   │   ├── components.css      # Botões, cards, badges, modais, formulários
│   │   └── responsive.css      # Breakpoints mobile-first (375px–1024px+)
│   ├── js/
│   │   ├── store.js            # Estado global da aplicação (~1787 linhas)
│   │   ├── ui.js               # Helpers de renderização HTML (~1019 linhas)
│   │   ├── router.js           # Roteador por hash (#) com guard de auth
│   │   ├── app.js              # Inicialização, páginas e modais (~5806 linhas)
│   │   ├── firebaseClient.js   # Auth Firebase + sync helpers
│   │   └── mapsService.js      # Google Maps Routes API + Places Autocomplete
│   └── img/
│       └── logo-placeholder.svg
└── README.md
```

---

## Rotas disponíveis

| Rota              | Acesso    | Descrição                                          |
|-------------------|-----------|----------------------------------------------------|
| `#/login`         | Público   | Login por email/senha, criação de conta e Google   |
| `#/inicio`        | Privado   | Dashboard: KPIs, próximas atividades, resumo geral |
| `#/viagens`       | Privado   | Lista de todas as viagens do usuário               |
| `#/viagem/:id`    | Privado   | Detalhe de viagem com participantes e estatísticas |
| `#/roteiro`       | Privado   | Roteiro por dia com atividades e custos vinculados  |
| `#/bagagem`       | Privado   | Lista de itens de bagagem por viagem               |
| `#/financeiro`    | Privado   | Despesas agrupadas por data, categoria e resumo     |
| `#/rotas`         | Privado   | Trechos com cálculo automático de combustível       |
| `#/config`        | Privado   | Conta, sincronização, dados, preferências          |
| `#/configuracoes` | Privado   | Alias para `#/config`                              |

> Todas as rotas privadas redirecionam para `#/login` quando não há sessão ativa (autenticado ou modo offline).

---

## Como testar localmente

### Opção 1 — Servidor estático (recomendado)

**Python 3:**
```bash
cd rotaboa
python3 -m http.server 8000
# Abra: http://localhost:8000
```

**VS Code Live Server:**
1. Instale a extensão *Live Server* (Ritwick Dey).
2. Abra `index.html` e clique em **Go Live** na barra de status.
3. O navegador abrirá em `http://127.0.0.1:5500`.

> ⚠️ O Service Worker, autenticação Firebase e PWA só funcionam via HTTPS ou `localhost`.  
> Abrir `index.html` diretamente como `file://` não funciona.

### Testando em mobile (iPhone/Android)

```bash
ipconfig getifaddr en0   # macOS — ex: 192.168.1.100
```
Acesse `http://192.168.1.100:8000` pelo celular (mesmo Wi-Fi).

### Nota sobre Google Maps em localhost

Quando a chave Maps API não está autorizada para localhost:
- O modal de atividade salva normalmente sem calcular rota.
- O modal de trecho exibe aviso e permite preenchimento manual.
- Nenhum crash ou trava no botão Salvar.

---

## GitHub Pages

1. Faça push para o branch `main`.
2. Repositório → Settings → Pages → Source: `main / root`.
3. Disponível em `https://<usuario>.github.io/rotaboa/`.

---

## Autenticação e sincronização

### Fluxo de sessão

```
Abertura do app
  └─ iniciarAuthStateListener()
       ├─ Usuário autenticado  → garantirIsolamentoUid() → pullFromRtdb() → startAutoSync()
       ├─ Modo offline ativo   → carregarCacheUid() → libera rotas privadas
       └─ Sem sessão           → redireciona para #/login
```

### Métodos de login (`firebaseClient.js`)

| Método             | Desktop          | Mobile (iOS/Android)  |
|--------------------|------------------|-----------------------|
| Google             | `signInWithPopup` | `signInWithPopup`     |
| Email + senha      | `signInWithEmailAndPassword` | idem     |
| Modo offline       | sem Firebase     | sem Firebase          |

> iOS Safari bloqueia `signInWithRedirect` por ITP. Por isso popup é usado em todos os dispositivos.

### Sincronização com RTDB (`SyncService`)

| Método                          | Descrição                                              |
|---------------------------------|--------------------------------------------------------|
| `pullFromRtdb(uid)`             | Carrega estado completo do usuário do RTDB             |
| `pushToRtdb(uid, opts)`         | Envia estado local para RTDB                           |
| `syncLocalToCloud(opts)`        | Push com feedback de toast                             |
| `startAutoSync()`               | Ciclo automático de 60s + eventos `online`/`visibilitychange` |
| `stopAutoSync()`                | Para o ciclo de sync                                   |
| `markPendingSync()`             | Marca estado como pendente após mutações               |
| `getSyncStatus()`               | Retorna `{ status, lastSync, pending }`                |
| `garantirIsolamentoUid(uid)`    | Limpa estado se o UID mudou (troca de conta)           |
| `carregarCacheUid(uid)`         | Lê cache local do RTDB por UID                         |

O auto sync é acionado:
- A cada 60 segundos (polling passivo).
- Ao recuperar conexão (`window online`).
- Ao voltar para aba visível (`visibilitychange`).
- Após operações de escrita via `markPendingSync()`.

Um lock interno impede chamadas duplicadas em paralelo.

---

## Store — estado global (`store.js`)

### Estrutura de dados no RTDB

```
rotaboa.viagens.v1        → lista de viagens { id, nome, dataInicio, dataFim, participantes[] }
rotaboa.itinerary.v1      → dias por viagem { tripId → [ { data, atividades[] } ] }
rotaboa.expenses.v1       → despesas por viagem { tripId → [ DespesaItem ] }
rotaboa.routes.v1         → trechos por viagem { tripId → [ TrechoItem ] }
rotaboa.bagagem.v1        → itens de bagagem por viagem
rotaboa.config.v1         → configurações do app (chave Maps, preferências)
```

### API pública do Store

| Função                              | Descrição                                                   |
|-------------------------------------|-------------------------------------------------------------|
| `getViagens()`                      | Lista de todas as viagens                                   |
| `getViagemSelecionada()`            | Viagem ativa (por `viagemSelecionadaId`)                    |
| `selecionarViagem(id)`              | Define viagem ativa                                         |
| `adicionarViagem(dados)`            | Cria viagem com participantes                               |
| `editarViagem(id, dados)`           | Atualiza viagem; migra formato antigo de participantes      |
| `excluirViagem(id)`                 | Remove viagem e todos os dados vinculados                   |
| `getItinerario(tripId)`             | Dias do roteiro ordenados por data                          |
| `adicionarAtividade(tripId, dia, ativ)` | Cria atividade e sincroniza despesa vinculada           |
| `editarAtividade(tripId, diaId, atividadeId, dados)` | Edita e re-sincroniza despesa          |
| `excluirAtividade(tripId, diaId, atividadeId)` | Remove e exclui despesa vinculada             |
| `getDespesas(tripId)`               | Despesas ordenadas por data (ascendente)                    |
| `adicionarDespesa(tripId, dados)`   | Cria despesa manual com suporte a parcelamento              |
| `editarDespesa(tripId, id, dados)`  | Edita despesa existente                                     |
| `excluirDespesa(tripId, id)`        | Remove despesa                                              |
| `getResumoFinanceiro(tripId)`       | KPIs e agrupamento por categoria (com `_mapCategoria`)      |
| `getBalancoMensal(tripId)`          | Balanço por mês/categoria                                   |
| `getRotas(tripId)`                  | Trechos do roteiro de rotas                                 |
| `getResumoRotas(tripId)`            | Distância total e custo estimado de combustível             |
| `getProximasAtividades(tripId, n)`  | Próximas N atividades a partir de hoje                      |
| `getConfiguracoes()`                | Config do app (chave Maps, preferências)                    |
| `setConfigDefaults(prefs)`          | Define padrões de cálculo de combustível a partir das prefs |
| `carregarEstadoCompleto(data)`      | Hidrata store a partir de snapshot do RTDB                  |
| `exportarEstadoCompleto()`          | Serializa estado para backup/push RTDB                      |

### Vinculação automática Roteiro → Financeiro

Toda atividade com `custoEstimado > 0` gera automaticamente uma despesa vinculada no Financeiro:

- **`_syncAtividadeExpense(tripId, ativ, dataISO)`** — upsert se custo > 0, remove se custo = 0.
- **`_upsertLinkedExpense(tripId, linkedSource, dados)`** — localiza por `linkedSource` e atualiza ou insere.
- **`_removeLinkedExpense(tripId, sourceType, sourceId)`** — remove pela chave `linkedSource`.
- **`_sincronizarTodasAtividades()`** — chamado em `carregarEstadoCompleto`; reconcilia todas as atividades existentes (corrige categoria, valor ou descrição desatualizados).

#### Mapeamento de categorias (`_mapCategoria`)

Atividades usam nomes de categoria livres. `_mapCategoria` normaliza para as categorias canônicas do Financeiro:

| Alias de atividade                              | Categoria canônica |
|-------------------------------------------------|--------------------|
| `restaurante`, `alimentacao`                    | `alimentacao`      |
| `hospedagem`                                    | `hospedagem`       |
| `deslocamento`, `transporte`                    | `transporte`       |
| `passeio`, `aventura`, `cachoeira`, `cultura`, `evento`, `natureza`, `noturno`, `praia`, `trilha` | `passeios` |
| `compra`, `compras`                             | `compras`          |
| `descanso`, `emergencia`, `livre`, `outros`     | `outros`           |

---

## Módulos de JS

### `ui.js` — Helpers de renderização

| Função                          | Descrição                                              |
|---------------------------------|--------------------------------------------------------|
| `renderDespesaItem(desp, tripId)` | Card de despesa com badge `Do roteiro` (laranja) para despesas vinculadas ao roteiro |
| `renderTrechoCard(trecho)`      | Card de trecho com badge Google Maps quando calculado pela API |
| `renderParticipanteChip(p)`     | Chip de participante (ativo/inativo)                   |
| `_despCatMeta`                  | Metadados de ícone/rótulo para todas as categorias de despesa |

### `mapsService.js` — Google Maps

| Função                             | Descrição                                                  |
|------------------------------------|------------------------------------------------------------|
| `computeRoute(origin, dest, mode)` | Chama Routes API e retorna `{ distanceKm, durationText }` |
| `initAutocomplete(inputEl, cb)`    | Inicializa Places Autocomplete em um input                 |
| `isConfigured()`                   | Retorna `true` se chave Maps está salva nas configurações  |

O `AtividadeModal` e o `RouteModal` usam guard `window.MapsService && typeof MapsService.computeRoute === 'function'` para ambientes sem a API disponível (localhost sem chave autorizada).

---

## Modais

### `TripModal`

- Criar/editar viagem com nome, datas e participantes.
- Gestão de participantes: adicionar, remover, marcar ativo/inativo.
- Validações: nome obrigatório, nomes únicos, ao menos 1 participante ativo.
- Migração automática de viagens antigas com número de participantes.

### `AtividadeModal`

- Criar/editar atividade em um dia do roteiro.
- Campos: título, categoria, horário, local, custo estimado, notas.
- Valor padrão `categoria: 'outro'` para evitar falha silenciosa de validação.
- Cálculo opcional de rota via Maps API (com `try/catch` para ambientes sem API).
- Salva atividade e aciona `_syncAtividadeExpense` automaticamente.

### `DespesaModal`

- Criar/editar despesa manual.
- Quem pagou: select de participantes ativos da viagem.
- Rateio: checkboxes com nomes reais dos participantes.
- Modo de pagamento: À vista ou Parcelado (calcula parcelas + ajuste de centavos na última).
- Bloqueado quando não há participantes ativos na viagem.

### `RouteModal`

- Criar/editar trecho de rota.
- Cálculo automático de distância e duração via Routes API (modo Carro).
- Estimativa de custo de combustível baseada nas preferências do usuário.
- Campos editáveis manualmente para tipos sem suporte a cálculo (Ônibus, Aéreo, etc.).

---

## Página Financeiro

- Despesas agrupadas por data (cabeçalhos estilo roteiro com número do dia).
- Ordenação cronológica ascendente (mesma ordem do Roteiro).
- Badge `Do roteiro` (laranja) em despesas geradas por atividades.
- Resumo por categoria usando categorias canônicas.
- KPIs: total gasto, orçamento, saldo, compromisso parcelado.
- Balanço mensal.

---

## Página Roteiro

- Dias agrupados por data com número do dia de viagem.
- Atividades com horário, local, categoria e custo estimado.
- Custo da atividade refletido automaticamente no Financeiro.

---

## Preferências e nome de usuário

As preferências são salvas localmente via `_salvarPreferencias` e lidas por `_lerPreferencias`. A função `_getDisplayUserName()` define o nome exibido no header, saudação e configurações com esta prioridade:

1. `prefs.nomeUsuario` (campo "Seu nome" em Configurações).
2. `user.displayName` do Firebase Auth.
3. Parte local do e-mail (`usuario@...` → `usuario`).
4. Fallback: `'Usuário'`.

O header é atualizado imediatamente após salvar as preferências via `atualizarHeaderAuthUI()`.

---

## Navegação mobile (bottom nav)

7 itens na barra inferior fixa (visível apenas em telas < 1024px):

| Ícone | Rota         |
|-------|-------------|
| 🏠    | `#/inicio`   |
| 🗺️    | `#/viagens`  |
| 📅    | `#/roteiro`  |
| 💰    | `#/financeiro` |
| 🛣️    | `#/rotas`    |
| 🧳    | `#/bagagem`  |
| ⚙️    | `#/config`   |

A barra usa `position: fixed; bottom: 0` com `env(safe-area-inset-bottom)` para suporte a iPhones com notch/home indicator.

---

## Tecnologias

- HTML5 semântico
- CSS3 com variáveis customizadas (sem pré-processadores)
- JavaScript vanilla ES5/ES2017 IIFEs (sem frameworks)
- Firebase: Authentication + Realtime Database
- Google Maps: Routes API + Places Autocomplete
- PWA: Service Worker + Web Manifest
- Hash routing nativo

---

## Nota sobre custos de rota e despesas vinculadas

- Custos de rotas (trechos) ficam em `rotaboa.routes.v1` — **não** são duplicados em `rotaboa.expenses.v1`.
- Custos de **atividades** com `custoEstimado > 0` são sincronizados automaticamente para `rotaboa.expenses.v1` via `_syncAtividadeExpense`. O campo `linkedSource` da despesa aponta para a atividade de origem.
- `_sincronizarTodasAtividades()` é chamado em `carregarEstadoCompleto` para reconciliar todas as atividades já existentes com as despesas corretas (categoria, valor, descrição).

---

## Histórico de implementação

| Etapa | O que foi feito |
|-------|-----------------|
| 1–5   | Estrutura inicial: SPA com hash routing, CRUD local em localStorage, layout responsivo, PWA básico, dados mock. |
| 6     | Página `#/config` com seções de conta, sincronização, dados e preferências. Cliente Firebase preparado (`firebaseClient.js`). |
| 7     | Autenticação Firebase: login por email/senha, Google e modo offline. Guard de rotas privadas. |
| 8     | `SyncService` com `syncLocalToCloud`, `pullFromRtdb`, `markPendingSync`. Estado local sincronizado com RTDB por UID. |
| 9     | Refinamento de UX de Auth: header sem termos técnicos, redirecionamento pós-login, preferências de usuário. |
| 10    | Refino visual global: header compacto, safe-area no bottom nav, padding seguro em `app-main`, grids consistentes. |
| 11    | Auto sync com ciclo 60s + lock anti-duplo. Dashboard `#/inicio` com KPIs, próximas atividades e viagens em destaque. |
| 12    | Participantes reais por viagem (`[{ id, nome, ativo }]`), migração automática. `DespesaModal` com rateio real e parcelamento. Remoção de dados mock. |
| 13    | Google Maps Routes API + Places Autocomplete. `RouteModal` com cálculo automático de distância/duração/custo. Badge "Google Maps" nos trechos. |
| 14    | Vinculação automática Roteiro → Financeiro (`_syncAtividadeExpense`). `_mapCategoria` normaliza aliases. `_sincronizarTodasAtividades` reconcilia ao carregar. |
| 15    | Financeiro agrupado por data (cabeçalhos com número do dia). Ordenação cronológica. Badge laranja `Do roteiro`. |
| 16    | Login Google por popup em todos os dispositivos (fix iOS Safari ITP). `Config` adicionado ao bottom nav (7 itens). `_getDisplayUserName()` com prioridade para nome nas preferências. Header atualizado imediatamente após salvar nome. |

---

## Checklist de validação final

### Auth e sessão
- [ ] Login com Google redireciona para `#/inicio`.
- [ ] Usuário logado redirecionado de `#/login` para `#/inicio`.
- [ ] Modo offline abre o app sem Firebase.
- [ ] Ao logar, pull do RTDB carrega estado do usuário.
- [ ] Auto sync a cada 60s e ao recuperar conexão.

### Roteiro e atividades
- [ ] Criar atividade com custo > 0 → despesa aparece em `#/financeiro` imediatamente.
- [ ] Editar custo da atividade → despesa atualizada no financeiro.
- [ ] Zerar custo da atividade → despesa removida do financeiro.
- [ ] Excluir atividade → despesa vinculada excluída.
- [ ] Atividade com categoria `restaurante` → Financeiro agrupa em **Alimentação**.
- [ ] Recarregar página → todas as atividades reconciliadas com despesas corretas.

### Google Maps (requer chave configurada)
- [ ] Modal de trecho: digitar origem/destino e selecionar tipo Carro → calcula distância e duração automaticamente.
- [ ] Badge "Google Maps" exibido no card do trecho após cálculo.
- [ ] Trocar para Aéreo → campos manuais, sem crash.
- [ ] Sem chave configurada → aviso de modo manual, botão Salvar funciona normalmente.
- [ ] Em localhost sem chave autorizada → `AtividadeModal` salva sem travar (try/catch).

### Financeiro
- [ ] Despesas ordenadas cronologicamente com cabeçalhos de dia.
- [ ] Badge `Do roteiro` (laranja) em despesas de atividades.
- [ ] Despesas manuais sem badge.
- [ ] KPIs coerentes com total das despesas (incluindo parceladas).

### Mobile
- [ ] Bottom nav exibe 7 itens sem sobreposição em 375px, 390px e 430px.
- [ ] Config acessível via ícone de engrenagem na bottom nav.
- [ ] Conteúdo não fica atrás da bottom nav (safe-area).
- [ ] Nome personalizado em "Seu nome" aparece no header após salvar preferências.

### Qualidade de código
- [ ] `node --check assets/js/app.js` → OK
- [ ] `node --check assets/js/store.js` → OK
- [ ] `node --check assets/js/ui.js` → OK
- [ ] Sem erros no console do navegador.

---

## Roadmap

- [ ] Compartilhamento de viagem entre usuários (convite por link)
- [ ] Notificações push para atividades do dia
- [ ] Exportar roteiro como PDF
- [ ] Modo escuro
- [ ] Suporte a moedas estrangeiras com conversão automática

---

> Iniciado em 10/05/2026 · Planejador de viagens com roteiro, finanças, rotas e organização de passeios.

