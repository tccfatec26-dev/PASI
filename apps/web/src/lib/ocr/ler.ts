/**
 * Lê fotos e PDFs de um formulário em papel e devolve os trechos de texto com
 * a posição deles. Foto e PDF digitalizado passam pelo OCR (Tesseract, cuja
 * leitura é uma rede neural LSTM); PDF com texto é lido direto (ver pdf.ts).
 * Tudo roda no navegador: o arquivo não vai para a API.
 *
 * Antes do OCR a imagem passa por `limparParaOcr` (fundos coloridos, letra
 * branca em faixa escura e bordas de tabela atrapalham o Tesseract).
 *
 * Na primeira leitura o navegador baixa o motor do Tesseract e o idioma
 * português (alguns MB, do CDN jsdelivr); depois fica em cache.
 */
import type { Segmento } from './montar';
import { limparParaOcr } from './limpar';
import { trechosDaLinha } from './trechos';
import { desenharPagina, ehPdf, textoDaPagina } from './pdf';

export const TIPOS_ACEITOS = 'image/png,image/jpeg,image/webp,image/bmp,application/pdf';
export const TAMANHO_MAXIMO = 20 * 1024 * 1024;
/** Páginas por leitura (fotos ou páginas de PDF do mesmo formulário). */
export const MAX_IMAGENS = 5;

/** Uma página a ler: uma foto, ou a página `pagina` (1, 2...) de um PDF. */
export interface Fonte {
  arquivo: File;
  pagina?: number;
}
/** Imagens menores que isso são ampliadas antes do OCR (melhora a leitura)... */
const LARGURA_MINIMA = 2200;
/** ...e fotos muito grandes são reduzidas (memória e tempo). */
const LARGURA_MAXIMA = 3200;

/** Andamento da leitura, página por página (para animar cada miniatura). */
export interface Andamento {
  /** índice da página em `fontes` */
  indice: number;
  /** preparando = baixando/iniciando o leitor (só demora na 1ª vez) */
  fase: 'preparando' | 'lendo' | 'concluida';
  /** 0–1 dentro da fase, quando o leitor informa */
  fracao?: number;
}

export type Progresso = (a: Andamento) => void;

/**
 * Desenha num canvas no tamanho bom para o OCR, passa para tons de cinza
 * (com um pouco mais de contraste) e limpa (ver `limparParaOcr`).
 */
function prepararImagem(img: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
  const escala =
    img.width < LARGURA_MINIMA ? Math.min(LARGURA_MINIMA / img.width, 3) : img.width > LARGURA_MAXIMA ? LARGURA_MAXIMA / img.width : 1;
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);

  const dados = ctx.getImageData(0, 0, c.width, c.height);
  const px = dados.data;
  const cinza = new Uint8ClampedArray(c.width * c.height);
  for (let i = 0, p = 0; i < cinza.length; i++, p += 4) {
    const lum = 0.299 * px[p] + 0.587 * px[p + 1] + 0.114 * px[p + 2];
    cinza[i] = (lum - 128) * 1.2 + 128;
  }
  const limpa = limparParaOcr(cinza, c.width, c.height);
  for (let i = 0, p = 0; i < limpa.length; i++, p += 4) {
    px[p] = px[p + 1] = px[p + 2] = limpa[i];
    px[p + 3] = 255;
  }
  ctx.putImageData(dados, 0, 0);
  return c;
}

async function carregarImagem(arquivo: File) {
  return createImageBitmap(arquivo);
}

type WorkerOcr = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>;

async function criarOcr(progresso: Progresso, indice: () => number): Promise<WorkerOcr> {
  const { createWorker } = await import('tesseract.js');
  return createWorker('por', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') progresso({ indice: indice(), fase: 'lendo', fracao: m.progress });
      else if (m.status.startsWith('loading') || m.status.startsWith('initializ'))
        progresso({ indice: indice(), fase: 'preparando', fracao: m.progress });
    },
  });
}

async function ocrDaPagina(ocr: WorkerOcr, canvas: HTMLCanvasElement, pagina: number): Promise<Segmento[]> {
  const { data } = await ocr.recognize(canvas, {}, { blocks: true });
  const segs: Segmento[] = [];
  for (const bloco of data.blocks ?? [])
    for (const par of bloco.paragraphs)
      for (const linha of par.lines) {
        // palavras de confiança baixa ficam: "Não" às vezes sai com 0. O lixo
        // (trechos curtos e de confiança baixa) sai depois, na montagem.
        const palavras = linha.words.filter((w) => w.text.trim()).map((w) => ({ texto: w.text, conf: w.confidence, ...w.bbox }));
        segs.push(...trechosDaLinha(palavras, pagina, canvas.width));
      }
  return segs;
}

/** Leitura cancelada pelo usuário (fechou a janela). */
export class LeituraCancelada extends Error {}

/**
 * Lê as páginas na ordem recebida. Página de PDF com texto não passa pelo OCR;
 * foto e PDF digitalizado, sim. `sinal` cancela no meio (o leitor é encerrado
 * na hora).
 */
export async function lerArquivos(fontes: Fonte[], progresso: Progresso, sinal?: AbortSignal): Promise<Segmento[]> {
  const segs: Segmento[] = [];
  let ocr: WorkerOcr | null = null;
  let atual = 0;
  const parar = () => void (ocr as WorkerOcr | null)?.terminate().catch(() => undefined);
  sinal?.addEventListener('abort', parar);
  const conferir = () => {
    if (sinal?.aborted) throw new LeituraCancelada('Leitura cancelada.');
  };
  const obterOcr = async () => {
    conferir();
    ocr ??= await criarOcr(progresso, () => atual);
    conferir();
    return ocr;
  };
  try {
    for (const [i, { arquivo, pagina }] of fontes.entries()) {
      conferir();
      atual = i;
      progresso({ indice: i, fase: 'lendo', fracao: 0 });
      if (pagina !== undefined && ehPdf(arquivo)) {
        const doTexto = await textoDaPagina(arquivo, pagina, i);
        // pouco texto: é PDF digitalizado (página só com imagem), vai pro OCR
        if (doTexto.reduce((n, t) => n + t.texto.length, 0) > 40) segs.push(...doTexto);
        else {
          const canvas = prepararImagem(await desenharPagina(arquivo, pagina, LARGURA_MINIMA));
          segs.push(...(await ocrDaPagina(await obterOcr(), canvas, i)));
        }
      } else {
        const img = await carregarImagem(arquivo);
        const canvas = prepararImagem(img);
        img.close();
        segs.push(...(await ocrDaPagina(await obterOcr(), canvas, i)));
      }
      progresso({ indice: i, fase: 'concluida', fracao: 1 });
    }
  } catch (e) {
    // com o leitor encerrado no meio, o reconhecimento falha: é o cancelamento
    if (sinal?.aborted) throw new LeituraCancelada('Leitura cancelada.');
    throw e;
  } finally {
    sinal?.removeEventListener('abort', parar);
    // sempre encerra (se o cancelamento chegou enquanto o leitor subia, ele
    // ainda não tinha sido encerrado); encerrar duas vezes não faz mal
    await (ocr as WorkerOcr | null)?.terminate().catch(() => undefined);
  }
  return segs;
}
