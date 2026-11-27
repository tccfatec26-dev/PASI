/**
 * Comunicação com a API do PASIBot (código em pasi_bot/, serviço pasi-bot-api
 * no Render). É a mesma chamada da landing page
 * (landing-page/src/components/Assistente/api.ts):
 *   POST /chat { mensagem, sessao, usuario } -> { resposta, agente, fontes }
 *
 * No app não há bloqueio de CORS. Nenhum dado pessoal vai para o PASIBot: o app
 * manda só o texto digitado e um identificador de conversa aleatório.
 */

import { juntarSinais } from '../assistente/conversa';

const URL_PADRAO = 'https://pasi-bot-api.onrender.com';
export const API_ASSISTENTE = (process.env.EXPO_PUBLIC_ASSISTENTE_API_URL || URL_PADRAO).replace(/\/$/, '');

const USUARIO = 'app-pasi';
/** No plano gratuito do Render a API "dorme": a primeira resposta pode levar perto de 1 minuto. */
const TEMPO_LIMITE_MS = 90_000;

export interface ServicoIndicado {
  servico: 'CRAS' | 'CREAS' | 'CAPS';
  /** ia = a IA registrou o serviço (indicar_servico); busca = a pessoa pediu unidades desse serviço. */
  origem: 'ia' | 'busca';
  motivo: string;
}

export interface RespostaChat {
  resposta: string;
  agente: string;
  fontes: string[];
  /** Ausente em versões antigas da API e enquanto a conversa não deixar claro o serviço. */
  servico_indicado?: ServicoIndicado | null;
}

/** Uma sessão por conversa: a API guarda o histórico por este identificador. */
export function novaSessao() {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Chamada leve para "acordar" a API assim que a pessoa abre o chat. */
export function acordarApi() {
  fetch(`${API_ASSISTENTE}/saude`).catch(() => {
    // falhas aqui não importam: a pergunta de verdade trata o erro
  });
}

/**
 * `cancelar`: sinal da conversa (ver assistente/conversa.ts). Ao recomeçar, a requisição pendente é
 * cancelada e a resposta atrasada não chega à conversa nova.
 */
export async function perguntar(mensagem: string, sessao: string, cancelar?: AbortSignal): Promise<RespostaChat> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const resposta = await fetch(`${API_ASSISTENTE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem, sessao, usuario: USUARIO }),
      signal: juntarSinais(cancelar, controle.signal),
    });
    if (!resposta.ok) throw new Error(`API respondeu ${resposta.status}`);
    return (await resposta.json()) as RespostaChat;
  } finally {
    clearTimeout(timer);
  }
}
