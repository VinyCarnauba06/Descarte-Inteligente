import * as L from 'leaflet';
import {
  CATEGORIAS_META,
  CHECKLIST_LGPD,
  COORDENADAS_PADRAO_PILOTO,
  ELEMENTOS_TOXICOS,
  EQUIPE_PROJETO,
  ITENS_CALCULADORA,
} from './data/maceioPevs';
import {
  CALLOUTS_COLETOR,
  renderizarDesenhoTecnicoSvg,
} from './components/collectorBlueprint';
import { gerarSvgQrCodeDidatico } from './components/qrCodeSvg';
import {
  buscarPevs,
  lerChecklistLgpd,
  listarDescartesRegistrados,
  registrarNovoDescarte,
  salvarChecklistLgpd,
  sincronizarDescartesPendentes,
} from './services/pevService';
import type { CategoriaResiduo, PevComDistancia, PevItem } from './types';
import {
  filtrarEOrdenarPevs,
  formatarDistancia,
  gerarLinksNavegacao,
} from './utils/geo';

type AbaAtiva = 'mapa' | 'coletor' | 'institucional';
type ModoVisaoMobile = 'ambos' | 'mapa' | 'lista';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface EstadoApp {
  aba: AbaAtiva;
  modoVisaoMobile: ModoVisaoMobile;
  pevs: PevItem[];
  origemDados: 'api' | 'local';
  categoriaFiltro: CategoriaResiduo | 'todas';
  termoBusca: string;
  coordenadasUsuario: {
    latitude: number;
    longitude: number;
    rotulo: string;
    precisaoMetros?: number;
  } | null;
  statusGps: string;
  pevSelecionadoId: number;
  calloutColetorAtivo: number;
  itemCalculadoraId: string;
  checklistLgpd: Record<string, boolean>;
  descartes: ReturnType<typeof listarDescartesRegistrados>;
  feedbackToast: string | null;
  eventoInstalacaoPwa: BeforeInstallPromptEvent | null;
  exibirGuiaInstalacaoPwa: boolean;
  urlQrCodeCustom: string;
}

function detectarPlataformaPwa(): {
  ehIos: boolean;
  ehStandalone: boolean;
  ehWebViewEmbutido: boolean;
} {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { ehIos: false, ehStandalone: false, ehWebViewEmbutido: false };
  }
  const ua = navigator.userAgent || '';
  const ehIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const navStandalone = (navigator as { standalone?: boolean }).standalone === true;
  const mediaStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  const ehStandalone = navStandalone || mediaStandalone;
  const ehWebViewEmbutido = /Instagram|FBAN|FBAV|WhatsApp/i.test(ua);
  return { ehIos, ehStandalone, ehWebViewEmbutido };
}

const SESSION_UI_STATE_KEY = 'descarte_inteligente_ui_state_v1';

function recuperarEstadoSessao(): Partial<
  Pick<EstadoApp, 'aba' | 'categoriaFiltro' | 'pevSelecionadoId'>
> {
  try {
    const salvo = sessionStorage.getItem(SESSION_UI_STATE_KEY);
    return salvo ? JSON.parse(salvo) : {};
  } catch {
    return {};
  }
}

function persistirEstadoSessao(): void {
  try {
    sessionStorage.setItem(
      SESSION_UI_STATE_KEY,
      JSON.stringify({
        aba: estado.aba,
        categoriaFiltro: estado.categoriaFiltro,
        pevSelecionadoId: estado.pevSelecionadoId,
      })
    );
  } catch {
    // Ignorar
  }
}

const sessaoSalva = recuperarEstadoSessao();
const abaSalvaValida: AbaAtiva =
  sessaoSalva.aba === 'mapa' ||
  sessaoSalva.aba === 'coletor' ||
  sessaoSalva.aba === 'institucional'
    ? sessaoSalva.aba
    : 'mapa';

const estado: EstadoApp = {
  aba: abaSalvaValida,
  modoVisaoMobile: 'ambos',
  pevs: [],
  origemDados: 'local',
  categoriaFiltro: sessaoSalva.categoriaFiltro ?? 'todas',
  termoBusca: '',
  coordenadasUsuario: {
    latitude: COORDENADAS_PADRAO_PILOTO.latitude,
    longitude: COORDENADAS_PADRAO_PILOTO.longitude,
    rotulo: COORDENADAS_PADRAO_PILOTO.label,
  },
  statusGps: 'Maceió (Centro)',
  pevSelecionadoId: sessaoSalva.pevSelecionadoId ?? 1,
  calloutColetorAtivo: 1,
  itemCalculadoraId: ITENS_CALCULADORA[0].id,
  checklistLgpd: lerChecklistLgpd(),
  descartes: listarDescartesRegistrados(),
  feedbackToast: null,
  eventoInstalacaoPwa: null,
  exibirGuiaInstalacaoPwa: false,
  urlQrCodeCustom:
    typeof window !== 'undefined' &&
    !window.location.hostname.includes('localhost') &&
    !window.location.hostname.includes('127.0.0.1')
      ? window.location.origin
      : 'https://descarte-inteligente-chi.vercel.app',
};

let instanciaMapa: L.Map | null = null;
let camadaMarkers: L.LayerGroup | null = null;
let timerDebounceBusca: number | null = null;

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mostrarNotificacao(mensagem: string): void {
  estado.feedbackToast = mensagem;
  const existente = document.getElementById('status-toast-banner');
  if (existente) {
    existente.textContent = mensagem;
  } else {
    renderizarApp();
  }
  window.setTimeout(() => {
    if (estado.feedbackToast === mensagem) {
      estado.feedbackToast = null;
      const toastEl = document.getElementById('status-toast-banner');
      if (toastEl) toastEl.remove();
    }
  }, 4200);
}

function obterPevsFiltrados(): PevComDistancia[] {
  return filtrarEOrdenarPevs(estado.pevs, {
    categoria: estado.categoriaFiltro,
    busca: estado.termoBusca,
    apenasAtivos: true,
    coordenadasUsuario: estado.coordenadasUsuario,
  });
}

function renderizarBadgeCategoria(catId: CategoriaResiduo): string {
  const meta = CATEGORIAS_META[catId];
  return `
    <span
      class="cat-badge"
      style="background-color: ${meta.corFundo}; color: ${meta.cor}; border-color: ${meta.corBorda};"
    >
      ${meta.iconeSvg}
      <span>${escaparHtml(meta.curto)}</span>
    </span>
  `;
}

function renderizarCabecalho(): string {
  const totalAtivos = estado.pevs.filter((p) => p.ativo).length;
  const totalDescartes = estado.descartes.length;
  const pendentesOffline = estado.descartes.filter(
    (d) => d.statusSincronizacao === 'pendente_offline'
  ).length;
  const totalMetaisGramas = estado.descartes.reduce(
    (acc, item) => acc + item.metaisGramas,
    0
  );

  return `
    <header class="site-header">
      <div class="header-topbar">
        <div>
          <span class="header-topbar-badge">MACEIÓ - AL</span>
        </div>
        <div>
          <span>PEVs: <strong>${totalAtivos}</strong></span>
          <span> · Descartes: <strong>${totalDescartes}</strong> (${totalMetaisGramas}g retidos)</span>
          ${
            pendentesOffline > 0
              ? `<span style="color: #F3A87E;"> · ${pendentesOffline} salvo(s) no aparelho</span>`
              : ''
          }
        </div>
      </div>

      <div class="header-main">
        <div class="brand-block">
          <div class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/>
              <path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/>
              <path d="m14 16-3 3 3 3"/>
              <path d="M8.293 13.596 7.196 9.5 3.1 10.598"/>
              <path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/>
              <path d="m13.378 9.633 4.096 1.098 1.097-4.096"/>
            </svg>
          </div>
          <div class="brand-titles">
            <span class="brand-eyebrow">Pontos de Coleta · E-Lixo</span>
            <h1 class="brand-name">DESCARTE INTELIGENTE</h1>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          ${
            !detectarPlataformaPwa().ehStandalone
              ? `
                <button type="button" class="btn btn-accent btn-sm" id="btn-instalar-pwa">
                  <span>Instalar App</span>
                </button>
              `
              : `<span class="spec-pill">PWA Instalado</span>`
          }
          <nav class="nav-tabs-desktop" role="tablist" aria-label="Seções do sistema Descarte Inteligente">
            <button
              type="button"
              role="tab"
              class="nav-tab"
              aria-selected="${estado.aba === 'mapa'}"
              data-tab="mapa"
            >
              <span>1. Mapa de PEVs</span>
              <span class="nav-tab-tag">Maceió</span>
            </button>
            <button
              type="button"
              role="tab"
              class="nav-tab"
              aria-selected="${estado.aba === 'coletor'}"
              data-tab="coletor"
            >
              <span>2. Coletor & LGPD</span>
              <span class="nav-tab-tag">1:10</span>
            </button>
            <button
              type="button"
              role="tab"
              class="nav-tab"
              aria-selected="${estado.aba === 'institucional'}"
              data-tab="institucional"
            >
              <span>3. Projeto 5W2H & Cartaz</span>
              <span class="nav-tab-tag">ODS</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  `;
}

