import fs from 'node:fs';
import path from 'node:path';
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { PEVS_INICIAIS_MACEIO } from '../src/data/maceioPevs';
import { validarPayloadPev } from '../src/utils/geo';
import type { CategoriaResiduo, PevItem, RegistroDescarte } from '../src/types';

const JWT_SECRET =
  process.env.JWT_SECRET ?? 'dev-extensionista-unima-secret-change-in-prod';
const ADMIN_USER = process.env.ADMIN_USER ?? 'admin@unima.edu.br';
const ADMIN_PASS = process.env.ADMIN_PASS ?? 'descarte2026';

const tentativasLogin = new Map<string, { count: number; resetAt: number }>();

function verificarRateLimitLogin(ip: string): boolean {
  const agora = Date.now();
  const registro = tentativasLogin.get(ip);
  if (!registro || agora > registro.resetAt) {
    tentativasLogin.set(ip, { count: 1, resetAt: agora + 15 * 60 * 1000 });
    return true;
  }
  if (registro.count >= 10) {
    return false;
  }
  registro.count += 1;
  return true;
}

const DESCARTES_SEMENTE_SERVIDOR: RegistroDescarte[] = [
  {
    id: 'seed-1',
    itemNome: 'Kit 4 Pilhas Alcalinas / Baterias',
    categoria: 'pilhas',
    pevId: 1,
    pevNome: 'Coletor Piloto — Campus UNIMA | Afya',
    pesoGramas: 96,
    metaisGramas: 38,
    timestamp: '2026-10-28T14:20:00.000Z',
    statusSincronizacao: 'sincronizado',
  },
  {
    id: 'seed-2',
    itemNome: 'Cabos USB, Carregador ou Fone',
    categoria: 'cabos',
    pevId: 1,
    pevNome: 'Coletor Piloto — Campus UNIMA | Afya',
    pesoGramas: 110,
    metaisGramas: 55,
    timestamp: '2026-11-02T10:15:00.000Z',
    statusSincronizacao: 'sincronizado',
  },
  {
    id: 'seed-3',
    itemNome: 'Smartphone / Celular Antigo',
    categoria: 'celulares',
    pevId: 1,
    pevNome: 'Coletor Piloto — Campus UNIMA | Afya',
    pesoGramas: 185,
    metaisGramas: 42,
    timestamp: '2026-11-08T18:40:00.000Z',
    statusSincronizacao: 'sincronizado',
  },
];

export interface OpcoesApiExpress {
  persistirEmDisco?: boolean;
  caminhoArquivoJson?: string;
}

