import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicOutDir = path.join(distDir, 'public');

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

function gerarIconePngApp(tamanho, maskable, destinoArquivo) {
  const bytesPorLinha = 1 + tamanho * 3;
  const rawData = Buffer.alloc(tamanho * bytesPorLinha);
  const margem = maskable ? Math.round(tamanho * 0.18) : Math.round(tamanho * 0.1);
  const centro = tamanho / 2;

  for (let y = 0; y < tamanho; y++) {
    const offsetLinha = y * bytesPorLinha;
    rawData[offsetLinha] = 0;

    for (let x = 0; x < tamanho; x++) {
      let r = 35; // #235338 Verde Floresta
      let g = 83;
      let b = 56;

      // Moldura interna clara
      const naBorda =
        (x >= margem && x <= tamanho - margem && (Math.abs(y - margem) < 3 || Math.abs(y - (tamanho - margem)) < 3)) ||
        (y >= margem && y <= tamanho - margem && (Math.abs(x - margem) < 3 || Math.abs(x - (tamanho - margem)) < 3));

      // Seta central estilizada de reciclagem/coletor (branca #F4F2EA)
      const dyTopo = y - tamanho * 0.25;
      const larguraTriangulo = dyTopo * 0.75;
      const noTriangulo =
        y >= tamanho * 0.25 &&
        y <= tamanho * 0.48 &&
        Math.abs(x - centro) <= larguraTriangulo;

      const noTroncoSeta =
        y >= tamanho * 0.45 &&
        y <= tamanho * 0.64 &&
        Math.abs(x - centro) <= tamanho * 0.07;

      // Faixa terracota inferior (#C85A24 - caixa de pilhas/slot)
      const naFaixaTerracota =
        y >= tamanho * 0.69 &&
        y <= tamanho * 0.77 &&
        Math.abs(x - centro) <= tamanho * 0.22;

      if (naFaixaTerracota) {
        r = 200;
        g = 90;
        b = 36;
      } else if (noTriangulo || noTroncoSeta || naBorda) {
        r = 244;
        g = 242;
        b = 234;
      }

      const idx = offsetLinha + 1 + x * 3;
      rawData[idx] = r;
      rawData[idx + 1] = g;
      rawData[idx + 2] = b;
    }
  }

  const assinatura = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamanho, 0);
  ihdr.writeUInt32BE(tamanho, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const idat = zlib.deflateSync(rawData, { level: 9 });
  const pngBuffer = Buffer.concat([
    assinatura,
    criarChunkPng('IHDR', ihdr),
    criarChunkPng('IDAT', idat),
    criarChunkPng('IEND', Buffer.alloc(0)),
  ]);

  fs.writeFileSync(destinoArquivo, pngBuffer);
}

function limparECriarDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function reescreverImportsRelativos(codigoJs) {
  return codigoJs.replace(
    /(from\s+['"])(\.\.?\/[^'"]+?)(['"])/g,
    (_match, p1, p2, p3) => {
      if (p2.endsWith('.js') || p2.endsWith('.json') || p2.endsWith('.css')) {
        return `${p1}${p2}${p3}`;
      }
      if (p2.endsWith('.ts')) {
        return `${p1}${p2.slice(0, -3)}.js${p3}`;
      }
      return `${p1}${p2}.js${p3}`;
    }
  );
}

