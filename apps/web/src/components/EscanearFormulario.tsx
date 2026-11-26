import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { NovaOpcao, NovaPergunta } from '../api/formularios';
import { lerArquivos, LeituraCancelada, MAX_IMAGENS, TAMANHO_MAXIMO, TIPOS_ACEITOS, type Andamento, type Fonte } from '../lib/ocr/ler';
import { contarPaginas, ehPdf, fecharPdfs, miniaturaDaPagina, paginaAmpliada } from '../lib/ocr/pdf';
import { lerOpcoesComuns, montarFormulario, type Segmento } from '../lib/ocr/montar';
import { nomeTipoPergunta, temOpcoes, TipoPergunta } from '../lib/perguntas';
import { plural } from '../lib/format';
import { Modal } from './Modal';
import { Alerta, MensagemErro } from './Form';
import { D, Ic, IcCheck, IcFechar, IcMais } from './icons';

/** Largura (px) com que a página ampliada é desenhada: nítida em telas de alta densidade. */
const largaAmpliada = () => Math.round(Math.min(1800, Math.max(900, 900 * (window.devicePixelRatio || 1))));

export interface FormularioImportado {
  titulo?: string;
  descricao?: string;
  perguntas: NovaPergunta[];
}

/** Uma foto escolhida (uma página). */
interface ArquivoFoto {
  id: number;
  tipo: 'foto';
  arquivo: File;
  url: string;
  nome: string;
}
/** Um PDF escolhido, com as páginas marcadas para ler (em ordem crescente). */
interface ArquivoPdf {
  id: number;
  tipo: 'pdf';
  arquivo: File;
  nome: string;
  total: number;
  marcadas: number[];
}
type Arquivo = ArquivoFoto | ArquivoPdf;

/** Uma página a ler, na ordem: uma foto ou uma página marcada de um PDF. */
interface Pagina {
  chave: string;
  idArquivo: number;
  fonte: Fonte;
  nome: string;
  /** só nas fotos; a miniatura da página de PDF é gerada quando aparece */
  url?: string;
}

type Etapa = 'selecao' | 'processando' | 'pronto';

const DICA = `Anexe fotos ou PDF de um formulário em papel (até ${MAX_IMAGENS} páginas por vez, do mesmo formulário; no PDF, você escolhe as páginas) para digitalizá-lo: as perguntas são criadas para você revisar antes de salvar.`;
const TIPOS_IMAGEM = TIPOS_ACEITOS.split(',').filter((t) => t.startsWith('image/'));

const escalaParaTexto = (ops: NovaOpcao[]) =>
  ops.map((o) => (o.valor_opcao !== undefined ? `${o.texto_opcao} = ${o.valor_opcao}` : o.texto_opcao)).join('\n');

const paginasALer = (arquivos: Arquivo[]): Pagina[] =>
  arquivos.flatMap<Pagina>((a) =>
    a.tipo === 'foto'
      ? [{ chave: String(a.id), idArquivo: a.id, fonte: { arquivo: a.arquivo }, nome: a.nome, url: a.url }]
      : a.marcadas.map((n) => ({
          chave: `${a.id}:${n}`,
          idArquivo: a.id,
          fonte: { arquivo: a.arquivo, pagina: n },
          nome: a.total > 1 ? `${a.nome} (pág. ${n})` : a.nome,
        })),
  );

const contarALer = (arquivos: Arquivo[]) => arquivos.reduce((n, a) => n + (a.tipo === 'foto' ? 1 : a.marcadas.length), 0);

let proximoId = 1;

/**
 * Prepara os arquivos escolhidos: foto = 1 página; PDF = todas as páginas
 * disponíveis para marcar. Um PDF que cabe inteiro nas `vagas` já vem com
 * todas marcadas; um PDF maior que as vagas vem sem nenhuma marcada, e o
 * usuário escolhe quais ler. Diz o que ficou de fora.
 */
async function paraArquivos(lista: File[], vagas: number): Promise<{ novos: Arquivo[]; aviso: string | null }> {
  const avisos: string[] = [];
  const novos: Arquivo[] = [];
  let foraDoLimite = 0;
  for (const f of lista) {
    const pdf = ehPdf(f);
    if (!pdf && !TIPOS_IMAGEM.includes(f.type)) {
      avisos.push(`“${f.name}” não é imagem (PNG, JPG ou WEBP) nem PDF.`);
      continue;
    }
    if (f.size > TAMANHO_MAXIMO) {
      avisos.push(`“${f.name}” passa de 20 MB.`);
      continue;
    }
    if (!pdf) {
      if (vagas <= 0) foraDoLimite++;
      else {
        novos.push({ id: proximoId++, tipo: 'foto', arquivo: f, url: URL.createObjectURL(f), nome: f.name });
        vagas--;
      }
      continue;
    }
    try {
      const total = await contarPaginas(f);
      // PDF de uma página sem vaga não teria onde ser marcado: fica de fora
      if (total === 1 && vagas <= 0) {
        foraDoLimite++;
        continue;
      }
      // não marca "as primeiras N" de um PDF que não cabe inteiro: quem escolhe é o usuário
      const n = total <= vagas ? total : 0;
      novos.push({ id: proximoId++, tipo: 'pdf', arquivo: f, nome: f.name, total, marcadas: Array.from({ length: n }, (_, i) => i + 1) });
      vagas -= n;
    } catch {
      avisos.push(`Não foi possível abrir “${f.name}”: o PDF pode estar protegido por senha ou corrompido.`);
    }
  }
  if (foraDoLimite)
    avisos.push(`São até ${MAX_IMAGENS} páginas por vez: ${plural(foraDoLimite, 'página ficou de fora', 'páginas ficaram de fora')}.`);
  return { novos, aviso: avisos.join(' ') || null };
}

/**
 * Lê o que o usuário digitou na escolha de páginas: números e intervalos,
 * como "1-3, 8" ou "10 a 12". Devolve as páginas em ordem, sem repetir.
 */
