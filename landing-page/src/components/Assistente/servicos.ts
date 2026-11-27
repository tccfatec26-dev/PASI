// Conteúdo fixo da assistente: os serviços, as opções rápidas e a triagem por palavras.
// Fica no front para que a triagem por botões responda na hora, mesmo com a API dormindo.

export type TipoServico = "CRAS" | "CREAS" | "CAPS";

export type Servico = {
  sigla: TipoServico;
  nome: string;
  descricao: string;
  atende: string[];
  alerta?: string;
  icone: string; // classe do Font Awesome
};

export const SERVICOS: Record<TipoServico, Servico> = {
  CRAS: {
    sigla: "CRAS",
    nome: "Centro de Referência de Assistência Social",
    descricao:
      "É a porta de entrada da assistência social. Atende famílias e pessoas em situação de vulnerabilidade social.",
    atende: [
      "Cadastro Único e Bolsa Família",
      "BPC e benefícios eventuais",
      "Acompanhamento da família (PAIF)",
      "Grupos e atividades de convivência",
    ],
    icone: "fa-house",
  },
  CREAS: {
    sigla: "CREAS",
    nome: "Centro de Referência Especializado de Assistência Social",
    descricao:
      "Atende pessoas e famílias que tiveram direitos violados e precisam de acompanhamento especializado.",
    atende: [
      "Violência física, psicológica ou sexual",
      "Negligência ou abandono de crianças, idosos ou pessoas com deficiência",
      "Trabalho infantil",
      "Pessoas em situação de rua",
    ],
    alerta:
      "Se você está em perigo agora, ligue 190 (Polícia Militar). Violência contra a mulher: 180. Para denunciar violação de direitos, ligue 100. As ligações são gratuitas.",
    icone: "fa-shield-halved",
  },
  CAPS: {
    sigla: "CAPS",
    nome: "Centro de Atenção Psicossocial · SUS",
    descricao: "Serviço do SUS para o cuidado em saúde mental.",
    atende: [
      "Sofrimento emocional intenso ou que não passa",
      "Uso de álcool e outras drogas (CAPS AD)",
      "Crianças e adolescentes (CAPSi)",
      "Acolhimento em momentos de crise",
    ],
    alerta:
      "Em risco imediato, ligue 192 (SAMU) ou vá ao pronto-socorro. Para conversar com alguém agora, o CVV atende 24 horas pelo 188, de graça.",
    icone: "fa-heart",
  },
};

export type Acao =
  | { tipo: "servico"; servico: TipoServico }
  | { tipo: "triagem" }
  | { tipo: "cep"; servico: TipoServico | null }
  | { tipo: "semCep" }
  | { tipo: "comoComecar" }
  | { tipo: "inicio" };

export type Opcao = { rotulo: string; acao: Acao };

export const OPCOES_INICIAIS: Opcao[] = [
  { rotulo: "Benefícios, renda ou Cadastro Único", acao: { tipo: "servico", servico: "CRAS" } },
  { rotulo: "Sofri ou vi uma situação de violência", acao: { tipo: "servico", servico: "CREAS" } },
  { rotulo: "Saúde mental, álcool ou drogas", acao: { tipo: "servico", servico: "CAPS" } },
  { rotulo: "Não sei qual procurar", acao: { tipo: "triagem" } },
  { rotulo: "Buscar unidade pelo CEP", acao: { tipo: "cep", servico: null } },
];

export const OPCOES_TRIAGEM: Opcao[] = [
  { rotulo: "Dificuldade para pagar contas ou ter comida em casa", acao: { tipo: "servico", servico: "CRAS" } },
  { rotulo: "Quero participar de grupos e atividades", acao: { tipo: "servico", servico: "CRAS" } },
  { rotulo: "Alguém está me machucando ou ameaçando", acao: { tipo: "servico", servico: "CREAS" } },
  { rotulo: "Idoso, criança ou pessoa com deficiência sem cuidado", acao: { tipo: "servico", servico: "CREAS" } },
  { rotulo: "Muita tristeza, ansiedade ou crises", acao: { tipo: "servico", servico: "CAPS" } },
  { rotulo: "Uso de álcool ou outras drogas", acao: { tipo: "servico", servico: "CAPS" } },
];

export function opcoesDepoisDoServico(servico: TipoServico): Opcao[] {
  return [
    { rotulo: `Encontrar o ${servico} mais próximo`, acao: { tipo: "cep", servico } },
    { rotulo: "Como começar a triagem", acao: { tipo: "comoComecar" } },
    { rotulo: "Tenho outra dúvida", acao: { tipo: "inicio" } },
  ];
}

export const MENSAGEM_RISCO =
  "Sinto muito que você esteja passando por isso. Você não precisa enfrentar isso sozinho(a).\n" +
  "Se você corre risco agora, ligue **192 (SAMU)** ou vá ao pronto-socorro mais próximo. " +
  "Para conversar com alguém agora, ligue **188 (CVV)**, 24 horas e de graça.";

function normalizar(texto: string) {
  return texto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const PALAVRAS_RISCO = ["suicid", "me matar", "tirar minha vida", "nao quero mais viver", "quero morrer"];

/** Situação de risco à vida: mostramos os telefones antes de qualquer outra resposta. */
export function indicaRisco(texto: string) {
  const t = normalizar(texto);
  return PALAVRAS_RISCO.some((p) => t.includes(p));
}

const PALAVRAS: Record<TipoServico, string[]> = {
  CREAS: ["violen", "agress", "apanh", "batendo", "abuso", "abusad", "assedi", "estupr", "explora", "abandon",
    "neglig", "trabalho infantil", "situacao de rua", "morando na rua", "ameac", "maus-trat", "maus trat"],
  CAPS: ["ansied", "depress", "saude mental", "psicolog", "psiquiatr", "crise", "panico", "surto", "alcool",
    "bebida", "droga", "crack", "cocaina", "maconha", "vicio", "dependen"],
  CRAS: ["bolsa familia", "cadastro unico", "cadunico", "cad unico", "beneficio", "bpc", "loas", "renda",
    "desempreg", "auxilio", "cesta basica", "fome", "tarifa social"],
};

/** Triagem simples por palavras, usada só quando a API não responde. */
export function classificar(texto: string): TipoServico | null {
  const t = normalizar(texto);
  for (const servico of ["CREAS", "CAPS", "CRAS"] as TipoServico[]) {
    if (PALAVRAS[servico].some((p) => t.includes(p))) return servico;
  }
  return null;
}

/** "09370000" -> "09370-000" (aceita digitação parcial). */
export function formatarCep(valor: string) {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

export function linkDoMapa(servico: TipoServico | null, cep: string) {
  const busca = `${servico ?? "CRAS CAPS CREAS"} perto de ${cep}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busca)}`;
}
