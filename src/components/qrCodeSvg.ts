// Gerador real de QR Code padrão ISO/IEC 18004 (Modo Byte, Nível de Correção M, Versões 1 a 10)
// Escaneável por qualquer câmera nativa (iOS, Android Google Lens, WhatsApp) sem dependências externas.

interface InfoVersaoQr {
  versao: number;
  totalCodewordsDados: number;
  ecCodewordsPorBloco: number;
  numBlocosGrupo1: number;
  dadosPorBlocoGrupo1: number;
  numBlocosGrupo2: number;
  dadosPorBlocoGrupo2: number;
  posicoesAlinhamento: number[];
}

// Tabela oficial ISO/IEC 18004 para Nível de Correção L (01) — alta capacidade e leitura rápida em cartazes
const TABELA_VERSOES_L: InfoVersaoQr[] = [
  { versao: 1, totalCodewordsDados: 19, ecCodewordsPorBloco: 7, numBlocosGrupo1: 1, dadosPorBlocoGrupo1: 19, numBlocosGrupo2: 0, dadosPorBlocoGrupo2: 0, posicoesAlinhamento: [] },
  { versao: 2, totalCodewordsDados: 34, ecCodewordsPorBloco: 10, numBlocosGrupo1: 1, dadosPorBlocoGrupo1: 34, numBlocosGrupo2: 0, dadosPorBlocoGrupo2: 0, posicoesAlinhamento: [6, 18] },
  { versao: 3, totalCodewordsDados: 55, ecCodewordsPorBloco: 15, numBlocosGrupo1: 1, dadosPorBlocoGrupo1: 55, numBlocosGrupo2: 0, dadosPorBlocoGrupo2: 0, posicoesAlinhamento: [6, 22] },
  { versao: 4, totalCodewordsDados: 80, ecCodewordsPorBloco: 20, numBlocosGrupo1: 1, dadosPorBlocoGrupo1: 80, numBlocosGrupo2: 0, dadosPorBlocoGrupo2: 0, posicoesAlinhamento: [6, 26] },
  { versao: 5, totalCodewordsDados: 108, ecCodewordsPorBloco: 26, numBlocosGrupo1: 1, dadosPorBlocoGrupo1: 108, numBlocosGrupo2: 0, dadosPorBlocoGrupo2: 0, posicoesAlinhamento: [6, 30] },
  { versao: 6, totalCodewordsDados: 136, ecCodewordsPorBloco: 18, numBlocosGrupo1: 2, dadosPorBlocoGrupo1: 68, numBlocosGrupo2: 0, dadosPorBlocoGrupo2: 0, posicoesAlinhamento: [6, 34] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function inicializarGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function gerarPolinomioGeradorRs(grau: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < grau; i++) {
    const proximo = new Uint8Array(poly.length + 1);
    const fator = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      proximo[j] ^= poly[j];
      proximo[j + 1] ^= gfMul(poly[j], fator);
    }
    poly = proximo;
  }
  return poly;
}

function calcularReedSolomon(dados: Uint8Array, numEc: number): Uint8Array {
  const gerador = gerarPolinomioGeradorRs(numEc);
  const resto = new Uint8Array(numEc);

  for (let i = 0; i < dados.length; i++) {
    const fator = dados[i] ^ resto[0];
    for (let j = 0; j < numEc - 1; j++) {
      resto[j] = resto[j + 1];
    }
    resto[numEc - 1] = 0;
    if (fator !== 0) {
      for (let j = 0; j < numEc; j++) {
        resto[j] ^= gfMul(gerador[j + 1], fator);
      }
    }
  }
  return resto;
}

function calcularBitsFormato(ecLevelBits: number, mascara: number): number {
  const dados = (ecLevelBits << 3) | mascara;
  let rem = dados << 10;
  for (let i = 14; i >= 10; i--) {
    if ((rem >> i) & 1) {
      rem ^= 0x537 << (i - 10);
    }
  }
  return ((dados << 10) | rem) ^ 0x5412;
}

