// Comunicação com a API do PASIBot (código em pasi_bot/, serviço pasi-bot-api no Render).
// Contrato: POST /chat { mensagem, sessao, usuario } -> { resposta, agente, fontes, servico_indicado }.
import { INATIVIDADE_MS, expirou, juntarSinais } from "./conversa";

const URL_PADRAO = "https://pasi-bot-api.onrender.com";

export const API_ASSISTENTE = (import.meta.env.VITE_ASSISTENTE_API_URL ?? URL_PADRAO).replace(/\/$/, "");

const USUARIO = "landing-pasi";
const CHAVE_SESSAO = "pasi-assistente-sessao";
/** Hora da última atividade da sessão salva: depois de 15 min, a próxima conversa começa do zero. */
const CHAVE_ATIVIDADE = "pasi-assistente-atividade";
// No plano gratuito do Render a API "dorme": a primeira resposta pode levar perto de 1 minuto.
const TEMPO_LIMITE_MS = 90_000;

/** Serviço que a IA identificou na conversa (ou que a pessoa pediu ao buscar unidades). */
export type ServicoIndicado = { servico: "CRAS" | "CREAS" | "CAPS"; origem: "ia" | "busca"; motivo: string };

export type RespostaChat = {
  resposta: string;
  agente: string;
  fontes: string[];
  /** Ausente em versões antigas da API e enquanto a conversa não deixar claro o serviço. */
  servico_indicado?: ServicoIndicado | null;
};

/**
 * Uma sessão por aba: a API guarda o histórico da conversa por este identificador.
 * Uma sessão parada há mais de 15 minutos não é reaproveitada: a conversa começa sem histórico.
 */
export function obterSessao(agora: number = Date.now()): string {
  try {
    const salva = sessionStorage.getItem(CHAVE_SESSAO);
    const atividade = Number(sessionStorage.getItem(CHAVE_ATIVIDADE)) || null;
    if (salva && !expirou(atividade, agora, INATIVIDADE_MS)) return salva;
    return renovarSessao();
  } catch {
    return novaSessao();
  }
}

/** Marca atividade na sessão salva (pergunta enviada ou resposta recebida). */
export function registrarAtividadeDaSessao(agora: number = Date.now()) {
  try {
    sessionStorage.setItem(CHAVE_ATIVIDADE, String(agora));
  } catch {
    // sem sessionStorage: a sessão vale só enquanto a página estiver aberta
  }
}

export function renovarSessao(): string {
  const nova = novaSessao();
  try {
    sessionStorage.setItem(CHAVE_SESSAO, nova);
    sessionStorage.removeItem(CHAVE_ATIVIDADE);
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

/**
 * `cancelar`: sinal da conversa (ver conversa.ts). Ao recomeçar, a requisição pendente é cancelada e a
 * resposta atrasada não chega à conversa nova.
 */
export async function perguntar(mensagem: string, sessao: string, cancelar?: AbortSignal): Promise<RespostaChat> {
  const resposta = await fetch(`${API_ASSISTENTE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mensagem, sessao, usuario: USUARIO }),
    signal: juntarSinais(cancelar, AbortSignal.timeout(TEMPO_LIMITE_MS)),
  });
  if (!resposta.ok) throw new Error(`API respondeu ${resposta.status}`);
  return (await resposta.json()) as RespostaChat;
}