function renderizarBarraInferiorMobile(): string {
  return `
    <nav class="mobile-bottom-nav" role="tablist" aria-label="Navegação rápida mobile">
      <button
        type="button"
        role="tab"
        class="mobile-nav-btn"
        aria-selected="${estado.aba === 'mapa'}"
        data-tab="mapa"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <span>Mapa PEVs</span>
      </button>

      <button
        type="button"
        role="tab"
        class="mobile-nav-btn"
        aria-selected="${estado.aba === 'coletor'}"
        data-tab="coletor"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <rect x="6" y="3" width="12" height="18" rx="2"/>
          <line x1="9" y1="7" x2="15" y2="7"/>
          <line x1="12" y1="12" x2="12" y2="16"/>
        </svg>
        <span>Coletor & LGPD</span>
      </button>

      <button
        type="button"
        role="tab"
        class="mobile-nav-btn"
        aria-selected="${estado.aba === 'institucional'}"
        data-tab="institucional"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
        </svg>
        <span>5W2H & QR</span>
      </button>
    </nav>
  `;
}

function renderizarChipsCategoriasHtml(): string {
  const chipsCategorias = (Object.keys(CATEGORIAS_META) as CategoriaResiduo[])
    .map((catKey) => {
      const meta = CATEGORIAS_META[catKey];
      const ativo = estado.categoriaFiltro === catKey;
      const contagem = estado.pevs.filter(
        (p) => p.ativo && p.categorias.includes(catKey)
      ).length;
      return `
        <button
          type="button"
          class="filter-chip"
          aria-pressed="${ativo}"
          data-filter-cat="${catKey}"
        >
          <span class="filter-chip-dot" style="background-color: ${meta.cor};"></span>
          <span>${escaparHtml(meta.label)}</span>
          <span style="opacity: 0.75; font-family: var(--font-mono); font-size: 0.75rem;">(${contagem})</span>
        </button>
      `;
    })
    .join('');

  return `
    <button
      type="button"
      class="filter-chip"
      aria-pressed="${estado.categoriaFiltro === 'todas'}"
      data-filter-cat="todas"
    >
      <span>Todas (${estado.pevs.filter((p) => p.ativo).length})</span>
    </button>
    ${chipsCategorias}
  `;
}

function renderizarListaCardsPevsHtml(
  pevsFiltrados: PevComDistancia[],
  pevSelecionado: PevComDistancia | null
): string {
  const maisProximoId = pevsFiltrados.length > 0 ? pevsFiltrados[0].id : null;

  const cardsHtml =
    pevsFiltrados.length === 0
      ? `
        <div class="section-card" role="status">
          <h3 style="margin-top: 0; font-family: var(--font-display);">Nenhum PEV encontrado para este filtro</h3>
          <p style="color: var(--color-text-secondary); font-size: 0.9rem;">
            Tente limpar o campo de busca ou tocar em "Todas" para visualizar os pontos de coleta em Maceió.
          </p>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-limpar-filtros">
            Restaurar todos os PEVs de Maceió
          </button>
        </div>
      `
      : pevsFiltrados
          .map((pev) => {
            const isSelected = pevSelecionado?.id === pev.id;
            const isNearest = maisProximoId === pev.id;
            const badgesCat = pev.categorias
              .map((c) => renderizarBadgeCategoria(c))
              .join('');

            return `
              <button
                type="button"
                class="pev-card ${isSelected ? 'is-selected' : ''} ${pev.destaque_piloto ? 'is-pilot' : ''}"
                data-select-pev="${pev.id}"
                aria-label="Selecionar ${escaparHtml(pev.nome)} no bairro ${escaparHtml(pev.bairro)}"
              >
                <div class="pev-card-top">
                  <div class="pev-badges-row">
                    ${isNearest ? `<span class="badge-nearest">Mais próximo</span>` : ''}
                  </div>
                  <span class="badge-distance">${formatarDistancia(pev.distanciaKm)}</span>
                </div>
                <h3 class="pev-title">${escaparHtml(pev.nome)}</h3>
                <p class="pev-address">${escaparHtml(pev.endereco)}</p>
                <p class="pev-hours">Horário: ${escaparHtml(pev.horario_funcionamento)}</p>
                <div class="pev-cat-list">
                  ${badgesCat}
                </div>
              </button>
            `;
          })
          .join('');

  return `
    <div class="list-header-bar">
      <span>EXIBINDO <strong>${pevsFiltrados.length}</strong> PONTOS EM MACEIÓ-AL</span>
      <span>ORDEM: PROXIMIDADE</span>
    </div>
    ${cardsHtml}
  `;
}

