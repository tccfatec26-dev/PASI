/**
 * Cores do app = variáveis do tema (src/acessibilidade/tema.ts). O App aplica
 * as variáveis do tema atual (claro, escuro, alto contraste, preto e branco)
 * no topo da árvore, e todas as telas trocam de cor juntas.
 *
 * O nome da classe continua o mesmo de antes (bg-white, text-primary,
 * text-gray-700...), mas cada utilitário aponta para a variável certa: por
 * exemplo, `bg-primary` é a cor do cabeçalho e `text-primary` é a cor de
 * título — no escuro a primeira continua escura e a segunda fica clara.
 * Para o que não aceita className, use useCores().
 *
 * @type {import('tailwindcss').Config}
 */
const v = (nome) => `rgb(var(--c-${nome}) / <alpha-value>)`;

module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './index.ts', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        superficie: v('superficie'),
        'superficie-2': v('superficie2'),
        'superficie-3': v('superficie3'),
        /** fundo do cabeçalho das telas */
        cabecalho: v('primaria'),
        /** botão principal e itens selecionados */
        primary: v('acao'),
        'primary-light': v('primariaClara'),
        /** texto, ícones e véus claros em cima do cabeçalho e dos botões */
        'sobre-primaria': v('sobrePrimaria'),
        destaque: v('destaque'),
        'input-bg': v('superficie2'),
        border: v('borda'),
        muted: v('muted'),
        'info-bg': v('infoFundo'),
        'info-border': v('infoBorda'),
        'info-text': v('infoTexto'),
        'success-bg': v('sucessoFundo'),
        'success-border': v('sucessoBorda'),
        'success-text': v('sucessoTexto'),
        red: { 400: v('erroBorda'), 500: v('erro'), 600: v('erroForte') },
        orange: { 50: v('avisoFundo'), 200: v('avisoBorda'), 500: v('aviso'), 600: v('avisoForte'), 700: v('avisoTexto') },
        green: { 500: v('sucesso') },
      },
      textColor: {
        // título/link sobre a superfície (no escuro fica claro)
        primary: v('destaque'),
        // texto branco do app é sempre sobre cor (cabeçalho, botão, aviso)
        white: v('sobrePrimaria'),
        gray: { 300: v('texto6'), 400: v('texto5'), 500: v('texto4'), 600: v('texto3'), 700: v('texto2'), 800: v('texto') },
      },
      backgroundColor: {
        // "branco" de fundo é a superfície do tema
        white: v('superficie'),
        gray: { 50: v('superficie2'), 100: v('superficie3') },
      },
      borderColor: {
        primary: v('bordaPrimaria'),
        white: v('sobrePrimaria'),
        gray: { 200: v('borda2'), 300: v('borda2') },
      },
    },
  },
  plugins: [],
};
