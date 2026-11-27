/**
 * Comunicação com a API do PASIBot (código em pasi_bot/, serviço pasi-bot-api
 * no Render). É a mesma chamada da landing page
 * (landing-page/src/components/Assistente/api.ts):
 *   POST /chat { mensagem, sessao, usuario } -> { resposta, agente, fontes }
 *
 * No app não há bloqueio de CORS. Nenhum dado pessoal vai para o PASIBot: o app
 * manda só o texto digitado e um identificador de conversa aleatório.
 */

const URL_PADRAO = 'https://pasi-bot-api.onrender.com';
export const API_ASSISTENTE = (process.env.EXPO_PUBLIC_ASSISTENTE_API_URL || URL_PADRAO).replace(/\/$/, '');

const USUARIO = 'app-pasi';
/** No plano gratuito do Render a API "dorme": a primeira resposta pode levar perto de 1 minuto. */
const TEMPO_LIMITE_MS = 90_000;

export interface RespostaChat {
  resposta: string;
  agente: string;
  fontes: string[];
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

export async function perguntar(mensagem: string, sessao: string): Promise<RespostaChat> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const resposta = await fetch(`${API_ASSISTENTE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem, sessao, usuario: USUARIO }),
      signal: controle.signal,
    });
    if (!resposta.ok) throw new Error(`API respondeu ${resposta.status}`);
    return (await resposta.json()) as RespostaChat;
  } finally {
    clearTimeout(timer);
  }
}
