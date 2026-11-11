export interface CalloutSpec {
  numero: number;
  titulo: string;
  dimensao: string;
  resumo: string;
  justificativaEngenharia: string;
}

export const CALLOUTS_COLETOR: CalloutSpec[] = [
  {
    numero: 1,
    titulo: 'Slot na tampa superior',
    dimensao: '20 × 4 cm',
    resumo:
      'Abertura calibrada para passagem exclusiva de cabos, fones, carregadores, mouses e celulares.',
    justificativaEngenharia:
      'Geometria anti-pesca: impede que resíduos já depositados sejam retirados por curiosos e bloqueia o descarte incorreto de lixo orgânico ou volumes grandes.',
  },
  {
    numero: 2,
    titulo: 'Caixa metálica lateral para pilhas',
    dimensao: '15 × 12 cm',
    resumo:
      'Compartimento metálico isolado fisicamente do tambor plástico principal.',
    justificativaEngenharia:
      'Prevenção de fuga térmica: baterias de íon-lítio e pilhas podem entrar em curto-circuito se comprimidas junto a cabos ou carcaças metálicas. O invólucro metálico retém qualquer princípio de ignição.',
  },
  {
    numero: 3,
    titulo: 'Trava com cadeado na tampa',
    dimensao: 'Aço 30 mm',
    resumo:
      'Fechamento mecânico da tampa superior com abertura restrita à equipe responsável.',
    justificativaEngenharia:
      'Garante a custódia segura dos equipamentos descartados (conformidade LGPD contra violação física de smartphones descartados) até o repasse ao ecoponto.',
  },
  {
    numero: 4,
    titulo: 'Adesivo de sinalização + QR Code',
    dimensao: 'A4 / Vinil',
    resumo:
      'Identidade visual de alto contraste com ícones universais e acesso em 1 scan ao Mapa de PEVs.',
    justificativaEngenharia:
      'Redireciona instantaneamente o usuário caso o resíduo dele exceda o gabarito de 20 × 4 cm (ex.: notebooks, monitores, micro-ondas) para o PEV adequado mais próximo em Maceió.',
  },
];

