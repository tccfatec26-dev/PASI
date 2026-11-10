import { api } from './client';
import type { Opcao, Pergunta } from './formularios';

export interface Resposta {
  id_resposta: number;
  id_pergunta: number;
  valor_texto: string | null;
  valor_numero: string | number | null;
  valor_binario: boolean | null;
  valor_data: string | null;
  dt_resposta: string;
}

export interface DetalheRespostas {
  atendimento: { id_atendimento: number; id_situacao_atendimento: number };
  formulario_paciente: { id_formulario_paciente: number; id_situacao_formulario: number } | null;
  formulario: {
    id_formulario: number;
    nome: string | null;
    descricao: string | null;
    tipo_formulario?: { nome: string };
    pergunta: Pergunta[];
  };
  respostas: Resposta[];
}

export interface Avaliacao {
  id_formulario_avaliacao: number;
  dt_avaliacao: string;
  observacao: string;
  usuario: { id_usuario: number; nome: string } | null;
}

const base = (idAt: number, idF: number) => `/atendimentos/${idAt}/formularios/${idF}`;

export async function respostas(idAt: number, idF: number) {
  const { data } = await api.get<DetalheRespostas>(`${base(idAt, idF)}/respostas`);
  return data;
}

export async function avaliacoes(idAt: number, idF: number) {
  const { data } = await api.get<Avaliacao[]>(`${base(idAt, idF)}/avaliacoes`);
  return data;
}

export async function iniciarAvaliacao(idAt: number, idF: number) {
  const { data } = await api.post<Avaliacao[]>(`${base(idAt, idF)}/avaliacoes/iniciar`);
  return data;
}

export async function avaliar(idAt: number, idF: number, observacao: string) {
  const { data } = await api.post<Avaliacao[]>(`${base(idAt, idF)}/avaliacoes`, { observacao });
  return data;
}

export type { Opcao };
