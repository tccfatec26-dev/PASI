// Link de download do aplicativo: é o mesmo endereço do QR code do app (build no Expo).
export const DOWNLOAD_URL = "https://expo.dev/accounts/pasitccs-team/projects/pasi/builds/38f1434a-fbb0-4277-862f-684162308302";

export const LOGO_SRC = `${import.meta.env.BASE_URL}logo.png`;
export const LIGHT_LOGO_SRC = `${import.meta.env.BASE_URL}PASI%20LOGO%20CLARO.svg`;
export const FAVICON_SRC = `${import.meta.env.BASE_URL}favicon.svg`;
// Endereço do chat de suporte (link ou iframe do chatbot). Vazio = a aba mostra "em breve".
export const CHATBOT_URL = import.meta.env.VITE_CHATBOT_URL ?? "";
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL ?? "";


export const navLinks = [
  { href: "#inicio", label: "Início" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#para-quem", label: "Para quem é" },
  { href: "#projeto", label: "Projeto" },
  { href: "#duvidas", label: "Dúvidas" },
  { href: "#suporte", label: "Suporte" },
];