function renderizarPainelDetalhePevHtml(
  pevSelecionado: PevComDistancia | null
): string {
  if (!pevSelecionado) return '';

  const links = gerarLinksNavegacao(
    pevSelecionado.latitude,
    pevSelecionado.longitude,
    pevSelecionado.nome
  );

  return `
    <div class="selected-pev-panel" aria-live="polite">
      <div class="selected-pev-grid">
        <div>
          <div class="pev-badges-row" style="margin-bottom: 6px;">
            <span class="spec-pill">Bairro: ${escaparHtml(pevSelecionado.bairro)}</span>
            <span class="badge-distance">${formatarDistancia(pevSelecionado.distanciaKm)}</span>
            <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--color-text-muted);">
              GPS: ${pevSelecionado.latitude.toFixed(4)}, ${pevSelecionado.longitude.toFixed(4)}
            </span>
          </div>
          <h3 style="margin: 0 0 4px 0; font-family: var(--font-display); font-size: 1.12rem;">
            ${escaparHtml(pevSelecionado.nome)}
          </h3>
          <p style="margin: 0 0 4px 0; font-size: 0.86rem; color: var(--color-text-secondary);">
            ${escaparHtml(pevSelecionado.endereco)} · Operador: <strong>${escaparHtml(pevSelecionado.operador)}</strong>
          </p>
          <div class="selected-pev-obs">
            <strong>Orientação do ponto:</strong> ${escaparHtml(pevSelecionado.observacao)}
          </div>
          <div class="pev-cat-list">
            ${pevSelecionado.categorias.map((c) => renderizarBadgeCategoria(c)).join('')}
          </div>
        </div>

        <div class="route-buttons">
          <a
            href="${links.googleMaps}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-primary"
          >
            <span>Google Maps</span>
          </a>
          <a
            href="${links.waze}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-secondary"
          >
            <span>Abrir Waze</span>
          </a>
          <a
            href="${links.appleMaps}"
            target="_blank"
            rel="noopener noreferrer"
            class="btn btn-secondary btn-sm"
          >
            <span>Apple Maps (iOS)</span>
          </a>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-copy-pev="${pevSelecionado.id}"
          >
            <span>Copiar Endereço</span>
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm full-span-btn"
            data-share-pev="${pevSelecionado.id}"
          >
            <span>Compartilhar Localização</span>
          </button>
          <button
            type="button"
            class="btn btn-accent btn-sm full-span-btn"
            data-quick-log-pev="${pevSelecionado.id}"
          >
            <span>Confirmar descarte neste ponto (+Impacto)</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderizarAbaMapa(): string {
  const pevsFiltrados = obterPevsFiltrados();
  const pevSelecionado =
    pevsFiltrados.find((p) => p.id === estado.pevSelecionadoId) ??
    pevsFiltrados[0] ??
    null;

  if (pevSelecionado && pevSelecionado.id !== estado.pevSelecionadoId) {
    estado.pevSelecionadoId = pevSelecionado.id;
  }

  return `
    <section class="qr-banner" aria-label="Orientação rápida de triagem do coletor">
      <div>
        <h2 class="qr-banner-title">
          <span>Na frente do Coletor?</span>
          <span class="spec-pill">Slot 20×4 cm | Pilhas 15×12 cm</span>
        </h2>
        <p class="qr-banner-desc">
          Deposite <strong>celulares, cabos e fones</strong> na fenda superior e <strong>pilhas/baterias</strong> na caixa metálica lateral isolada. Tem um equipamento maior (notebook, monitor, micro-ondas)? Localize abaixo o PEV ideal em Maceió.
        </p>
      </div>
      <div class="qr-banner-actions">
        <button type="button" class="btn btn-accent btn-sm" id="btn-filtrar-grandes">
          <span>Meu item não cabe no coletor (Ver PEVs Maiores)</span>
        </button>
        <button type="button" class="btn btn-secondary btn-sm" data-go-tab="coletor">
          <span>Ficha 1:10 & Checklist LGPD</span>
        </button>
      </div>
    </section>

    <section class="controls-panel" aria-label="Filtros de busca e geolocalização">
      <div class="controls-top-row">
        <div class="search-box">
          <svg class="search-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            id="input-busca-pev"
            class="search-input"
            inputmode="search"
            autocomplete="off"
            placeholder="Buscar PEV ou bairro (Cruz das Almas, Mangabeiras, Farol, Poço)..."
            value="${escaparHtml(estado.termoBusca)}"
            aria-label="Buscar Ponto de Entrega Voluntária por nome ou bairro em Maceió"
          />
        </div>

        <div class="gps-controls">
          <span id="gps-status-pill" class="gps-status-pill" aria-live="polite">${escaparHtml(estado.statusGps)}</span>
          <button type="button" class="btn btn-primary btn-sm" id="btn-usar-gps">
            <span>Usar Meu GPS</span>
          </button>
        </div>
      </div>

      <div id="category-chips-container" class="category-filters" role="group" aria-label="Filtrar PEVs por categoria de resíduo eletrônico">
        ${renderizarChipsCategoriasHtml()}
      </div>
    </section>

    <div class="mobile-view-toggle" role="group" aria-label="Modo de visualização no celular">
      <button
        type="button"
        class="view-mode-btn"
        aria-pressed="${estado.modoVisaoMobile === 'ambos'}"
        data-mobile-view-btn="ambos"
      >
        Mapa + Lista
      </button>
      <button
        type="button"
        class="view-mode-btn"
        aria-pressed="${estado.modoVisaoMobile === 'mapa'}"
        data-mobile-view-btn="mapa"
      >
        Foco no Mapa
      </button>
      <button
        type="button"
        class="view-mode-btn"
        aria-pressed="${estado.modoVisaoMobile === 'lista'}"
        data-mobile-view-btn="lista"
      >
        Só Lista (${pevsFiltrados.length})
      </button>
    </div>

    <div id="workspace-grid-mapa" class="workspace-grid" data-mobile-view="${estado.modoVisaoMobile}">
      <div id="pev-list-container" class="pev-list-column" aria-label="Lista de Pontos de Entrega Voluntária ordenada por proximidade">
        ${renderizarListaCardsPevsHtml(pevsFiltrados, pevSelecionado)}
      </div>

      <div class="map-column">
        <div class="map-frame-card">
          <div class="map-frame-header">
            <span>CARTOGRAFIA MACEIÓ-AL · LEAFLET + OSM</span>
            <span>TOQUE EM UM PIN PARA ROTA</span>
          </div>
          <div id="leaflet-map" class="leaflet-map-box" role="region" aria-label="Mapa interativo de PEVs de lixo eletrônico em Maceió"></div>
          <div id="selected-pev-panel-container">
            ${renderizarPainelDetalhePevHtml(pevSelecionado)}
          </div>
        </div>
      </div>
    </div>
  `;
}

function atualizarParcialAbaMapa(centralizarNoSelecionado = false): void {
  const pevsFiltrados = obterPevsFiltrados();
  let pevSelecionado =
    pevsFiltrados.find((p) => p.id === estado.pevSelecionadoId) ??
    pevsFiltrados[0] ??
    null;

  if (pevSelecionado && pevSelecionado.id !== estado.pevSelecionadoId) {
    estado.pevSelecionadoId = pevSelecionado.id;
  }

  const chipsEl = document.getElementById('category-chips-container');
  if (chipsEl) {
    chipsEl.innerHTML = renderizarChipsCategoriasHtml();
  }

  const listaEl = document.getElementById('pev-list-container');
  if (listaEl) {
    listaEl.innerHTML = renderizarListaCardsPevsHtml(
      pevsFiltrados,
      pevSelecionado
    );
  }

  const detalheEl = document.getElementById('selected-pev-panel-container');
  if (detalheEl) {
    detalheEl.innerHTML = renderizarPainelDetalhePevHtml(pevSelecionado);
  }

  const gpsEl = document.getElementById('gps-status-pill');
  if (gpsEl) {
    gpsEl.textContent = estado.statusGps;
  }

  vincularEventosParciaisMapa();
  atualizarMarkersMapaLeaflet(pevsFiltrados, centralizarNoSelecionado);
  persistirEstadoSessao();
}

function renderizarAbaColetorELgpd(): string {
  const calloutAtual =
    CALLOUTS_COLETOR.find((c) => c.numero === estado.calloutColetorAtivo) ??
    CALLOUTS_COLETOR[0];

  const itemCalc =
    ITENS_CALCULADORA.find((i) => i.id === estado.itemCalculadoraId) ??
    ITENS_CALCULADORA[0];

  const totalPassosLgpd = CHECKLIST_LGPD.length;
  const passosConcluidos = CHECKLIST_LGPD.filter(
    (item) => estado.checklistLgpd[item.id]
  ).length;

  return `
    <section class="technical-sheet" aria-labelledby="titulo-prancha-coletor">
      <div class="sheet-header">
        <div>
          <h2 class="sheet-title-main" id="titulo-prancha-coletor">
            COLETOR DE
            <span class="sheet-title-accent">DESCARTE ELETRÔNICO</span>
          </h2>
          <div class="sheet-meta-mono" style="margin-top: 6px;">
            DESCARTE INTELIGENTE — EXTENSIONISTA II · PROTÓTIPO DO COLETOR · ESCALA 1:10
          </div>
        </div>
        <div>
          <span class="spec-pill">Cilindro ⌀ 40 cm × 60 cm</span>
          <div class="sheet-meta-mono" style="margin-top: 4px;">
            Local: Entrada do Refeitório (Campus UNIMA)
          </div>
        </div>
      </div>

      <div class="blueprint-grid">
        <div class="blueprint-box">
          <div class="blueprint-caption">
            <span>PRANCHA TÉCNICA INTERATIVA (TOQUE NOS ITENS 1 A 4)</span>
            <span>UNID.: CM</span>
          </div>
          ${renderizarDesenhoTecnicoSvg(estado.calloutColetorAtivo)}
        </div>

        <div class="callout-list" role="region" aria-label="Especificações dos componentes do coletor">
          ${CALLOUTS_COLETOR.map((item) => {
            const ativo = item.numero === estado.calloutColetorAtivo;
            return `
              <button
                type="button"
                class="callout-item ${ativo ? 'is-active' : ''}"
                data-callout="${item.numero}"
                aria-pressed="${ativo}"
              >
                <span class="callout-number">${item.numero}</span>
                <div>
                  <div style="display: flex; justify-content: space-between; gap: 8px; align-items: center; flex-wrap: wrap;">
                    <strong style="font-family: var(--font-display); font-size: 0.98rem;">${escaparHtml(item.titulo)}</strong>
                    <span class="spec-pill">${escaparHtml(item.dimensao)}</span>
                  </div>
                  <p style="margin: 4px 0; font-size: 0.85rem; color: var(--color-text-secondary);">
                    ${escaparHtml(item.resumo)}
                  </p>
                  <p style="margin: 4px 0 0 0; font-size: 0.78rem; color: var(--color-text-muted);">
                    <strong>Engenharia:</strong> ${escaparHtml(item.justificativaEngenharia)}
                  </p>
                </div>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <div class="lithium-warning-box" role="note">
        <h3 style="margin: 0 0 6px 0; font-family: var(--font-display); font-size: 1.02rem; color: var(--color-brand-secondary);">
          Por que as pilhas e baterias ficam em caixa metálica isolada (${escaparHtml(calloutAtual.titulo)})?
        </h3>
        <p style="margin: 0; font-size: 0.88rem; color: var(--color-text-primary);">
          Baterias — sobretudo as de <strong>íon-lítio</strong> — entram em curto-circuito e sofrem <em>fuga térmica</em> (podendo incendiar) quando comprimidas ou perfuradas junto a outros metais, o que ocorre caso fiquem misturadas com cabos, conectores e placas no mesmo tambor plástico. Por isso, o protótipo isola as pilhas em um <strong>compartimento metálico lateral externo de 15 × 12 cm</strong>, projetado para conter calor e impedir ignição.
        </p>
      </div>
    </section>

    <div class="two-col-section">
      <!-- Calculadora / Triagem de Resíduo -->
      <section class="section-card" aria-labelledby="titulo-simulador-tox">
        <span class="brand-eyebrow">Simulador de Impacto & Gabarito Físico</span>
        <h2 id="titulo-simulador-tox" style="margin: 4px 0 12px 0; font-family: var(--font-display);">
          O que você deseja descartar hoje?
        </h2>

        <div class="form-field" style="margin-bottom: 16px;">
          <label for="select-item-calculadora">Selecione o tipo de equipamento:</label>
          <select id="select-item-calculadora" class="form-input">
            ${ITENS_CALCULADORA.map(
              (it) => `
                <option value="${it.id}" ${it.id === itemCalc.id ? 'selected' : ''}>
                  ${escaparHtml(it.nome)} (~${it.pesoMedioGramas}g)
                </option>
              `
            ).join('')}
          </select>
        </div>

        <div style="background: var(--color-bg-canvas); border: 1.5px solid var(--color-border-strong); padding: 14px; border-radius: var(--radius-sm);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">
            <span class="spec-pill" style="background: ${itemCalc.cabeNoColetorPiloto ? '#ECF4EF' : '#FDF1EB'}; color: ${itemCalc.cabeNoColetorPiloto ? '#1D633B' : '#B84A18'}; border-color: currentColor;">
              ${itemCalc.cabeNoColetorPiloto ? '✓ CABE NO COLETOR (20×4 cm)' : '✕ EXCEDE O COLETOR — EXIGE ECOPONTO MAIOR'}
            </span>
            <span style="font-family: var(--font-mono); font-size: 0.78rem; font-weight: 600;">
              Retém ~${itemCalc.metaisEvitadosGramas}g de compostos tóxicos
            </span>
          </div>

          <p style="margin: 0 0 10px 0; font-size: 0.88rem; color: var(--color-text-secondary);">
            ${escaparHtml(itemCalc.alertaManuseio)}
          </p>

          <div style="margin-bottom: 14px;">
            <strong style="font-size: 0.78rem; font-family: var(--font-mono); text-transform: uppercase;">
              Elementos críticos evitados no solo/lençol freático:
            </strong>
            <div class="pev-cat-list" style="margin-top: 6px;">
              ${itemCalc.elementosPrincipais
                .map(
                  (el) =>
                    `<span class="badge-distance" style="background: #fff;">${escaparHtml(el)}</span>`
                )
                .join('')}
            </div>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              data-ver-pevs-categoria="${itemCalc.categoriaRecomendada}"
            >
              <span>Ver PEVs para ${escaparHtml(CATEGORIAS_META[itemCalc.categoriaRecomendada].curto)}</span>
            </button>
            <button
              type="button"
              class="btn btn-accent btn-sm"
              id="btn-registrar-descarte-calc"
            >
              <span>Registrar descarte (+${itemCalc.metaisEvitadosGramas}g retidos)</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Checklist LGPD -->
      <section class="section-card" aria-labelledby="titulo-lgpd">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <span class="brand-eyebrow">Frente Jurídica · Direito Digital & LGPD</span>
          <span class="spec-pill">${passosConcluidos}/${totalPassosLgpd} verificados</span>
        </div>
        <h2 id="titulo-lgpd" style="margin: 4px 0 8px 0; font-family: var(--font-display);">
          Protocolo de Sanitização de Dados (LGPD)
        </h2>
        <p style="margin: 0 0 14px 0; font-size: 0.86rem; color: var(--color-text-secondary);">
          Segundo a <strong>Lei 13.709/2018 (LGPD)</strong> e a norma <strong>ABNT ISO/IEC 27001</strong>, o ciclo de vida do dado pessoal só termina com sua destruição segura. Marque os passos antes de depositar celulares ou computadores:
        </p>

        <div>
          ${CHECKLIST_LGPD.map((passo) => {
            const marcado = Boolean(estado.checklistLgpd[passo.id]);
            return `
              <label class="lgpd-check-item">
                <input
                  type="checkbox"
                  data-lgpd-check="${passo.id}"
                  ${marcado ? 'checked' : ''}
                />
                <div>
                  <strong style="display: block; font-size: 0.88rem;">${escaparHtml(passo.titulo)}</strong>
                  <span style="display: block; font-size: 0.8rem; color: var(--color-text-secondary); margin-top: 2px;">
                    ${escaparHtml(passo.detalhe)}
                  </span>
                  <span style="display: inline-block; font-family: var(--font-mono); font-size: 0.7rem; color: var(--color-brand-primary); margin-top: 4px;">
                    Base normativa: ${escaparHtml(passo.norma)}
                  </span>
                </div>
              </label>
            `;
          }).join('')}
        </div>
      </section>
    </div>

    <!-- Mapeamento Toxicológico eCycle / CETEM -->
    <section class="section-card" aria-labelledby="titulo-tabela-toxica">
      <span class="brand-eyebrow">Embasamento Científico · CETEM & Agência Internacional de Pesquisa do Câncer (IARC)</span>
      <h2 id="titulo-tabela-toxica" style="margin: 4px 0 8px 0; font-family: var(--font-display);">
        Por que o E-Lixo responde por 70% dos metais pesados em aterros?
      </h2>
      <p style="margin: 0 0 16px 0; font-size: 0.88rem; color: var(--color-text-secondary);">
        Embora represente uma fração menor do volume urbano, o resíduo eletrônico concentra elementos classificados nos Grupos 1 e 2A da IARC que infiltram no solo e contaminam o lençol freático:
      </p>

      <div class="matrix-grid">
        ${ELEMENTOS_TOXICOS.map(
          (el) => `
            <div class="matrix-card">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; margin-bottom: 6px;">
                <strong style="font-family: var(--font-display); font-size: 1rem;">
                  ${escaparHtml(el.nome)} (${escaparHtml(el.simbolo)})
                </strong>
                <span class="spec-pill">${escaparHtml(el.grupoIarc)}</span>
              </div>
              <p style="margin: 0 0 6px 0; font-size: 0.82rem; color: var(--color-text-secondary);">
                <strong>Onde está:</strong> ${escaparHtml(el.encontradoEm)}
              </p>
              <p style="margin: 0; font-size: 0.82rem; color: var(--color-text-primary);">
                <strong>Impacto biológico:</strong> ${escaparHtml(el.efeitosAgudosCronicos)}
              </p>
            </div>
          `
        ).join('')}
      </div>
    </section>
  `;
}

function renderizarAbaInstitucional(): string {
  const urlQr =
    estado.urlQrCodeCustom.trim() ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'https://descarte-inteligente-chi.vercel.app');

  return `
    <!-- Indicadores da Árvore do Problema -->
    <div class="stats-strip" role="region" aria-label="Indicadores científicos do problema do lixo eletrônico no Brasil">
      <div class="stat-box">
        <div class="stat-value">&gt; 2,0 Mi ton</div>
        <div class="stat-label">Geradas por ano no Brasil (5º maior produtor mundial e 1º na América Latina)</div>
      </div>
      <div class="stat-box">
        <div class="stat-value" style="color: var(--color-brand-secondary);">3% a 4%</div>
        <div class="stat-label">Taxa efetiva de reciclagem adequada de e-lixo no território nacional</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">73%</div>
        <div class="stat-label">Dos brasileiros apontam a falta de PEVs próximos como barreira (49% têm dúvidas)</div>
      </div>
      <div class="stat-box">
        <div class="stat-value" style="color: var(--color-brand-secondary);">70%</div>
        <div class="stat-label">Dos metais pesados em lixões e aterros têm origem em resíduos eletrônicos</div>
      </div>
    </div>

    <!-- Matriz 5W2H -->
    <section class="section-card" style="margin-bottom: var(--space-6);" aria-labelledby="titulo-5w2h">
      <span class="brand-eyebrow">Planejamento Operacional · Metodologia 5W2H</span>
      <h2 id="titulo-5w2h" style="margin: 4px 0 16px 0; font-family: var(--font-display);">
        Matriz 5W2H — Projeto Descarte Inteligente
      </h2>

      <div class="matrix-grid">
        <div class="matrix-card">
          <span class="matrix-tag">WHAT · O que será feito?</span>
          <p style="margin: 6px 0 0 0; font-size: 0.88rem;">
            Ecossistema <strong>fígital</strong> integrando um coletor físico ecológico (cilindro ⌀ 40×60 cm com isolamento metálico para pilhas) a uma Web App Mobile-First com mapeamento interativo dos PEVs de Maceió-AL.
          </p>
        </div>

        <div class="matrix-card">
          <span class="matrix-tag">WHY · Por que será feito?</span>
          <p style="margin: 6px 0 0 0; font-size: 0.88rem;">
            Mitigar o gargalo de descarte (apenas 3–4% reciclado) e a desinformação de 49% da população, prevenindo a contaminação do lençol freático por metais pesados e cumprindo a PNRS (Lei 12.305/2010) e o Decreto 10.240/2020.
          </p>
        </div>

        <div class="matrix-card">
          <span class="matrix-tag">WHERE · Onde será feito?</span>
          <p style="margin: 6px 0 0 0; font-size: 0.88rem;">
            <strong>Físico:</strong> Estudo de cenários entre (A) Escola-Parceira, (B) Centro de Inovação do Polo Tecnológico (CIPT Jaraguá) e (C) Campus UNIMA (Cruz das Almas).<br/>
            <strong>Digital:</strong> Aplicativo web acessível por QR Code em nuvem gratuita.
          </p>
        </div>

        <div class="matrix-card">
          <span class="matrix-tag">WHEN · Quando será feito?</span>
          <p style="margin: 6px 0 0 0; font-size: 0.88rem;">
            Ciclo ágil de 4 semanas, com repasse periódico do material coletado para ecopontos homologados (Green Eletron / cooperativa local).
          </p>
        </div>

        <div class="matrix-card">
          <span class="matrix-tag">WHO · Por quem será feito?</span>
          <p style="margin: 6px 0 0 0; font-size: 0.88rem;">
            Equipe multidisciplinar de <strong>17 discentes</strong> (13 de Ciência da Computação, 2 de Direito, 1 de Ciências Contábeis e 1 de Administração).
          </p>
        </div>

        <div class="matrix-card">
          <span class="matrix-tag">HOW · Como será feito?</span>
          <p style="margin: 6px 0 0 0; font-size: 0.88rem;">
            Reaproveitamento estrutural para o coletor físico com separação de risco químico (caixa metálica 15×12 cm para baterias), cartografia aberta (Leaflet + OpenStreetMap) e conformidade jurídica (PNRS + LGPD).
          </p>
        </div>

        <div class="matrix-card" style="grid-column: 1 / -1; border-left: 5px solid var(--color-brand-primary);">
          <span class="matrix-tag">HOW MUCH · Quanto custará? (Orçamento de Baixíssimo Custo)</span>
          <p style="margin: 6px 0 0 0; font-size: 0.88rem;">
            <strong>Investimento Total Estimado: R$ 90,00 a R$ 110,00</strong> (cerca de R$ 5,30 a R$ 6,50 por integrante):
            <br/>• Adaptação do Coletor Físico + Caixa Metálica + Cadeado: <strong>R$ 30,00 a R$ 50,00</strong>
            <br/>• Impressão de Cartazes A3/A4 Coloridos e Adesivo Vinil com QR Code: <strong>R$ 40,00 a R$ 60,00</strong>
            <br/>• Infraestrutura de Software, Mapas (OSM/Leaflet) e Hospedagem Cloud: <strong>R$ 0,00 (100% Free Tier)</strong>
          </p>
        </div>
      </div>
    </section>

    <!-- ODS + Marco Legal -->
    <div class="two-col-section">
      <section class="section-card" aria-labelledby="titulo-ods">
        <span class="brand-eyebrow">Agenda 2030 da ONU</span>
        <h2 id="titulo-ods" style="margin: 4px 0 12px 0; font-family: var(--font-display);">
          Alinhamento com os Objetivos de Desenvolvimento Sustentável
        </h2>
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <div class="matrix-card">
            <strong style="color: var(--color-brand-secondary);">ODS 4 — Educação de Qualidade</strong>
            <p style="margin: 4px 0 0 0; font-size: 0.84rem;">
              Conscientização prática da comunidade acadêmica e escolar por meio de sinalização educativa e letramento ambiental e digital no ato do descarte.
            </p>
          </div>
          <div class="matrix-card">
            <strong style="color: var(--color-brand-primary);">ODS 11 — Cidades e Comunidades Sustentáveis</strong>
            <p style="margin: 4px 0 0 0; font-size: 0.84rem;">
              Redução direta do impacto ambiental negativo per capita em Maceió através da retenção de chumbo, mercúrio e cádmio antes que cheguem aos aterros.
            </p>
          </div>
          <div class="matrix-card">
            <strong style="color: var(--color-text-primary);">ODS 12 — Consumo e Produção Responsáveis</strong>
            <p style="margin: 4px 0 0 0; font-size: 0.84rem;">
              Destinação ambientalmente adequada e fomento à <em>Mineração Urbana</em> (recuperação de metais como ouro, prata, cobre e terras raras).
            </p>
          </div>
        </div>
      </section>

      <section class="section-card" aria-labelledby="titulo-equipe">
        <span class="brand-eyebrow">Governança & Multidisciplinaridade</span>
        <h2 id="titulo-equipe" style="margin: 4px 0 12px 0; font-family: var(--font-display);">
          Equipe Multidisciplinar (17 Integrantes)
        </h2>
        <p style="margin: 0 0 12px 0; font-size: 0.84rem; color: var(--color-text-secondary);">
          <strong>Liderança:</strong> ${escaparHtml(EQUIPE_PROJETO.lideranca)} · <strong>Tema:</strong> ${escaparHtml(EQUIPE_PROJETO.tema)}
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px;">
          ${EQUIPE_PROJETO.cursos
            .map(
              (grupo) => `
                <div class="matrix-card" style="padding: 10px 14px;">
                  <strong style="font-size: 0.88rem; color: var(--color-brand-primary);">${escaparHtml(grupo.curso)}</strong>
                  <div style="font-size: 0.76rem; color: var(--color-text-muted); margin-bottom: 4px;">
                    ${escaparHtml(grupo.papel)}
                  </div>
                  <div style="font-size: 0.8rem; color: var(--color-text-primary);">
                    ${grupo.alunos.map((a) => escaparHtml(a)).join(' · ')}
                  </div>
                </div>
              `
            )
            .join('')}
        </div>
      </section>
    </div>

    <!-- Cartaz Físico QR Code Imprimível -->
    <section class="section-card" aria-labelledby="titulo-cartaz">
      <div class="no-print" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 14px;">
        <div>
          <span class="brand-eyebrow">Gerador ISO/IEC 18004 Real · Alta Resolução</span>
          <h2 id="titulo-cartaz" style="margin: 4px 0 0 0; font-family: var(--font-display);">
            Gerador de QR Code & Cartaz A4 para o Coletor
          </h2>
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          <button type="button" class="btn btn-secondary" id="btn-baixar-qr-svg">
            <span>Baixar QR Code (.SVG Vetorial)</span>
          </button>
          <button type="button" class="btn btn-primary" id="btn-imprimir-cartaz">
            <span>Imprimir Cartaz A4 (PDF / Impressora)</span>
          </button>
        </div>
      </div>

      <div class="no-print" style="background: var(--color-bg-canvas); border: 1.5px solid var(--color-border-strong); padding: 14px; border-radius: var(--radius-sm); margin-bottom: 16px;">
        <div class="form-field">
          <label for="input-url-qrcode">URL de destino codificada no QR Code (escaneável pela câmera do celular):</label>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <input
              type="url"
              id="input-url-qrcode"
              class="form-input"
              style="flex: 1 1 280px;"
              value="${escaparHtml(urlQr)}"
              placeholder="https://descarte-inteligente-chi.vercel.app"
            />
            <button type="button" class="btn btn-secondary btn-sm" data-qr-preset="${escaparHtml(typeof window !== 'undefined' ? window.location.origin : 'https://descarte-inteligente-chi.vercel.app')}">
              <span>Usar URL Atual do App</span>
            </button>
          </div>
        </div>
      </div>

      <div class="poster-preview">
        <div style="font-family: var(--font-mono); font-size: 0.76rem; letter-spacing: 0.08em; color: var(--color-brand-secondary); font-weight: 700;">
          PROJETO DESCARTE INTELIGENTE · MACEIÓ-AL
        </div>
        <h3 style="font-family: var(--font-display); font-size: 1.75rem; margin: 6px 0; text-transform: uppercase;">
          DESCARTE INTELIGENTE DE E-LIXO
        </h3>
        <p style="margin: 0 auto 16px auto; max-width: 520px; font-size: 0.92rem; color: var(--color-text-secondary);">
          Deposite <strong>cabos, carregadores, fones e celulares</strong> na fenda superior (20×4 cm) e <strong>pilhas/baterias</strong> exclusivamente na caixa metálica lateral (15×12 cm).
        </p>

        <div id="qr-svg-preview-box" style="display: inline-block; padding: 12px; background: #fff; border: 2px solid #1a211e; border-radius: 8px; margin-bottom: 10px;">
          ${gerarSvgQrCodeDidatico(urlQr, 220)}
        </div>

        <div style="font-family: var(--font-mono); font-size: 0.74rem; color: var(--color-text-muted); margin-bottom: 10px;">
          ${escaparHtml(urlQr)}
        </div>

        <div style="font-family: var(--font-display); font-size: 1.08rem; font-weight: 700; color: var(--color-brand-primary);">
          SEU EQUIPAMENTO NÃO CABE AQUI? ESCANEIE O QR CODE!
        </div>
        <p style="margin: 4px 0 0 0; font-family: var(--font-mono); font-size: 0.78rem; color: var(--color-text-secondary);">
          Localize em 2 toques o PEV credenciado mais próximo em Maceió e veja como proteger seus dados (LGPD).
        </p>
      </div>
    </section>
  `;
}

function atualizarMarkersMapaLeaflet(
  pevsFiltrados: PevComDistancia[],
  centralizarNoSelecionado = false
): void {
  if (!instanciaMapa || !camadaMarkers) return;

  camadaMarkers.clearLayers();

  if (estado.coordenadasUsuario) {
    const marcadorUsuario = L.circleMarker(
      [estado.coordenadasUsuario.latitude, estado.coordenadasUsuario.longitude],
      {
        radius: 8,
        fillColor: '#2E4775',
        color: '#FFFFFF',
        weight: 3,
        fillOpacity: 1,
      }
    );
    const precisaoTxt = estado.coordenadasUsuario.precisaoMetros
      ? ` (±${Math.round(estado.coordenadasUsuario.precisaoMetros)}m)`
      : '';
    marcadorUsuario.bindTooltip(
      `Sua referência: ${estado.coordenadasUsuario.rotulo}${precisaoTxt}`,
      { direction: 'top' }
    );
    marcadorUsuario.addTo(camadaMarkers);
  }

  pevsFiltrados.forEach((pev) => {
    const catPrincipal = pev.categorias[0] ?? 'cabos';
    const meta = CATEGORIAS_META[catPrincipal];
    const corPin = pev.destaque_piloto ? '#C85A24' : meta.cor;

    const icone = L.divIcon({
      className: 'custom-pev-marker',
      html: `
        <div class="marker-pin ${pev.destaque_piloto ? 'is-pilot-pin' : ''}" style="background-color: ${corPin};">
          <div class="marker-pin-inner">${meta.iconeSvg}</div>
        </div>
      `,
      iconSize: pev.destaque_piloto ? [44, 44] : [38, 38],
      iconAnchor: pev.destaque_piloto ? [22, 44] : [19, 38],
      popupAnchor: [0, -34],
    });

    const marker = L.marker([pev.latitude, pev.longitude], {
      icon: icone,
      title: pev.nome,
    });

    marker.on('click', () => {
      estado.pevSelecionadoId = pev.id;
      atualizarParcialAbaMapa(true);
      const painel = document.getElementById('selected-pev-panel-container');
      if (painel && window.innerWidth < 768) {
        painel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    if (pev.id === estado.pevSelecionadoId) {
      marker.bindTooltip(`Selecionado: ${pev.nome}`, {
        permanent: false,
        direction: 'top',
      });
    }

    marker.addTo(camadaMarkers!);
  });

  const pevFoco =
    pevsFiltrados.find((p) => p.id === estado.pevSelecionadoId) ??
    pevsFiltrados[0];

  if (pevFoco && centralizarNoSelecionado) {
    instanciaMapa.panTo([pevFoco.latitude, pevFoco.longitude], {
      animate: true,
    });
  }
}

function inicializarOuAtualizarMapaLeaflet(): void {
  const container = document.getElementById('leaflet-map');
  if (!container) {
    if (instanciaMapa) {
      instanciaMapa.remove();
      instanciaMapa = null;
      camadaMarkers = null;
    }
    return;
  }

  const pevsFiltrados = obterPevsFiltrados();
  const pevFoco =
    pevsFiltrados.find((p) => p.id === estado.pevSelecionadoId) ??
    pevsFiltrados[0];

  const latInicial = pevFoco
    ? pevFoco.latitude
    : COORDENADAS_PADRAO_PILOTO.latitude;
  const lngInicial = pevFoco
    ? pevFoco.longitude
    : COORDENADAS_PADRAO_PILOTO.longitude;

  if (!instanciaMapa) {
    instanciaMapa = L.map(container, {
      center: [latInicial, lngInicial],
      zoom: 13,
      zoomControl: true,
      preferCanvas: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Descarte Inteligente Maceió',
    }).addTo(instanciaMapa);

    camadaMarkers = L.layerGroup().addTo(instanciaMapa);
  }

  atualizarMarkersMapaLeaflet(pevsFiltrados, false);
}

function vincularEventosParciaisMapa(): void {
  // Chips de categoria (atualização parcial sem destruir o mapa)
  document
    .querySelectorAll<HTMLButtonElement>('[data-filter-cat]')
    .forEach((chip) => {
      chip.onclick = () => {
        const cat = chip.getAttribute('data-filter-cat') as
          | CategoriaResiduo
          | 'todas';
        if (cat) {
          estado.categoriaFiltro = cat;
          atualizarParcialAbaMapa(true);
        }
      };
    });

  // Botão limpar filtros
  const btnLimpar = document.getElementById('btn-limpar-filtros');
  if (btnLimpar) {
    btnLimpar.onclick = () => {
      estado.categoriaFiltro = 'todas';
      estado.termoBusca = '';
      const inputBusca = document.getElementById(
        'input-busca-pev'
      ) as HTMLInputElement | null;
      if (inputBusca) inputBusca.value = '';
      atualizarParcialAbaMapa(true);
    };
  }

  // Seleção de Card PEV
  document
    .querySelectorAll<HTMLButtonElement>('[data-select-pev]')
    .forEach((card) => {
      card.onclick = () => {
        const id = Number(card.getAttribute('data-select-pev'));
        if (!Number.isNaN(id)) {
          estado.pevSelecionadoId = id;
          if (estado.modoVisaoMobile === 'lista') {
            estado.modoVisaoMobile = 'ambos';
            const grid = document.getElementById('workspace-grid-mapa');
            if (grid) grid.setAttribute('data-mobile-view', 'ambos');
            if (instanciaMapa) {
              window.setTimeout(() => instanciaMapa?.invalidateSize(), 100);
            }
          }
          atualizarParcialAbaMapa(true);
        }
      };
    });

  // Copiar Endereço do PEV
  document
    .querySelectorAll<HTMLButtonElement>('[data-copy-pev]')
    .forEach((btn) => {
      btn.onclick = async () => {
        const id = Number(btn.getAttribute('data-copy-pev'));
        const pev = estado.pevs.find((p) => p.id === id);
        if (!pev) return;
        try {
          await navigator.clipboard.writeText(
            `${pev.nome} — ${pev.endereco} (${pev.horario_funcionamento})`
          );
          mostrarNotificacao('Endereço copiado para a área de transferência!');
        } catch {
          mostrarNotificacao(`Endereço: ${pev.endereco}`);
        }
      };
    });

  // Compartilhar PEV (Web Share API no celular)
  document
    .querySelectorAll<HTMLButtonElement>('[data-share-pev]')
    .forEach((btn) => {
      btn.onclick = async () => {
        const id = Number(btn.getAttribute('data-share-pev'));
        const pev = estado.pevs.find((p) => p.id === id);
        if (!pev) return;
        const texto = `Ponto de Coleta de E-Lixo em Maceió: ${pev.nome} (${pev.endereco} · ${pev.horario_funcionamento})`;
        if (navigator.share) {
          try {
            await navigator.share({
              title: pev.nome,
              text: texto,
              url: window.location.href,
            });
            return;
          } catch {
            // Usuário cancelou o share
            return;
          }
        }
        try {
          await navigator.clipboard.writeText(
            `${texto} - ${window.location.href}`
          );
          mostrarNotificacao('Link e endereço do PEV copiados!');
        } catch {
          mostrarNotificacao(texto);
        }
      };
    });

  // Confirmar descarte rápido em um PEV
  document
    .querySelectorAll<HTMLButtonElement>('[data-quick-log-pev]')
    .forEach((btn) => {
      btn.onclick = async () => {
        const pevId = Number(btn.getAttribute('data-quick-log-pev'));
        const pev = estado.pevs.find((p) => p.id === pevId);
        if (!pev) return;
        const resultado = await registrarNovoDescarte({
          itemNome: 'Resíduo Eletrônico (Triagem Rápida)',
          categoria: pev.categorias[0] ?? 'pilhas',
          pevId: pev.id,
          pevNome: pev.nome,
          pesoGramas: 120,
          metaisGramas: 40,
        });
        estado.descartes = resultado.lista;
        const sufixoSinc = resultado.sincronizadoServidor
          ? 'Sincronizado com o servidor.'
          : 'Salvo no aparelho (sincronizará quando houver rede).';
        mostrarNotificacao(
          `Descarte registrado em "${pev.nome}"! +40g de metais pesados retidos. ${sufixoSinc}`
        );
      };
    });
}

function vincularEventosDom(): void {
  // Botão Instalar PWA (Android WebAPK + Guia iOS Safari)
  const btnInstalar = document.getElementById('btn-instalar-pwa');
  if (btnInstalar) {
    btnInstalar.addEventListener('click', async () => {
      if (estado.eventoInstalacaoPwa) {
        await estado.eventoInstalacaoPwa.prompt();
        estado.eventoInstalacaoPwa = null;
        estado.exibirGuiaInstalacaoPwa = false;
        renderizarApp();
        return;
      }
      estado.exibirGuiaInstalacaoPwa = !estado.exibirGuiaInstalacaoPwa;
      renderizarApp();
    });
  }

  const btnFecharGuiaPwa = document.getElementById('btn-fechar-guia-pwa');
  if (btnFecharGuiaPwa) {
    btnFecharGuiaPwa.addEventListener('click', () => {
      estado.exibirGuiaInstalacaoPwa = false;
      renderizarApp();
    });
  }

  // Navegação de abas (Top desktop + Bottom mobile)
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const novaAba = btn.getAttribute('data-tab') as AbaAtiva;
      if (novaAba && novaAba !== estado.aba) {
        if (novaAba !== 'mapa' && instanciaMapa) {
          instanciaMapa.remove();
          instanciaMapa = null;
          camadaMarkers = null;
        }
        estado.aba = novaAba;
        persistirEstadoSessao();
        renderizarApp();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  });

  document
    .querySelectorAll<HTMLButtonElement>('[data-go-tab]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const destino = btn.getAttribute('data-go-tab') as AbaAtiva;
        if (destino) {
          if (instanciaMapa) {
            instanciaMapa.remove();
            instanciaMapa = null;
            camadaMarkers = null;
          }
          estado.aba = destino;
          persistirEstadoSessao();
          renderizarApp();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });

  // Alternador de visão mobile (Mapa + Lista / Foco Mapa / Só Lista)
  document
    .querySelectorAll<HTMLButtonElement>('[data-mobile-view-btn]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const modo = btn.getAttribute(
          'data-mobile-view-btn'
        ) as ModoVisaoMobile;
        if (!modo) return;
        estado.modoVisaoMobile = modo;
        const grid = document.getElementById('workspace-grid-mapa');
        if (grid) {
          grid.setAttribute('data-mobile-view', modo);
        }
        document
          .querySelectorAll<HTMLButtonElement>('[data-mobile-view-btn]')
          .forEach((b) =>
            b.setAttribute(
              'aria-pressed',
              String(b.getAttribute('data-mobile-view-btn') === modo)
            )
          );
        if (modo !== 'lista' && instanciaMapa) {
          window.setTimeout(() => instanciaMapa?.invalidateSize(), 80);
        }
      });
    });

  // Botão rápido "Meu item não cabe no coletor"
  const btnGrandes = document.getElementById('btn-filtrar-grandes');
  if (btnGrandes) {
    btnGrandes.addEventListener('click', () => {
      estado.categoriaFiltro = 'computadores';
      estado.pevSelecionadoId = 3; // Parque Shopping (a 850m do ponto piloto)
      atualizarParcialAbaMapa(true);
      mostrarNotificacao(
        'Filtro ajustado para Computadores/Médio Porte. Destacando PEV Parque Shopping (850m da UNIMA).'
      );
    });
  }

  // Busca textual com debounce (não destrói o mapa nem perde foco no teclado mobile)
  const inputBusca = document.getElementById(
    'input-busca-pev'
  ) as HTMLInputElement | null;
  if (inputBusca) {
    inputBusca.addEventListener('input', (e) => {
      estado.termoBusca = (e.target as HTMLInputElement).value;
      if (timerDebounceBusca !== null) {
        window.clearTimeout(timerDebounceBusca);
      }
      timerDebounceBusca = window.setTimeout(() => {
        atualizarParcialAbaMapa(false);
      }, 140);
    });
  }

  // GPS real do navegador com exibição de precisão em metros
  const btnGps = document.getElementById('btn-usar-gps');
  if (btnGps) {
    btnGps.addEventListener('click', () => {
      if (!('geolocation' in navigator)) {
        mostrarNotificacao(
          'Seu navegador não suporta geolocalização. Mantendo referência no Campus UNIMA.'
        );
        return;
      }
      estado.statusGps = 'Obtendo GPS...';
      const gpsEl = document.getElementById('gps-status-pill');
      if (gpsEl) gpsEl.textContent = estado.statusGps;

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const precisao = Math.round(pos.coords.accuracy || 0);
          estado.coordenadasUsuario = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            rotulo: 'Sua localização GPS atual',
            precisaoMetros: precisao,
          };
          estado.statusGps = `GPS ativo (±${precisao}m)`;
          const ordenados = obterPevsFiltrados();
          if (ordenados.length > 0) {
            estado.pevSelecionadoId = ordenados[0].id;
          }
          atualizarParcialAbaMapa(true);
          mostrarNotificacao(
            `Localização obtida (±${precisao}m)! O PEV mais próximo foi destacado.`
          );
        },
        () => {
          estado.coordenadasUsuario = {
            latitude: COORDENADAS_PADRAO_PILOTO.latitude,
            longitude: COORDENADAS_PADRAO_PILOTO.longitude,
            rotulo: COORDENADAS_PADRAO_PILOTO.label,
          };
          estado.statusGps = 'GPS desativado';
          atualizarParcialAbaMapa(true);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
  }

  vincularEventosParciaisMapa();

  // Interação da Ficha Técnica do Coletor (Callouts 1 a 4)
  document
    .querySelectorAll<HTMLButtonElement>('[data-callout]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const num = Number(btn.getAttribute('data-callout'));
        if (!Number.isNaN(num)) {
          estado.calloutColetorAtivo = num;
          renderizarApp();
        }
      });
    });

  // Calculadora de Toxicidade
  const selectCalc = document.getElementById(
    'select-item-calculadora'
  ) as HTMLSelectElement | null;
  if (selectCalc) {
    selectCalc.addEventListener('change', () => {
      estado.itemCalculadoraId = selectCalc.value;
      renderizarApp();
    });
  }

  document
    .querySelectorAll<HTMLButtonElement>('[data-ver-pevs-categoria]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.getAttribute(
          'data-ver-pevs-categoria'
        ) as CategoriaResiduo;
        if (cat) {
          estado.categoriaFiltro = cat;
          estado.aba = 'mapa';
          const filtrados = obterPevsFiltrados();
          if (filtrados.length > 0) {
            estado.pevSelecionadoId = filtrados[0].id;
          }
          persistirEstadoSessao();
          renderizarApp();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });

  const btnRegistrarCalc = document.getElementById(
    'btn-registrar-descarte-calc'
  );
  if (btnRegistrarCalc) {
    btnRegistrarCalc.addEventListener('click', async () => {
      const itemCalc =
        ITENS_CALCULADORA.find((i) => i.id === estado.itemCalculadoraId) ??
        ITENS_CALCULADORA[0];
      const resultado = await registrarNovoDescarte({
        itemNome: itemCalc.nome,
        categoria: itemCalc.categoriaRecomendada,
        pevId: itemCalc.cabeNoColetorPiloto ? 1 : 3,
        pevNome: itemCalc.cabeNoColetorPiloto
          ? 'Coletor Piloto — Cruz das Almas'
          : 'PEV Green Eletron — Parque Shopping Maceió',
        pesoGramas: itemCalc.pesoMedioGramas,
        metaisGramas: itemCalc.metaisEvitadosGramas,
      });
      estado.descartes = resultado.lista;
      mostrarNotificacao(
        `Descarte de "${itemCalc.nome}" contabilizado! Você evitou ${itemCalc.metaisEvitadosGramas}g de toxinas no ambiente.`
      );
    });
  }

  // Checklist LGPD
  document
    .querySelectorAll<HTMLInputElement>('[data-lgpd-check]')
    .forEach((chk) => {
      chk.addEventListener('change', () => {
        const id = chk.getAttribute('data-lgpd-check');
        if (id) {
          estado.checklistLgpd[id] = chk.checked;
          salvarChecklistLgpd(estado.checklistLgpd);
          renderizarApp();
        }
      });
    });

  // Imprimir Cartaz QR Code e Personalização de URL / Download SVG
  const btnPrint = document.getElementById('btn-imprimir-cartaz');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  const inputQrUrl = document.getElementById(
    'input-url-qrcode'
  ) as HTMLInputElement | null;
  if (inputQrUrl) {
    inputQrUrl.addEventListener('input', () => {
      estado.urlQrCodeCustom = inputQrUrl.value;
      const box = document.getElementById('qr-svg-preview-box');
      if (box) {
        box.innerHTML = gerarSvgQrCodeDidatico(
          estado.urlQrCodeCustom.trim() ||
            (typeof window !== 'undefined'
              ? window.location.origin
              : 'https://descarte-inteligente-chi.vercel.app'),
          220
        );
      }
    });
  }

  document
    .querySelectorAll<HTMLButtonElement>('[data-qr-preset]')
    .forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-qr-preset');
        if (preset) {
          estado.urlQrCodeCustom = preset;
          renderizarApp();
        }
      });
    });

  const btnBaixarSvg = document.getElementById('btn-baixar-qr-svg');
  if (btnBaixarSvg) {
    btnBaixarSvg.addEventListener('click', () => {
      const urlAlvo =
        estado.urlQrCodeCustom.trim() ||
        (typeof window !== 'undefined'
          ? window.location.origin
          : 'https://descarte-inteligente-chi.vercel.app');
      const svgString = gerarSvgQrCodeDidatico(urlAlvo, 1024);
      const blob = new Blob([svgString], {
        type: 'image/svg+xml;charset=utf-8',
      });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'qrcode-descarte-inteligente.svg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      mostrarNotificacao('Arquivo qrcode-descarte-inteligente.svg baixado!');
    });
  }
}

