import { api } from './client';

export interface Documento {
  id_documento: number;
  id_formulario: number | null;
  nome_fisico: string | null;
  caminho: string;
  dt_cadastro: string | null;
}

export async function listar(idFormulario: number) {
  const { data } = await api.get<Documento[]>(`/formularios/${idFormulario}/documentos`);
  return data;
}

export async function enviar(idFormulario: number, arquivo: File) {
  const corpo = new FormData();
  corpo.append('arquivo', arquivo);
  const { data } = await api.post<Documento>(`/formularios/${idFormulario}/documentos`, corpo);
  return data;
}

export async function excluir(id: number) {
  await api.delete(`/documentos/${id}`);
}

/** Baixa com o token (não dá para usar um link simples) e abre o "salvar como". */
export async function baixar(doc: Documento) {
  const { data } = await api.get<Blob>(`/documentos/${doc.id_documento}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.nome_fisico || `documento-${doc.id_documento}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const TAMANHO_MAXIMO = 10 * 1024 * 1024;