export function lerFaixaDePaginas(texto: string, total: number): { paginas: number[] } | { erro: string } {
  const limpo = texto.trim().replace(/(\d)\s*(?:-|–|—|a|até)\s*(?=\d)/gi, '$1-');
  if (!limpo) return { erro: 'Digite as páginas, por exemplo: 1-3, 8.' };
  const paginas = new Set<number>();
  for (const pedaco of limpo.split(/[\s,;e]+/i).filter(Boolean)) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(pedaco);
    if (!m) return { erro: `Não entendi “${pedaco}”. Use números e intervalos, por exemplo: 1-3, 8.` };
    let de = Number(m[1]);
    let ate = Number(m[2] ?? m[1]);
    if (de > ate) [de, ate] = [ate, de];
    if (de < 1 || ate > total) return { erro: `O PDF tem ${plural(total, 'página', 'páginas')}: “${pedaco}” fica fora.` };
    for (let n = de; n <= ate; n++) paginas.add(n);
  }
  return { paginas: [...paginas].sort((a, b) => a - b) };
}

/**
 * Miniatura de uma página de PDF, gerada só quando aparece na tela (num PDF
 * grande, desenhar todas de uma vez travaria a janela).
 */
function MiniaturaPdf({ arquivo, n }: { arquivo: File; n: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let vivo = true;
    const io = new IntersectionObserver(
      (es) => {
        if (!es.some((e) => e.isIntersecting)) return;
        io.disconnect();
        miniaturaDaPagina(arquivo, n).then(
          (u) => vivo && setUrl(u),
          () => vivo && setFalhou(true),
        );
      },
      { rootMargin: '160px' },
    );
    io.observe(el);
    return () => {
      vivo = false;
      io.disconnect();
    };
  }, [arquivo, n]);
  return url ? <img src={url} alt="" /> : <span ref={ref} className={'mini-carregando' + (falhou ? ' falhou' : '')} aria-hidden="true" />;
}

/**
 * Botão "Escanear com IA" e a janela da digitalização. O botão abre a escolha
 * de fotos ou PDF; escolhidos, a janela mostra as miniaturas das páginas a ler
 * (no PDF, o usuário marca quais) e, ao processar, cada uma ganha a animação de
 * leitura enquanto é lida (OCR com o Tesseract, rede neural LSTM; PDF com
 * texto é lido direto). Nada é salvo aqui: as perguntas vão para o editor.
 */
