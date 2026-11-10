import { api } from './client';
import type { Profissao, Usuario, VinculoUnidade } from './types';

export interface Permissoes {
  somente_leitura: boolean;
  reenviar_senha: boolean;
  corrigir_email: boolean;
  promover: boolean;
  inativar: boolean;
  reativar: boolean;
  gerir_unidades: boolean;
}

export interface UsuarioLista {
  id_usuario: number;
  nome: string;
  email: string;
  cpf: string;
  id_tipo_usuario: number;
  perfil: string;
  profissao: Profissao | null;
  id_situacao_usuario: number;
  situacao: string;
  ativo: boolean;
  inativado_em: string | null;
  senha_provisoria_expira_em: string | null;
  dt_cadastro: string | null;
  eu: boolean;
  permissoes: Permissoes;
}

export interface ListaUsuarios {
  data: UsuarioLista[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  contagem: { todos: number; pendencia_i: number; pendencia_ii: number; deferido: number };
}

export interface FiltrosUsuarios {
  perfil?: 'intermediario' | 'maximo' | 'paciente';
  situacao?: number;
  acesso?: 'ativos' | 'inativos';
  id_profissao?: number;
  search?: string;
  ordenar?: 'nome' | 'recentes' | 'antigos';
  page?: number;
  limit?: number;
}

export interface Historico {
  id: number;
  data: string;
  acao: string;
  detalhe: string | null;
  por: { id_usuario: number; nome: string } | null;
}

export interface UsuarioDetalhe extends Usuario {
  perfil: string;
  situacao: string;
  inativado_em: string | null;
  cadastrado_por: { id_usuario: number; nome: string } | null;
  eu: boolean;
  unidades: VinculoUnidade[];
  historico: Historico[];
  permissoes: Permissoes;
}

export interface EnvioSenha {
  email_enviado: boolean;
  senha_provisoria_expira_em: string;
}

export async function listar(filtros: FiltrosUsuarios) {
  const { data } = await api.get<ListaUsuarios>('/gestao/usuarios', { params: filtros });
  return data;
}

/** Cadastros em Pendência I ou II (número no menu "Usuários"). */
export async function contarPendentes() {
  const r = await listar({ limit: 1 });
  return r.contagem.pendencia_i + r.contagem.pendencia_ii;
}

export async function detalhar(id: number) {
  const { data } = await api.get<UsuarioDetalhe>(`/gestao/usuarios/${id}`);
  return data;
}

export interface NovoProfissional {
  nome: string;
  cpf: string;
  email: string;
  tel_celular: string;
  sexo: string;
  id_profissao: number;
  id_genero?: number;
  perfil: 'intermediario' | 'maximo';
  unidades: { id_unidade_atendimento: number; sede: boolean }[];
}

export async function cadastrarProfissional(dados: NovoProfissional) {
  const { data } = await api.post<{ usuario: UsuarioDetalhe } & EnvioSenha>('/gestao/usuarios/profissionais', dados);
  return data;
}

export async function reenviarSenha(id: number) {
  const { data } = await api.post<EnvioSenha>(`/gestao/usuarios/${id}/reenviar-senha`);
  return data;
}

export async function corrigirEmail(id: number, email: string) {
  const { data } = await api.patch<EnvioSenha>(`/gestao/usuarios/${id}/email`, { email });
  return data;
}

export async function inativar(id: number) {
  const { data } = await api.post<UsuarioDetalhe>(`/gestao/usuarios/${id}/inativar`);
  return data;
}

export async function reativar(id: number) {
  const { data } = await api.post<UsuarioDetalhe>(`/gestao/usuarios/${id}/reativar`);
  return data;
}

export async function promover(id: number) {
  const { data } = await api.post<UsuarioDetalhe>(`/gestao/usuarios/${id}/promover`);
  return data;
}

export async function vincularUnidade(id: number, id_unidade_atendimento: number, sede = false) {
  const { data } = await api.post<VinculoUnidade[]>(`/gestao/usuarios/${id}/unidades`, { id_unidade_atendimento, sede });
  return data;
}

export async function desvincularUnidade(id: number, idUnidade: number) {
  const { data } = await api.delete<VinculoUnidade[]>(`/gestao/usuarios/${id}/unidades/${idUnidade}`);
  return data;
}

export async function trocarSede(id: number, idUnidade: number) {
  const { data } = await api.patch<VinculoUnidade[]>(`/gestao/usuarios/${id}/unidades/${idUnidade}/sede`);
  return data;
}
