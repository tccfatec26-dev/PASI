import { api } from './client';
import type { Usuario } from './types';

export async function login(login: string, senha: string) {
  const { data } = await api.post<{ access_token: string; usuario: Usuario }>('/auth/login', {
    login,
    senha,
    canal: 'web',
  });
  return data;
}

export async function primeiroAcesso(nova_senha: string) {
  const { data } = await api.post<{ message: string }>('/auth/primeiro-acesso', { nova_senha });
  return data;
}

export async function esqueceuSenha(email: string) {
  const { data } = await api.post<{ message: string }>('/auth/esqueceu-senha', { email });
  return data;
}

export async function redefinirSenha(token: string, nova_senha: string) {
  const { data } = await api.post<{ message: string }>('/auth/redefinir-senha', { token, nova_senha });
  return data;
}
