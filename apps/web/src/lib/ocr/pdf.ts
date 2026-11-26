/**
 * PDFs no "Escanear com IA": o usuário escolhe as páginas a ler (pela
 * miniatura de cada uma) e cada página é lida separadamente. PDF gerado no computador já tem o texto (com posição) e não
 * precisa de OCR; PDF digitalizado (só imagem) é desenhado e vai para o OCR.
 *
 * O pdf.js é carregado só quando aparece um PDF (fica fora do pacote principal).
 */
import type { Segmento } from './montar';
import { trechosDaLinha } from './trechos';

type Pdfjs = typeof import('pdfjs-dist');
type DocumentoPdf = Awaited<ReturnType<Pdfjs['getDocument']>['promise']>;

let pdfjs: Promise<Pdfjs> | null = null;
function carregarPdfjs(): Promise<Pdfjs> {
  pdfjs ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  });
  return pdfjs;
}

/** PDFs abertos nesta janela (miniaturas e leitura usam o mesmo documento). */
const abertos = new Map<File, Promise<DocumentoPdf>>();

export const ehPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');

function abrir(arquivo: File): Promise<DocumentoPdf> {
  let doc = abertos.get(arquivo);
  if (!doc) {
    doc = carregarPdfjs().then(async (lib) => lib.getDocument({ data: new Uint8Array(await arquivo.arrayBuffer()) }).promise);
    doc.catch(() => abertos.delete(arquivo));
    abertos.set(arquivo, doc);
  }
  return doc;
}

/** Miniaturas já geradas, por arquivo e página (endereços blob:). */
const miniaturas = new Map<File, Map<number, Promise<string>>>();
/** Uma miniatura por vez: com o PDF grande, rolar a lista não trava a tela. */
let fila: Promise<unknown> = Promise.resolve();

/**
 * Fecha os PDFs abertos e solta as miniaturas (ao fechar a janela). As
 * miniaturas saem só depois da animação de saída, que ainda mostra as <img>.
 */
export function fecharPdfs() {
  for (const doc of abertos.values()) void doc.then((d) => d.loadingTask.destroy()).catch(() => undefined);
  abertos.clear();
  const soltar = [...miniaturas.values()].flatMap((m) => [...m.values()]);
  miniaturas.clear();
  setTimeout(() => soltar.forEach((u) => void u.then(URL.revokeObjectURL).catch(() => undefined)), 1000);
}

export async function contarPaginas(arquivo: File): Promise<number> {
  return (await abrir(arquivo)).numPages;
}

/** Desenha a página `n` (1, 2...) num canvas com a largura pedida. */
export async function desenharPagina(arquivo: File, n: number, largura: number): Promise<HTMLCanvasElement> {
  const pag = await (await abrir(arquivo)).getPage(n);
  const base = pag.getViewport({ scale: 1 });
  const vp = pag.getViewport({ scale: largura / base.width });
  const c = document.createElement('canvas');
  c.width = Math.round(vp.width);
  c.height = Math.round(vp.height);
  // fundo branco: PDF sem fundo ficaria transparente (preto para o OCR)
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  await pag.render({ canvas: c, viewport: vp }).promise;
  return c;
}

async function gerarMiniatura(arquivo: File, n: number): Promise<string> {
  const c = await desenharPagina(arquivo, n, 240);
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('Não foi possível gerar a miniatura.');
  return URL.createObjectURL(blob);
}

/**
 * Página em tamanho grande (para ver de perto qual é). Não fica guardada: quem
 * pede solta o endereço blob: com URL.revokeObjectURL quando não precisar mais.
 */
export async function paginaAmpliada(arquivo: File, n: number, largura: number): Promise<string> {
  const c = await desenharPagina(arquivo, n, largura);
  const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('Não foi possível desenhar a página.');
  return URL.createObjectURL(blob);
}

/**
 * Miniatura da página (endereço blob: para usar num <img>). Gerada na primeira
 * vez que é pedida e guardada até `fecharPdfs`.
 */
export function miniaturaDaPagina(arquivo: File, n: number): Promise<string> {
  let doArquivo = miniaturas.get(arquivo);
  if (!doArquivo) miniaturas.set(arquivo, (doArquivo = new Map()));
  let url = doArquivo.get(n);
  if (!url) {
    url = fila.then(() => gerarMiniatura(arquivo, n));
    fila = url.catch(() => undefined);
    const mapa = doArquivo;
    url.catch(() => mapa.delete(n));
    doArquivo.set(n, url);
  }
  return url;
}

/**
 * Texto que a própria página tem, com posição, no mesmo formato do OCR.
 * Vazio quando o PDF é digitalizado (página só com imagem).
 */
export async function textoDaPagina(arquivo: File, n: number, pagina: number): Promise<Segmento[]> {
  const pag = await (await abrir(arquivo)).getPage(n);
  const vp = pag.getViewport({ scale: 1 });
  const conteudo = await pag.getTextContent();
  const palavras: { texto: string; x0: number; x1: number; y0: number; y1: number }[] = [];
  for (const item of conteudo.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const t = item.transform as number[];
    const altura = item.height || Math.abs(t[3]) || 10;
    const y1 = vp.height - t[5];
    // um item do PDF pode ter várias palavras: separa, com a posição de cada
    // uma estimada pela proporção de caracteres (a montagem usa o x da palavra)
    const porChar = item.width / Math.max(item.str.length, 1);
    for (const m of item.str.matchAll(/\S+/g)) {
      const x0 = t[4] + (m.index ?? 0) * porChar;
      palavras.push({ texto: m[0], x0, x1: x0 + m[0].length * porChar, y0: y1 - altura, y1 });
    }
  }
  // agrupa em linhas (mesma altura, com tolerância) e quebra nas colunas
  palavras.sort((a, b) => a.y1 - b.y1 || a.x0 - b.x0);
  const segs: Segmento[] = [];
  let linha: typeof palavras = [];
  let yRef = 0;
  for (const p of palavras) {
    if (linha.length && Math.abs(p.y1 - yRef) > (p.y1 - p.y0) * 0.5) {
      segs.push(...trechosDaLinha(linha, pagina, vp.width));
      linha = [];
    }
    if (!linha.length) yRef = p.y1;
    linha.push(p);
  }
  segs.push(...trechosDaLinha(linha, pagina, vp.width));
  return segs;
}
