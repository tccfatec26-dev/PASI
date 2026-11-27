import { api } from './client';
import type { Paginado } from './types';

/** tipo_notificacao (ids fixos, iguais aos da API). */
export const TipoNotificacao = { INCLUIDO_ATENDIMENTO: 1, NOVOS_FORMULARIOS: 2, FORMULARIO_RESPONDIDO: 3, PEDIDO_ATENDENTE: 4 } as const;

export interface Notificacao {
  id_notificacao: number;
  id_tipo_notificacao: number;
  titulo: string;
  mensagem: string;
  id_atendimento: number | null;
  id_formulario: number | null;
  lida: boolean;
  dt_leitura: string | null;
  dt_cadastro: string;
}

export type ListaNotificacoes = Paginado<Notificacao> & { nao_lidas: number };

export async function listar(params: { page?: number; limit?: number; nao_lidas?: boolean } = {}) {
  const { data } = await api.get<ListaNotificacoes>('/notificacoes', { params });
  return data;
}

export async function marcarLida(id: number) {
  const { data } = await api.patch<{ nao_lidas: number }>(`/notificacoes/${id}/lida`);
  return data;
}

export async function marcarTodasLidas() {
  const { data } = await api.patch<{ nao_lidas: number }>('/notificacoes/lidas');
  return data;
}
