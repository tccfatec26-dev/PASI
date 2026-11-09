/**
 * Identificadores fixos das tabelas de domínio (carga inicial do DDL).
 * A ordem dos INSERTs no DDL define esses ids (IDENTITY começa em 1).
 */
export const TipoUsuario = {
  /** Profissional com privilégio intermediário (restrito às suas unidades). */
  INTERMEDIARIO: 1,
  /** Paciente (privilégio mínimo, usa o app). */
  PACIENTE: 2,
  /** Profissional com privilégio máximo (gestão de usuários, todas as unidades). */
  MAXIMO: 3,
} as const;

/** Tipos de usuário que entram no painel web (profissionais). */
export const TIPOS_PROFISSIONAL: number[] = [TipoUsuario.INTERMEDIARIO, TipoUsuario.MAXIMO];

export function ehProfissional(tipo: number): boolean {
  return TIPOS_PROFISSIONAL.includes(tipo);
}

/** situacao_usuario (RN-USR-06): só avança nesta ordem. */
export const SituacaoUsuario = {
  PENDENCIA_I: 1,
  PENDENCIA_II: 2,
  DEFERIDO: 3,
} as const;

/** Validade da senha provisória (RN-USR-07). */
export const SENHA_PROVISORIA_HORAS = 24;

/** Validade do link de redefinição de senha ("Esqueci a senha"). */
export const LINK_REDEFINICAO_HORAS = 1;

/** Nome do módulo de log da gestão de usuários (tabela modulo). */
export const MODULO_GESTAO_USUARIOS = 'Gestão de usuários';

/** Ações registradas no log da gestão (tabela acao, RN-USR-18). */
export const AcaoGestao = {
  CADASTRAR: 'Cadastrar usuário',
  REENVIAR_SENHA: 'Reenviar senha provisória',
  CORRIGIR_EMAIL: 'Corrigir e-mail',
  INATIVAR: 'Inativar usuário',
  REATIVAR: 'Reativar usuário',
  PROMOVER: 'Promover a máximo',
  VINCULAR_UNIDADE: 'Vincular unidade',
  DESVINCULAR_UNIDADE: 'Desvincular unidade',
  TROCAR_SEDE: 'Trocar sede',
} as const;

/** situacao_atendimento (ordem da carga inicial do DDL). */
export const SituacaoAtendimento = {
  CRIADO: 1,
  INICIADO: 2,
  RESPONDIDO: 3,
  EM_AVALIACAO: 4,
  AVALIADO: 5,
  ENCERRADO: 6,
  INATIVO: 7,
} as const;

/** situacao_formulario (ordem da carga inicial do DDL). */
export const SituacaoFormulario = {
  RASCUNHO: 1,
  RESPONDIDO: 2,
  EM_AVALIACAO: 3,
  AVALIADO: 4,
} as const;

/** tipo_pergunta (ordem da carga inicial do DDL). */
export const TipoPergunta = {
  TEXTO: 1,
  NUMERO: 2,
  BOOLEANO: 3,
  ESCOLHA_UNICA: 4,
  ESCOLHA_MULTIPLA: 5,
} as const;

/** Tipos de pergunta que exigem opções cadastradas. */
export const TIPOS_COM_OPCOES: number[] = [
  TipoPergunta.ESCOLHA_UNICA,
  TipoPergunta.ESCOLHA_MULTIPLA,
];


/** Regex de senha: mín. 8 caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 especial. */
export const SENHA_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const SENHA_MENSAGEM =
  'A senha deve ter no mínimo 8 caracteres, incluindo ao menos 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial.';
