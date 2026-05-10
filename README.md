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
| `#/viagens`         | Lista de viagens (mock)            |
| `#/viagem/:id`      | Detalhe de uma viagem              |
| `#/roteiro`         | Roteiro por dia                    |
| `#/financeiro`      | Resumo financeiro e despesas       |
| `#/rotas`           | Trechos e estimativa de combustível|
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

---

## Roadmap

- [ ] Prompt 2: Autenticação e persistência (Supabase/Firebase)
- [ ] Prompt 3: CRUD completo de viagens e roteiros
- [ ] Prompt 4: Mapas e cálculo de rotas real
- [ ] Prompt 5: Colaboração entre usuários

---

> MVP gerado em 10/05/2026 · Dados fictícios para desenvolvimento.
Planejador de viagens com roteiro, finanças, rotas e organização de passeios.