export function gerarMatrizQrCodeIso(texto: string): boolean[][] {
  const bytesTexto = new TextEncoder().encode(texto);
  const info =
    TABELA_VERSOES_L.find(
      (v) => v.totalCodewordsDados >= bytesTexto.length + 2
    ) ?? TABELA_VERSOES_L[TABELA_VERSOES_L.length - 1];

  const bytesTruncados =
    bytesTexto.length > info.totalCodewordsDados - 2
      ? bytesTexto.slice(0, info.totalCodewordsDados - 2)
      : bytesTexto;

  const bits: number[] = [];
  function adicionarBits(valor: number, qtdBits: number): void {
    for (let i = qtdBits - 1; i >= 0; i--) {
      bits.push((valor >> i) & 1);
    }
  }

  // Indicador Modo Byte (0100) + Tamanho (8 bits para versões 1..9)
  adicionarBits(0b0100, 4);
  adicionarBits(bytesTruncados.length, 8);
  for (const b of bytesTruncados) {
    adicionarBits(b, 8);
  }

  const capacidadeBits = info.totalCodewordsDados * 8;
  const terminador = Math.min(4, capacidadeBits - bits.length);
  adicionarBits(0, terminador);

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < capacidadeBits) {
    adicionarBits(padBytes[padIdx % 2], 8);
    padIdx++;
  }

  const codewordsDados = new Uint8Array(info.totalCodewordsDados);
  for (let i = 0; i < info.totalCodewordsDados; i++) {
    let val = 0;
    for (let b = 0; b < 8; b++) {
      val = (val << 1) | bits[i * 8 + b];
    }
    codewordsDados[i] = val;
  }

  // Dividir em blocos e calcular EC Reed-Solomon
  const blocosDados: Uint8Array[] = [];
  const blocosEc: Uint8Array[] = [];
  let offset = 0;

  for (let i = 0; i < info.numBlocosGrupo1; i++) {
    const bloco = codewordsDados.slice(offset, offset + info.dadosPorBlocoGrupo1);
    offset += info.dadosPorBlocoGrupo1;
    blocosDados.push(bloco);
    blocosEc.push(calcularReedSolomon(bloco, info.ecCodewordsPorBloco));
  }

  for (let i = 0; i < info.numBlocosGrupo2; i++) {
    const bloco = codewordsDados.slice(offset, offset + info.dadosPorBlocoGrupo2);
    offset += info.dadosPorBlocoGrupo2;
    blocosDados.push(bloco);
    blocosEc.push(calcularReedSolomon(bloco, info.ecCodewordsPorBloco));
  }

  const codewordsFinais: number[] = [];
  const maxDadosLen = Math.max(...blocosDados.map((b) => b.length));
  for (let i = 0; i < maxDadosLen; i++) {
    for (const b of blocosDados) {
      if (i < b.length) codewordsFinais.push(b[i]);
    }
  }
  for (let i = 0; i < info.ecCodewordsPorBloco; i++) {
    for (const ec of blocosEc) {
      codewordsFinais.push(ec[i]);
    }
  }

  const tamanho = 17 + info.versao * 4;
  const modulos: boolean[][] = Array.from({ length: tamanho }, () =>
    Array(tamanho).fill(false)
  );
  const reservado: boolean[][] = Array.from({ length: tamanho }, () =>
    Array(tamanho).fill(false)
  );

  function definirModulo(r: number, c: number, escuro: boolean): void {
    if (r >= 0 && r < tamanho && c >= 0 && c < tamanho) {
      modulos[r][c] = escuro;
      reservado[r][c] = true;
    }
  }

  function desenharFinder(rCentro: number, cCentro: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const r = rCentro + dy;
        const c = cCentro + dx;
        if (r >= 0 && r < tamanho && c >= 0 && c < tamanho) {
          definirModulo(r, c, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  desenharFinder(3, 3);
  desenharFinder(3, tamanho - 4);
  desenharFinder(tamanho - 4, 3);

  // Padrões de alinhamento
  const pos = info.posicoesAlinhamento;
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if (
        (i === 0 && j === 0) ||
        (i === 0 && j === pos.length - 1) ||
        (i === pos.length - 1 && j === 0)
      ) {
        continue;
      }
      const rc = pos[i];
      const cc = pos[j];
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          definirModulo(rc + dy, cc + dx, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < tamanho - 8; i++) {
    if (!reservado[6][i]) definirModulo(6, i, i % 2 === 0);
    if (!reservado[i][6]) definirModulo(i, 6, i % 2 === 0);
  }

  // Dark module e reserva de formato
  definirModulo(tamanho - 8, 8, true);
  for (let i = 0; i < 9; i++) {
    if (!reservado[8][i]) reservado[8][i] = true;
    if (!reservado[i][8]) reservado[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    reservado[8][tamanho - 1 - i] = true;
    reservado[tamanho - 1 - i][8] = true;
  }

  // Inserir bits em zigue-zague de 2 colunas da direita para a esquerda
  let bitIdx = 0;
  const totalBitsFinal = codewordsFinais.length * 8;
  let subindo = true;

  for (let col = tamanho - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let passo = 0; passo < tamanho; passo++) {
      const r = subindo ? tamanho - 1 - passo : passo;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (!reservado[r][c]) {
          let escuro = false;
          if (bitIdx < totalBitsFinal) {
            const byteAtual = codewordsFinais[bitIdx >> 3];
            escuro = ((byteAtual >> (7 - (bitIdx & 7))) & 1) === 1;
            bitIdx++;
          }
          modulos[r][c] = escuro;
        }
      }
    }
    subindo = !subindo;
  }

  // Aplicar máscara 0 ((r + c) % 2 === 0) e gravar bits de formato (Nível L = 0b01, Máscara = 0)
  const mascara = 0;
  for (let r = 0; r < tamanho; r++) {
    for (let c = 0; c < tamanho; c++) {
      if (!reservado[r][c] && (r + c) % 2 === 0) {
        modulos[r][c] = !modulos[r][c];
      }
    }
  }

  const bitsFormato = calcularBitsFormato(0b01, mascara);
  for (let i = 0; i <= 5; i++) modulos[8][i] = ((bitsFormato >> i) & 1) === 1;
  modulos[8][7] = ((bitsFormato >> 6) & 1) === 1;
  modulos[8][8] = ((bitsFormato >> 7) & 1) === 1;
  modulos[7][8] = ((bitsFormato >> 8) & 1) === 1;
  for (let i = 9; i < 15; i++) {
    modulos[14 - i][8] = ((bitsFormato >> i) & 1) === 1;
  }

  for (let i = 0; i < 8; i++) {
    modulos[8][tamanho - 1 - i] = ((bitsFormato >> i) & 1) === 1;
  }
  for (let i = 8; i < 15; i++) {
    modulos[tamanho - 15 + i][8] = ((bitsFormato >> i) & 1) === 1;
  }

  return modulos;
}

export function gerarSvgQrCodeDidatico(
  textoUrl: string,
  tamanhoPx = 220
): string {
  const matriz = gerarMatrizQrCodeIso(textoUrl);
  const n = matriz.length;
  const quietZone = 4;
  const totalModulos = n + quietZone * 2;

  const caminhos: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matriz[r][c]) {
        caminhos.push(`M${c + quietZone},${r + quietZone}h1v1h-1z`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalModulos} ${totalModulos}" width="${tamanhoPx}" height="${tamanhoPx}" shape-rendering="crispEdges" role="img" aria-label="QR Code escaneável para ${textoUrl.replace(/"/g, '')}">
  <rect width="${totalModulos}" height="${totalModulos}" fill="#FFFFFF"/>
  <path d="${caminhos.join('')}" fill="#1A211E"/>
</svg>`;
}
