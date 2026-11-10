import axios, { AxiosError } from 'axios';

/** Endereço da API, com o prefixo /api. */
export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');

const TOKEN_KEY = 'pasi.token';

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* navegação privada: a sessão vale só enquanto a aba estiver aberta */
    }
    memoria = token;
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignora */
    }
    memoria = null;
  },
};
let memoria: string | null = null;

export const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get() ?? memoria;
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

/** Quem quer saber de sessão vencida ou de mudança de situação (AuthContext). */
type Ouvinte = (evento: 'sessao-expirada' | 'situacao-mudou') => void;
const ouvintes = new Set<Ouvinte>();
export function ouvirSessao(fn: Ouvinte) {
  ouvintes.add(fn);
  return () => {
    ouvintes.delete(fn);
  };
}

api.interceptors.response.use(
  (r) => r,
  (erro: AxiosError<{ codigo?: string }>) => {
    const status = erro.response?.status;
    const url = erro.config?.url ?? '';
    const rotaPublica = url.startsWith('/auth/');
    if (status === 401 && !rotaPublica) {
      ouvintes.forEach((fn) => fn('sessao-expirada'));
    }
    const codigo = erro.response?.data?.codigo;
    if (status === 403 && (codigo === 'PENDENCIA_I' || codigo === 'PENDENCIA_II')) {
      ouvintes.forEach((fn) => fn('situacao-mudou'));
    }
    return Promise.reject(erro);
  },
);

/** Mensagem legível de um erro da API (Nest devolve string ou lista). */
export function mensagemErro(erro: unknown, padrao = 'Não foi possível concluir. Tente de novo.'): string {
  if (axios.isAxiosError(erro)) {
    if (!erro.response) {
      return 'Não foi possível falar com o servidor. Confira a sua conexão e tente de novo.';
    }
    const msg = (erro.response.data as { message?: unknown } | undefined)?.message;
    if (Array.isArray(msg)) return msg.join(' ');
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  return padrao;
}

export function statusErro(erro: unknown): number | undefined {
  return axios.isAxiosError(erro) ? erro.response?.status : undefined;
}