function renderizarGuiaInstalacaoPwaHtml(): string {
  const plat = detectarPlataformaPwa();
  if (!estado.exibirGuiaInstalacaoPwa && !plat.ehWebViewEmbutido) {
    return '';
  }

  return `
    <section
      class="section-card"
      role="region"
      aria-label="Instruções de instalação do aplicativo no Android e iOS"
      style="margin-bottom: var(--space-3); border: 2px solid var(--color-brand-primary); background: #FFFFFF;"
    >
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div>
          <span class="brand-eyebrow">PWA Multiplataforma · Android & iPhone (iOS)</span>
          <h2 style="margin: 2px 0 8px 0; font-family: var(--font-display); font-size: 1.1rem;">
            Como instalar o Descarte Inteligente na tela inicial do celular
          </h2>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" id="btn-fechar-guia-pwa">
          <span>Fechar</span>
        </button>
      </div>

      ${
        plat.ehWebViewEmbutido
          ? `
            <div style="background: #FDF1EB; border: 1.5px solid #B84A18; padding: 10px 12px; border-radius: 4px; margin-bottom: 10px; font-size: 0.85rem;">
              <strong>Atenção (Navegador Interno Detectado):</strong> Você abriu o link dentro do WhatsApp/Instagram. Toque nos <strong>3 pontos (⋮) ou no ícone de bússola</strong> e escolha <strong>"Abrir no Chrome" (Android)</strong> ou <strong>"Abrir no Safari" (iPhone)</strong> para liberar GPS de alta precisão e instalação.
            </div>
          `
          : ''
      }

      <div class="matrix-grid">
        <div class="matrix-card" style="border-left: 4px solid var(--color-brand-primary);">
          <strong style="font-family: var(--font-display); font-size: 0.95rem;">No Android (Google Chrome / Edge)</strong>
          <p style="margin: 4px 0 0 0; font-size: 0.84rem; color: var(--color-text-secondary);">
            1. Toque no botão <strong>"Instalar App"</strong> no topo ou no menu <strong>⋮ (três pontos)</strong> do Chrome.<br/>
            2. Selecione <strong>"Instalar aplicativo" / "Adicionar à tela inicial"</strong>.<br/>
            3. O sistema gera um pacote nativo (WebAPK) com ícone próprio e suporte offline.
          </p>
        </div>

        <div class="matrix-card" style="border-left: 4px solid var(--color-brand-secondary);">
          <strong style="font-family: var(--font-display); font-size: 0.95rem;">No iPhone / iPad (iOS Safari)</strong>
          <p style="margin: 4px 0 0 0; font-size: 0.84rem; color: var(--color-text-secondary);">
            1. No <strong>Safari</strong>, toque no botão <strong>Compartilhar</strong> (ícone de quadrado com seta para cima na barra inferior).<br/>
            2. Role a lista e toque em <strong>"Adicionar à Tela de Início"</strong>.<br/>
            3. Confirme em <strong>"Adicionar"</strong> no canto superior direito.
          </p>
        </div>
      </div>
    </section>
  `;
}

