// Formatos que a API devolve (apenas os campos usados pelo painel).

export const TipoUsuario = { INTERMEDIARIO: 1, PACIENTE: 2, MAXIMO: 3 } as const;
export const SituacaoUsuario = { PENDENCIA_I: 1, PENDENCIA_II: 2, DEFERIDO: 3 } as const;
export const SituacaoAtendimento = {
  CRIADO: 1,
  INICIADO: 2,
  RESPONDIDO: 3,
  EM_AVALIACAO: 4,
  AVALIADO: 5,
  ENCERRADO: 6,
  INATIVO: 7,
} as const;
export const SituacaoFormulario = { RASCUNHO: 1, RESPONDIDO: 2, EM_AVALIACAO: 3, AVALIADO: 4 } as const;

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface TipoUnidade {
  id_tipo_unidade_atend: number;
  nome: string;
}

export interface Unidade {
  id_unidade_atendimento: number;
  nome: string;
  cidade?: string | null;
  estado?: string | null;
  tipo_unidade_atendimento?: TipoUnidade | null;
}

export interface VinculoUnidade {
  id_usuario_unidade: number;
  id_usuario: number;
  id_unidade_atendimento: number;
  sede: boolean;
  dt_vinculo?: string | null;
  unidade_atendimento: Unidade;
  usuario_vinculo?: { id_usuario: number; nome: string } | null;
}

export interface Profissao {
  id_profissao: number;
  nome: string;
}

export interface Genero {
  id_genero: number;
  nome: string;
}

export interface Usuario {
  id_usuario: number;
  id_tipo_usuario: number;
  id_situacao_usuario: number;
  ativo: boolean;
  nome: string;
  cpf: string;
  email: string;
  tel_celular: string;
  sexo: string;
  id_genero?: number | null;
  id_profissao?: number | null;
  senha_provisoria_expira_em?: string | null;
  dt_cadastro?: string | null;
  tipo_usuario?: { id_tipo_usuario: number; nome: string; descricao?: string | null };
  situacao_usuario?: { id_situacao_usuario: number; nome: string };
  profissao?: Profissao | null;
  genero?: Genero | null;
  unidades?: VinculoUnidade[];
}

export interface PacienteResumo {
  id_usuario: number;
  nome: string;
  cpf: string;
  email: string;
}

export interface FormularioResumo {
  id_formulario: number;
  nome: string;
  descricao?: string | null;
}

export interface StatusFormularioPaciente {
  id_formulario: number;
  id_situacao_formulario: number;
  situacao_formulario: { nome: string } | null;
  formulario_avaliacao?: { dt_avaliacao: string; usuario: { id_usuario: number; nome: string } | null }[];
}

export interface AtendimentoFormulario {
  id_atendimento_formulario: number;
  id_atendimento: number;
  id_formulario: number;
  dt_atribuicao?: string | null;
  formulario: FormularioResumo;
  status_formulario_paciente: StatusFormularioPaciente | null;
}

export interface Atendimento {
  id_atendimento: number;
  descricao: string | null;
  id_usuario_paciente: number;
  id_situacao_atendimento: number;
  id_unidade_atendimento: number | null;
  dt_cadastro: string | null;
  situacao_atendimento: { id_situacao_atendimento: number; nome: string };
  unidade_atendimento: { id_unidade_atendimento: number; nome: string } | null;
  usuario_atendimento_id_usuario_pacienteTousuario: PacienteResumo;
  usuario_atendimento_id_usuario_cadTousuario?: { id_usuario: number; nome: string } | null;
  atendimento_formulario: AtendimentoFormulario[];
}