export function renderizarDesenhoTecnicoSvg(calloutAtivo: number): string {
  const c1 = calloutAtivo === 1 ? '#C85A24' : '#1A211E';
  const c2 = calloutAtivo === 2 ? '#C85A24' : '#1A211E';
  const c3 = calloutAtivo === 3 ? '#C85A24' : '#1A211E';
  const c4 = calloutAtivo === 4 ? '#C85A24' : '#1A211E';

  return `
    <svg viewBox="0 0 680 340" width="100%" height="auto" role="img" aria-label="Desenho técnico isométrico, planta superior e elevação frontal do Coletor de Descarte Eletrônico 40 por 60 centímetros">
      <defs>
        <pattern id="grid-tecnico" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#E5E1D5" stroke-width="0.8"/>
        </pattern>
      </defs>

      <rect x="0" y="0" width="680" height="340" fill="url(#grid-tecnico)" rx="4" />

      <!-- QUADRO 1: VISTA 3D ISOMÉTRICA -->
      <g transform="translate(20, 15)">
        <text x="10" y="16" font-family="JetBrains Mono, monospace" font-size="10" fill="#434D48" font-weight="600">VISTA 3D — ISOMÉTRICA (S/ ESCALA)</text>
        <line x1="10" y1="22" x2="310" y2="22" stroke="#9E9888" stroke-width="1"/>

        <!-- Corpo Cilíndrico do Coletor -->
        <path d="M85,95 L85,245 A75,26 0 0,0 235,245 L235,95 Z" fill="#232B27" stroke="#1A211E" stroke-width="2"/>
        <!-- Anéis de reforço do tambor -->
        <path d="M85,145 A75,24 0 0,0 235,145" fill="none" stroke="#3B4640" stroke-width="2"/>
        <path d="M85,195 A75,24 0 0,0 235,195" fill="none" stroke="#3B4640" stroke-width="2"/>

        <!-- Tampa Superior -->
        <ellipse cx="160" cy="95" rx="75" ry="26" fill="#EAE6DA" stroke="#1A211E" stroke-width="2"/>
        <ellipse cx="160" cy="92" rx="68" ry="21" fill="#FBF9F4" stroke="#1A211E" stroke-width="1.5"/>

        <!-- (1) Slot 20x4 cm -->
        <rect x="132" y="85" width="56" height="12" rx="2" fill="#1A211E" stroke="${c1}" stroke-width="${calloutAtivo === 1 ? '3.5' : '1.5'}"/>

        <!-- (3) Cadeado Frontal -->
        <g transform="translate(152, 114)">
          <path d="M4,0 V-5 A4,4 0 0,1 12,-5 V0" fill="none" stroke="${c3}" stroke-width="2.2"/>
          <rect x="1" y="0" width="14" height="12" rx="2" fill="#FBF9F4" stroke="${c3}" stroke-width="${calloutAtivo === 3 ? '3' : '1.8'}"/>
        </g>

        <!-- (2) Caixa Metálica Lateral de Pilhas -->
        <g transform="translate(225, 165)">
          <polygon points="0,10 28,-4 28,44 0,58" fill="#C85A24" stroke="${c2}" stroke-width="${calloutAtivo === 2 ? '3.5' : '1.8'}"/>
          <polygon points="-12,4 16,-10 28,-4 0,10" fill="#E07A47" stroke="${c2}" stroke-width="1.5"/>
          <polygon points="-12,4 0,10 0,58 -12,52" fill="#9E4216" stroke="${c2}" stroke-width="1.5"/>
        </g>

        <!-- (4) Adesivo de Sinalização Frontal -->
        <g transform="translate(128, 152)">
          <rect x="0" y="0" width="64" height="54" rx="3" fill="#FBF9F4" stroke="${c4}" stroke-width="${calloutAtivo === 4 ? '3.5' : '1.8'}"/>
          <circle cx="32" cy="20" r="10" fill="#235338"/>
          <path d="M32,14 L37,22 H27 Z" fill="#FBF9F4"/>
          <rect x="12" y="36" width="40" height="4" fill="#1A211E"/>
          <rect x="18" y="43" width="28" height="3" fill="#C85A24"/>
        </g>

        <!-- Linhas de Chamada (Callouts 1 a 4) -->
        <!-- Callout 1 -->
        <line x1="145" y1="85" x2="55" y2="52" stroke="${c1}" stroke-width="1.5"/>
        <circle cx="45" cy="48" r="11" fill="${c1}"/>
        <text x="45" y="52" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#FFF" font-weight="700">1</text>

        <!-- Callout 3 -->
        <line x1="166" y1="115" x2="268" y2="56" stroke="${c3}" stroke-width="1.5"/>
        <circle cx="278" cy="52" r="11" fill="${c3}"/>
        <text x="278" y="56" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#FFF" font-weight="700">3</text>

        <!-- Callout 4 -->
        <line x1="128" y1="190" x2="52" y2="255" stroke="${c4}" stroke-width="1.5"/>
        <circle cx="42" cy="260" r="11" fill="${c4}"/>
        <text x="42" y="264" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#FFF" font-weight="700">4</text>

        <!-- Callout 2 -->
        <line x1="250" y1="205" x2="285" y2="255" stroke="${c2}" stroke-width="1.5"/>
        <circle cx="292" cy="262" r="11" fill="${c2}"/>
        <text x="292" y="266" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#FFF" font-weight="700">2</text>
      </g>

      <!-- QUADRO 2: PLANTA — VISTA SUPERIOR (ESC 1:10) -->
      <g transform="translate(365, 15)">
        <text x="10" y="16" font-family="JetBrains Mono, monospace" font-size="10" fill="#434D48" font-weight="600">PLANTA — SUPERIOR (ESC 1:10)</text>
        <line x1="10" y1="22" x2="290" y2="22" stroke="#9E9888" stroke-width="1"/>

        <!-- Cota 40 cm -->
        <line x1="85" y1="42" x2="205" y2="42" stroke="#1A211E" stroke-width="1"/>
        <line x1="85" y1="37" x2="85" y2="47" stroke="#1A211E" stroke-width="1"/>
        <line x1="205" y1="37" x2="205" y2="47" stroke="#1A211E" stroke-width="1"/>
        <text x="145" y="38" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#1A211E">⌀ 40 cm</text>

        <circle cx="145" cy="102" r="52" fill="#FBF9F4" stroke="#1A211E" stroke-width="2"/>
        <rect x="122" y="95" width="46" height="14" rx="2" fill="#EAE6DA" stroke="${c1}" stroke-width="2"/>
        <rect x="197" y="92" width="16" height="20" fill="#C85A24" stroke="${c2}" stroke-width="1.8"/>
        <text x="220" y="106" font-family="JetBrains Mono, monospace" font-size="9" fill="#434D48">PILHAS</text>
      </g>

      <!-- QUADRO 3: ELEVAÇÃO — VISTA FRONTAL (ESC 1:10) -->
      <g transform="translate(365, 175)">
        <text x="10" y="16" font-family="JetBrains Mono, monospace" font-size="10" fill="#434D48" font-weight="600">ELEVAÇÃO — FRONTAL (60 cm)</text>
        <line x1="10" y1="22" x2="290" y2="22" stroke="#9E9888" stroke-width="1"/>

        <!-- Cota Vertical 60 cm -->
        <line x1="65" y1="38" x2="65" y2="142" stroke="#1A211E" stroke-width="1"/>
        <line x1="60" y1="38" x2="70" y2="38" stroke="#1A211E" stroke-width="1"/>
        <line x1="60" y1="142" x2="70" y2="142" stroke="#1A211E" stroke-width="1"/>
        <text x="55" y="95" text-anchor="end" font-family="JetBrains Mono, monospace" font-size="10" fill="#1A211E">60 cm</text>

        <!-- Corpo Frontal -->
        <rect x="95" y="38" width="96" height="104" fill="#FBF9F4" stroke="#1A211E" stroke-width="2"/>
        <line x1="95" y1="48" x2="191" y2="48" stroke="#1A211E" stroke-width="1.5"/>
        <!-- Slot Frontal -->
        <rect x="125" y="41" width="36" height="5" fill="#EAE6DA" stroke="${c1}" stroke-width="1.5"/>
        <text x="143" y="34" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="8.5" fill="#434D48">SLOT 20×4</text>

        <!-- Adesivo Frontal -->
        <rect x="131" y="56" width="24" height="22" fill="#EAE6DA" stroke="${c4}" stroke-width="1.2"/>

        <!-- Caixa Lateral Pilhas 15x12 cm -->
        <rect x="191" y="96" width="26" height="30" fill="#FDF1EB" stroke="${c2}" stroke-width="2"/>
        <line x1="191" y1="104" x2="217" y2="104" stroke="#C85A24" stroke-width="2"/>
        <text x="224" y="110" font-family="JetBrains Mono, monospace" font-size="8.5" fill="#C85A24" font-weight="600">PILHAS</text>
        <text x="224" y="121" font-family="JetBrains Mono, monospace" font-size="8.5" fill="#434D48">15×12 cm</text>
      </g>
    </svg>
  `;
}