function renderizarApp(): void {
  const root = document.getElementById('app');
  if (!root) return;

  if (instanciaMapa) {
    instanciaMapa.remove();
    instanciaMapa = null;
    camadaMarkers = null;
  }

  let conteudoAba = '';
  if (estado.aba === 'mapa') {
    conteudoAba = renderizarAbaMapa();
  } else if (estado.aba === 'coletor') {
    conteudoAba = renderizarAbaColetorELgpd();
  } else {
    conteudoAba = renderizarAbaInstitucional();
  }

  const toastHtml = estado.feedbackToast
    ? `
      <div
        id="status-toast-banner"
        role="status"
        aria-live="polite"
        style="background: var(--color-brand-primary); color: #fff; padding: 10px 16px; border-radius: var(--radius-sm); margin-bottom: 14px; font-weight: 600; font-size: 0.88rem; border: 1.5px solid var(--color-text-primary); box-shadow: var(--shadow-hard);"
      >
        ${escaparHtml(estado.feedbackToast)}
      </div>
    `
    : '';

  root.innerHTML = `
    ${renderizarCabecalho()}
    <main id="conteudo-principal" class="main-container">
      ${toastHtml}
      ${renderizarGuiaInstalacaoPwaHtml()}
      ${conteudoAba}
    </main>
    ${renderizarBarraInferiorMobile()}
    <footer class="site-footer">
      <div class="footer-inner">
        <div>
          <strong>DESCARTE INTELIGENTE</strong> · Maceió - AL<br/>
          Mapeamento de PEVs e Descarte de Resíduos Eletrônicos
        </div>
        <div style="font-family: var(--font-mono); font-size: 0.76rem;">
          Base Legal: PNRS (Lei 12.305/2010) · LGPD (Lei 13.709/2018)<br/>
          PWA Mobile-First · OpenStreetMap
        </div>
      </div>
    </footer>
  `;

  vincularEventosDom();

  if (estado.aba === 'mapa') {
    inicializarOuAtualizarMapaLeaflet();
  }
}

