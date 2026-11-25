/**
 * Monta as perguntas de um formulário a partir do texto lido de uma imagem
 * (OCR). Só regras de layout: o resultado é um rascunho
 * que o profissional revisa no editor antes de salvar.
 *
 * Padrões reconhecidos (vistos nos formulários em papel do projeto):
 *  - "a. Tipo de residência" / "12. Sinto medo..." / "01 Quando..." (número
 *    na própria coluna da tabela) / texto terminado em "?": começa uma
 *    pergunta (o "a." / "12." sai do texto);
 *  - linhas recuadas logo abaixo da pergunta ("Própria", "Alugada"...): opções;
 *  - caixas de marcar na mesma linha ("|__| Sim |__| Não", "( )A ( )B"):
 *    cada trecho depois da caixa é uma opção;
 *  - texto sem número seguido de opções ("Percepção do técnico sobre..."):
 *    vira a pergunta dessas opções;
 *  - Sim/Não vira pergunta Sim/Não; 2+ opções viram seleção única; sem opções,
 *    texto longo (ou as "opções em comum", para escalas como a do SCARED);
 *  - escala nas colunas do cabeçalho ("0 Não verdadeiro | 1 Às vezes... |
 *    2 Verdadeiro"): sugerida como opções em comum.
 */
import type { NovaOpcao, NovaPergunta } from '../../api/formularios';
import { TipoPergunta } from '../perguntas';

/** Um trecho de texto numa linha, com a posição na página (em pixels). */
export interface Segmento {
  texto: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  pagina: number;
  larguraPagina: number;
  /** confiança média do OCR (0–100) */
  confianca?: number;
  /** item numerado de tabela (o número estava na coluna ao lado) */
  item?: boolean;
  /** onde começa o texto do item, sem o número (para achar a 2ª linha dele) */
  xTexto?: number;
  /** x0 de cada palavra de `texto` (separadas por espaço), quando o OCR dá */
  palavrasX?: number[];
}

export interface ResultadoLeitura {
  /** sugestão de título (a 1ª linha de texto antes da 1ª pergunta) */
  titulo?: string;
  /** texto corrido antes da 1ª pergunta (instruções), se houver */
  descricao?: string;
  /**
   * Escala achada nas colunas do cabeçalho, quando a maioria das perguntas
   * não tem opções próprias (ex.: SCARED). A tela oferece como opções em comum.
   */
  escalaSugerida?: NovaOpcao[];
  perguntas: NovaPergunta[];
  /** linhas que não viraram pergunta nem opção (para o profissional conferir) */
  ignoradas: string[];
}

/**
 * Caixas de marcar como o OCR costuma ler: |__|, | —|, [_], ( ), (  ), □... O
 * ")" de "( )" às vezes sai como J, D, Y ou ] grudado na palavra seguinte
 * ("( JSim").
 */
const MARCA = /[[({|]\s?[_\s—–]{0,6}\s?[\])}|]|\(\s?[JDY\]](?=\p{Lu})|[[|Il]?[_—]{2,}[\]|IlJ]?|[□☐❑◻▢○◯]/gu;
/**
 * "a. ", "b) ", "12. ", "3- " no começo da linha, ou só o número antes do
 * texto ("01 Quando...", "05 — Meu filho..."; o OCR às vezes lê o 0 como O).
 */
const PREFIXO = /^\s*(?:(?:\d{1,3}|[a-zA-Z])\s?[.)\-–]|(?:(?=\S*\d)[0-9OoºlI!]{1,3}|[Oo0][lI!|])(?:\s*[—|])?(?=\s+[“"]?\p{L}))\s+(?=\S)/u;
/**
 * Trecho que é só o número do item, na coluna ao lado do texto: "01", "12."
 * e as leituras erradas comuns de número em foto ("0!", "0º", "l1", e "Ol"
 * para 01). Fora o "Ol", precisa ter um algarismo: "|_|" e "O" sozinhos são
 * caixas, não números.
 */
const SO_NUMERO = /^\s*(?:(?=\S*\d)[0-9OoºlI!]{1,3}|[Oo0][lI!|])[.)]?\s*$/;
/** sobra da borda da tabela antes do "a." ("[ d. Possui", "1 b. Acesso") */
const BORDA_ANTES = /^[[\]|!Il1]\s+(?=(\d{1,3}|[a-zA-Z])\s?[.)\-–]\s)/;
const TAM_TITULO = 50;
const TAM_DESCRICAO = 500;
const TAM_PERGUNTA = 500;
const TAM_OPCAO = 255;

