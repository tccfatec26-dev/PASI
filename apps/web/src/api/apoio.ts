import { api } from './client';
import type { Genero, Profissao, TipoUnidade, Unidade } from './types';

// Tabelas de domínio mudam pouco: guarda a primeira resposta em memória.
const cache = new Map<string, Promise<unknown>>();
function lookup<T>(rota: string): Promise<T> {
  if (!cache.has(rota)) {
    const p = api.get<T>(rota).then((r) => r.data);
    p.catch(() => cache.delete(rota));
    cache.set(rota, p);
  }
  return cache.get(rota) as Promise<T>;
}

export const unidades = () => lookup<Unidade[]>('/apoio/unidades');
export const profissoes = () => lookup<Profissao[]>('/apoio/profissoes');
export const generos = () => lookup<Genero[]>('/apoio/generos');
export const tiposUnidade = () => lookup<TipoUnidade[]>('/apoio/tipos-unidade');
export const tiposFormulario = () => lookup<{ id_tipo_formulario: number; nome: string }[]>('/apoio/tipos-formulario');
export const tiposPergunta = () =>
  lookup<{ id_tipo_pergunta: number; nome: string; descricao?: string | null }[]>('/apoio/tipos-pergunta');