export function EscanearComIA({ aoUsar, pequeno = false }: { aoUsar: (f: FormularioImportado) => void; pequeno?: boolean }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<Arquivo[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  /** abrindo os PDFs (leva um instante) */
  const [abrindo, setAbrindo] = useState(false);

  // libera as fotos e os PDFs da memória quando a janela fecha
  const urls = useRef<string[]>([]);
  useEffect(
    () => () => {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      fecharPdfs();
    },
    [],
  );

  async function adicionar(lista: FileList | null) {
    const escolhidos = Array.from(lista ?? []);
    if (!escolhidos.length) return;
    const atuais = arquivos ?? [];
    // a janela abre na hora; os PDFs chegam em seguida
    setArquivos(atuais);
    setAbrindo(true);
    const { novos, aviso: a } = await paraArquivos(escolhidos, MAX_IMAGENS - contarALer(atuais));
    urls.current.push(...novos.flatMap((n) => (n.tipo === 'foto' ? [n.url] : [])));
    setAbrindo(false);
    setAviso(a);
    setArquivos((agora) => (agora ? [...agora, ...novos] : agora));
  }

  function fechar() {
    // libera as fotos só depois da animação de saída: a cópia animada da
    // janela ainda mostra as <img> por ~300 ms (as miniaturas de PDF, idem, em fecharPdfs)
    const soltar = urls.current;
    urls.current = [];
    setTimeout(() => soltar.forEach((u) => URL.revokeObjectURL(u)), 1000);
    fecharPdfs();
    setArquivos(null);
    setAviso(null);
  }

  return (
    <>
      <button
        type="button"
        className={'btn-escanear' + (pequeno ? ' sm' : '')}
        data-tip={DICA}
        data-tip-pos="bottom"
        onClick={() => entrada.current?.click()}
      >
        <Ic d={D.importar} />
        <strong>Escanear com IA</strong>
      </button>
      <input
        ref={entrada}
        type="file"
        hidden
        multiple
        accept={TIPOS_ACEITOS}
        onChange={(e) => {
          void adicionar(e.target.files);
          e.target.value = '';
        }}
      />
      {/* A janela vai para o contêiner do painel (.ps.app), fora do painel onde
          o botão está (animação/overflow dele atrapalhariam a posição fixa).
          Tem que ficar dentro do .ps: a animação de saída (behaviors/modal.js)
          copia a janela para o mesmo pai, e fora do .ps a cópia sai sem estilo. */}
      {arquivos &&
        createPortal(
          <JanelaEscanear
            arquivos={arquivos}
            aviso={aviso}
            abrindo={abrindo}
            aoMudar={setArquivos}
            aoAdicionar={adicionar}
            aoUsar={(f) => {
              fechar();
              aoUsar(f);
            }}
            aoFechar={fechar}
          />,
          document.querySelector('.ps.app') ?? document.body,
        )}
    </>
  );
}

/**
 * Escolha das páginas de um PDF: miniatura de cada página com caixa de marcar,
 * e um campo para digitar as páginas (útil em PDF longo). `limite` = quantas
 * páginas deste PDF cabem, descontadas as marcadas nos outros arquivos.
 */
function EscolherPaginas({
  pdf,
  limite,
  aoMarcar,
  aoTirar,
}: {
  pdf: ArquivoPdf;
  limite: number;
  aoMarcar: (marcadas: number[]) => void;
  aoTirar: () => void;
}) {
  const id = `pdf-${pdf.id}`;
  const [faixa, setFaixa] = useState('');
  const [erroFaixa, setErroFaixa] = useState<string | null>(null);
  /** página aberta em tamanho grande */
  const [ampliada, setAmpliada] = useState<number | null>(null);
  const marcadas = new Set(pdf.marcadas);
  const cheio = pdf.marcadas.length >= limite;

  const alternar = (n: number) =>
    aoMarcar(marcadas.has(n) ? pdf.marcadas.filter((x) => x !== n) : [...pdf.marcadas, n].sort((a, b) => a - b));

  function aplicar() {
    const r = lerFaixaDePaginas(faixa, pdf.total);
    if ('erro' in r) return setErroFaixa(r.erro);
    if (r.paginas.length > limite)
      return setErroFaixa(
        limite === MAX_IMAGENS
          ? `São até ${MAX_IMAGENS} páginas por vez: você indicou ${r.paginas.length}.`
          : `Cabem mais ${plural(limite, 'página', 'páginas')} deste PDF (são até ${MAX_IMAGENS} por vez, somando os outros arquivos): você indicou ${r.paginas.length}.`,
      );
    setErroFaixa(null);
    aoMarcar(r.paginas);
  }

  return (
    <section className="escolher-paginas" aria-labelledby={`${id}-tit`}>
      <div className="ep-topo">
        <div className="ep-titulo">
          <h3 id={`${id}-tit`}>Páginas de “{pdf.nome}”</h3>
          <p>
            {plural(pdf.total, 'página', 'páginas')} ·{' '}
            {pdf.marcadas.length ? plural(pdf.marcadas.length, 'marcada', 'marcadas') : 'nenhuma marcada'}. Marque as que têm o
            formulário.
          </p>
        </div>
        <div className="ep-acoes">
          {pdf.marcadas.length > 0 && (
            <button type="button" className="ps-btn tertiary sm" onClick={() => aoMarcar([])}>
              Desmarcar todas
            </button>
          )}
          <button type="button" className="ps-btn tertiary sm" onClick={aoTirar}>
            <Ic d={D.lixeira} />
            Tirar este PDF
          </button>
        </div>
      </div>

      <div className="ep-faixa">
        <label className="ps-label" htmlFor={`${id}-faixa`}>
          Ou digite as páginas
        </label>
        <div className="ep-faixa-linha">
          <div className={'ps-control' + (erroFaixa ? ' is-error' : '')}>
            <input
              id={`${id}-faixa`}
              type="text"
              placeholder="ex.: 1-3, 8"
              value={faixa}
              onChange={(e) => {
                // só números inteiros e os separadores da faixa ("1-3, 8"): letras e outros caracteres não entram
                setFaixa(e.target.value.replace(/[–—]/g, '-').replace(/[^\d\s,-]/g, ''));
                setErroFaixa(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  aplicar();
                }
              }}
              aria-invalid={!!erroFaixa || undefined}
              aria-describedby={erroFaixa ? `${id}-faixa-erro` : undefined}
            />
          </div>
          <button type="button" className="ps-btn secondary" onClick={aplicar}>
            Marcar
          </button>
        </div>
        {erroFaixa && <MensagemErro id={`${id}-faixa-erro`}>{erroFaixa}</MensagemErro>}
      </div>

      <ul className="grade-paginas" aria-label={`Páginas de ${pdf.nome}`}>
        {Array.from({ length: pdf.total }, (_, i) => i + 1).map((n) => {
          const on = marcadas.has(n);
          const bloqueada = !on && cheio;
          return (
            <li key={n}>
              <label
                className={'pagina-pdf' + (on ? ' is-marcada' : '') + (bloqueada ? ' is-bloqueada' : '')}
                data-tip={bloqueada ? `São até ${MAX_IMAGENS} páginas por vez: desmarque outra para marcar esta.` : undefined}
              >
                <input
                  type="checkbox"
                  className="ps-sr"
                  checked={on}
                  disabled={bloqueada}
                  onChange={() => alternar(n)}
                  aria-label={`Página ${n}`}
                />
                <MiniaturaPdf arquivo={pdf.arquivo} n={n} />
                <span className="marca" aria-hidden="true">
                  {on && <IcCheck />}
                </span>
                <span className="num" aria-hidden="true">
                  {n}
                </span>
              </label>
              {/* fora do <label>: clicar aqui amplia a página, sem marcar/desmarcar */}
              <button
                type="button"
                className="ampliar"
                aria-label={`Ampliar a página ${n}`}
                data-tip="Ampliar a página"
                onClick={() => setAmpliada(n)}
              >
                <Ic d={D.telaCheia} />
              </button>
            </li>
          );
        })}
      </ul>

      {ampliada !== null && (
        <VerPagina
          fonte={fontePdf(pdf.arquivo, ampliada, pdf.nome)}
          pos={ampliada - 1}
          total={pdf.total}
          titulo={`Página ${ampliada} de ${pdf.total}`}
          subtitulo={pdf.nome}
          aoIr={(i) => setAmpliada(i + 1)}
          aoFechar={() => setAmpliada(null)}
          aoEnter={() => (marcadas.has(ampliada) || !cheio) && alternar(ampliada)}
          rotuloEnter="marcar/desmarcar"
          acao={
            <BotaoMarcar
              marcada={marcadas.has(ampliada)}
              podeMarcar={marcadas.has(ampliada) || !cheio}
              aoAlternar={() => alternar(ampliada)}
            />
          }
        />
      )}
    </section>
  );
}

/** "Marcar esta página" na visualização ampliada de um PDF. */
function BotaoMarcar({ marcada, podeMarcar, aoAlternar }: { marcada: boolean; podeMarcar: boolean; aoAlternar: () => void }) {
  return (
    <button
      type="button"
      className={'vp-btn marcar' + (marcada ? ' is-on' : '')}
      aria-pressed={marcada}
      onClick={aoAlternar}
      disabled={!podeMarcar}
      aria-keyshortcuts="Enter"
      title={podeMarcar ? 'Tecla Enter' : `São até ${MAX_IMAGENS} páginas por vez: desmarque outra para marcar esta.`}
    >
      {marcada ? <IcCheck /> : <IcMais />}
      {marcada ? 'Página marcada' : 'Marcar esta página'}
    </button>
  );
}

/** O que a visualização ampliada mostra: uma página de PDF ou uma foto. */
interface FonteVista {
  /** muda quando a página muda (recarrega a imagem e volta o zoom) */
  chave: string;
  alt: string;
  /** imagem que aparece na hora (miniatura do PDF ou a própria foto) */
  previa: () => Promise<string> | string;
  /** só no PDF: desenha a página na largura pedida (blob: que a visualização solta) */
  nitida?: (largura: number) => Promise<string>;
}

const fontePdf = (arquivo: File, n: number, nome: string): FonteVista => ({
  chave: `${nome}:${n}:${arquivo.size}:${arquivo.lastModified}`,
  alt: `Página ${n} do PDF ${nome}`,
  previa: () => miniaturaDaPagina(arquivo, n),
  nitida: (largura) => paginaAmpliada(arquivo, n, largura),
});

const ZOOM_MAX = 5;
/** maior largura (px) com que a página é redesenhada ao aproximar */
const LARGURA_MAX = 3200;
const limitarZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(1, Math.round(z * 100) / 100));

