/**
 * Ciclo de vida de uma conversa com a assistente: identificador, cancelamento e inatividade.
 *
 * Problema que resolve (item 7 de docs/assistente-digital.md): ao tocar em "Recomeçar" enquanto a IA
 * ainda respondia, a resposta da conversa anterior aparecia na conversa nova.
 *
 * Cada conversa ganha um número. Toda pergunta guarda o número da conversa em que foi feita e
 * recebe um AbortSignal. Ao recomeçar (ou encerrar por inatividade) a conversa atual é encerrada:
 * a requisição pendente é cancelada e, se a resposta chegar mesmo assim, `ehAtual` devolve false
 * e ela é descartada.
 *
 * Módulo sem dependências (o mesmo arquivo existe no app, em apps/mobile/src/assistente/), testado em tests/conversa.test.ts.
 */

/** Depois de 15 minutos sem atividade a conversa é encerrada e a próxima começa do zero. */
export const INATIVIDADE_MS = 15 * 60 * 1000;

export const MENSAGEM_INATIVIDADE = "Atendimento finalizado por inatividade.";

/** A conversa ficou parada por mais tempo que o limite? */
export function expirou(ultimaAtividade: number | null, agora: number = Date.now(), limite = INATIVIDADE_MS) {
  return ultimaAtividade !== null && agora - ultimaAtividade > limite;
}

export class ControleConversa {
  private numero = 0;
  private pendentes = new Set<AbortController>();
  private ultimaAtividade: number | null = null;

  /** Número da conversa ativa. */
  get atual() {
    return this.numero;
  }

  /** Marca atividade da pessoa ou da assistente (pergunta, resposta, toque em opção). */
  registrarAtividade(agora: number = Date.now()) {
    this.ultimaAtividade = agora;
  }

  /** A conversa ativa está parada há mais tempo que o limite? Conversa sem atividade nunca expira. */
  inativa(agora: number = Date.now(), limite = INATIVIDADE_MS) {
    return expirou(this.ultimaAtividade, agora, limite);
  }

  /** Começa uma requisição da conversa ativa: o número dela e um sinal para cancelar. */
  iniciarRequisicao() {
    const controlador = new AbortController();
    this.pendentes.add(controlador);
    const numero = this.numero;
    return {
      numero,
      signal: controlador.signal,
      /** Chame quando a requisição terminar (deu certo ou não). */
      concluir: () => {
        this.pendentes.delete(controlador);
      },
    };
  }

  /** A resposta da conversa `numero` ainda pode aparecer? */
  ehAtual(numero: number) {
    return numero === this.numero;
  }

  /** Encerra a conversa ativa: cancela o que estiver pendente e passa para a próxima. */
  encerrar() {
    for (const controlador of this.pendentes) controlador.abort();
    this.pendentes.clear();
    this.numero += 1;
    this.ultimaAtividade = null;
    return this.numero;
  }

  /** Há requisição em andamento? */
  get ocupada() {
    return this.pendentes.size > 0;
  }
}

/** Junta dois sinais de cancelamento (o da conversa e o do tempo limite). */
export function juntarSinais(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  if (!a) return b;
  const controlador = new AbortController();
  const cancelar = () => controlador.abort();
  if (a.aborted || b.aborted) controlador.abort();
  a.addEventListener("abort", cancelar, { once: true });
  b.addEventListener("abort", cancelar, { once: true });
  return controlador.signal;
}
