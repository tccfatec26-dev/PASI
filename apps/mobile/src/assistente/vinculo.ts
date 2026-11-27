/**
 * Vínculo da conversa com a unidade de atendimento.
 *
 * O serviço indicado (CRAS, CREAS ou CAPS) vem de um critério válido:
 *  - "formulario": a dúvida é sobre um atendimento do paciente: vale a unidade desse atendimento;
 *  - "botao":      a pessoa escolheu o serviço nos botões de triagem;
 *  - "ia":         o PASIBot registrou o serviço com a ferramenta indicar_servico;
 *  - "busca":      a pessoa pediu unidades daquele serviço (o PASIBot chamou a busca);
 *  - "palavras":   triagem local por palavras, só quando a IA está fora do ar. Não basta para
 *                  vincular: a pessoa precisa confirmar.
 *
 * A unidade sai SÓ das unidades em que o paciente já é atendido (unidade_atendimento dos
 * atendimentos dele, com o tipo vindo de tipo_unidade_atendimento pela rota /apoio/unidades).
 * Nada é criado nem gravado no banco: o vínculo vale para a conversa e é enviado ao PASIBot como
 * contexto. Sem unidade daquele tipo, não há vínculo: a assistente oferece a busca por CEP.
 *
 * Módulo sem dependências, testado em tests/vinculo.test.ts.
 */

export type Servico = 'CRAS' | 'CREAS' | 'CAPS';
export type OrigemServico = 'formulario' | 'botao' | 'ia' | 'busca' | 'palavras';

export interface UnidadeDoUsuario {
  id: number;
  nome: string;
  /** null quando o tipo cadastrado não é CRAS, CREAS nem CAPS: essa unidade nunca é escolhida por tipo. */
  tipo: Servico | null;
  cidade: string | null;
  estado: string | null;
  /** Atendimentos do paciente nesta unidade. */
  atendimentos: number[];
}

export interface Vinculo {
  unidade: UnidadeDoUsuario;
  servico: Servico | null;
  origem: OrigemServico | 'escolha';
  /** Atendimento que originou o vínculo (dúvida sobre formulário). */
  idAtendimento?: number;
}

export type Resolucao =
  | { status: 'vinculada'; vinculo: Vinculo }
  | { status: 'escolher'; servico: Servico; opcoes: UnidadeDoUsuario[]; origem: OrigemServico }
  | { status: 'confirmar'; servico: Servico }
  | { status: 'sem-unidade'; servico: Servico }
  | { status: 'indefinido' };

/**
 * Tipo da unidade pelo nome cadastrado em tipo_unidade_atendimento: aceita a sigla ("CREAS") ou o
 * nome por extenso ("Centro de Referência Especializado de Assistência Social"). Confere CREAS
 * antes de CRAS. Nome que não bate com nenhum -> null (a unidade não é escolhida por tipo).
 */
export function tipoDaUnidade(nomeDoTipo: string | null | undefined): Servico | null {
  const n = (nomeDoTipo ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  if (/\bCREAS\b/.test(n) || n.includes('REFERENCIA ESPECIALIZADO')) return 'CREAS';
  if (/\bCRAS\b/.test(n) || n.includes('REFERENCIA DE ASSISTENCIA SOCIAL')) return 'CRAS';
  if (/\bCAPS/.test(n) || n.includes('ATENCAO PSICOSSOCIAL')) return 'CAPS'; // CAPS, CAPS AD, CAPSi...
  return null;
}

interface AtendimentoComUnidade {
  id_atendimento: number;
  id_situacao_atendimento: number;
  unidade_atendimento?: { id_unidade_atendimento: number; nome: string } | null;
}

interface UnidadeApoio {
  id_unidade_atendimento: number;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
  tipo_unidade_atendimento?: { nome: string | null } | null;
}

/**
 * Unidades em que o paciente é atendido, com o tipo.
 * `situacoesIgnoradas`: atendimentos que não contam (ex.: inativos).
 */
export function unidadesDoUsuario(
  atendimentos: AtendimentoComUnidade[],
  unidades: UnidadeApoio[],
  situacoesIgnoradas: number[] = [],
): UnidadeDoUsuario[] {
  const porId = new Map(unidades.map((u) => [u.id_unidade_atendimento, u]));
  const resultado = new Map<number, UnidadeDoUsuario>();
  for (const a of atendimentos) {
    const u = a.unidade_atendimento;
    if (!u || situacoesIgnoradas.includes(a.id_situacao_atendimento)) continue;
    const existente = resultado.get(u.id_unidade_atendimento);
    if (existente) {
      existente.atendimentos.push(a.id_atendimento);
      continue;
    }
    const cadastro = porId.get(u.id_unidade_atendimento);
    resultado.set(u.id_unidade_atendimento, {
      id: u.id_unidade_atendimento,
      nome: u.nome,
      tipo: tipoDaUnidade(cadastro?.tipo_unidade_atendimento?.nome),
      cidade: cadastro?.cidade ?? null,
      estado: cadastro?.estado ?? null,
      atendimentos: [a.id_atendimento],
    });
  }
  return [...resultado.values()];
}

/** Vínculo pela dúvida sobre um atendimento: a unidade dele, sem depender do serviço. */
export function vinculoDoAtendimento(idAtendimento: number, unidades: UnidadeDoUsuario[]): Resolucao {
  const unidade = unidades.find((u) => u.atendimentos.includes(idAtendimento));
  if (!unidade) return { status: 'indefinido' };
  return {
    status: 'vinculada',
    vinculo: { unidade, servico: unidade.tipo, origem: 'formulario', idAtendimento },
  };
}

/** Do serviço indicado para a unidade do paciente. */
export function resolverVinculo(
  servico: Servico | null,
  origem: OrigemServico,
  unidades: UnidadeDoUsuario[],
): Resolucao {
  if (!servico) return { status: 'indefinido' };
  // a triagem por palavras é só um palpite: a pessoa confirma antes
  if (origem === 'palavras') return { status: 'confirmar', servico };
  const doTipo = unidades.filter((u) => u.tipo === servico);
  if (doTipo.length === 0) return { status: 'sem-unidade', servico };
  if (doTipo.length > 1) return { status: 'escolher', servico, opcoes: doTipo, origem };
  return { status: 'vinculada', vinculo: { unidade: doTipo[0], servico, origem } };
}

/** Vínculo pela escolha explícita da pessoa entre as unidades dela. */
export function vinculoEscolhido(idUnidade: number, unidades: UnidadeDoUsuario[], servico: Servico | null): Resolucao {
  const unidade = unidades.find((u) => u.id === idUnidade);
  if (!unidade) return { status: 'indefinido' };
  return { status: 'vinculada', vinculo: { unidade, servico: servico ?? unidade.tipo, origem: 'escolha' } };
}

/** Texto enviado ao PASIBot antes da pergunta, no mesmo formato "(Contexto: ...)" já usado pelo app. */
export function contextoParaIa(v: Vinculo): string {
  const onde = [v.unidade.cidade, v.unidade.estado].filter(Boolean).join('/');
  const tipo = v.unidade.tipo ? ` (${v.unidade.tipo})` : '';
  return `(Contexto do atendimento: a pessoa já é atendida na unidade ${v.unidade.nome}${tipo}${onde ? `, ${onde}` : ''}.)`;
}

/** Chave que muda quando o vínculo muda: para mandar o contexto à IA só uma vez por vínculo. */
export function chaveDoVinculo(v: Vinculo | null) {
  return v ? `${v.unidade.id}:${v.servico ?? ''}` : '';
}
