import { PEVS_INICIAIS_MACEIO } from '../data/maceioPevs';
import type { PevItem, RegistroDescarte } from '../types';

const STORAGE_PEVS_KEY = 'descarte_inteligente_pevs_v1';
const STORAGE_DESCARTES_KEY = 'descarte_inteligente_descartes_v1';
const STORAGE_LGPD_KEY = 'descarte_inteligente_lgpd_checks_v1';

const DESCARTES_SEMENTE: RegistroDescarte[] = [
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

function lerPevsLocal(): PevItem[] {
  try {
    const salvo = localStorage.getItem(STORAGE_PEVS_KEY);
    if (!salvo) return [...PEVS_INICIAIS_MACEIO];
    const parsed = JSON.parse(salvo);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : [...PEVS_INICIAIS_MACEIO];
  } catch {
    return [...PEVS_INICIAIS_MACEIO];
  }
}

function salvarPevsLocal(pevs: PevItem[]): void {
  try {
    localStorage.setItem(STORAGE_PEVS_KEY, JSON.stringify(pevs));
  } catch {
    // Fallback silencioso para QuotaExceededError
  }
}

export async function buscarPevs(): Promise<{
  pevs: PevItem[];
  origem: 'api' | 'local';
}> {
  try {
    const resposta = await fetch('/api/pevs', {
      headers: { Accept: 'application/json' },
    });
    if (resposta.ok) {
      const dados = (await resposta.json()) as PevItem[];
      salvarPevsLocal(dados);
      return { pevs: dados.filter((item) => item.ativo), origem: 'api' };
    }
  } catch {
    // Continua para fallback local
  }

  const locais = lerPevsLocal().filter((item) => item.ativo);
  return { pevs: locais, origem: 'local' };
}

export function listarDescartesRegistrados(): RegistroDescarte[] {
  try {
    const salvo = localStorage.getItem(STORAGE_DESCARTES_KEY);
    if (!salvo) return [...DESCARTES_SEMENTE];
    const parsed = JSON.parse(salvo);
    return Array.isArray(parsed) ? parsed : [...DESCARTES_SEMENTE];
  } catch {
    return [...DESCARTES_SEMENTE];
  }
}

function salvarDescartesLocal(lista: RegistroDescarte[]): void {
  try {
    localStorage.setItem(STORAGE_DESCARTES_KEY, JSON.stringify(lista));
  } catch {
    // Ignorar
  }
}

export async function registrarNovoDescarte(
  novo: Omit<RegistroDescarte, 'id' | 'timestamp' | 'statusSincronizacao'>
): Promise<{
  lista: RegistroDescarte[];
  sincronizadoServidor: boolean;
}> {
  const listaAtual = listarDescartesRegistrados();
  const idIdempotente = `desc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const itemLocal: RegistroDescarte = {
    ...novo,
    id: idIdempotente,
    timestamp: new Date().toISOString(),
    statusSincronizacao: 'pendente_offline',
  };

  // Persiste primeiro no aparelho (regra de escrita offline segura)
  const listaComPendente = [itemLocal, ...listaAtual];
  salvarDescartesLocal(listaComPendente);

  try {
    const resposta = await fetch('/api/descartes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemLocal),
    });
    if (resposta.ok) {
      const listaSincronizada = listaComPendente.map((d) =>
        d.id === idIdempotente
          ? { ...d, statusSincronizacao: 'sincronizado' as const }
          : d
      );
      salvarDescartesLocal(listaSincronizada);
      return { lista: listaSincronizada, sincronizadoServidor: true };
    }
  } catch {
    // Permanece na fila local como pendente_offline para reenvio quando a rede voltar
  }

  return { lista: listaComPendente, sincronizadoServidor: false };
}

export async function sincronizarDescartesPendentes(): Promise<RegistroDescarte[]> {
  const atuais = listarDescartesRegistrados();
  const pendentes = atuais.filter(
    (d) => d.statusSincronizacao === 'pendente_offline'
  );
  if (pendentes.length === 0) return atuais;

  const idsSincronizados = new Set<string>();
  for (const item of pendentes) {
    try {
      const res = await fetch('/api/descartes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        idsSincronizados.add(item.id);
      }
    } catch {
      break;
    }
  }

  if (idsSincronizados.size > 0) {
    const atualizada = atuais.map((d) =>
      idsSincronizados.has(d.id)
        ? { ...d, statusSincronizacao: 'sincronizado' as const }
        : d
    );
    salvarDescartesLocal(atualizada);
    return atualizada;
  }

  return atuais;
}

export function lerChecklistLgpd(): Record<string, boolean> {
  try {
    const salvo = localStorage.getItem(STORAGE_LGPD_KEY);
    return salvo ? (JSON.parse(salvo) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function salvarChecklistLgpd(estado: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_LGPD_KEY, JSON.stringify(estado));
  } catch {
    // Ignorar
  }
}
