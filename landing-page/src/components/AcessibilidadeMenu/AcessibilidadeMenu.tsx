import { useEffect, useRef, useState } from "react";
import "./AcessibilidadeMenu.css";

const FONT_LEVEL_MAX = 2;

type VLibrasWindow = Window & {
  VLibras?: { Widget: new (path: string) => unknown };
};

function AcessibilidadeMenu() {
  const [open, setOpen] = useState(false);
  const [fontLevel, setFontLevel] = useState(0);
  const [altoContraste, setAltoContraste] = useState(false);
  const [pretoEBranco, setPretoEBranco] = useState(false);
  const [leitorAtivo, setLeitorAtivo] = useState(false);
  const painelRef = useRef<HTMLDivElement | null>(null);

  // aplica as preferências no <html>, para valer para o site inteiro
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("a11y-font-1", fontLevel === 1);
    html.classList.toggle("a11y-font-2", fontLevel === 2);
  }, [fontLevel]);

  useEffect(() => {
    document.documentElement.classList.toggle("a11y-contraste", altoContraste);
  }, [altoContraste]);

  useEffect(() => {
    document.documentElement.classList.toggle("a11y-pb", pretoEBranco);
  }, [pretoEBranco]);

  // "leitor de tela": enquanto ativo, clicar em qualquer texto da página o lê em voz alta
  useEffect(() => {
    if (!leitorAtivo) {
      window.speechSynthesis?.cancel();
      return;
    }

    const lerTexto = (event: MouseEvent) => {
      const alvo = event.target as HTMLElement | null;
      const texto = alvo?.innerText?.trim();
      if (!texto) return;

      window.speechSynthesis.cancel();
      const fala = new SpeechSynthesisUtterance(texto);
      fala.lang = "pt-BR";
      window.speechSynthesis.speak(fala);
    };

    document.addEventListener("click", lerTexto, true);
    return () => document.removeEventListener("click", lerTexto, true);
  }, [leitorAtivo]);

  // injeta o widget oficial do VLibras uma única vez
  useEffect(() => {
    if (document.getElementById("vlibras-wrapper")) return;

    const container = document.createElement("div");
    container.id = "vlibras-wrapper";
    container.setAttribute("vw", "");
    container.className = "enabled";
    container.innerHTML = `
      <div vw-access-button class="active"></div>
      <div vw-plugin-wrapper>
        <div class="vw-plugin-top-wrapper"></div>
      </div>
    `;
    document.body.appendChild(container);

    const script = document.createElement("script");
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.onload = () => {
      const { VLibras } = window as VLibrasWindow;
      if (VLibras) new VLibras.Widget("https://vlibras.gov.br/app");
    };
    document.body.appendChild(script);
  }, []);

  // fecha ao clicar fora ou apertar Esc
  useEffect(() => {
    if (!open) return;

    const aoClicarFora = (event: MouseEvent) => {
      if (painelRef.current && !painelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const aoApertarTecla = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", aoClicarFora);
    window.addEventListener("keydown", aoApertarTecla);

    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      window.removeEventListener("keydown", aoApertarTecla);
    };
  }, [open]);

  const abrirLibras = () => {
    document.querySelector<HTMLElement>("[vw-access-button]")?.click();
    setOpen(false);
  };

  const redefinir = () => {
    setFontLevel(0);
    setAltoContraste(false);
    setPretoEBranco(false);
    setLeitorAtivo(false);
  };

  return (
    <div className="a11y-menu" ref={painelRef}>
      <button
        type="button"
        className="a11y-botao"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls="a11y-painel"
        aria-label="Abrir menu de acessibilidade"
        onClick={() => setOpen((atual) => !atual)}
      >
        <i className="fa-solid fa-universal-access" aria-hidden="true"></i>
      </button>

      <div className={`a11y-painel ${open ? "is-open" : ""}`} id="a11y-painel" hidden={!open}>
        <div className="a11y-painel-header">
          <strong>Acessibilidade</strong>
          <button type="button" className="a11y-fechar" aria-label="Fechar menu de acessibilidade" onClick={() => setOpen(false)}>
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>

        <div className="a11y-bloco">
          <span className="a11y-bloco-label">Tamanho do texto</span>
          <div className="a11y-fonte-controles">
            <button
              type="button"
              className="a11y-fonte-botao"
              onClick={() => setFontLevel((nivel) => Math.max(nivel - 1, 0))}
              disabled={fontLevel === 0}
              aria-label="Diminuir o tamanho do texto"
            >
              A<span>-</span>
            </button>
            <button
              type="button"
              className="a11y-fonte-botao a11y-fonte-botao-grande"
              onClick={() => setFontLevel((nivel) => Math.min(nivel + 1, FONT_LEVEL_MAX))}
              disabled={fontLevel === FONT_LEVEL_MAX}
              aria-label="Aumentar o tamanho do texto"
            >
              A<span>+</span>
            </button>
          </div>
        </div>

        <button type="button" className="a11y-linha" aria-pressed={altoContraste} onClick={() => setAltoContraste((v) => !v)}>
          <span>Alto contraste</span>
          <span className={`a11y-switch ${altoContraste ? "is-on" : ""}`} aria-hidden="true"></span>
        </button>

        <button type="button" className="a11y-linha" aria-pressed={pretoEBranco} onClick={() => setPretoEBranco((v) => !v)}>
          <span>Preto e branco</span>
          <span className={`a11y-switch ${pretoEBranco ? "is-on" : ""}`} aria-hidden="true"></span>
        </button>

        <button type="button" className="a11y-linha" aria-pressed={leitorAtivo} onClick={() => setLeitorAtivo((v) => !v)}>
          <span>
            Leitor de tela
            <small>Clique em um texto da página para ouvi-lo.</small>
          </span>
          <span className={`a11y-switch ${leitorAtivo ? "is-on" : ""}`} aria-hidden="true"></span>
        </button>

        <button type="button" className="a11y-linha" onClick={abrirLibras}>
          <span>Tradução em Libras (VLibras)</span>
          <i className="fa-solid fa-hands" aria-hidden="true"></i>
        </button>

        <button type="button" className="a11y-redefinir" onClick={redefinir}>
          Redefinir preferências
        </button>
      </div>
    </div>
  );
}

export default AcessibilidadeMenu;
