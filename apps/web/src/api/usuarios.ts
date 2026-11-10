import { api } from './client';
import type { PacienteResumo, Usuario, VinculoUnidade } from './types';

export async function me() {
  const { data } = await api.get<Usuario>('/usuarios/me');
  return data;
}

export interface DadosPessoais {
  nome?: string;
  email?: string;
  tel_celular?: string;
  sexo?: string;
  id_genero?: number;
  id_profissao?: number;
}

export async function atualizarMe(dados: DadosPessoais) {
  const { data } = await api.patch<Usuario>('/usuarios/me', dados);
  return data;
}

export async function confirmarDados() {
  const { data } = await api.post<Usuario>('/usuarios/me/confirmar-dados');
  return data;
}

export async function trocarSenha(senha_atual: string, nova_senha: string) {
  const { data } = await api.patch<{ message: string }>('/usuarios/me/senha', { senha_atual, nova_senha });
  return data;
}

export async function vincularPropria(id_unidade_atendimento: number, sede = false) {
  const { data } = await api.post<VinculoUnidade[]>('/usuarios/me/unidades', { id_unidade_atendimento, sede });
  return data;
}

export async function desvincularPropria(idUnidade: number) {
  const { data } = await api.delete<VinculoUnidade[]>(`/usuarios/me/unidades/${idUnidade}`);
  return data;
}

export async function trocarSedePropria(idUnidade: number) {
  const { data } = await api.patch<VinculoUnidade[]>(`/usuarios/me/unidades/${idUnidade}/sede`);
  return data;
}

export async function buscarPacientes(search: string) {
  const { data } = await api.get<PacienteResumo[]>('/usuarios/pacientes', { params: { search } });
  return data;
}
