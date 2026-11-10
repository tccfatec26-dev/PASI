import { api } from './client';
import type { Atendimento, Paginado } from './types';

export type OrdemAtendimento = 'data_desc' | 'data_asc' | 'paciente' | 'situacao';

export interface FiltrosAtendimento {
  page?: number;
  limit?: number;
  search?: string;
  situacoes?: number[];
  unidades?: number[];
  data_inicio?: string;
  data_fim?: string;
  ordenar_por?: OrdemAtendimento;
}

export async function listar(f: FiltrosAtendimento) {
  const params: Record<string, unknown> = {
    page: f.page,
    limit: f.limit,
    search: f.search?.trim() || undefined,
    situacoes: f.situacoes?.length ? f.situacoes.join(',') : undefined,
    unidades: f.unidades?.length ? f.unidades.join(',') : undefined,
    data_inicio: f.data_inicio || undefined,
    data_fim: f.data_fim || undefined,
    ordenar_por: f.ordenar_por,
  };
  const { data } = await api.get<Paginado<Atendimento>>('/atendimentos', { params });
  return data;
}

export async function obter(id: number) {
  const { data } = await api.get<Atendimento>(`/atendimentos/${id}`);
  return data;
}

export interface NovoAtendimento {
  id_usuario_paciente: number;
  id_unidade_atendimento: number;
  formularios: number[];
  descricao?: string;
}

export async function criar(dados: NovoAtendimento) {
  const { data } = await api.post<Atendimento>('/atendimentos', dados);
  return data;
}

export async function alterar(id: number, dados: { descricao?: string; id_unidade_atendimento?: number }) {
  const { data } = await api.patch<Atendimento>(`/atendimentos/${id}`, dados);
  return data;
}

export async function adicionarFormularios(id: number, formularios: number[]) {
  const { data } = await api.post<Atendimento>(`/atendimentos/${id}/formularios`, { formularios });
  return data;
}

export async function removerFormulario(id: number, idFormulario: number) {
  const { data } = await api.delete<Atendimento>(`/atendimentos/${id}/formularios/${idFormulario}`);
  return data;
}

export async function encerrar(id: number) {
  const { data } = await api.patch<Atendimento>(`/atendimentos/${id}/encerrar`);
  return data;
}

export async function inativar(id: number) {
  const { data } = await api.patch<Atendimento>(`/atendimentos/${id}/inativar`);
  return data;
}
