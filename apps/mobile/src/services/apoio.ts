import axios from 'axios';
import api from '../config/api';

export const apoioService = {
  getGeneros: () =>
    api.get('/apoio/generos').then((r) => r.data as { id_genero: number; nome: string }[]),
  /** Unidades de atendimento com o tipo (CRAS, CREAS, CAPS...). */
  getUnidades: () => api.get('/apoio/unidades').then((r) => r.data as UnidadeApoio[]),
};

export interface UnidadeApoio {
  id_unidade_atendimento: number;
  nome: string;
  cidade: string | null;
  estado: string | null;
  tipo_unidade_atendimento: { id_tipo_unidade_atend: number; nome: string | null } | null;
}

export const buscarCep = async (cep: string) => {
  const { data } = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
  if (data.erro) return null;
  return data as {
    logradouro: string;
    bairro: string;
    localidade: string;
    uf: string;
  };
};
