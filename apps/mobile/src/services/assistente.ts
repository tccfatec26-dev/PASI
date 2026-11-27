import api from '../config/api';

/**
 * Assistente virtual do app.
 *
 * - Pedido de atendente: API do PASI (POST /assistente/atendente), que manda
 *   e-mail para a unidade do atendimento e avisa o profissional.
 * - Perguntas que o conteúdo fixo do app não responde: API do PASIBot
 *   (código em pasi_bot/, serviço pasi-bot-api no Render), a mesma da landing
 *   page. No app não há bloqueio de CORS, então a lista de endereços liberados
 *   no pasi_bot/app/main.py não se aplica aqui.
 *
 * Nenhum dado pessoal vai para o PASIBot: o app manda só o texto digitado e
 * um identificador de conversa aleatório.
 */

export interface MensagemConversa {
  autor: 'paciente' | 'assistente';
  texto: string;
}

export interface RespostaPedidoAtendente {
  enviado: boolean;
  email_unidade: boolean;
  profissional_avisado: boolean;
  unidade: { nome: string; telefone: string | null } | null;
}

export const assistenteService = {
  pedirAtendente: (dados: {
    id_atendimento: number;
    assunto: string;
    mensagem?: string;
    conversa?: MensagemConversa[];
  }) => api.post<RespostaPedidoAtendente>('/assistente/atendente', dados).then((r) => r.data),
};

// ------------------------------------------------------------------
// PASIBot
// ------------------------------------------------------------------

const URL_PADRAO = 'https://pasi-bot-api.onrender.com';
const API_PASIBOT = (process.env.EXPO_PUBLIC_ASSISTENTE_API_URL || URL_PADRAO).replace(/\/$/, '');
/** No plano gratuito do Render a API "dorme": a primeira resposta pode levar perto de 1 minuto. */
const TEMPO_LIMITE_MS = 60_000;

export interface RespostaPasiBot {
  resposta: string;
  agente: string;
  fontes: string[];
}

export function novaSessaoPasiBot() {
  return `app-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Chamada leve para "acordar" a API assim que a pessoa abre o assistente. */
export function acordarPasiBot() {
  fetch(`${API_PASIBOT}/saude`).catch(() => {
    // falhas aqui não importam: a pergunta de verdade trata o erro
  });
}

export async function perguntarPasiBot(mensagem: string, sessao: string): Promise<RespostaPasiBot> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TEMPO_LIMITE_MS);
  try {
    const resposta = await fetch(`${API_PASIBOT}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensagem, sessao, usuario: 'app-pasi' }),
      signal: controle.signal,
    });
    if (!resposta.ok) throw new Error(`PASIBot respondeu ${resposta.status}`);
    return (await resposta.json()) as RespostaPasiBot;
  } finally {
    clearTimeout(timer);
  }
}