function transpilarDiretorioTs(origemRel, destinoAbs) {
  const origemAbs = path.join(rootDir, origemRel);
  if (!fs.existsSync(origemAbs)) return;

  const entradas = fs.readdirSync(origemAbs, { withFileTypes: true });
  for (const entrada of entradas) {
    const caminhoOrigem = path.join(origemAbs, entrada.name);
    const caminhoDestino = path.join(destinoAbs, entrada.name);

    if (entrada.isDirectory()) {
      transpilarDiretorioTs(
        path.join(origemRel, entrada.name),
        caminhoDestino
      );
    } else if (entrada.isFile() && entrada.name.endsWith('.ts')) {
      const conteudoTs = fs.readFileSync(caminhoOrigem, 'utf8');
      const resultado = ts.transpileModule(conteudoTs, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          sourceMap: false,
        },
        fileName: caminhoOrigem,
      });

      const jsFinal = reescreverImportsRelativos(resultado.outputText);
      const arquivoJsDestino = caminhoDestino.replace(/\.ts$/, '.js');
      limparECriarDir(path.dirname(arquivoJsDestino));
      fs.writeFileSync(arquivoJsDestino, jsFinal, 'utf8');
    }
  }
}

function copiarDiretorio(origemAbs, destinoAbs) {
  if (!fs.existsSync(origemAbs)) return;
  limparECriarDir(destinoAbs);
  for (const item of fs.readdirSync(origemAbs, { withFileTypes: true })) {
    const srcPath = path.join(origemAbs, item.name);
    const destPath = path.join(destinoAbs, item.name);
    if (item.isDirectory()) {
      copiarDiretorio(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 1. Verificar tipagem estrita com TypeScript
const configPath = path.join(rootDir, 'tsconfig.json');
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  rootDir
);
const program = ts.createProgram(
  parsedConfig.fileNames,
  parsedConfig.options
);
const diagnostics = ts.getPreEmitDiagnostics(program);

if (diagnostics.length > 0) {
  const formatHost = {
    getCanonicalFileName: (p) => p,
    getCurrentDirectory: ts.sys.getCurrentDirectory,
    getNewLine: () => '\n',
  };
  console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics, formatHost));
  process.exit(1);
}

// 2. Gerar ícones PNG nativos para Android (WebAPK 192/512) e iOS (apple-touch-icon 180)
const publicSrcDir = path.join(rootDir, 'public');
limparECriarDir(publicSrcDir);
gerarIconePngApp(180, false, path.join(publicSrcDir, 'apple-touch-icon.png'));
gerarIconePngApp(192, false, path.join(publicSrcDir, 'icon-192.png'));
gerarIconePngApp(512, false, path.join(publicSrcDir, 'icon-512.png'));
gerarIconePngApp(512, true, path.join(publicSrcDir, 'icon-512-maskable.png'));

// 3. Limpar e construir dist/
fs.rmSync(distDir, { recursive: true, force: true });
limparECriarDir(publicOutDir);

// 4. Copiar ativos públicos, index.html, CSS e Leaflet ESM
copiarDiretorio(publicSrcDir, publicOutDir);
fs.copyFileSync(
  path.join(rootDir, 'index.html'),
  path.join(publicOutDir, 'index.html')
);
copiarDiretorio(
  path.join(rootDir, 'src/styles'),
  path.join(publicOutDir, 'styles')
);

const vendorDir = path.join(publicOutDir, 'vendor');
limparECriarDir(vendorDir);
fs.copyFileSync(
  path.join(rootDir, 'node_modules/leaflet/dist/leaflet-src.esm.js'),
  path.join(vendorDir, 'leaflet-src.esm.js')
);
fs.copyFileSync(
  path.join(rootDir, 'node_modules/leaflet/dist/leaflet.css'),
  path.join(vendorDir, 'leaflet.css')
);
copiarDiretorio(
  path.join(rootDir, 'node_modules/leaflet/dist/images'),
  path.join(vendorDir, 'images')
);

// 5. Transpilar módulos TypeScript para navegador (dist/public/src) e Node (dist/src, dist/server, dist/tests)
transpilarDiretorioTs('src', path.join(publicOutDir, 'src'));
transpilarDiretorioTs('src', path.join(distDir, 'src'));
transpilarDiretorioTs('server', path.join(distDir, 'server'));
transpilarDiretorioTs('tests', path.join(distDir, 'tests'));

console.log('Build concluído com sucesso em dist/ (TypeScript strict + ES Modules + Ícones Android/iOS).');
