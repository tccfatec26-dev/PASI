import { api } from './client';
import type { Paginado } from './types';

export interface TipoFormulario {
  id_tipo_formulario: number;
  nome: string;
}

export interface Opcao {
  id_opcao: number;
  id_pergunta: number;
  texto_opcao: string;
  valor_opcao: number | null;
}

export interface Pergunta {
  id_pergunta: number;
  id_tipo_pergunta: number;
  pergunta: string;
  valor_minimo: number | null;
  valor_maximo: number | null;
  obrigatoria: boolean | null;
  tipo_pergunta?: { id_tipo_pergunta: number; nome: string };
  opcao_pergunta: Opcao[];
  _count?: { resposta: number };
}

export interface Formulario {
  id_formulario: number;
  id_tipo_formulario: number;
  nome: string | null;
  descricao: string | null;
  ativo: boolean | null;
  dt_cadastro: string | null;
  tipo_formulario: TipoFormulario;
  _count?: { pergunta: number; formulario_paciente: number };
}

export interface FormularioDetalhe extends Formulario {
  pergunta: Pergunta[];
}

export type OrdemFormulario = 'data_desc' | 'data_asc' | 'nome' | 'mais_respondidos';

export interface FiltrosFormulario {
  page?: number;
  limit?: number;
  search?: string;
  id_tipo_formulario?: number;
  ativo?: boolean;
  ordenar_por?: OrdemFormulario;
}

export async function listar(f: FiltrosFormulario) {
  const { data } = await api.get<Paginado<Formulario>>('/formularios', {
    params: { ...f, search: f.search?.trim() || undefined },
  });
  return data;
}

export async function obter(id: number) {
  const { data } = await api.get<FormularioDetalhe>(`/formularios/${id}`);
  return data;
}

export interface NovaOpcao {
  texto_opcao: string;
  valor_opcao?: number;
}

export interface NovaPergunta {
  pergunta: string;
  id_tipo_pergunta: number;
  obrigatoria?: boolean;
  valor_minimo?: number;
  valor_maximo?: number;
  opcoes?: NovaOpcao[];
}

export async function criar(dados: { id_tipo_formulario: number; nome?: string; descricao?: string; perguntas?: NovaPergunta[] }) {
  const { data } = await api.post<FormularioDetalhe>('/formularios', dados);
  return data;
}

export async function alterar(id: number, dados: { id_tipo_formulario?: number; nome?: string; descricao?: string }) {
  const { data } = await api.patch<FormularioDetalhe>(`/formularios/${id}`, dados);
  return data;
}

export async function desativar(id: number) {
  const { data } = await api.patch<FormularioDetalhe>(`/formularios/${id}/desativar`);
  return data;
}

export async function reativar(id: number) {
  const { data } = await api.patch<FormularioDetalhe>(`/formularios/${id}/reativar`);
  return data;
}

export async function adicionarPergunta(id: number, p: NovaPergunta) {
  const { data } = await api.post(`/formularios/${id}/perguntas`, p);
  return data;
}

export async function alterarPergunta(id: number, idPergunta: number, p: Partial<NovaPergunta>) {
  const { data } = await api.patch(`/formularios/${id}/perguntas/${idPergunta}`, p);
  return data;
}

export async function removerPergunta(id: number, idPergunta: number) {
  const { data } = await api.delete(`/formularios/${id}/perguntas/${idPergunta}`);
  return data;
}