export function criarApiExpress(opcoes: OpcoesApiExpress = {}): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '64kb' }));

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  const persistir = opcoes.persistirEmDisco ?? false;
  const arquivoDb =
    opcoes.caminhoArquivoJson ??
    path.resolve(process.cwd(), 'server/data/pevs-db.json');

  function carregarBancoInicial(): PevItem[] {
    if (persistir && fs.existsSync(arquivoDb)) {
      try {
        const lido = JSON.parse(fs.readFileSync(arquivoDb, 'utf8'));
        if (Array.isArray(lido) && lido.length > 0) {
          return lido as PevItem[];
        }
      } catch {
        // Fallback para dados semente
      }
    }
    return PEVS_INICIAIS_MACEIO.map((item) => ({
      ...item,
      categorias: [...item.categorias],
    }));
  }

  let bancoPevs: PevItem[] = carregarBancoInicial();
  let bancoDescartes: RegistroDescarte[] = DESCARTES_SEMENTE_SERVIDOR.map(
    (d) => ({ ...d })
  );

  function salvarEmDisco(): void {
    if (!persistir) return;
    try {
      fs.mkdirSync(path.dirname(arquivoDb), { recursive: true });
      fs.writeFileSync(arquivoDb, JSON.stringify(bancoPevs, null, 2), 'utf8');
    } catch {
      // Falha silenciosa se diretório for somente leitura
    }
  }

  if (persistir && !fs.existsSync(arquivoDb)) {
    salvarEmDisco();
  }

  function exigirAuthAdmin(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ erro: 'Token de autenticação ausente.' });
      return;
    }
    const token = authHeader.slice(7);
    try {
      jwt.verify(token, JWT_SECRET);
      next();
    } catch {
      res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
  }

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      totalPevsAtivos: bancoPevs.filter((p) => p.ativo).length,
      totalDescartes: bancoDescartes.length,
      persistenciaDisco: persistir,
    });
  });

  app.get('/api/pevs', (req: Request, res: Response) => {
    const categoria =
      typeof req.query.categoria === 'string'
        ? (req.query.categoria as CategoriaResiduo)
        : undefined;
    const incluirInativos = req.query.incluirInativos === 'true';

    const lista = bancoPevs.filter((pev) => {
      if (!incluirInativos && !pev.ativo) return false;
      if (categoria && !pev.categorias.includes(categoria)) return false;
      return true;
    });

    res.json(lista);
  });

  app.get('/api/pevs/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const pev = bancoPevs.find((item) => item.id === id);
    if (!pev) {
      res.status(404).json({ erro: 'PEV não encontrado.' });
      return;
    }
    res.json(pev);
  });

  app.get('/api/descartes', (_req: Request, res: Response) => {
    res.json(bancoDescartes);
  });

  app.post('/api/descartes', (req: Request, res: Response) => {
    const id =
      typeof req.body?.id === 'string' && req.body.id.trim().length > 0
        ? req.body.id.trim().slice(0, 64)
        : `desc-${Date.now()}`;

    const existente = bancoDescartes.find((d) => d.id === id);
    if (existente) {
      res.status(200).json(existente);
      return;
    }

    const itemNome =
      typeof req.body?.itemNome === 'string'
        ? req.body.itemNome.trim().slice(0, 120)
        : 'Resíduo Eletrônico';
    const pevId = Number(req.body?.pevId) || 1;
    const pevAlvo = bancoPevs.find((p) => p.id === pevId);
    const pesoGramas = Math.min(
      50000,
      Math.max(10, Number(req.body?.pesoGramas) || 100)
    );
    const metaisGramas = Math.min(
      20000,
      Math.max(1, Number(req.body?.metaisGramas) || 35)
    );

    const novoDescarte: RegistroDescarte = {
      id,
      itemNome,
      categoria: (req.body?.categoria as CategoriaResiduo) ?? 'pilhas',
      pevId,
      pevNome:
        pevAlvo?.nome ??
        (typeof req.body?.pevNome === 'string'
          ? req.body.pevNome.slice(0, 120)
          : 'Coletor Piloto UNIMA'),
      pesoGramas,
      metaisGramas,
      timestamp:
        typeof req.body?.timestamp === 'string'
          ? req.body.timestamp
          : new Date().toISOString(),
      statusSincronizacao: 'sincronizado',
    };

    bancoDescartes = [novoDescarte, ...bancoDescartes].slice(0, 500);
    res.status(201).json(novoDescarte);
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    if (
      process.env.NODE_ENV === 'production' &&
      (!process.env.ADMIN_PASS || !process.env.JWT_SECRET)
    ) {
      res.status(403).json({
        erro: 'Autenticação administrativa desabilitada em produção.',
      });
      return;
    }

    const ip = req.ip ?? 'local';
    if (!verificarRateLimitLogin(ip)) {
      res.status(429).json({
        erro: 'Muitas tentativas de login. Aguarde alguns minutos.',
      });
      return;
    }

    const email =
      typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';

    if (email !== ADMIN_USER || senha !== ADMIN_PASS) {
      res.status(401).json({ erro: 'Credenciais administrativas inválidas.' });
      return;
    }

    const token = jwt.sign({ role: 'admin', sub: email }, JWT_SECRET, {
      expiresIn: '8h',
    });
    res.json({ token, usuario: { email, role: 'admin' } });
  });

  app.post('/api/pevs', exigirAuthAdmin, (req: Request, res: Response) => {
    const validacao = validarPayloadPev(req.body);
    if (!validacao.valido) {
      res.status(400).json({ erro: validacao.erro });
      return;
    }

    const novoId =
      bancoPevs.reduce((max, item) => (item.id > max ? item.id : max), 0) + 1;
    const agoraIso = new Date().toISOString();

    const novoPev: PevItem = {
      id: novoId,
      ...validacao.valor,
      operador: validacao.valor.operador ?? 'Parceiro Credenciado',
      observacao: validacao.valor.observacao ?? '',
      ativo: true,
      destaque_piloto: false,
      criado_em: agoraIso,
      atualizado_em: agoraIso,
    };

    bancoPevs.push(novoPev);
    salvarEmDisco();
    res.status(201).json(novoPev);
  });

  app.put('/api/pevs/:id', exigirAuthAdmin, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const indice = bancoPevs.findIndex((item) => item.id === id);
    if (indice === -1) {
      res.status(404).json({ erro: 'PEV não encontrado.' });
      return;
    }

    const atual = bancoPevs[indice];
    const validacao = validarPayloadPev({
      ...atual,
      ...req.body,
    });

    if (!validacao.valido) {
      res.status(400).json({ erro: validacao.erro });
      return;
    }

    const atualizado: PevItem = {
      ...atual,
      ...validacao.valor,
      operador: validacao.valor.operador ?? atual.operador,
      observacao: validacao.valor.observacao ?? atual.observacao,
      ativo: typeof req.body?.ativo === 'boolean' ? req.body.ativo : atual.ativo,
      atualizado_em: new Date().toISOString(),
    };

    bancoPevs[indice] = atualizado;
    salvarEmDisco();
    res.json(atualizado);
  });

  app.delete('/api/pevs/:id', exigirAuthAdmin, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const indice = bancoPevs.findIndex((item) => item.id === id);
    if (indice === -1) {
      res.status(404).json({ erro: 'PEV não encontrado.' });
      return;
    }

    bancoPevs[indice] = {
      ...bancoPevs[indice],
      ativo: !bancoPevs[indice].ativo,
      atualizado_em: new Date().toISOString(),
    };

    salvarEmDisco();
    res.json(bancoPevs[indice]);
  });

  return app;
}