/**
 * Página em tamanho grande, por cima da janela de escanear, para o usuário ver
 * qual é. Mostra a prévia na hora e troca pela versão nítida quando fica
 * pronta (e redesenha com mais resolução ao aproximar).
 * Zoom: botões − / +, roda do mouse ou pinça, duplo clique; aproximada, a
 * página é arrastada para os lados. Setas do teclado (ou os botões) passam de
 * página; + / − / 0 controlam o zoom; Enter faz a ação da página (ex.: marcar).
 * Esc fecha só esta visualização.
 */
function VerPagina({
  fonte,
  pos,
  total,
  titulo,
  subtitulo,
  acao,
  aoEnter,
  rotuloEnter,
  aoIr,
  aoFechar,
}: {
  fonte: FonteVista;
  /** posição (0, 1...) entre as `total` páginas navegáveis */
  pos: number;
  total: number;
  titulo: string;
  subtitulo: string;
  /** botão do meio, entre Anterior e Próxima (ex.: marcar a página) */
  acao?: ReactNode;
  /** tecla Enter (ex.: marcar/desmarcar a página) e o nome dela na linha de atalhos */
  aoEnter?: () => void;
  rotuloEnter?: string;
  aoIr: (pos: number) => void;
  aoFechar: () => void;
}) {
  const [previa, setPrevia] = useState<string | null>(null);
  const [nitida, setNitida] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [larguraPedida, setLarguraPedida] = useState(largaAmpliada);
  const [zoom, setZoom] = useState(1);
  /** tamanho da página ajustada à tela (zoom 1), medido na área disponível */
  const [ajuste, setAjuste] = useState<{ w: number; h: number } | null>(null);

  const folha = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const fonteRef = useRef(fonte);
  fonteRef.current = fonte;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  /** ponto da página que deve ficar parado na tela depois do zoom */
  const ancora = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const nitidaUrl = useRef<string | null>(null);

  const tem = { ant: pos > 0, prox: pos < total - 1 };
  const temNitida = !!fonte.nitida;

  function trocarNitida(url: string | null) {
    if (nitidaUrl.current) URL.revokeObjectURL(nitidaUrl.current);
    nitidaUrl.current = url;
    setNitida(url);
  }
  useEffect(() => () => void (nitidaUrl.current && URL.revokeObjectURL(nitidaUrl.current)), []);

  // página nova: prévia na hora, zoom de volta ao ajuste
  useEffect(() => {
    let vivo = true;
    setPrevia(null);
    trocarNitida(null);
    setFalhou(false);
    setZoom(1);
    setLarguraPedida(largaAmpliada());
    Promise.resolve(fonteRef.current.previa()).then(
      (u) => vivo && setPrevia(u),
      () => vivo && setFalhou(true),
    );
    return () => {
      vivo = false;
    };
  }, [fonte.chave]);

  // versão nítida (PDF): na largura pedida; ao aproximar, a largura sobe
  useEffect(() => {
    const gerar = fonteRef.current.nitida;
    if (!gerar) return;
    let vivo = true;
    gerar(larguraPedida).then(
      (u) => (vivo ? trocarNitida(u) : URL.revokeObjectURL(u)),
      () => vivo && setFalhou(true),
    );
    return () => {
      vivo = false;
    };
  }, [fonte.chave, larguraPedida]);

  // aproximou além da resolução desenhada: redesenha maior (depois de parar)
  useEffect(() => {
    if (!temNitida || !ajuste || zoom === 1) return;
    const precisa = Math.min(LARGURA_MAX, Math.ceil(ajuste.w * zoom * (window.devicePixelRatio || 1)));
    if (precisa <= larguraPedida * 1.15) return;
    const t = setTimeout(() => setLarguraPedida(precisa), 300);
    return () => clearTimeout(t);
  }, [temNitida, ajuste, zoom, larguraPedida]);

  // tamanho ajustado à tela: na carga da imagem e quando a área muda
  const medir = useCallback(() => {
    const c = folha.current;
    const i = img.current;
    if (!c || !i || !i.naturalWidth) return;
    const proporcao = i.naturalWidth / i.naturalHeight;
    // offsetWidth/Height incluem a barra de rolagem: a medida não muda quando ela aparece
    const w = Math.floor(Math.min(c.offsetWidth, c.offsetHeight * proporcao));
    setAjuste((a) => (a && a.w === w ? a : { w, h: Math.floor(w / proporcao) }));
  }, []);
  useEffect(() => {
    const c = folha.current;
    if (!c) return;
    const obs = new ResizeObserver(medir);
    obs.observe(c);
    return () => obs.disconnect();
  }, [medir]);

  /** zoom mantendo parado o ponto (da tela) sob o cursor; sem ponto, o centro */
  const zoomPara = useCallback((novo: number, ponto?: { x: number; y: number }) => {
    const c = folha.current;
    const i = img.current;
    const z = limitarZoom(novo);
    if (!c || !i || z === zoomRef.current) return;
    const rc = c.getBoundingClientRect();
    const ri = i.getBoundingClientRect();
    const p = ponto ?? { x: rc.left + rc.width / 2, y: rc.top + rc.height / 2 };
    const dentro = (v: number) => Math.min(1, Math.max(0, v));
    ancora.current = { ...p, fx: dentro((p.x - ri.left) / ri.width), fy: dentro((p.y - ri.top) / ri.height) };
    setZoom(z);
  }, []);

  useLayoutEffect(() => {
    const a = ancora.current;
    const c = folha.current;
    const i = img.current;
    ancora.current = null;
    if (!a || !c || !i) return;
    const r = i.getBoundingClientRect();
    c.scrollLeft += r.left - (a.x - a.fx * r.width);
    c.scrollTop += r.top - (a.y - a.fy * r.height);
  }, [zoom]);

  // roda do mouse / pinça no trackpad: zoom (precisa de listener não passivo)
  useEffect(() => {
    const c = folha.current;
    if (!c) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      // a pinça do trackpad chega como roda com Ctrl e passos pequenos
      zoomPara(zoomRef.current * Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.0018)), { x: e.clientX, y: e.clientY });
    };
    c.addEventListener('wheel', roda, { passive: false });
    return () => c.removeEventListener('wheel', roda);
  }, [zoomPara]);

  // arrastar (um dedo/mouse) move a página aproximada; dois dedos = pinça
  const toques = useRef(new Map<number, { x: number; y: number }>());
  const arrasto = useRef<{ x: number; y: number; sl: number; st: number; moveu: boolean; noFundo: boolean } | null>(null);
  const pinca = useRef<{ d: number; z: number } | null>(null);
  const distancia = () => {
    const [a, b] = [...toques.current.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  function aoApertar(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const c = e.currentTarget;
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.current.size === 2) {
      pinca.current = { d: distancia(), z: zoomRef.current };
      arrasto.current = null;
      for (const id of toques.current.keys()) capturar(c, id);
    } else if (toques.current.size === 1) {
      const noFundo = e.target === c;
      arrasto.current = { x: e.clientX, y: e.clientY, sl: c.scrollLeft, st: c.scrollTop, moveu: false, noFundo };
    }
  }
  /** captura só ao arrastar: capturar no clique desviaria o duplo clique da imagem */
  const capturar = (c: HTMLElement, id: number) => {
    try {
      c.setPointerCapture(id);
    } catch {
      /* ponteiro já solto */
    }
  };
  function aoMover(e: React.PointerEvent<HTMLDivElement>) {
    if (!toques.current.has(e.pointerId)) return;
    toques.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const c = e.currentTarget;
    if (pinca.current && toques.current.size === 2) {
      const [a, b] = [...toques.current.values()];
      zoomPara(pinca.current.z * (distancia() / pinca.current.d), { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      return;
    }
    const d = arrasto.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moveu && Math.abs(dx) + Math.abs(dy) > 4) {
      d.moveu = true;
      capturar(c, e.pointerId);
    }
    if (zoomRef.current > 1) {
      c.scrollLeft = d.sl - dx;
      c.scrollTop = d.st - dy;
    }
  }
  function aoSoltar(e: React.PointerEvent<HTMLDivElement>) {
    toques.current.delete(e.pointerId);
    if (toques.current.size < 2) pinca.current = null;
    // clique no fundo (sem arrastar e sem zoom) fecha
    const d = arrasto.current;
    if (e.type === 'pointerup' && d && !d.moveu && d.noFundo && zoomRef.current === 1) aoFechar();
    if (!toques.current.size) arrasto.current = null;
  }

  // foco na própria visualização ao abrir (não num botão: assim o Enter marca a
  // página em vez de acionar o botão focado); volta para o botão de ampliar ao fechar
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    caixa.current?.focus({ preventScroll: true });
    return () => anterior?.focus({ preventScroll: true });
  }, []);

  // na captura, para o Esc não chegar à janela de escanear (que fecharia junto).
  // + / − / 0 funcionam sozinhos ou com Ctrl/Cmd: aí o zoom é da página, não do navegador.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape') {
        e.stopPropagation();
        aoFechar();
      } else if (e.altKey) return;
      else if (e.key === 'ArrowLeft' && !mod && tem.ant) aoIr(pos - 1);
      else if (e.key === 'ArrowRight' && !mod && tem.prox) aoIr(pos + 1);
      else if (e.key === '+' || e.key === '=') zoomPara(zoomRef.current * 1.25);
      else if (e.key === '-' || e.key === '_') zoomPara(zoomRef.current / 1.25);
      else if (e.key === '0') zoomPara(1);
      else if (e.key === 'Enter' && !mod && !e.shiftKey && !e.repeat && aoEnter) {
        // botão focado pelo teclado (Tab): o Enter aciona ele, como de costume
        const foco = document.activeElement;
        if (foco instanceof HTMLButtonElement && foco.matches(':focus-visible')) return;
        aoEnter();
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', tecla, true);
    return () => window.removeEventListener('keydown', tecla, true);
  }, [pos, tem.ant, tem.prox, aoFechar, aoIr, aoEnter, zoomPara]);

  const src = nitida ?? previa;
  const carregando = temNitida ? !nitida : !previa;
  const fundo = (e: React.MouseEvent) => e.target === e.currentTarget && aoFechar();
  return createPortal(
    <div
      ref={caixa}
      tabIndex={-1}
      className="ver-pagina"
      role="dialog"
      aria-modal="true"
      aria-label={`${titulo}: ${subtitulo}`}
      onClick={fundo}
    >
      <div className="vp-barra">
        <p className="vp-titulo">
          <strong>{titulo}</strong>
          <span>{subtitulo}</span>
        </p>
        <div className="vp-zoom" role="group" aria-label="Zoom">
          <button
            type="button"
            className="vp-btn icone"
            aria-label="Diminuir o zoom"
            aria-keyshortcuts="- Control+-"
            data-tip="Diminuir o zoom (tecla −)"
            onClick={() => zoomPara(zoom / 1.25)}
            disabled={zoom <= 1}
          >
            <Ic d={D.menos} />
          </button>
          <button
            type="button"
            className="vp-btn vp-pct"
            aria-label={`Zoom de ${Math.round(zoom * 100)}%. Ajustar à tela`}
            aria-keyshortcuts="0 Control+0"
            data-tip="Ajustar à tela (tecla 0)"
            onClick={() => zoomPara(1)}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            type="button"
            className="vp-btn icone"
            aria-label="Aumentar o zoom"
            aria-keyshortcuts="+ Control+="
            data-tip="Aumentar o zoom (tecla +)"
            onClick={() => zoomPara(zoom * 1.25)}
            disabled={zoom >= ZOOM_MAX}
          >
            <IcMais />
          </button>
        </div>
        <button type="button" className="vp-btn icone" aria-label="Fechar a página ampliada" onClick={aoFechar}>
          <IcFechar />
        </button>
      </div>

      <div
        ref={folha}
        className={'vp-folha' + (zoom > 1 ? ' is-zoom' : '') + (carregando ? ' is-carregando' : '')}
        onPointerDown={aoApertar}
        onPointerMove={aoMover}
        onPointerUp={aoSoltar}
        onPointerCancel={aoSoltar}
        onPointerLeave={aoSoltar}
        onDoubleClick={(e) => e.target === img.current && zoomPara(zoom > 1 ? 1 : 2.5, { x: e.clientX, y: e.clientY })}
      >
        {src && (
          <img
            ref={img}
            src={src}
            alt={fonte.alt}
            draggable={false}
            onLoad={medir}
            className={ajuste ? 'is-medida' : undefined}
            style={ajuste ? { width: ajuste.w * zoom, height: ajuste.h * zoom } : undefined}
          />
        )}
        {(carregando || falhou) && (
          <span className="vp-status" role="status">
            {falhou ? 'Não foi possível ampliar esta página.' : 'Carregando a página…'}
          </span>
        )}
      </div>

      <p className="vp-dica" onClick={fundo}>
        <kbd>+</kbd> <kbd>−</kbd> zoom · <kbd>0</kbd> ajustar · roda do mouse ou duplo clique para aproximar · arraste para mover ·{' '}
        <kbd>←</kbd> <kbd>→</kbd> páginas ·{' '}
        {aoEnter && rotuloEnter && (
          <>
            <kbd>Enter</kbd> {rotuloEnter} ·{' '}
          </>
        )}
        <kbd>Esc</kbd> fechar
      </p>

      <div className="vp-barra vp-acoes" onClick={fundo}>
        <button type="button" className="vp-btn" onClick={() => aoIr(pos - 1)} disabled={!tem.ant} aria-label="Página anterior">
          <Ic d={D.chevronEsq} />
          <span className="vp-rotulo">Anterior</span>
        </button>
        {acao}
        <button type="button" className="vp-btn" onClick={() => aoIr(pos + 1)} disabled={!tem.prox} aria-label="Próxima página">
          <span className="vp-rotulo">Próxima</span>
          <Ic d={D.chevronDir} />
        </button>
      </div>
    </div>,
    document.querySelector('.ps.app') ?? document.body,
  );
}

