import type {
  CategoriaMeta,
  CategoriaResiduo,
  ElementoToxico,
  ItemCalculadoraToxica,
  PevItem,
} from '../types';

export const COORDENADAS_PADRAO_PILOTO = {
  latitude: -9.6198,
  longitude: -35.7014,
  label: 'Ponto Piloto Cruz das Almas (Maceió-AL)',
};
export const COORDENADAS_PADRAO_UNIMA = COORDENADAS_PADRAO_PILOTO;

export const CATEGORIAS_META: Record<CategoriaResiduo, CategoriaMeta> = {
  pilhas: {
    id: 'pilhas',
    label: 'Pilhas e Baterias',
    curto: 'Pilhas',
    cor: '#B84A18',
    corFundo: '#FDF1EB',
    corBorda: '#E7B89E',
    descricao:
      'Pilhas AA/AAA, baterias 9V, moedas de lítio e baterias de celular. Exigem compartimento metálico isolado contra curto-circuito.',
    aceitoNoColetorPiloto: true,
    iconeSvg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7" y="4" width="10" height="17" rx="2"/><line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="10" y1="11" x2="14" y2="11"/><line x1="10" y1="16" x2="14" y2="16"/></svg>`,
  },
  celulares: {
    id: 'celulares',
    label: 'Celulares e Portáteis',
    curto: 'Celulares',
    cor: '#185854',
    corFundo: '#EBF6F5',
    corBorda: '#9FD0CD',
    descricao:
      'Smartphones, celulares antigos, tablets pequenos e leitores digitais que passam na fenda de 20 × 4 cm.',
    aceitoNoColetorPiloto: true,
    iconeSvg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/><line x1="10" y1="5" x2="14" y2="5"/></svg>`,
  },
  cabos: {
    id: 'cabos',
    label: 'Cabos e Periféricos',
    curto: 'Cabos',
    cor: '#235338',
    corFundo: '#ECF4EF',
    corBorda: '#A3C9B3',
    descricao:
      'Cabos USB/HDMI, carregadores, fones de ouvido, mouses, pendrives e adaptadores pequenos.',
    aceitoNoColetorPiloto: true,
    iconeSvg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z"/></svg>`,
  },
  computadores: {
    id: 'computadores',
    label: 'Computadores e TI',
    curto: 'Informática',
    cor: '#2E4775',
    corFundo: '#EDF1F8',
    corBorda: '#A8B9DA',
    descricao:
      'Notebooks, gabinetes, placas-mãe, monitores, impressoras, roteadores e no-breaks (médio porte).',
    aceitoNoColetorPiloto: false,
    iconeSvg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  },
  eletrodomesticos: {
    id: 'eletrodomesticos',
    label: 'Eletrodomésticos',
    curto: 'Eletros',
    cor: '#68472E',
    corFundo: '#F6F0EB',
    corBorda: '#CFB6A2',
    descricao:
      'Micro-ondas, televisores, liquidificadores, ventiladores, ferros de passar e aparelhos de linha branca.',
    aceitoNoColetorPiloto: false,
    iconeSvg: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><rect x="6" y="8" width="8" height="8" rx="1"/><line x1="17" y1="9" x2="17.01" y2="9"/><line x1="17" y1="13" x2="17.01" y2="13"/></svg>`,
  },
};

export const PEVS_INICIAIS_MACEIO: PevItem[] = [
  {
    id: 1,
    nome: 'Coletor Piloto — Ponto Cruz das Almas (Entrada Principal)',
    endereco: 'Av. Comendador Gustavo Paiva, 5017 — Cruz das Almas, Maceió - AL',
    bairro: 'Cruz das Almas',
    latitude: -9.6198,
    longitude: -35.7014,
    horario_funcionamento: 'Seg a Sex: 07h00 às 22h00 | Sáb: 08h00 às 12h00',
    categorias: ['pilhas', 'celulares', 'cabos'],
    ativo: true,
    destaque_piloto: true,
    operador: 'Projeto Descarte Inteligente',
    observacao:
      'Coletor cilíndrico ⌀ 40×60 cm com slot superior (20×4 cm) para celulares/cabos e caixa metálica lateral isolada (15×12 cm) exclusiva para pilhas e baterias.',
    criado_em: '2026-08-22T10:00:00.000Z',
    atualizado_em: '2026-09-30T14:00:00.000Z',
  },
  {
    id: 2,
    nome: 'Centro de Inovação do Polo Tecnológico (CIPT Jaraguá)',
    endereco: 'Av. Comendador Leão, 322 — Jaraguá, Maceió - AL',
    bairro: 'Jaraguá',
    latitude: -9.6731,
    longitude: -35.7224,
    horario_funcionamento: 'Seg a Sex: 08h00 às 18h00',
    categorias: ['pilhas', 'celulares', 'cabos', 'computadores'],
    ativo: true,
    destaque_piloto: false,
    operador: 'SECTI-AL / Hub Tecnológico de Alagoas',
    observacao:
      'Recebe resíduos de informática, placas, periféricos, smartphones e baterias no hall térreo.',
    criado_em: '2026-08-22T10:00:00.000Z',
    atualizado_em: '2026-09-15T12:00:00.000Z',
  },
  {
    id: 3,
    nome: 'PEV Green Eletron — Parque Shopping Maceió',
    endereco: 'Av. Comendador Gustavo Paiva, 5945 — Cruz das Almas, Maceió - AL',
    bairro: 'Cruz das Almas',
    latitude: -9.6263,
    longitude: -35.6997,
    horario_funcionamento: 'Seg a Sáb: 10h00 às 22h00 | Dom: 12h00 às 21h00',
    categorias: ['pilhas', 'celulares', 'cabos', 'computadores'],
    ativo: true,
    destaque_piloto: false,
    operador: 'Green Eletron / ABREE',
    observacao:
      'A apenas 850m do Ponto Piloto. Ideal quando seu equipamento (notebook, impressora pequena, teclado) não passar na fenda de 20×4 cm do coletor piloto.',
    criado_em: '2026-08-22T10:00:00.000Z',
    atualizado_em: '2026-09-15T12:00:00.000Z',
  },
  {
    id: 4,
    nome: 'Ponto de Logística Reversa — Leroy Merlin Maceió',
    endereco: 'Av. Comendador Gustavo Paiva, 5300 — Cruz das Almas, Maceió - AL',
    bairro: 'Cruz das Almas',
    latitude: -9.6285,
    longitude: -35.7021,
    horario_funcionamento: 'Seg a Sáb: 08h00 às 22h00 | Dom: 09h00 às 20h00',
    categorias: ['pilhas', 'celulares', 'cabos', 'eletrodomesticos'],
    ativo: true,
    destaque_piloto: false,
    operador: 'Leroy Merlin / Recicla Eletro',
    observacao:
      'Aceita ferramentas elétricas descartadas, eletroportáteis, lâmpadas íntegras, pilhas e cabos na entrada principal.',
    criado_em: '2026-08-22T10:00:00.000Z',
    atualizado_em: '2026-09-15T12:00:00.000Z',
  },
  {
    id: 5,
    nome: 'PEV Green Eletron — Maceió Shopping',
    endereco: 'Av. Comendador Gustavo Paiva, 2990 — Mangabeiras, Maceió - AL',
    bairro: 'Mangabeiras',
    latitude: -9.6481,
    longitude: -35.7136,
    horario_funcionamento: 'Seg a Sáb: 09h00 às 22h00 | Dom: 12h00 às 21h00',
    categorias: ['pilhas', 'celulares', 'cabos', 'computadores'],
    ativo: true,
    destaque_piloto: false,
    operador: 'Green Eletron / Operadoras de Telefonia',
    observacao:
      'Urna coletora para celulares, baterias, carregadores, modems e pequenos aparelhos eletrônicos.',
    criado_em: '2026-08-22T10:00:00.000Z',
    atualizado_em: '2026-09-15T12:00:00.000Z',
  },
  {
    id: 6,
    nome: 'Estação Coleta — Carrefour Mangabeiras',
    endereco: 'Av. Comendador Gustavo Paiva, 2642 — Mangabeiras, Maceió - AL',
    bairro: 'Mangabeiras',
    latitude: -9.6442,
    longitude: -35.7175,
    horario_funcionamento: 'Seg a Sáb: 07h00 às 22h00 | Dom: 07h00 às 20h00',
    categorias: ['pilhas', 'celulares', 'cabos', 'eletrodomesticos'],
    ativo: true,
    destaque_piloto: false,
    operador: 'Grupo Carrefour / Green Eletron',
    observacao:
      'Coletor próximo ao atendimento ao cliente para pilhas, baterias portáteis e pequenos eletrodomésticos.',
    criado_em: '2026-08-22T10:00:00.000Z',
    atualizado_em: '2026-09-15T12:00:00.000Z',
  },
  {
    id: 7,
    nome: 'SENAI Alagoas — Hub Logística Reversa Poço',
    endereco: 'Rua Pedro Américo, 18 — Poço, Maceió - AL',
    bairro: 'Poço',
    latitude: -9.6624,
    longitude: -35.7318,
    horario_funcionamento: 'Seg a Sex: 08h00 às 17h30',
    categorias: ['pilhas', 'celulares', 'cabos', 'computadores', 'eletrodomesticos'],
    ativo: true,
    destaque_piloto: false,
    operador: 'Sistema FIEA / SENAI-AL',
    observacao:
      'Recebe computadores completos, monitores, placas eletrônicas e equipamentos de laboratório/escritório para triagem técnica.',
    criado_em: '2026-08-22T10:00:00.000Z',
    atualizado_em: '2026-09-15T12:00:00.000Z',
  },
  {
    id: 8,
    nome: 'Home Center Ferreira Costa — Coleta Eletrônica',
    endereco: 'Av. Durval de Góes Monteiro, 6101 — Tabuleiro do Martins, Maceió - AL',
    bairro: 'Tabuleiro do Martins',
    latitude: -9.6079,
    longitude: -35.7469,
    horario_funcionamento: 'Seg a Sáb: 08h00 às 21h00 | Dom: 09h00 às 18h00',
    categorias: ['pilhas', 'celulares', 'cabos', 'computadores', 'eletrodomesticos'],
    ativo: true,
    destaque_piloto: false,
    operador: 'Ferreira Costa / ABREE',
    observacao:
      'Ecoponto amplo no piso de estacionamento para a parte alta de Maceió. Recebe de pilhas a ventiladores e micro-ondas.',
    criado_em: '2026-08-22T10:00:00.000Z',
    atualizado_em: '2026-09-15T12:00:00.000Z',
  },
  {
    id: 9,
    nome: 'PEV Green Eletron — Shopping Pátio Maceió',
    endereco: 'Av. Menino Marcelo, 3800 — Cidade Universitária, Maceió - AL',
    bairro: 'Cidade Universitária',
    latitude: -9.5582,
    longitude: -35.7478,
    horario_funcionamento: 'Seg a Sáb: 09h00 às 22h00 | Dom: 12h00 às 21h00',
    categorias: ['pilhas', 'celulares', 'cabos', 'computadores'],
    ativo: true,
    destaque_piloto: false,
    operador: 'Green Eletron',
    observacao:
      'Atende toda a região da Cidade Universitária e Benedito Bentes para descarte de portáteis, cabos, pilhas e acessórios.',
    criado_em: '2026-08-22T10:00:00.000Z',
    atualizado_em: '2026-09-15T12:00:00.000Z',
  },
  {
    id: 10,
    nome: 'Ecoponto Municipal ALURB — Pajuçara',
    endereco: 'Rua Campos Teixeira, s/n — Pajuçara, Maceió - AL',
    bairro: 'Pajuçara',
    latitude: -9.6692,
    longitude: -35.7145,
    horario_funcionamento: 'Todos os dias: 06h00 às 18h00',
    categorias: ['computadores', 'eletrodomesticos'],
    ativo: true,
    destaque_piloto: false,
    operador: 'ALURB / Prefeitura de Maceió + Cooperativas Parceiras',
    observacao:
      'Indicado exclusivamente para equipamentos volumosos (TVs antigas, monitores, carcaças de PC e eletrodomésticos de grande porte).',
    criado_em: '2026-08-22T10:00:00.000Z',
    atualizado_em: '2026-09-15T12:00:00.000Z',
  },
];

export const ELEMENTOS_TOXICOS: ElementoToxico[] = [
  {
    nome: 'Chumbo',
    simbolo: 'Pb',
    grupoIarc: 'Grupo 2A (Provável carcinógeno)',
    encontradoEm: 'Soldas de placas de circuito, baterias e vidros de monitores antigos.',
    efeitosAgudosCronicos:
      'Anemia, fraqueza muscular, danos renais severos e comprometimento neurológico permanente.',
  },
  {
    nome: 'Mercúrio',
    simbolo: 'Hg',
    grupoIarc: 'Grupo 2B (Metil-mercúrio)',
    encontradoEm: 'Displays LCD antigos, relés, sensores e baterias botão.',
    efeitosAgudosCronicos:
      'Necrose renal, tremores, transtornos do sistema nervoso central e bioacumulação hídrica.',
  },
  {
    nome: 'Cádmio',
    simbolo: 'Cd',
    grupoIarc: 'Grupo 1 (Carcinógeno humano confirmado)',
    encontradoEm: 'Baterias recarregáveis NiCd, contatos de placas, chips SMD e plásticos PVC.',
    efeitosAgudosCronicos:
      'Debilitação óssea severa, lesões renais irreversíveis e câncer pulmonar.',
  },
  {
    nome: 'Arsênio',
    simbolo: 'As',
    grupoIarc: 'Grupo 1 (Carcinógeno humano confirmado)',
    encontradoEm: 'Transistores de arsenieto de gálio em smartphones, chips de RF e LEDs.',
    efeitosAgudosCronicos:
      'Neuropatia periférica, lesões dérmicas e neoplasias de pele, pulmão, bexiga e rins.',
  },
  {
    nome: 'Berílio',
    simbolo: 'Be',
    grupoIarc: 'Grupo 1 (Carcinógeno humano confirmado)',
    encontradoEm: 'Conectores de mola em placas-mãe, contatos de alta condutividade.',
    efeitosAgudosCronicos:
      'Beriliose pulmonar crônica por inalação de poeira no desmanche irregular.',
  },
  {
    nome: 'Lítio & Eletrólitos',
    simbolo: 'Li',
    grupoIarc: 'Risco Químico e Térmico Crítico',
    encontradoEm: 'Baterias de smartphones, notebooks, fones Bluetooth e powerbanks.',
    efeitosAgudosCronicos:
      'Fuga térmica (incêndio espontâneo quando perfurado/comprimido), arritmia e contaminação alcalina.',
  },
];

export const ITENS_CALCULADORA: ItemCalculadoraToxica[] = [
  {
    id: 'smartphone',
    nome: 'Smartphone / Celular Antigo',
    pesoMedioGramas: 185,
    metaisEvitadosGramas: 42,
    categoriaRecomendada: 'celulares',
    cabeNoColetorPiloto: true,
    elementosPrincipais: ['Lítio (Li)', 'Cobalto (Co)', 'Chumbo (Pb)', 'Arsênio (As)', 'Ouro (0,03g recuperável)'],
    alertaManuseio:
      'Cabe na fenda de 20×4 cm do Coletor Piloto. Antes de depositar, realize o Hard Reset (LGPD) e remova chip SIM/SD. Se a bateria estiver estufada, entregue na portaria/caixa metálica.',
  },
  {
    id: 'pilhas-pack',
    nome: 'Kit 4 Pilhas Alcalinas / Baterias',
    pesoMedioGramas: 96,
    metaisEvitadosGramas: 38,
    categoriaRecomendada: 'pilhas',
    cabeNoColetorPiloto: true,
    elementosPrincipais: ['Zinco (Zn)', 'Manganês (Mn)', 'Cádmio (Cd)', 'Lítio (Li)'],
    alertaManuseio:
      'Deposite EXCLUSIVAMENTE na Caixa Metálica Lateral (15×12 cm) do Coletor Piloto. Nunca misture pilhas soltas com cabos no tambor principal (risco de curto-circuito).',
  },
  {
    id: 'cabo-carregador',
    nome: 'Cabos USB, Carregador ou Fone',
    pesoMedioGramas: 110,
    metaisEvitadosGramas: 55,
    categoriaRecomendada: 'cabos',
    cabeNoColetorPiloto: true,
    elementosPrincipais: ['Cobre eletrolítico (Cu)', 'Ftalatos (PVC)', 'Retardantes de chama bromados', 'Estanho (Sn)'],
    alertaManuseio:
      'Cabe perfeitamente no slot superior de 20×4 cm do Coletor Piloto. Enrole o cabo para evitar que trave a boca coletora.',
  },
  {
    id: 'notebook',
    nome: 'Notebook / Placa de Computador',
    pesoMedioGramas: 2100,
    metaisEvitadosGramas: 680,
    categoriaRecomendada: 'computadores',
    cabeNoColetorPiloto: false,
    elementosPrincipais: ['Chumbo (Pb)', 'Berílio (Be)', 'Cromo Hexavalente (Cr VI)', 'Lítio (Li)', 'Prata & Ouro'],
    alertaManuseio:
      'NÃO CABE no slot 20×4 cm do Coletor Piloto. Recomendamos o PEV Parque Shopping (a 850m do ponto piloto), CIPT Jaraguá ou SENAI Poço.',
  },
  {
    id: 'microondas-tv',
    nome: 'Monitor, TV ou Eletroportátil Grande',
    pesoMedioGramas: 6500,
    metaisEvitadosGramas: 1950,
    categoriaRecomendada: 'eletrodomesticos',
    cabeNoColetorPiloto: false,
    elementosPrincipais: ['Chumbo em vidro/solda (Pb)', 'Mercúrio (Hg)', 'Cádmio (Cd)', 'Retardantes bromados'],
    alertaManuseio:
      'Equipamento de médio/grande porte. Direcione ao Ponto Leroy Merlin (Cruz das Almas), Ferreira Costa (Tabuleiro) ou Ecoponto ALURB (Pajuçara).',
  },
];

export const CHECKLIST_LGPD = [
  {
    id: 'lgpd-1',
    titulo: '1. Faça backup externo e desvincule contas em nuvem',
    detalhe:
      'Remova a conta Google (FRP) ou Apple ID (Buscar Meu iPhone) antes de formatar. Sem isso, o aparelho fica bloqueado para reaproveitamento de peças.',
    norma: 'Art. 16 da LGPD (Lei 13.709/2018) — Término do tratamento',
  },
  {
    id: 'lgpd-2',
    titulo: '2. Retire cartões físicos (SIM Card e MicroSD)',
    detalhe:
      'Chips de operadora e cartões de memória guardam contatos, fotos e tokens de autenticação em texto plano mesmo após formatar o aparelho.',
    norma: 'ABNT NBR ISO/IEC 27002 — Descarte seguro de mídias',
  },
  {
    id: 'lgpd-3',
    titulo: '3. Ative a criptografia de disco antes do Factory Reset',
    detalhe:
      'Em aparelhos antigos (Android < 10 ou HDs de notebook), criptografe o armazenamento antes de restaurar o padrão de fábrica para impedir recuperação forense de blocos.',
    norma: 'Prevenção de Incidente de Segurança perante a ANPD',
  },
  {
    id: 'lgpd-4',
    titulo: '4. Execute a Restauração de Fábrica (Hard Reset)',
    detalhe:
      'Em Configurações > Sistema > Opções de Redefinição > Apagar todos os dados (incluindo eSIM, se houver).',
    norma: 'Mitigação de risco de vazamento físico de credenciais bancárias',
  },
];

export const EQUIPE_PROJETO = {
  tema: 'Prevenção de Vulnerabilidades Sociais e Ambientais — Logística Reversa',
  lideranca: 'Fabiano Felipe de França (Ciência da Computação)',
  cursos: [
    {
      curso: 'Ciência da Computação (13 integrantes)',
      papel: 'Engenharia de Software (Web App + API), UI/UX Design, Prototipagem e QA',
      alunos: [
        'Lucas Gabriel Correia Gomes',
        'Fabiano Felipe de França',
        'Humberto Henrique Torres de Castro Azevedo',
        'José Nogueira Lima Neto',
        'João Marcelo',
        'Vinícius de Souza Silva Carnaúba',
        'Marcelo Ramalho Carnaúba',
        'Matteus Oliveira',
        'Bruno Duarte Batista',
        'Kauê Anderson Arry Pereira de Andrade',
        'Luis Arthur Alves Cordeiro',
        'Antônio de Freitas Melo',
        'Sérvio Túllio Marinho Machado',
      ],
    },
    {
      curso: 'Direito (2 integrantes)',
      papel: 'Enquadramento Legal (PNRS Lei 12.305/2010, Decreto 10.240/2020, LGPD) e Termos Institucionais',
      alunos: ['Beatriz dos Santos Sales', 'Ariel Matheus de Andrade'],
    },
    {
      curso: 'Ciências Contábeis (1 integrante)',
      papel: 'Orçamento de Custos (Matriz 5W2H), Viabilidade Econômica e Métricas de Mineração Urbana',
      alunos: ['Júlio César dos Santos Silva'],
    },
    {
      curso: 'Administração (1 integrante)',
      papel: 'Gestão Operacional, Cronograma Logístico e Indicadores de Impacto Sustentável (ODS)',
      alunos: ['Mayara Oliveira'],
    },
  ],
};

