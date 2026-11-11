import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import {
  PEVS_INICIAIS_MACEIO,
  COORDENADAS_PADRAO_UNIMA,
} from '../src/data/maceioPevs';
import {
  calcularDistanciaKm,
  filtrarEOrdenarPevs,
  formatarDistancia,
  validarPayloadPev,
} from '../src/utils/geo';
import { criarApiExpress } from '../server/apiApp';
import {
  gerarMatrizQrCodeIso,
  gerarSvgQrCodeDidatico,
} from '../src/components/qrCodeSvg';

describe('Descarte Inteligente — Geolocalização, Filtros e Validação de PEVs', () => {
  it('calcula distância zero para a mesma coordenada (Campus UNIMA)', () => {
    const d = calcularDistanciaKm(
      COORDENADAS_PADRAO_UNIMA.latitude,
      COORDENADAS_PADRAO_UNIMA.longitude,
      COORDENADAS_PADRAO_UNIMA.latitude,
      COORDENADAS_PADRAO_UNIMA.longitude
    );
    assert.equal(d, 0);
    assert.equal(formatarDistancia(d), '10 m');
  });

  it('ordena o Coletor Piloto UNIMA como o mais próximo quando o usuário está na UNIMA', () => {
    const resultado = filtrarEOrdenarPevs(PEVS_INICIAIS_MACEIO, {
      categoria: 'todas',
      busca: '',
      apenasAtivos: true,
      coordenadasUsuario: COORDENADAS_PADRAO_UNIMA,
    });

    assert.ok(resultado.length >= 10);
    assert.equal(resultado[0].id, 1);
    assert.equal(resultado[0].destaque_piloto, true);
    assert.ok(resultado[1].nome.includes('Parque Shopping'));
  });

  it('filtra corretamente por categoria de resíduo e por termo de bairro', () => {
    const apenasEletros = filtrarEOrdenarPevs(PEVS_INICIAIS_MACEIO, {
      categoria: 'eletrodomesticos',
      busca: 'Tabuleiro',
      apenasAtivos: true,
      coordenadasUsuario: COORDENADAS_PADRAO_UNIMA,
    });

    assert.equal(apenasEletros.length, 1);
    assert.ok(apenasEletros[0].nome.includes('Ferreira Costa'));
  });

  it('valida payload de novo PEV rejeitando coordenadas fora de Alagoas ou sem categoria', () => {
    const invalidoLat = validarPayloadPev({
      nome: 'PEV Teste',
      endereco: 'Rua Teste, 123',
      bairro: 'Centro',
      latitude: -23.55,
      longitude: -35.7,
      categorias: ['pilhas'],
    });
    assert.equal(invalidoLat.valido, false);

    const valido = validarPayloadPev({
      nome: 'PEV Escola Parceira',
      endereco: 'Av. Fernandes Lima, 1500 — Farol',
      bairro: 'Farol',
      latitude: -9.6312,
      longitude: -35.7341,
      horario_funcionamento: 'Seg a Sex: 08h às 17h',
      categorias: ['pilhas', 'celulares'],
    });
    assert.equal(valido.valido, true);
  });

  it('gera matriz QR Code ISO/IEC 18004 válida com padrões finder 7x7 nos três cantos', () => {
    const matriz = gerarMatrizQrCodeIso('http://192.168.0.176:5173');
    const n = matriz.length;
    assert.equal(n, 25); // Versão 2 (17 + 4*2 = 25x25)
    assert.equal(matriz[0][0], true);
    assert.equal(matriz[0][6], true);
    assert.equal(matriz[3][3], true);
    assert.equal(matriz[0][n - 1], true);
    assert.equal(matriz[n - 1][0], true);

    const svg = gerarSvgQrCodeDidatico('http://192.168.0.176:5173', 512);
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('viewBox="0 0 33 33"'));
  });

  it('atende contrato da API REST (/api/pevs, /api/auth/login e proteção JWT)', async () => {
    const app = criarApiExpress();
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const getRes = await fetch(`${baseUrl}/api/pevs?categoria=pilhas`);
      assert.equal(getRes.status, 200);
      const lista = (await getRes.json()) as Array<{ id: number }>;
      assert.ok(lista.length >= 8);

      const postSemToken = await fetch(`${baseUrl}/api/pevs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'Teste Sem Token' }),
      });
      assert.equal(postSemToken.status, 401);

      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@unima.edu.br',
          senha: 'descarte2026',
        }),
      });
      assert.equal(loginRes.status, 200);
      const { token } = (await loginRes.json()) as { token: string };
      assert.ok(token.length > 20);

      const postComToken = await fetch(`${baseUrl}/api/pevs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: 'PEV Escola Estadual Parceira',
          endereco: 'Av. Fernandes Lima, 900 — Farol, Maceió - AL',
          bairro: 'Farol',
          latitude: -9.6421,
          longitude: -35.7319,
          horario_funcionamento: 'Seg a Sex: 08h às 17h',
          categorias: ['pilhas', 'celulares'],
        }),
      });
      assert.equal(postComToken.status, 201);
      const criado = (await postComToken.json()) as { id: number; nome: string };
      assert.equal(criado.nome, 'PEV Escola Estadual Parceira');

      const putComToken = await fetch(`${baseUrl}/api/pevs/${criado.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nome: 'PEV Escola Estadual Parceira (Atualizado)',
          endereco: 'Av. Fernandes Lima, 900 — Farol, Maceió - AL',
          bairro: 'Farol',
          latitude: -9.6421,
          longitude: -35.7319,
          horario_funcionamento: 'Seg a Sáb: 08h às 18h',
          categorias: ['pilhas', 'celulares', 'cabos'],
        }),
      });
      assert.equal(putComToken.status, 200);
      const editado = (await putComToken.json()) as { nome: string };
      assert.equal(editado.nome, 'PEV Escola Estadual Parceira (Atualizado)');

      const descartePayload = {
        id: 'idemp-test-123',
        itemNome: 'Kit 4 Pilhas',
        categoria: 'pilhas',
        pevId: 1,
        pesoGramas: 96,
        metaisGramas: 38,
      };
      const desc1 = await fetch(`${baseUrl}/api/descartes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(descartePayload),
      });
      assert.equal(desc1.status, 201);

      const descDuplicado = await fetch(`${baseUrl}/api/descartes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(descartePayload),
      });
      assert.equal(descDuplicado.status, 200);
    } finally {
      server.close();
    }
  });
});
