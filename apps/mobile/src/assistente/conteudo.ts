/**
 * Conteúdo fixo do assistente virtual: as dúvidas sobre o app, com respostas
 * revisadas, e a triagem por palavras do texto livre.
 *
 * Fica no app para responder na hora, mesmo sem internet boa ou com a API do
 * PASIBot dormindo. O que não casar com nada aqui vai para o PASIBot
 * (services/assistente.ts).
 */

export type IdTopico = 'responder' | 'situacoes' | 'rascunho' | 'acessibilidade' | 'notificacoes' | 'perfil';

export interface Topico {
  id: IdTopico;
  /** Texto do botão de sugestão (é também a "pergunta" que aparece no chat). */
  pergunta: string;
  /** Ícone do MaterialIcons. */
  icone: 'edit' | 'info-outline' | 'save' | 'accessibility-new' | 'notifications-none' | 'person-outline';
  /** Frase antes dos passos. */
  introducao: string;
  passos?: string[];
  /** Frase depois dos passos. */
  observacao?: string;
  /** Palavras (sem acento, minúsculas) que levam a este tópico no texto livre. */
  palavras: string[];
}

export const TOPICOS: Topico[] = [
  {
    id: 'responder',
    pergunta: 'Como respondo um formulário?',
    icone: 'edit',
    introducao: 'São 4 passos:',
    passos: [
      'Em Meus Atendimentos, toque no botão verde "Responder formulários".',
      'Escolha um formulário com a situação "Pendente".',
      'Responda as perguntas. Se tocar em "Voltar", suas respostas ficam salvas como rascunho.',
      'Toque em "Enviar". Depois de enviado, o formulário não pode mais ser alterado.',
    ],
    palavras: ['responder', 'responde', 'preencher', 'formulario', 'pergunta', 'enviar', 'questionario'],
  },
  {
    id: 'situacoes',
    pergunta: 'O que significa cada situação?',
    icone: 'info-outline',
    introducao: 'Cada atendimento passa por estas situações:',
    passos: [
      'Criado: o profissional criou o atendimento e ele espera você começar os formulários.',
      'Iniciado: você começou a responder pelo menos um formulário.',
      'Respondido: você enviou todos os formulários.',
      'Em avaliação: o profissional está analisando as suas respostas.',
      'Avaliado: o profissional terminou de avaliar todos os formulários.',
      'Encerrado: o atendimento foi concluído pelo profissional.',
    ],
    observacao: 'Na lista, você também pode tocar na etiqueta colorida para ver essa explicação.',
    palavras: [
      'situacao',
      'status',
      'significa',
      'criado',
      'iniciado',
      'respondido',
      'avaliacao',
      'avaliado',
      'encerrado',
      'etiqueta',
    ],
  },
  {
    id: 'rascunho',
    pergunta: 'Posso parar e continuar depois?',
    icone: 'save',
    introducao:
      'Pode, sim. Ao tocar em "Voltar" dentro de um formulário, suas respostas ficam salvas como rascunho. ' +
      'Quando você abrir o formulário de novo, elas estarão lá.',
    observacao: 'Só depois de tocar em "Enviar" é que o formulário não pode mais ser mudado.',
    palavras: ['parar', 'continuar', 'depois', 'rascunho', 'salvar', 'salva', 'perder', 'perdi'],
  },
  {
    id: 'acessibilidade',
    pergunta: 'Aumentar a letra ou ouvir a tela',
    icone: 'accessibility-new',
    introducao: 'Toque no botão de acessibilidade, o bonequinho no canto do cabeçalho. Lá você pode:',
    passos: [
      'Aumentar o tamanho do texto (Normal, Maior ou Muito maior).',
      'Ligar a leitura em voz alta: o app lê o que você tocar.',
      'Escolher o tema claro ou escuro, alto contraste ou preto e branco.',
      'Reduzir o movimento das telas.',
    ],
    palavras: [
      'letra',
      'texto',
      'fonte',
      'aumentar',
      'ouvir',
      'voz',
      'ler',
      'leitura',
      'acessibilidade',
      'contraste',
      'escuro',
      'enxergo',
      'enxergar',
    ],
  },
  {
    id: 'notificacoes',
    pergunta: 'Onde vejo meus avisos?',
    icone: 'notifications-none',
    introducao:
      'Toque no sino no alto da tela de Meus Atendimentos. O número vermelho mostra quantos avisos você ainda não leu.',
    observacao:
      'Você é avisado quando é incluído em um atendimento e quando recebe formulários novos, também pelo celular, mesmo com o app fechado.',
    palavras: ['aviso', 'notificacao', 'notificacoes', 'sino', 'alerta', 'mensagem nova'],
  },
  {
    id: 'perfil',
    pergunta: 'Como mudo meus dados?',
    icone: 'person-outline',
    introducao: 'Abra o menu (as três linhas no canto de cima) e toque em "Meu Perfil". Lá você pode:',
    passos: [
      'Trocar a foto.',
      'Atualizar nome, e-mail, telefone, data de nascimento, sexo, gênero e endereço.',
      'Tocar em "Salvar" para guardar.',
    ],
    observacao: 'O CPF não pode ser alterado. Se ele estiver errado, peça ajuda a um atendente.',
    palavras: ['perfil', 'dados', 'endereco', 'telefone', 'email', 'e-mail', 'foto', 'nome', 'cadastro', 'cpf'],
  },
];

export const TOPICOS_POR_ID = Object.fromEntries(TOPICOS.map((t) => [t.id, t])) as Record<IdTopico, Topico>;

export function normalizar(texto: string) {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const PALAVRAS_ATENDENTE = [
  'atendente',
  'humano',
  'falar com uma pessoa',
  'falar com alguem',
  'recepcao',
  'profissional',
  'assistente social',
  'psicolog',
];

const PALAVRAS_RISCO = ['suicid', 'me matar', 'tirar minha vida', 'nao quero mais viver', 'quero morrer'];

export const MENSAGEM_RISCO =
  'Sinto muito que você esteja passando por isso. Você não precisa enfrentar isso sozinho(a).\n\n' +
  'Se você corre risco agora, ligue 192 (SAMU) ou vá ao pronto-socorro mais próximo. ' +
  'Para conversar com alguém agora, ligue 188 (CVV), 24 horas e de graça.';

/** Situação de risco à vida: os telefones aparecem antes de qualquer outra resposta. */
export function indicaRisco(texto: string) {
  const t = normalizar(texto);
  return PALAVRAS_RISCO.some((p) => t.includes(p));
}

export function pedeAtendente(texto: string) {
  const t = normalizar(texto);
  return PALAVRAS_ATENDENTE.some((p) => t.includes(p));
}

/** Tópico do app que casa com o texto livre (o de mais palavras encontradas), ou null. */
export function topicoDoTexto(texto: string): Topico | null {
  const t = normalizar(texto);
  let melhor: Topico | null = null;
  let pontos = 0;
  for (const topico of TOPICOS) {
    const n = topico.palavras.filter((p) => t.includes(p)).length;
    if (n > pontos) {
      melhor = topico;
      pontos = n;
    }
  }
  return melhor;
}

/** Texto corrido de um tópico (para ouvir em voz alta e para o resumo enviado ao atendente). */
export function textoDoTopico(t: Topico) {
  return [t.introducao, ...(t.passos ?? []).map((p, i) => `${i + 1}. ${p}`), t.observacao ?? '']
    .filter(Boolean)
    .join(' ');
}
