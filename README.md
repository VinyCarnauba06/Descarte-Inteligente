# Descarte Inteligente — Ecossistema Fígital de Logística Reversa (Maceió-AL)

Aplicação Web Mobile-First e API REST desenvolvidas para o mapeamento e gestão inteligente de descarte de resíduos eletrônicos e logística reversa em Maceió - AL.

## Visão Geral da Solução

O sistema conecta o **Coletor Físico Piloto** (cilindro $\varnothing\ 40 \times 60\text{ cm}$ com slot superior de $20 \times 4\text{ cm}$ e caixa metálica lateral isolada de $15 \times 12\text{ cm}$ para pilhas/baterias) a uma plataforma digital imediata acessível via **QR Code**, sem exigir instalação de aplicativo nativo.

### Módulos Implementados
1. **Mapa Interativo de PEVs em Maceió-AL (`Leaflet.js` + `OpenStreetMap`)**:
   - 10 Pontos de Entrega Voluntária reais mapeados em Maceió (Campus Cruz das Almas, CIPT Jaraguá, Parque Shopping, Maceió Shopping, Pátio Maceió, Leroy Merlin, Carrefour, Ferreira Costa, SENAI Poço e Ecoponto ALURB Pajuçara).
   - Cálculo de distância em tempo real via **Fórmula de Haversine** (GPS do navegador ou referência do Ponto Piloto).
   - Filtro combinado por categoria (`pilhas`, `celulares`, `cabos`, `computadores`, `eletrodomesticos`) e busca por bairro/nome.
   - Integração de rota direta com **Google Maps**, **Waze** e **Apple Maps**.
2. **Prancha Técnica Interativa do Coletor (Escala 1:10) & Conformidade LGPD**:
   - Desenho técnico interativo em SVG fiel ao protótipo físico (vistas 3D isométrica, planta superior e elevação frontal) com detalhamento dos 4 componentes e justificativa química do isolamento de baterias de íon-lítio.
   - **Simulador de Gabarito e Toxicidade**: indica se o item cabe no coletor piloto ou exige ecoponto de médio/grande porte e calcula a retenção de metais pesados (Chumbo, Mercúrio, Cádmio, Arsênio, Berílio e Lítio — base CETEM/IARC).
   - **Protocolo Interativo de Sanitização de Dados (LGPD — Lei 13.709/2018 e ISO/IEC 27002)**.
3. **Portfólio Institucional (Matriz 5W2H, ODS 4/11/12, Equipe e Cartaz QR Code A4)**:
   - Prestação de contas com os 17 integrantes multidisciplinares (Ciência da Computação, Direito, Ciências Contábeis e Administração).
   - Gerador de **Cartaz Oficial A4 com QR Code** pronto para impressão (`Ctrl + P`).
4. **PWA Multiplataforma (Android WebAPK + iOS Safari) & API REST**:
   - Instalável na Tela de Início com Service Worker, leitura offline dos PEVs e fila local idempotente para contabilização de descartes (`/api/pevs`, `/api/descartes`).

## Como Executar Localmente

```bash
# 1. Instalar dependências
npm install

# 2. Iniciar servidor de desenvolvimento (Frontend + API integrada em http://localhost:5173)
npm run dev

# 3. Executar testes automatizados (Node Test Runner + API REST)
npm test

# 4. Gerar build de produção (TypeScript strict + ES Modules em dist/)
npm run build
```

