export type CategoriaResiduo =
  | 'pilhas'
  | 'celulares'
  | 'cabos'
  | 'computadores'
  | 'eletrodomesticos';

export interface PevItem {
  id: number;
  nome: string;
  endereco: string;
  bairro: string;
  latitude: number;
  longitude: number;
  horario_funcionamento: string;
  categorias: CategoriaResiduo[];
  ativo: boolean;
  destaque_piloto?: boolean;
  operador: string;
  observacao: string;
  criado_em: string;
  atualizado_em: string;
}

export interface PevComDistancia extends PevItem {
  distanciaKm: number | null;
}

export interface CategoriaMeta {
  id: CategoriaResiduo;
  label: string;
  curto: string;
  cor: string;
  corFundo: string;
  corBorda: string;
  descricao: string;
  aceitoNoColetorPiloto: boolean;
  iconeSvg: string;
}

export interface ElementoToxico {
  nome: string;
  simbolo: string;
  grupoIarc: string;
  encontradoEm: string;
  efeitosAgudosCronicos: string;
}

export interface ItemCalculadoraToxica {
  id: string;
  nome: string;
  pesoMedioGramas: number;
  metaisEvitadosGramas: number;
  categoriaRecomendada: CategoriaResiduo;
  cabeNoColetorPiloto: boolean;
  elementosPrincipais: string[];
  alertaManuseio: string;
}

export type StatusSincronizacao = 'sincronizado' | 'pendente_offline';

export interface RegistroDescarte {
  id: string;
  itemNome: string;
  categoria: CategoriaResiduo;
  pevId: number;
  pevNome: string;
  pesoGramas: number;
  metaisGramas: number;
  timestamp: string;
  statusSincronizacao?: StatusSincronizacao;
}
