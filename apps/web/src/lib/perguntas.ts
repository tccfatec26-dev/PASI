/** Tipos de pergunta da API (tipo_pergunta) com os nomes usados no painel. */
export const TipoPergunta = { TEXTO: 1, NUMERO: 2, BOOLEANO: 3, ESCOLHA_UNICA: 4, ESCOLHA_MULTIPLA: 5 } as const;

export const TIPOS_PERGUNTA = [
  { id: TipoPergunta.TEXTO, nome: 'Texto longo', desc: 'Resposta em várias linhas' },
  { id: TipoPergunta.NUMERO, nome: 'Número', desc: 'Inteiro, decimal ou escala (ex.: de 0 a 10)' },
  { id: TipoPergunta.BOOLEANO, nome: 'Sim / Não', desc: 'Resposta binária' },
  { id: TipoPergunta.ESCOLHA_MULTIPLA, nome: 'Múltipla escolha', desc: 'Uma ou mais opções' },
  { id: TipoPergunta.ESCOLHA_UNICA, nome: 'Seleção única', desc: 'Exatamente uma opção' },
];

export function nomeTipoPergunta(id: number, valorMin?: number | null, valorMax?: number | null) {
  if (id === TipoPergunta.NUMERO && valorMin != null && valorMax != null) return 'Escala numérica';
  return TIPOS_PERGUNTA.find((t) => t.id === id)?.nome ?? 'Pergunta';
}

export const temOpcoes = (id: number) => id === TipoPergunta.ESCOLHA_UNICA || id === TipoPergunta.ESCOLHA_MULTIPLA;
