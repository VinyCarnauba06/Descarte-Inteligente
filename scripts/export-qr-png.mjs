import fs from 'node:fs';
import zlib from 'node:zlib';
import { gerarMatrizQrCodeIso } from '../dist/src/components/qrCodeSvg.js';

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function criarChunkPng(tipoAscii, dadosBuffer) {
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(dadosBuffer.length, 0);
  const tipoBuf = Buffer.from(tipoAscii, 'ascii');
  const crcInput = Buffer.concat([tipoBuf, dadosBuffer]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, tipoBuf, dadosBuffer, crcBuf]);
}

function exportarMatrizParaPng(textoUrl, caminhoSaida, escalaPx = 24) {
  const matriz = gerarMatrizQrCodeIso(textoUrl);
  const n = matriz.length;
  const quiet = 4;
  const totalModulos = n + quiet * 2;
  const largura = totalModulos * escalaPx;
  const altura = totalModulos * escalaPx;

  const bytesPorLinha = 1 + largura * 3;
  const rawData = Buffer.alloc(altura * bytesPorLinha);

  for (let y = 0; y < altura; y++) {
    const offsetLinha = y * bytesPorLinha;
    rawData[offsetLinha] = 0; // Filtro None
    const modR = Math.floor(y / escalaPx) - quiet;

    for (let x = 0; x < largura; x++) {
      const modC = Math.floor(x / escalaPx) - quiet;
      const escuro =
        modR >= 0 && modR < n && modC >= 0 && modC < n ? matriz[modR][modC] : false;

      const idx = offsetLinha + 1 + x * 3;
      if (escuro) {
        rawData[idx] = 26;
        rawData[idx + 1] = 33;
        rawData[idx + 2] = 30;
      } else {
        rawData[idx] = 255;
        rawData[idx + 1] = 255;
        rawData[idx + 2] = 255;
      }
    }
  }

  const assinatura = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 2; // Truecolor RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(rawData, { level: 9 });
  const pngBuffer = Buffer.concat([
    assinatura,
    criarChunkPng('IHDR', ihdr),
    criarChunkPng('IDAT', idat),
    criarChunkPng('IEND', Buffer.alloc(0)),
  ]);

  fs.writeFileSync(caminhoSaida, pngBuffer);
}

exportarMatrizParaPng(
  'http://192.168.0.176:5173',
  'Docs/qrcode-wifi-local-192.168.0.176.png',
  24
);
exportarMatrizParaPng(
  'https://descarte-inteligente-unima.vercel.app',
  'Docs/qrcode-producao-descarte-inteligente.png',
  24
);
console.log('Arquivos PNG de alta resolução gerados em Docs/');

