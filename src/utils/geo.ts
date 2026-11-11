import type { CategoriaResiduo, PevComDistancia, PevItem } from '../types';

const RAIO_TERRA_KM = 6371;

function grausParaRadianos(graus: number): number {
  return (graus * Math.PI) / 180;
}

export function calcularDistanciaKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = grausParaRadianos(lat2 - lat1);
  const dLon = grausParaRadianos(lon2 - lon1);
  const rLat1 = grausParaRadianos(lat1);
  const rLat2 = grausParaRadianos(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(rLat1) * Math.cos(rLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((RAIO_TERRA_KM * c).toFixed(2));
}

export function formatarDistancia(distanciaKm: number | null): string {
  if (distanciaKm === null || Number.isNaN(distanciaKm)) {
    return 'Distância não calculada';
  }
  if (distanciaKm < 1) {
    const metros = Math.max(10, Math.round(distanciaKm * 1000));
    return `${metros} m`;
  }
  return `${distanciaKm.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km`;
}

export interface FiltroPevsOpcoes {
  categoria: CategoriaResiduo | 'todas';
  busca: string;
  apenasAtivos?: boolean;
  coordenadasUsuario?: { latitude: number; longitude: number } | null;
}

export function filtrarEOrdenarPevs(
  pevs: PevItem[],
  opcoes: FiltroPevsOpcoes
): PevComDistancia[] {
  const termo = opcoes.busca.trim().toLowerCase();
  const apenasAtivos = opcoes.apenasAtivos ?? true;

  const filtrados = pevs
    .filter((pev) => {
      if (apenasAtivos && !pev.ativo) return false;
      if (
        opcoes.categoria !== 'todas' &&
        !pev.categorias.includes(opcoes.categoria)
      ) {
        return false;
      }
      if (termo.length > 0) {
        const alvo =
          `${pev.nome} ${pev.bairro} ${pev.endereco} ${pev.operador}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    })
    .map((pev): PevComDistancia => {
      const distanciaKm = opcoes.coordenadasUsuario
        ? calcularDistanciaKm(
            opcoes.coordenadasUsuario.latitude,
            opcoes.coordenadasUsuario.longitude,
            pev.latitude,
            pev.longitude
          )
        : null;
      return { ...pev, distanciaKm };
    });

  return filtrados.sort((a, b) => {
    if (a.distanciaKm !== null && b.distanciaKm !== null) {
      return a.distanciaKm - b.distanciaKm;
    }
    if (a.destaque_piloto && !b.destaque_piloto) return -1;
    if (!a.destaque_piloto && b.destaque_piloto) return 1;
    return a.id - b.id;
  });
}

export function gerarLinksNavegacao(
  latitude: number,
  longitude: number,
  nome: string
): { googleMaps: string; waze: string; appleMaps: string } {
  const query = encodeURIComponent(`${latitude},${longitude} (${nome})`);
  return {
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&destination_place_id=${query}`,
    waze: `https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`,
    appleMaps: `https://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=d&q=${encodeURIComponent(nome)}`,
  };
}

export interface PayloadNovoPev {
  nome: string;
  endereco: string;
  bairro: string;
  latitude: number;
  longitude: number;
  horario_funcionamento: string;
  categorias: CategoriaResiduo[];
  operador?: string;
  observacao?: string;
}

const CATEGORIAS_VALIDAS: CategoriaResiduo[] = [
  'pilhas',
  'celulares',
  'cabos',
  'computadores',
  'eletrodomesticos',
];

export function validarPayloadPev(
  dados: Partial<PayloadNovoPev>
): { valido: true; valor: PayloadNovoPev } | { valido: false; erro: string } {
  const nome = (dados.nome ?? '').trim();
  const endereco = (dados.endereco ?? '').trim();
  const bairro = (dados.bairro ?? '').trim();
  const horario = (dados.horario_funcionamento ?? '').trim();
  const latitude = Number(dados.latitude);
  const longitude = Number(dados.longitude);
  const categorias = Array.isArray(dados.categorias)
    ? dados.categorias.filter((c): c is CategoriaResiduo =>
        CATEGORIAS_VALIDAS.includes(c as CategoriaResiduo)
      )
    : [];

  if (nome.length < 4 || nome.length > 120) {
    return { valido: false, erro: 'Informe um nome entre 4 e 120 caracteres.' };
  }
  if (endereco.length < 6 || endereco.length > 255) {
    return {
      valido: false,
      erro: 'Informe o endereço completo (entre 6 e 255 caracteres).',
    };
  }
  if (bairro.length < 2 || bairro.length > 80) {
    return { valido: false, erro: 'Informe o bairro em Maceió-AL.' };
  }
  if (Number.isNaN(latitude) || latitude < -10.5 || latitude > -8.8) {
    return {
      valido: false,
      erro: 'Latitude inválida para a região de Alagoas (esperado entre -10.5 e -8.8).',
    };
  }
  if (Number.isNaN(longitude) || longitude < -38.0 || longitude > -35.0) {
    return {
      valido: false,
      erro: 'Longitude inválida para a região de Alagoas (esperado entre -38.0 e -35.0).',
    };
  }
  if (categorias.length === 0) {
    return {
      valido: false,
      erro: 'Selecione ao menos uma categoria de resíduo aceita no PEV.',
    };
  }

  return {
    valido: true,
    valor: {
      nome,
      endereco,
      bairro,
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      horario_funcionamento: horario || 'Seg a Sex: 08h00 às 18h00',
      categorias,
      operador: (dados.operador ?? 'Parceiro Credenciado').trim(),
      observacao: (
        dados.observacao ?? 'Ponto de Entrega Voluntária verificado.'
      ).trim(),
    },
  };
}