/** Recuo mínimo (fração da largura da página) para uma linha ser opção. */
const RECUO_OPCAO = 0.02;

type Tipo = 'pergunta' | 'opcoes' | 'texto' | 'vazia';

interface Linha extends Segmento {
  tipo: Tipo;
  /** texto sem as caixas de marcar e sem o prefixo "a." */
  limpo: string;
  /** opções achadas na própria linha (caixas de marcar) */
  opcoes: string[];
}

interface Rascunho {
  texto: string;
  x0: number;
  /** começo do texto (sem o número do item) */
  xTexto: number;
  /** pergunta numerada ("01", "a.") */
  item: boolean;
  /** topo da 1ª linha da pergunta */
  y0: number;
  y1: number;
  /** meio da última linha incluída (pergunta ou opção) */
  yMeio: number;
  altura: number;
  opcoes: string[];
}

const espacos = (s: string) => s.replace(/\s+/g, ' ').trim();
/** tira sobras de tabela e pontuação solta das pontas */
const aparar = (s: string) => {
  const t = espacos(s.replace(/[|]/g, ' '))
    .replace(/^[\s.,;:_\-–—•*[\]]+|[\s,;_\-–—•[]+$/g, '')
    .trim();
  // aspas sem par no começo: sobra de borda ("“Meu filho")
  return (t.match(/[“”"]/g) ?? []).length % 2 ? t.replace(/^[“"]\s*/, '') : t;
};
const letras = (s: string) => (s.match(/\p{L}/gu) ?? []).length;
const chave = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '');
/**
 * Sobra de borda, caixa ou linha de data lida como letras ("NS A", "AA"):
 * confiança baixa e nenhuma minúscula. "Sim"/"Não" com confiança baixa ficam.
 */
const lixo = (texto: string, confianca = 100) =>
  letras(texto) < 2 ||
  (confianca < 45 && !/\p{Ll}/u.test(texto) && letras(texto) <= 8) ||
  // caixas e bolinhas vazias lidas como letras ("oO oO", "0 O")
  /^[oO0Qº°\s]+$/.test(texto);

function classificar(s: Segmento): Linha {
  const original = espacos(s.texto).replace(BORDA_ANTES, '');
  const partes = original.split(MARCA);
  const nMarcas = partes.length - 1;
  const base = { ...s, texto: original, opcoes: [] as string[] };

  if (nMarcas >= 2 || (nMarcas === 1 && aparar(partes[0]) && aparar(partes[1]))) {
    // "Pergunta? ( ) A ( ) B": o que vem antes da 1ª caixa é a pergunta;
    // "|__| Sim |__| Não": cada trecho depois de uma caixa é uma opção.
    const antes = aparar(partes[0]);
    const opcoes = partes
      .slice(1)
      .map(aparar)
      .filter((p) => !lixo(p, s.confianca));
    const comPergunta = antes && opcoes.length >= 1 && (PREFIXO.test(antes) || /[?:]$/.test(antes));
    if (comPergunta)
      return {
        ...base,
        tipo: 'pergunta',
        limpo: antes.replace(PREFIXO, ''),
        opcoes,
      };
    if (antes && !lixo(antes, s.confianca)) opcoes.unshift(antes);
    if (opcoes.length) return { ...base, tipo: 'opcoes', limpo: '', opcoes };
  }

  const limpo = aparar(partes.join(' '));
  if (lixo(limpo, s.confianca)) return { ...base, tipo: 'vazia', limpo: '' };
  if (s.item || PREFIXO.test(limpo) || /\?$/.test(limpo)) {
    const prefixo = limpo.match(PREFIXO)?.[0] ?? '';
    const texto = aparar(limpo.replace(PREFIXO, ''));
    // "0! — Quando...": o texto começa na 1ª palavra depois do número
    const primeira = texto.split(' ')[0];
    const idx = prefixo && primeira ? s.texto.split(' ').findIndex((w, i) => i > 0 && w.includes(primeira)) : -1;
    const xPalavra = idx > 0 ? s.palavrasX?.[idx] : undefined;
    return {
      ...base,
      tipo: 'pergunta',
      limpo: texto,
      xTexto: xPalavra ?? s.xTexto ?? s.x0,
      item: s.item || !!prefixo,
    };
  }
  // uma caixa só, com texto de um lado ("Própria |__|"): é uma opção
  if (nMarcas === 1) return { ...base, tipo: 'opcoes', limpo: '', opcoes: [limpo] };
  return { ...base, tipo: 'texto', limpo };
}

/** Ordena por página e por linha (de cima para baixo), e na linha da esquerda para a direita. */
function ordenar(segs: Segmento[]): Segmento[] {
  const porAltura = [...segs].sort((a, b) => a.pagina - b.pagina || (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2);
  const linhas: Segmento[][] = [];
  for (const s of porAltura) {
    const atual = linhas[linhas.length - 1];
    const ref = atual?.[0];
    // mesma linha: as alturas se sobrepõem em boa parte (em foto torta o
    // texto inclinado fica mais alto que o número ao lado dele)
    const sobre = ref ? Math.min(ref.y1, s.y1) - Math.max(ref.y0, s.y0) : 0;
    if (ref && ref.pagina === s.pagina && sobre > Math.min(ref.y1 - ref.y0, s.y1 - s.y0) * 0.5) atual.push(s);
    else linhas.push([s]);
  }
  return linhas.flatMap((l) => juntarNumero(l.sort((a, b) => a.x0 - b.x0)));
}

/** "01" numa coluna e o texto do item na outra: vira um trecho só ("01 Quando..."). */
function juntarNumero(linha: Segmento[]): Segmento[] {
  const out: Segmento[] = [];
  for (let i = 0; i < linha.length; i++) {
    const s = linha[i];
    const prox = linha[i + 1];
    if (prox && SO_NUMERO.test(s.texto) && letras(prox.texto) >= 2) {
      // o número em si sai (o OCR costuma errá-lo); fica a marca de item
      out.push({
        ...prox,
        item: true,
        xTexto: prox.x0,
        x0: s.x0,
        y0: Math.min(s.y0, prox.y0),
        y1: Math.max(s.y1, prox.y1),
      });
      i++;
    } else out.push(s);
  }
  return out;
}

/** As alturas se sobrepõem em mais da metade da menor: estão na mesma linha. */
function mesmaLinha(a: Segmento, b: Segmento) {
  const sobre = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return a.pagina === b.pagina && sobre > Math.min(a.y1 - a.y0, b.y1 - b.y0) * 0.5;
}

/** Corta no fim de uma palavra para caber em `max` caracteres. */
function caber(texto: string, max: number) {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max + 1).replace(/\s+\S*$/, '');
  return (corte || texto.slice(0, max)).trim();
}

/** Opções em comum digitadas pelo profissional: uma por linha, "texto = valor" opcional. */
export function lerOpcoesComuns(texto: string): NovaOpcao[] {
  const linhas = texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  return linhas.map((l, i) => {
    const m = l.match(/^(.*?)\s*[=:]\s*(-?\d+)$/);
    return m
      ? { texto_opcao: m[1].slice(0, TAM_OPCAO), valor_opcao: Number(m[2]) }
      : { texto_opcao: l.slice(0, TAM_OPCAO), valor_opcao: i };
  });
}

/** Distância de edição (Levenshtein) entre duas chaves. */
function distancia(a: string, b: string): number {
  let ant = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(ant[j] + 1, cur[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    ant = cur;
  }
  return ant[b.length];
}

/** Mesma palavra lida com um erro pequeno ("Conflituoso" x "Confituoso"), mas "com" ≠ "sem". */
function mesmaPalavra(a: string, b: string) {
  return distancia(a, b) <= Math.max(1, Math.floor(Math.max(a.length, b.length) * 0.2));
}

function mesmaOpcao(a: string, b: string) {
  const pa = a.split(' ').map(chave).filter(Boolean);
  const pb = b.split(' ').map(chave).filter(Boolean);
  return pa.length === pb.length && pa.every((p, i) => mesmaPalavra(p, pb[i]));
}

/**
 * Junta opções repetidas (formulários com várias linhas iguais, uma por
 * técnico/data) mesmo quando o OCR leu cada uma com um erro diferente; fica a
 * grafia que mais apareceu, na ordem da primeira vez que apareceu.
 */
export function unirOpcoes(lidas: string[]): string[] {
  const grupos: { primeira: string; grafias: Map<string, number> }[] = [];
  for (const o of lidas) {
    if (!chave(o)) continue;
    const g = grupos.find((x) => mesmaOpcao(x.primeira, o));
    if (g) g.grafias.set(o, (g.grafias.get(o) ?? 0) + 1);
    else grupos.push({ primeira: o, grafias: new Map([[o, 1]]) });
  }
  return grupos.map((g) => [...g.grafias.entries()].sort((a, b) => b[1] - a[1])[0][0]);
}

function paraPergunta(r: Rascunho, comuns: NovaOpcao[]): NovaPergunta | null {
  const texto = r.texto.slice(0, TAM_PERGUNTA);
  const opcoes = unirOpcoes(r.opcoes.map((o) => o.slice(0, TAM_OPCAO)));

  if (!texto && opcoes.length < 2) return null;
  const pergunta = texto || 'Pergunta sem título (revise)';

  const chaves = opcoes.map(chave).sort().join('|');
  if (chaves === 'nao|sim')
    return {
      pergunta,
      id_tipo_pergunta: TipoPergunta.BOOLEANO,
      obrigatoria: true,
    };
  if (opcoes.length >= 2) {
    const multipla = /mais de uma|todas? as? que|pode marcar|marque quantas/i.test(pergunta);
    return {
      pergunta,
      id_tipo_pergunta: multipla ? TipoPergunta.ESCOLHA_MULTIPLA : TipoPergunta.ESCOLHA_UNICA,
      obrigatoria: true,
      opcoes: opcoes.map((texto_opcao) => ({ texto_opcao })),
    };
  }
  if (comuns.length >= 2)
    return {
      pergunta,
      id_tipo_pergunta: TipoPergunta.ESCOLHA_UNICA,
      obrigatoria: true,
      opcoes: comuns.map((o) => ({ ...o })),
    };
  // uma opção solta não forma escolha: a pergunta fica aberta
  return { pergunta, id_tipo_pergunta: TipoPergunta.TEXTO, obrigatoria: true };
}

/** Título: a 1ª linha antes da 1ª pergunta, sem o parêntese se não couber. */
function escolherTitulo(cabecalho: Linha[]): {
  titulo?: string;
  descricao?: string;
  resto: Linha[];
} {
  // "(Mês/Ano)" e outros cabeçalhos de coluna curtos não servem de título
  const candidatas = cabecalho.filter((l) => letras(l.limpo) >= 8);
  if (!candidatas.length) return { resto: cabecalho };
  // o título é a 1ª linha de texto da página (cabeçalhos de coluna podem ter
  // a caixa mais alta, então "a maior letra" não serve)
  const maior = candidatas.reduce((a, b) => (b.pagina < a.pagina || (b.pagina === a.pagina && b.y0 < a.y0) ? b : a));
  let titulo = maior.limpo;
  if (titulo.length > TAM_TITULO) titulo = aparar(titulo.replace(/\(.*$/, ''));
  titulo = caber(titulo, TAM_TITULO);
  const resto = cabecalho.filter((l) => l !== maior);
  // instruções: o texto corrido abaixo do título, na metade esquerda
  const corrido = resto.filter((l) => l.y0 >= maior.y0 && l.x0 < l.larguraPagina * 0.5);
  const descricao = espacos(corrido.map((l) => l.limpo).join(' '));
  if (descricao.length >= 40)
    return {
      titulo: titulo || undefined,
      descricao: caber(descricao, TAM_DESCRICAO),
      resto: resto.filter((l) => !corrido.includes(l)),
    };
  return { titulo: titulo || undefined, resto };
}

/**
 * Escala nas colunas à direita do cabeçalho, logo acima da 1ª pergunta:
 * "Não / verdadeiro", "Às vezes / verdadeiro", "Verdadeiro" (os "0 1 2" de
 * cima viram os valores; se o OCR não os leu, valem 0, 1, 2...).
 */
function escalaDoCabecalho(cabecalho: Linha[], primeira: Rascunho | undefined): NovaOpcao[] | undefined {
  if (!primeira) return undefined;
  const W = cabecalho[0]?.larguraPagina ?? 1;
  // só a faixa logo acima da 1ª pergunta (o título centralizado fica de fora)
  const faixa = W * 0.1;
  const cols = cabecalho
    .filter((l) => l.x0 > W * 0.45 && l.y1 <= primeira.y0 + primeira.altura * 0.5 && primeira.y0 - l.y1 < faixa)
    .sort((a, b) => (a.x0 + a.x1) / 2 - (b.x0 + b.x1) / 2);
  const grupos: Linha[][] = [];
  for (const l of cols) {
    const g = grupos[grupos.length - 1];
    const meio = (l.x0 + l.x1) / 2;
    if (g && meio - (g[g.length - 1].x0 + g[g.length - 1].x1) / 2 < W * 0.06) g.push(l);
    else grupos.push([l]);
  }
  if (grupos.length < 2 || grupos.length > 7) return undefined;
  return grupos.map((g, i) => {
    const texto = espacos(
      g
        .sort((a, b) => a.y0 - b.y0)
        .map((l) => l.limpo)
        .join(' '),
    );
    const m = texto.match(/^(\d{1,2})\s+(.*)$/);
    return m
      ? { texto_opcao: caber(m[2], TAM_OPCAO), valor_opcao: Number(m[1]) }
      : { texto_opcao: caber(texto, TAM_OPCAO), valor_opcao: i };
  });
}

export function montarFormulario(segmentos: Segmento[], opcoesComuns: NovaOpcao[] = []): ResultadoLeitura {
  const linhas = ordenar(segmentos)
    .map(classificar)
    .filter((l) => l.tipo !== 'vazia');
  const rascunhos: Rascunho[] = [];
  const ignoradas: Linha[] = [];
  const cabecalho: Linha[] = [];
  /** linhas de texto sem dono: podem virar a pergunta das próximas opções */
  let soltas: Linha[] = [];
  let atual: Rascunho | null = null;

  const novo = (l: Linha, texto: string): Rascunho => ({
    texto,
    x0: l.x0,
    xTexto: l.xTexto ?? l.x0,
    item: !!l.item,
    y0: l.y0,
    y1: l.y1,
    yMeio: (l.y0 + l.y1) / 2,
    altura: l.y1 - l.y0,
    opcoes: [],
  });
  const fechar = () => {
    if (atual) rascunhos.push(atual);
    atual = null;
  };
  const descartarSoltas = () => {
    (rascunhos.length || atual ? ignoradas : cabecalho).push(...soltas);
    soltas = [];
  };
  /**
   * Texto sem número que precede opções: usa a última linha solta da metade
   * esquerda da página e as de cima que continuam o mesmo parágrafo (mesmo
   * recuo, sem espaço entre elas). Cabeçalhos de coluna à direita ficam de fora.
   */
  const perguntaDasSoltas = (): Rascunho | null => {
    const esquerda = soltas.filter((l) => l.x0 < l.larguraPagina * 0.5);
    if (!esquerda.length) return null;
    const bloco = [esquerda[esquerda.length - 1]];
    for (let i = esquerda.length - 2; i >= 0; i--) {
      const cima = esquerda[i];
      const baixo = bloco[0];
      const altura = baixo.y1 - baixo.y0;
      const junto = cima.pagina === baixo.pagina && baixo.y0 - cima.y1 < altura * 0.6;
      const alinhado = Math.abs(cima.x0 - baixo.x0) < cima.larguraPagina * RECUO_OPCAO;
      if (!junto || !alinhado) break;
      bloco.unshift(cima);
    }
    const usadas = new Set(bloco);
    soltas = soltas.filter((l) => !usadas.has(l));
    descartarSoltas();
    const r = novo(bloco[0], espacos(bloco.map((l) => l.limpo).join(' ')));
    const ult = bloco[bloco.length - 1];
    r.y1 = ult.y1;
    r.yMeio = (ult.y0 + ult.y1) / 2;
    return r;
  };

  let pagina = linhas[0]?.pagina ?? 0;
  for (const l of linhas) {
    // página nova (outra foto) começa do zero: opções no topo dela não vão
    // para a última pergunta da página anterior
    if (l.pagina !== pagina) {
      fechar();
      descartarSoltas();
      pagina = l.pagina;
    }
    if (l.tipo === 'pergunta') {
      fechar();
      descartarSoltas();
      atual = novo(l, l.limpo);
      atual.opcoes.push(...l.opcoes);
      continue;
    }

    if (l.tipo === 'opcoes') {
      // "|Sim  |__| Não": a caixa do "Sim" não foi lida, mas ele está na mesma
      // linha de outras caixas, então também é opção (e não a pergunta)
      const vizinhas = soltas.filter((x) => mesmaLinha(x, l) && x.limpo.split(' ').length <= 6);
      if (vizinhas.length) {
        soltas = soltas.filter((x) => !vizinhas.includes(x));
        l.opcoes.unshift(...vizinhas.map((x) => x.limpo));
      }
      if (soltas.length) {
        const r = perguntaDasSoltas();
        if (r) {
          fechar();
          atual = r;
        }
      }
      if (!atual) atual = novo(l, '');
      atual.opcoes.push(...l.opcoes);
      atual.y1 = l.y1;
      atual.yMeio = (l.y0 + l.y1) / 2;
      continue;
    }

    // texto comum
    const a = atual as Rascunho | null;
    if (a && !soltas.length) {
      const alturaL = l.y1 - l.y0;
      const perto = l.y0 - a.y1 < Math.max(a.altura, alturaL) * 1.2;
      // na linha de baixo, não na mesma (colunas à direita da pergunta não
      // contam). Compara o meio das linhas: em foto torta a caixa do texto
      // inclinado é alta e encosta na linha de baixo.
      const abaixo = (l.y0 + l.y1) / 2 - a.yMeio > Math.min(alturaL, a.altura) * 0.6;
      const W = l.larguraPagina;
      const recuada = l.x0 > a.xTexto + W * RECUO_OPCAO && l.x0 < W * 0.5;
      const naMargemDoTexto = Math.abs(l.x0 - a.xTexto) < W * RECUO_OPCAO;
      const fraseAcabou = /[.?!]$/.test(a.texto);
      // continuação da pergunta, logo abaixo dela: alinhada com o começo do
      // texto do item, ou começando com minúscula perto da margem
      // (alinhada só vale se a frase não terminou: senão é o item seguinte
      // com o número mal lido)
      const alinhada = naMargemDoTexto && !fraseAcabou;
      const minuscula = l.x0 < a.x0 + W * 0.15 && /^[\p{Ll}(]/u.test(l.limpo);
      if (perto && abaixo && !a.opcoes.length && (alinhada || minuscula)) {
        a.texto = espacos(`${a.texto} ${l.limpo}`);
        a.y1 = l.y1;
        a.yMeio = (l.y0 + l.y1) / 2;
        continue;
      }
      // item seguinte com o número ilegível: mesma margem do texto, logo
      // depois de uma frase terminada, numa lista de itens numerados
      if (perto && abaixo && a.item && !a.opcoes.length && naMargemDoTexto && fraseAcabou && /^\p{Lu}/u.test(l.limpo)) {
        fechar();
        atual = { ...novo(l, l.limpo), item: true };
        continue;
      }
      // opção sem caixa (a caixa ficou em outra coluna): recuada sob a pergunta
      if (perto && abaixo && recuada) {
        a.opcoes.push(l.limpo);
        a.y1 = l.y1;
        a.yMeio = (l.y0 + l.y1) / 2;
        continue;
      }
    }
    soltas.push(l);
  }
  fechar();
  descartarSoltas();

  const semOpcoes = rascunhos.filter((r) => r.opcoes.length < 2).length;
  const escalaSugerida = semOpcoes > rascunhos.length / 2 ? escalaDoCabecalho(cabecalho, rascunhos[0]) : undefined;
  const usadasNaEscala = escalaSugerida ? cabecalho.filter((l) => l.x0 > l.larguraPagina * 0.45) : [];
  const { titulo, descricao, resto } = escolherTitulo(cabecalho.filter((l) => !usadasNaEscala.includes(l)));
  // pedaço de linha cortada ("it", "Te") sem opções não vira pergunta
  const curtas = rascunhos.filter((r) => r.texto && letras(r.texto) < 4 && r.opcoes.length < 2);
  const perguntas = rascunhos
    .filter((r) => !curtas.includes(r))
    .map((r) => paraPergunta(r, opcoesComuns))
    .filter((p): p is NovaPergunta => p !== null);
  return {
    titulo,
    descricao,
    escalaSugerida,
    perguntas,
    ignoradas: [...resto, ...ignoradas].map((l) => l.texto).concat(curtas.map((r) => r.texto)),
  };
}
