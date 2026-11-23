/** Junta palavras (do OCR ou do texto de um PDF) em trechos de linha. */
import type { Segmento } from './montar';

export interface Palavra {
  texto: string;
  conf?: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Traço sozinho: borda vertical da tabela lida pelo OCR ("Às vezes — Verdadeiro"). */
const BORDA = /^[—–]+$/;

/**
 * Junta as palavras de uma linha em trechos, separando onde há um espaço
 * grande (colunas de tabela): "Própria ......... |__|  |__|" vira "Própria",
 * "|__|", "|__|". Um traço sozinho também separa (é a borda entre colunas).
 */
export function trechosDaLinha(palavras: Palavra[], pagina: number, larguraPagina: number): Segmento[] {
  const ord = palavras.filter((p) => p.texto).sort((a, b) => a.x0 - b.x0);
  if (!ord.length) return [];
  const chars = ord.reduce((n, p) => n + Math.max(p.texto.length, 1), 0);
  const larguraChar = ord.reduce((n, p) => n + (p.x1 - p.x0), 0) / chars;
  const limite = Math.max(larguraChar * 3, 12);

  const trechos: Segmento[] = [];
  let atual: Palavra[] = [];
  const fechar = () =>
    atual.length &&
    trechos.push({
      texto: atual.map((p) => p.texto).join(' '),
      confianca: atual.reduce((n, p) => n + (p.conf ?? 100), 0) / atual.length,
      palavrasX: atual.map((p) => p.x0),
      x0: Math.min(...atual.map((p) => p.x0)),
      y0: Math.min(...atual.map((p) => p.y0)),
      x1: Math.max(...atual.map((p) => p.x1)),
      y1: Math.max(...atual.map((p) => p.y1)),
      pagina,
      larguraPagina,
    });
  for (const p of ord) {
    if (BORDA.test(p.texto)) {
      fechar();
      atual = [];
    } else if (atual.length && p.x0 - atual[atual.length - 1].x1 > limite) {
      fechar();
      atual = [p];
    } else atual.push(p);
  }
  fechar();
  return trechos;
}
