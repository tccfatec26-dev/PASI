/**
 * Temas do app: claro, escuro e alto contraste.
 *
 * As cores das classes do Tailwind (bg-superficie, text-destaque, text-gray-700...)
 * apontam para variáveis CSS (tailwind.config.js); o App aplica no topo da
 * árvore as variáveis do tema atual com `vars()` do NativeWind, e todas as
 * telas trocam de cor juntas. Para o que não aceita className (ícones,
 * placeholderTextColor, ActivityIndicator, Switch), use `useCores()`.
 *
 * O escuro segue as cores do tema escuro do painel web (apps/web/src/styles/dark.css);
 * o alto contraste, o do menu de acessibilidade do painel: preto, texto amarelo
 * e ações em ciano.
 */

/** Nomes das cores do tema (cada uma vira a variável CSS --c-<nome>). */
export const NOMES = [
  'superficie', // fundo das telas e dos cartões
  'superficie2', // campos e áreas internas
  'superficie3', // campo desabilitado
  'primaria', // cabeçalho (fundo)
  'primariaClara',
  'acao', // botão principal e itens selecionados (fundo)
  'sobrePrimaria', // texto e ícones em cima do cabeçalho e dos botões
  'destaque', // títulos e links sobre a superfície
  'bordaPrimaria', // contorno do botão secundário
  'texto', // gray-800
  'texto2', // gray-700
  'texto3', // gray-600
  'texto4', // gray-500
  'texto5', // gray-400
  'texto6', // gray-300
  'muted',
  'borda',
  'borda2', // gray-200/300
  'placeholder',
  'erro',
  'erroForte',
  'erroBorda',
  'avisoFundo',
  'avisoBorda',
  'aviso',
  'avisoForte',
  'avisoTexto',
  'sucesso',
  'sucessoFundo',
  'sucessoBorda',
  'sucessoTexto',
  'infoFundo',
  'infoBorda',
  'infoTexto',
] as const;

export type NomeCor = (typeof NOMES)[number];
export type Paleta = Record<NomeCor, string>;

export const CLARO: Paleta = {
  superficie: '#FFFFFF',
  superficie2: '#F8FAFC',
  superficie3: '#F3F4F6',
  primaria: '#0D2347',
  primariaClara: '#1A3A5C',
  acao: '#0D2347',
  sobrePrimaria: '#FFFFFF',
  destaque: '#0D2347',
  bordaPrimaria: '#0D2347',
  texto: '#1F2937',
  texto2: '#374151',
  texto3: '#4B5563',
  texto4: '#6B7280',
  texto5: '#9CA3AF',
  texto6: '#D1D5DB',
  muted: '#718096',
  borda: '#E2E8F0',
  borda2: '#D1D5DB',
  placeholder: '#A0AEC0',
  erro: '#EF4444',
  erroForte: '#DC2626',
  erroBorda: '#F87171',
  avisoFundo: '#FFF7ED',
  avisoBorda: '#FED7AA',
  aviso: '#F97316',
  avisoForte: '#EA580C',
  avisoTexto: '#C2410C',
  sucesso: '#15803D',
  sucessoFundo: '#F0FFF4',
  sucessoBorda: '#C6F6D5',
  sucessoTexto: '#276749',
  infoFundo: '#EBF8FF',
  infoBorda: '#BEE3F8',
  infoTexto: '#2B6CB0',
};

export const ESCURO: Paleta = {
  superficie: '#0B1424',
  superficie2: '#16243C',
  superficie3: '#172235',
  primaria: '#16243C',
  primariaClara: '#1B2B47',
  acao: '#2F70DF',
  sobrePrimaria: '#FFFFFF',
  destaque: '#D8E2F3',
  bordaPrimaria: '#5B95F2',
  texto: '#E4EBF7',
  texto2: '#D8E2F3',
  texto3: '#B4C2DA',
  texto4: '#9CABC4',
  texto5: '#6E7F9B',
  texto6: '#4D6286',
  muted: '#9CABC4',
  borda: '#2A3B59',
  borda2: '#4D6286',
  placeholder: '#6E7F9B',
  erro: '#FF8A8D',
  erroForte: '#B3262E',
  erroBorda: '#FF8A8D',
  avisoFundo: '#33280C',
  avisoBorda: '#6B5420',
  aviso: '#FFD27A',
  avisoForte: '#FFD27A',
  avisoTexto: '#FFD27A',
  sucesso: '#2F8A55',
  sucessoFundo: '#10301F',
  sucessoBorda: '#1E5236',
  sucessoTexto: '#74D396',
  infoFundo: '#1A2F52',
  infoBorda: '#2C4A7A',
  infoTexto: '#84B3FF',
};

/** Alto contraste (WCAG AAA): fundo preto, texto amarelo, ações em ciano. */
export const CONTRASTE: Paleta = {
  superficie: '#000000',
  superficie2: '#000000',
  superficie3: '#000000',
  primaria: '#000000',
  primariaClara: '#000000',
  acao: '#000000',
  sobrePrimaria: '#00E5FF',
  destaque: '#FFEB3B',
  bordaPrimaria: '#00E5FF',
  texto: '#FFEB3B',
  texto2: '#FFEB3B',
  texto3: '#FFEB3B',
  texto4: '#FFEB3B',
  texto5: '#C9B92F',
  texto6: '#C9B92F',
  muted: '#FFEB3B',
  borda: '#FFEB3B',
  borda2: '#FFEB3B',
  placeholder: '#C9B92F',
  erro: '#FF8A80',
  erroForte: '#000000',
  erroBorda: '#FF8A80',
  avisoFundo: '#000000',
  avisoBorda: '#FFEB3B',
  aviso: '#FFEB3B',
  avisoForte: '#FFEB3B',
  avisoTexto: '#FFEB3B',
  sucesso: '#000000',
  sucessoFundo: '#000000',
  sucessoBorda: '#FFEB3B',
  sucessoTexto: '#FFEB3B',
  infoFundo: '#000000',
  infoBorda: '#FFEB3B',
  infoTexto: '#FFEB3B',
};

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();

/** Uma cor em cinza de mesma luminância (preto e branco). */
export function corEmCinza(c: string): string {
  const [r, g, b] = rgb(c);
  const l = 0.299 * r + 0.587 * g + 0.114 * b;
  return hex(l, l, l);
}

/** Preto e branco: cada cor vira o cinza de mesma luminância. */
export function emCinza(p: Paleta): Paleta {
  const saida = {} as Paleta;
  for (const nome of NOMES) {
    const [r, g, b] = rgb(p[nome]);
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    saida[nome] = hex(l, l, l);
  }
  return saida;
}

/** Variáveis CSS do tema, no formato que o Tailwind usa com opacidade ("13 35 71"). */
export function variaveisDe(p: Paleta): Record<string, string> {
  const v: Record<string, string> = {};
  for (const nome of NOMES) v[`--c-${nome}`] = rgb(p[nome]).join(' ');
  return v;
}
