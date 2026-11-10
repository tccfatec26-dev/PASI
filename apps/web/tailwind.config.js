/** @type {import('tailwindcss').Config} */
// Tema com os tokens do design system PASI (os mesmos de src/styles/painel.css).
// O preflight fica desligado: a base visual vem do CSS do protótipo
// (ds-bundle.css + painel.css), para a tela ficar idêntica ao que foi desenhado.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        action: { DEFAULT: '#2f70df', hover: '#1d5fcf', pressed: '#174ea8' },
        blue: { DEFAULT: '#4081ed' },
        link: '#1d5fcf',
        'info-on-dark': '#a9c8ff',
        navy: { DEFAULT: '#172944', 700: '#1d365d', 800: '#172d50', 900: '#102746' },
        softblue: '#e9f1ff',
        background: '#f8faff',
        muted: '#526078',
        line: '#dce8fb',
        'border-card': '#e5edf9',
        error: { DEFAULT: '#c42b33', bg: '#fff1f1' },
        success: { DEFAULT: '#256b42', bg: '#eef8f1' },
        warning: { DEFAULT: '#7a4f00', bg: '#fff7e0' },
      },
      fontFamily: {
        sans: ['Montserrat', 'sans-serif'],
        display: ['"Smooth Circulars"', 'sans-serif'],
      },
      borderRadius: { card: '18px', control: '10px' },
      boxShadow: {
        card: '0 10px 30px rgba(40,75,130,0.045)',
        'card-hover': '0 15px 35px rgba(40,75,130,0.08)',
      },
    },
  },
  plugins: [],
};
