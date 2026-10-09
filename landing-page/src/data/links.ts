// Link de download do aplicativo. Ainda não definido na documentação:
// troque "#baixar" pelo link da loja quando o app for publicado.
export const DOWNLOAD_URL = "#baixar";

export const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;
export const LIGHT_LOGO_SRC = `${import.meta.env.BASE_URL}PASI%20LOGO%20CLARO.svg`;
export const FAVICON_SRC = `${import.meta.env.BASE_URL}favicon.svg`;
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL ?? "";


export const navLinks = [
  { href: "#inicio", label: "Início" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#para-quem", label: "Para quem é" },
  { href: "#projeto", label: "Projeto" },
  { href: "#duvidas", label: "Dúvidas" },
];
