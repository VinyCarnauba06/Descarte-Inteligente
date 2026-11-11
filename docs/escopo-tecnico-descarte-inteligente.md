# Escopo Técnico — Descarte Inteligente

## 1. Visão Geral

Aplicação web responsiva (mobile-first), acessada via QR Code, que consolida:
- Portfólio institucional do projeto (metodologia 5W2H)
- Mapa interativo com Pontos de Entrega Voluntária (PEVs) de resíduos eletrônicos

**Restrição de custo:** infraestrutura 100% free tier.

---

## 2. Stack

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | HTML + CSS (Tailwind) + JS vanilla, bundlado com Vite | Site institucional + mapa não exigem SSR/roteamento de framework; Vite dá build único, hot-reload e módulos ES organizados sem overhead de SPA |
| Mapa | Leaflet.js + OpenStreetMap | Zero custo, zero API key, controle total de markers/popups/filtros (Google Maps JS API exigiria billing account e ainda assim cai em cota) |
| Backend | Node.js (Express) ou Go (Fiber) | API REST para CRUD de PEVs |
| Banco | SQLite (dev/local) → Postgres free tier (Neon/Supabase) em produção | Zero custo, migração simples |
| Auth (admin) | JWT | Proteger CRUD de PEVs sem expor endpoint público de escrita |
| Containerização | Docker Compose | Ambiente de dev consistente (api + db) |
| Deploy | Frontend → Vercel/Netlify (build estático via Vite) · Backend → Render/Fly.io free tier | CI/CD automático via GitHub |
| CI | GitHub Actions | Lint + build em PR |

**Decisão registrada:** Google Maps Embed API foi avaliada e descartada — não permite markers customizados, popups com dados dinâmicos nem filtro por categoria (requisito central do mapa). Maps JavaScript API exigiria conta de billing no GCP. Leaflet cobre o requisito sem essas dependências.

**Decisão registrada:** Framework SPA (Next.js) descartado — projeto não precisa de SSR/roteamento complexo. Estrutura final: **Vite vanilla + JS modules**, páginas organizadas como componentes reutilizáveis via import (header/footer/partials), evitando duplicação entre as 3 frentes de Front-end.

---

## 3. Modelo de Dados (proposta inicial)

```sql
-- PEV: Ponto de Entrega Voluntária
CREATE TABLE pevs (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    endereco VARCHAR(255) NOT NULL,
    latitude DECIMAL(9,6) NOT NULL,
    longitude DECIMAL(9,6) NOT NULL,
    horario_funcionamento VARCHAR(120),
    categorias TEXT[] NOT NULL, -- ex: ['pilhas', 'celulares', 'cabos']
    ativo BOOLEAN DEFAULT true,
    criado_em TIMESTAMP DEFAULT now(),
    atualizado_em TIMESTAMP DEFAULT now()
);
```

---

## 4. Contrato da API (proposta inicial)

| Método | Endpoint | Descrição | Auth |
|---|---|---|---|
| GET | `/api/pevs` | Lista todos os PEVs ativos | Não |
| GET | `/api/pevs?categoria=pilhas` | Filtra por categoria | Não |
| GET | `/api/pevs/:id` | Detalhe de um PEV | Não |
| POST | `/api/pevs` | Cria PEV | Sim (admin) |
| PUT | `/api/pevs/:id` | Atualiza PEV | Sim (admin) |
| DELETE | `/api/pevs/:id` | Desativa PEV (soft delete) | Sim (admin) |
| POST | `/api/auth/login` | Login do admin | Não |

---

## 5. Diretrizes UX/UI

### 5.1 Princípios
- **Mobile-first obrigatório** — entrada principal é via QR Code em celular, no ponto de coleta físico.
- **Máximo 2 toques** entre escanear o QR e visualizar o PEV mais próximo.
- **Baixa carga cognitiva** — usuário está em pé, na rua, decidindo rápido onde descartar.

### 5.2 Breakpoints
| Nome | Largura | Prioridade |
|---|---|---|
| Mobile | 320–767px | Design primário |
| Tablet | 768–1023px | Adaptação de grid |
| Desktop | 1024px+ | Secundário (portfólio institucional principalmente) |

### 5.3 Fluxos-chave (Design entrega wireframe de cada um)
1. **Escanear QR → Mapa com geolocalização do usuário → PEV mais próximo destacado**
2. **Filtrar por categoria → lista + mapa atualizam em conjunto**
3. **Tocar em PEV → bottom sheet (mobile) ou popup (desktop) com endereço, horário, categorias aceitas, botão "Como chegar" (abre Google Maps/Waze externamente)**
4. **Admin → login → CRUD de PEV (formulário simples, sem fricção)**

### 5.4 Design System (Design define, Front consome via tokens)
- Paleta: cores por categoria de resíduo (ex: pilhas, eletrônicos, cabos) — usadas em ícone do marker + badge de filtro, consistentes em todo o site.
- Tipografia: 1 família, 2 pesos (regular/bold), escala tipográfica mobile-first.
- Ícones: um por categoria, reconhecíveis sem legenda (piloto de teste com usuário leigo recomendado).
- Componentes reutilizáveis: card de PEV, badge de categoria, botão primário/secundário, bottom sheet, campo de busca.

### 5.5 Acessibilidade (mínimo viável)
- Contraste AA (WCAG) em texto sobre cor de categoria.
- Área de toque mínima 44x44px nos markers/filtros (uso majoritariamente mobile).
- Alt text em ícones de categoria.
- Não depender só de cor para diferenciar categoria (ícone + label sempre juntos).

### 5.6 Entregáveis do Design
- Wireframes low-fi dos 4 fluxos (seção 5.3)
- Hi-fi no Figma com design tokens exportáveis (cores, tipografia, espaçamento)
- Ícones de categoria em SVG
- Protótipo clicável do fluxo principal (escanear → encontrar PEV) para validação antes do Front iniciar

---

## 6. Divisão de Equipe (7 devs)

**Front-end (3)**
- Front 1 — Mapa Leaflet: integração, markers, clustering, popups
- Front 2 — Filtros por categoria, busca, listagem responsiva
- Front 3 — Site institucional (5W2H) + telas do painel admin (CRUD) + partials compartilhados (header/footer/nav) via Vite

**Back-end (2)**
- Back 1 — API REST, validação de input, schema do banco
- Back 2 — Auth do admin, seed de dados reais, testes da API

**Docker/Infra (1)**
- `docker-compose.yml` (api + db + front), Dockerfiles multi-stage, deploy, CI (GitHub Actions: lint + build)

**Design (1)**
- Wireframes → hi-fi no Figma, design tokens, ícones por categoria de resíduo, assets do QR Code/cartaz físico

---

## 7. Dependências Críticas (ordem)

1. Design entrega wireframes + tokens antes do Front iniciar telas.
2. Back 1 e Front 1/3 alinham o contrato da API (seção 4) em conjunto, documentam no README.
3. Docker sobe `docker-compose` cedo para Back e Front desenvolverem contra ambiente containerizado.

---

## 8. Fora de Escopo (v1)

- App nativo (iOS/Android)
- Sistema de login para usuário final (apenas admin)
- Banco de dados relacional complexo além do necessário para PEVs
- Pagamentos ou qualquer integração financeira
