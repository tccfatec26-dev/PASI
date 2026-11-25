/**
 * Limpa a imagem antes do OCR. Os formulários em papel do projeto têm faixas
 * coloridas (verde claro), cabeçalho escuro com letra branca e bordas de
 * tabela — tudo isso confunde o Tesseract. O que esta etapa faz:
 *
 *  1. inverte as regiões de fundo escuro (letra branca vira letra preta);
 *  2. binariza com limiar adaptativo (Sauvola): fundos coloridos e sombras de
 *     foto viram branco, a letra vira preto;
 *  3. apaga linhas retas longas (bordas da tabela), mantendo as letras.
 *
 * Recebe e devolve tons de cinza (0 = preto, 255 = branco), um byte por pixel.
 */

/** Média de cada pixel numa janela (2r+1)², por somas acumuladas separáveis. */
function mediaJanela(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const lin = y * w;
    let soma = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) soma += src[lin + x];
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r);
      const x1 = Math.min(w - 1, x + r);
      tmp[lin + x] = soma / (x1 - x0 + 1);
      if (x + r + 1 < w) soma += src[lin + x + r + 1];
      if (x - r >= 0) soma -= src[lin + x - r];
    }
  }
  for (let x = 0; x < w; x++) {
    let soma = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) soma += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - r);
      const y1 = Math.min(h - 1, y + r);
      out[y * w + x] = soma / (y1 - y0 + 1);
      if (y + r + 1 < h) soma += tmp[(y + r + 1) * w + x];
      if (y - r >= 0) soma -= tmp[(y - r) * w + x];
    }
  }
  return out;
}

/** Marca (em `linha`) as corridas de tinta com `minimo` pixels ou mais, na horizontal ou vertical. */
function marcarRetas(tinta: Uint8Array, w: number, h: number, minimo: number, horizontal: boolean, linha: Uint8Array) {
  const [externo, interno] = horizontal ? [h, w] : [w, h];
  const idx = horizontal ? (e: number, i: number) => e * w + i : (e: number, i: number) => i * w + e;
  for (let e = 0; e < externo; e++) {
    let inicio = -1;
    for (let i = 0; i <= interno; i++) {
      const t = i < interno && tinta[idx(e, i)];
      if (t && inicio < 0) inicio = i;
      if (!t && inicio >= 0) {
        if (i - inicio >= minimo) for (let k = inicio; k < i; k++) linha[idx(e, k)] = 1;
        inicio = -1;
      }
    }
  }
}

/** Engrossa a tinta `r` pixels para os lados (horizontal) ou para cima/baixo. */
function engrossar(tinta: Uint8Array, w: number, h: number, r: number, horizontal: boolean): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!tinta[y * w + x]) continue;
      if (horizontal) for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) out[y * w + k] = 1;
      else for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) out[k * w + x] = 1;
    }
  return out;
}

export function limparParaOcr(cinza: Uint8ClampedArray | Uint8Array, w: number, h: number): Uint8Array {
  const n = w * h;
  const g = new Float32Array(n);
  const escuro = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    g[i] = cinza[i];
    escuro[i] = cinza[i] < 128 ? 1 : 0;
  }

  // 1. fundo escuro (mais da metade da vizinhança é escura): inverte
  const fracEscura = mediaJanela(escuro, w, h, 40);
  for (let i = 0; i < n; i++) if (fracEscura[i] > 0.55) g[i] = 255 - g[i];

  // 2. Sauvola: limiar = média * (1 + k * (desvio / 128 - 1))
  const quad = new Float32Array(n);
  for (let i = 0; i < n; i++) quad[i] = g[i] * g[i];
  const m = mediaJanela(g, w, h, 15);
  const m2 = mediaJanela(quad, w, h, 15);
  const tinta = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const desvio = Math.sqrt(Math.max(m2[i] - m[i] * m[i], 0));
    const limiar = m[i] * (1 + 0.2 * (desvio / 128 - 1));
    // fundo de cor clara (verde, amarelo) nunca é tinta, mesmo perto de uma
    // borda; 165 ainda pega traço fino e claro de foto (a "/" de "filho/a")
    tinta[i] = g[i] < limiar && g[i] < 165 ? 1 : 0;
  }

  // 3. bordas de tabela: retas bem mais compridas que uma letra. Em foto a
  // folha fica um pouco torta; engrossar a tinta 3 px para o lado antes de
  // medir a reta faz uma linha inclinada (até ~5°) continuar inteira.
  const minimo = Math.max(60, Math.round(w * 0.03));
  const reta = new Uint8Array(n);
  marcarRetas(engrossar(tinta, w, h, 3, false), w, h, minimo, true, reta);
  marcarRetas(engrossar(tinta, w, h, 3, true), w, h, minimo, false, reta);

  const saida = new Uint8Array(n);
  for (let i = 0; i < n; i++) saida[i] = tinta[i] && !reta[i] ? 0 : 255;
  return saida;
}
