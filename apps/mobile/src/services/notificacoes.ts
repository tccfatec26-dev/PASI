import api from '../config/api';

/** tipo_notificacao (ids fixos, iguais aos da API). */
export const TipoNotificacao = { INCLUIDO_ATENDIMENTO: 1, NOVOS_FORMULARIOS: 2, FORMULARIO_RESPONDIDO: 3 } as const;

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

export interface ListaNotificacoes {
  data: Notificacao[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  nao_lidas: number;
}

export const notificacoesService = {
  async listar(params: { page?: number; limit?: number; nao_lidas?: boolean } = {}): Promise<ListaNotificacoes> {
    const { data } = await api.get<ListaNotificacoes>('/notificacoes', { params });
    return data;
  },

  async marcarLida(id: number): Promise<{ nao_lidas: number }> {
    const { data } = await api.patch<{ nao_lidas: number }>(`/notificacoes/${id}/lida`);
    return data;
  },

  async marcarTodasLidas(): Promise<{ nao_lidas: number }> {
    const { data } = await api.patch<{ nao_lidas: number }>('/notificacoes/lidas');
    return data;
  },
};