function JanelaEscanear({
  arquivos,
  aviso,
  abrindo,
  aoMudar,
  aoAdicionar,
  aoUsar,
  aoFechar,
}: {
  arquivos: Arquivo[];
  aviso: string | null;
  abrindo: boolean;
  aoMudar: (l: Arquivo[]) => void;
  aoAdicionar: (l: FileList | null) => void;
  aoUsar: (f: FormularioImportado) => void;
  aoFechar: () => void;
}) {
  const mais = useRef<HTMLInputElement>(null);
  const [etapa, setEtapa] = useState<Etapa>('selecao');
  const [andamento, setAndamento] = useState<Andamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [comuns, setComuns] = useState('');
  /** página "para ler" aberta em tamanho grande (posição na lista) */
  const [vendo, setVendo] = useState<number | null>(null);
  const cancelar = useRef<AbortController | null>(null);

  const paginas = useMemo(() => paginasALer(arquivos), [arquivos]);
  // tirou a página que estava aberta (ou a última): mostra a vizinha, ou fecha
  const pVendo = vendo === null ? null : (paginas[Math.min(vendo, paginas.length - 1)] ?? null);
  const pdfsParaEscolher = arquivos.filter((a): a is ArquivoPdf => a.tipo === 'pdf' && a.total > 1);
  // sem as opções em comum: quantas perguntas ficaram sem opções e a escala achada
  const base = useMemo(() => montarFormulario(segmentos), [segmentos]);
  const resultado = useMemo(() => montarFormulario(segmentos, lerOpcoesComuns(comuns)), [segmentos, comuns]);
  const semOpcoes = base.perguntas.filter((p) => p.id_tipo_pergunta === TipoPergunta.TEXTO).length;
  const nPerg = resultado.perguntas.length;
  const cheio = paginas.length >= MAX_IMAGENS;

  async function processar() {
    setErro(null);
    setEtapa('processando');
    setAndamento({ indice: 0, fase: 'lendo', fracao: 0 });
    const controle = new AbortController();
    cancelar.current = controle;
    try {
      const segs = await lerArquivos(
        paginas.map((p) => p.fonte),
        setAndamento,
        controle.signal,
      );
      const achado = montarFormulario(segs);
      setSegmentos(segs);
      setComuns(achado.escalaSugerida ? escalaParaTexto(achado.escalaSugerida) : '');
      setEtapa('pronto');
    } catch (e) {
      if (e instanceof LeituraCancelada) return;
      setErro(
        'Não foi possível ler as páginas. Na primeira vez o navegador baixa o leitor de texto: confira a internet e tente de novo.' +
          (e instanceof Error && e.message ? ` (${e.message})` : ''),
      );
      setEtapa('selecao');
    } finally {
      cancelar.current = null;
    }
  }

  function fechar() {
    cancelar.current?.abort();
    aoFechar();
  }

  /** muda os arquivos; sem nenhum, fecha a janela */
  function mudar(resto: Arquivo[]) {
    if (resto.length) aoMudar(resto);
    else fechar();
  }

  /** "x" na miniatura: tira a foto (ou o PDF de uma página), ou desmarca a página do PDF */
  function tirar(p: Pagina) {
    const a = arquivos.find((x) => x.id === p.idArquivo);
    if (!a) return;
    if (a.tipo === 'foto' || a.total === 1) {
      mudar(arquivos.filter((x) => x.id !== a.id));
      if (a.tipo === 'foto') setTimeout(() => URL.revokeObjectURL(a.url), 1000);
    } else mudar(arquivos.map((x) => (x.id === a.id ? { ...a, marcadas: a.marcadas.filter((n) => n !== p.fonte.pagina) } : x)));
  }

  /** estado de cada miniatura durante a leitura */
  const estadoDa = (i: number): 'espera' | 'lendo' | 'pronta' => {
    if (etapa === 'pronto') return 'pronta';
    if (etapa !== 'processando' || !andamento) return 'espera';
    if (i < andamento.indice || (i === andamento.indice && andamento.fase === 'concluida')) return 'pronta';
    return i === andamento.indice ? 'lendo' : 'espera';
  };

  const status = abrindo
    ? 'Abrindo os arquivos…'
    : etapa === 'processando' && andamento
      ? andamento.fase === 'preparando'
        ? 'Preparando o leitor (só na primeira vez demora mais)…'
        : `Lendo ${paginas.length > 1 ? `a página ${Math.min(andamento.indice + 1, paginas.length)} de ${paginas.length}` : 'a página'}…`
      : null;

  const rodape =
    etapa === 'selecao' ? (
      <>
        {(erro || aviso) && (
          <div className="erro-rodape">
            <MensagemErro>{erro ?? aviso}</MensagemErro>
          </div>
        )}
        <button type="button" className="ps-btn secondary cancelar" onClick={fechar}>
          Cancelar
        </button>
        <button
          type="button"
          className="ps-btn primary"
          onClick={() => mais.current?.click()}
          disabled={cheio || abrindo}
        >
          <IcMais />
          Selecionar mais imagens
        </button>
        <button type="button" className="ps-btn primary processar" onClick={() => void processar()} disabled={!paginas.length || abrindo}>
          Processar
        </button>
      </>
    ) : etapa === 'processando' ? (
      <button type="button" className="ps-btn secondary cancelar" onClick={fechar}>
        Cancelar
      </button>
    ) : (
      <>
        <button type="button" className="ps-btn secondary cancelar" onClick={fechar}>
          Cancelar
        </button>
        <button type="button" className="ps-btn secondary" onClick={() => setEtapa('selecao')}>
          Voltar às imagens
        </button>
        <button
          type="button"
          className="ps-btn primary"
          disabled={!nPerg}
          onClick={() =>
            aoUsar({
              titulo: resultado.titulo,
              descricao: resultado.descricao,
              perguntas: resultado.perguntas,
            })
          }
        >
          {nPerg ? `Usar ${plural(nPerg, 'pergunta', 'perguntas')}` : 'Usar perguntas'}
        </button>
      </>
    );

  return (
    <Modal
      vidro
      alta
      classe="janela-escanear"
      // os dois botões do rodapé são "primary": o foco inicial vai para o Processar
      focoInicial="footer .ps-btn.processar"
      largura={760}
      titulo="Escanear formulário com IA"
      subtitulo={
        etapa === 'pronto'
          ? 'Confira o que foi lido. Depois você ainda revisa cada pergunta no editor antes de salvar.'
          : `Fotos e PDF são lidos aqui no seu navegador, na ordem das páginas. Até ${MAX_IMAGENS} páginas por vez.`
      }
      aoFechar={fechar}
      fecharNoX
      estiloCorpo={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      rodape={rodape}
    >
      {etapa === 'selecao' && !abrindo && (
        <p className="escanear-contagem">
          <strong>
            {paginas.length} de {MAX_IMAGENS}
          </strong>{' '}
          {paginas.length === 1 ? 'página para ler' : 'páginas para ler'}
        </p>
      )}
      {paginas.length === 0 && pdfsParaEscolher.length > 0 ? (
        <p className="escanear-vazio">Nenhuma página marcada. Marque abaixo as páginas do PDF que devem ser lidas.</p>
      ) : (
        <ol className={'escanear-miniaturas is-' + etapa} aria-label="Páginas a ler">
          {paginas.map((p, i) => {
            const estado = estadoDa(i);
            const fracao = estado === 'lendo' && andamento?.fase === 'lendo' ? (andamento.fracao ?? 0) : undefined;
            return (
              <li
                key={p.chave}
                className={'miniatura is-' + estado}
                aria-label={`Página ${i + 1}: ${p.nome}${estado === 'lendo' ? ', em leitura' : estado === 'pronta' ? ', lida' : ''}`}
              >
                {p.url ? <img src={p.url} alt="" /> : <MiniaturaPdf arquivo={p.fonte.arquivo} n={p.fonte.pagina ?? 1} />}
                {estado === 'lendo' && <span className="brilho" aria-hidden="true" />}
                {estado === 'pronta' && (
                  <span className="selo-ok" aria-hidden="true">
                    <IcCheck />
                  </span>
                )}
                {fracao !== undefined && (
                  <span className="barra" aria-hidden="true">
                    <i style={{ width: `${Math.round(fracao * 100)}%` }} />
                  </span>
                )}
                <span className="pag" aria-hidden="true">
                  {p.fonte.pagina !== undefined && p.nome !== p.fonte.arquivo.name ? `pág. ${p.fonte.pagina}` : i + 1}
                </span>
                {etapa !== 'processando' && (
                  <button
                    type="button"
                    className="ampliar"
                    aria-label={`Ampliar a página ${i + 1} para ler`}
                    data-tip="Ampliar a página"
                    onClick={() => setVendo(i)}
                  >
                    <Ic d={D.telaCheia} />
                  </button>
                )}
                {etapa === 'selecao' && (
                  <button
                    type="button"
                    className="tirar"
                    aria-label={p.fonte.pagina !== undefined ? `Desmarcar a página ${p.fonte.pagina} do PDF` : `Tirar a página ${i + 1}`}
                    data-tip={p.fonte.pagina !== undefined && p.nome !== p.fonte.arquivo.name ? 'Desmarcar esta página' : 'Tirar esta página'}
                    onClick={() => tirar(p)}
                  >
                    <IcFechar />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {pVendo && vendo !== null && etapa !== 'processando' && (
        <VerPagina
          fonte={
            pVendo.url
              ? { chave: pVendo.chave, alt: pVendo.nome, previa: () => pVendo.url! }
              : { ...fontePdf(pVendo.fonte.arquivo, pVendo.fonte.pagina ?? 1, pVendo.fonte.arquivo.name), chave: pVendo.chave }
          }
          pos={Math.min(vendo, paginas.length - 1)}
          total={paginas.length}
          titulo={`Página ${Math.min(vendo, paginas.length - 1) + 1} de ${paginas.length} para ler`}
          subtitulo={pVendo.nome}
          aoIr={setVendo}
          aoFechar={() => setVendo(null)}
          acao={
            etapa === 'selecao' ? (
              <button type="button" className="vp-btn" onClick={() => tirar(pVendo)}>
                <Ic d={D.lixeira} />
                {pVendo.fonte.pagina !== undefined && pVendo.nome !== pVendo.fonte.arquivo.name ? 'Desmarcar esta página' : 'Tirar esta página'}
              </button>
            ) : undefined
          }
        />
      )}

      <input
        ref={mais}
        type="file"
        hidden
        multiple
        accept={TIPOS_ACEITOS}
        onChange={(e) => {
          aoAdicionar(e.target.files);
          e.target.value = '';
        }}
      />

      {etapa === 'selecao' &&
        pdfsParaEscolher.map((pdf) => (
          <EscolherPaginas
            key={pdf.id}
            pdf={pdf}
            limite={MAX_IMAGENS - (paginas.length - pdf.marcadas.length)}
            aoMarcar={(marcadas) => mudar(arquivos.map((x) => (x.id === pdf.id ? { ...pdf, marcadas } : x)))}
            aoTirar={() => mudar(arquivos.filter((x) => x.id !== pdf.id))}
          />
        ))}

      {etapa === 'selecao' && (
        <p className="escanear-dica">
          Dica: fotografe a folha inteira, de frente, com boa luz e sem sombra. Se tiver o formulário em PDF, prefira ele: a leitura é
          mais precisa. Com mais de uma página, envie na ordem.
        </p>
      )}

      {status && (
        <p className="escanear-status" role="status" aria-live="polite">
          {status}
        </p>
      )}

      {etapa === 'pronto' && (
        <>
          {nPerg === 0 ? (
            <Alerta tipo="warning" titulo="Nenhuma pergunta encontrada">
              Não deu para reconhecer perguntas nessas páginas. Tente uma foto mais nítida e de frente. Perguntas são reconhecidas quando
              começam com número ou letra (“1.”, “01”, “a.”), terminam com “?” ou têm caixas de marcar.
            </Alerta>
          ) : (
            <Alerta tipo="info" titulo={plural(nPerg, 'pergunta encontrada', 'perguntas encontradas')}>
              A leitura automática pode trocar letras ou juntar palavras. Confira os textos e os tipos de resposta.
            </Alerta>
          )}

          {(semOpcoes > 0 || comuns) && (
            <div className="ps-field">
              <label className="ps-label" htmlFor="ocr-comuns">
                Opções para as perguntas sem opções <span className="opt">(opcional)</span>
              </label>
              <div className="ps-control ps-textarea" style={{ alignItems: 'flex-start' }}>
                <textarea
                  id="ocr-comuns"
                  style={{ minHeight: 88 }}
                  value={comuns}
                  onChange={(e) => setComuns(e.target.value)}
                  aria-describedby="ocr-comuns-ajuda"
                />
              </div>
              <div className="ps-helper" id="ocr-comuns-ajuda">
                Para escalas como a do SCARED: uma opção por linha, com a pontuação depois do “=” (ex.: Não verdadeiro = 0). Vazio,{' '}
                {semOpcoes === 1 ? 'a pergunta sem opções vira' : 'as perguntas sem opções viram'} pergunta de texto.
                {base.escalaSugerida && ' A escala foi preenchida a partir do cabeçalho da tabela: confira.'}
              </div>
            </div>
          )}

          {nPerg > 0 && (
            <ol className="ocr-lista">
              {resultado.perguntas.map((p, i) => (
                <li key={i}>
                  <strong>{p.pergunta}</strong>
                  <span className="selos-linha">
                    <span className="ps-badge info">{nomeTipoPergunta(p.id_tipo_pergunta, p.valor_minimo, p.valor_maximo)}</span>
                  </span>
                  {temOpcoes(p.id_tipo_pergunta) && p.opcoes && (
                    <span className="ocr-opcoes">
                      {p.opcoes
                        .map((o) => (o.valor_opcao !== undefined ? `${o.texto_opcao} (${o.valor_opcao})` : o.texto_opcao))
                        .join(' · ')}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          )}

          {resultado.ignoradas.length > 0 && (
            <details className="ocr-ignoradas">
              <summary>Textos da imagem que não viraram pergunta ({resultado.ignoradas.length})</summary>
              <p>
                Títulos, cabeçalhos de coluna e notas que a leitura encontrou, mas não usou como pergunta nem como opção. Confira se
                nenhuma pergunta ficou aqui; se ficou, inclua no editor com “Adicionar perguntas”.
              </p>
              <ul>
                {resultado.ignoradas.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </Modal>
  );
}