async function iniciarSistema(): Promise<void> {
  // Suporte a atalhos da Tela Inicial do PWA (?tab=mapa|coletor|institucional)
  try {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (
      tabParam === 'mapa' ||
      tabParam === 'coletor' ||
      tabParam === 'institucional'
    ) {
      estado.aba = tabParam;
    }
  } catch {
    // Ignorar
  }

  // Monitor de teclado virtual (Android / iOS visualViewport) para ocultar barra inferior ao digitar
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const alturaBase = window.innerHeight;
    const aoRedimensionarViewport = () => {
      const tecladoAberto = vv.height < alturaBase * 0.78;
      document.body.classList.toggle('is-keyboard-open', tecladoAberto);
    };
    vv.addEventListener('resize', aoRedimensionarViewport);
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    estado.eventoInstalacaoPwa = e as BeforeInstallPromptEvent;
    renderizarApp();
  });

  window.addEventListener('online', async () => {
    estado.descartes = await sincronizarDescartesPendentes();
    renderizarApp();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistirEstadoSessao();
    } else if (navigator.onLine) {
      sincronizarDescartesPendentes().then((lista) => {
        estado.descartes = lista;
      });
    }
  });

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {
      // Silencioso
    });
  }

  const resultado = await buscarPevs();
  estado.pevs = resultado.pevs;
  estado.origemDados = resultado.origem;
  estado.descartes = await sincronizarDescartesPendentes();
  renderizarApp();

  if (
    'serviceWorker' in navigator &&
    window.location.protocol.startsWith('http')
  ) {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service Worker opcional em desenvolvimento
    });
  }
}

iniciarSistema();
