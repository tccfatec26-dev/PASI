// Comunicação com a API do PASIBot (código em pasi_bot/, serviço pasi-bot-api no Render).
// Contrato: POST /chat { mensagem, sessao, usuario } -> { resposta, agente, fontes }.

const URL_PADRAO = "https://pasi-bot-api.onrender.com";

export const API_ASSISTENTE = (import.meta.env.VITE_ASSISTENTE_API_URL ?? URL_PADRAO).replace(/\/$/, "");

const USUARIO = "landing-pasi";
const CHAVE_SESSAO = "pasi-assistente-sessao";
// No plano gratuito do Render a API "dorme": a primeira resposta pode levar perto de 1 minuto.
const TEMPO_LIMITE_MS = 90_000;

export type RespostaChat = { resposta: string; agente: string; fontes: string[] };

/** Uma sessão por aba: a API guarda o histórico da conversa por este identificador. */
export function obterSessao(): string {
  try {
    const salva = sessionStorage.getItem(CHAVE_SESSAO);
    if (salva) return salva;
    const nova = novaSessao();
    sessionStorage.setItem(CHAVE_SESSAO, nova);
    return nova;
  } catch {
    return novaSessao();
  }
}

export function renovarSessao(): string {
  const nova = novaSessao();
  try {
    sessionStorage.setItem(CHAVE_SESSAO, nova);
  } catch {
    // sem sessionStorage (aba anônima restrita): a sessão vale só enquanto a página estiver aberta
  }
  return nova;
}

function novaSessao() {
  const aleatorio = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `landing-${aleatorio}`;
}

/** Chamada leve para "acordar" a API assim que a pessoa abre o chat. */
export function acordarApi() {
  fetch(`${API_ASSISTENTE}/saude`).catch(() => {
    // falhas aqui não importam: a pergunta de verdade trata o erro
  });
}

export async function perguntar(mensagem: string, sessao: string): Promise<RespostaChat> {
  const resposta = await fetch(`${API_ASSISTENTE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensagem, sessao, usuario: USUARIO }),
    signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
  });
  if (!resposta.ok) throw new Error(`API respondeu ${resposta.status}`);
  return (await resposta.json()) as RespostaChat;
}
