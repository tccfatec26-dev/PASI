import api from '../config/api';

export interface Paciente {
  id_usuario: number;
  nome: string;
  cpf: string;
  email: string;
}

export interface FormularioResumo {
  id_formulario: number;
  nome?: string;
  descricao?: string;
}

export interface StatusFormularioPaciente {
  id_formulario: number;
  id_situacao_formulario: number;
  situacao_formulario: { nome: string } | null;
}

export interface AtendimentoFormulario {
  id_atendimento_formulario: number;
  id_formulario: number;
  dt_atribuicao?: string;
  formulario: FormularioResumo;
  status_formulario_paciente?: StatusFormularioPaciente | null;
}

export interface Atendimento {
  id_atendimento: number;
  descricao?: string;
  id_usuario_paciente: number;
  id_situacao_atendimento: number;
  dt_cadastro?: string;
  situacao_atendimento: { id_situacao_atendimento: number; nome: string };
  usuario_atendimento_id_usuario_pacienteTousuario: Paciente;
  atendimento_formulario: AtendimentoFormulario[];
  /** Unidade do atendimento (a API já devolve; usada pelo assistente para o vínculo). */
  unidade_atendimento?: { id_unidade_atendimento: number; nome: string } | null;
}

export interface ListaAtendimentos {
  data: Atendimento[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FiltrosAtendimento {
  page?: number;
  limit?: number;
  search?: string;
  /** IDs de situação separados por vírgula. */
  situacoes?: string;
  data_inicio?: string;
  data_fim?: string;
  ordenar_por?: 'data_desc' | 'data_asc' | 'paciente' | 'situacao';
}

export const atendimentosService = {
  listar: (params?: FiltrosAtendimento) =>
    api.get<ListaAtendimentos>('/atendimentos', { params }).then((r) => r.data),

  buscar: (id: number) => api.get<Atendimento>(`/atendimentos/${id}`).then((r) => r.data),
};
