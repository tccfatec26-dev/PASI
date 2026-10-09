import { useEffect, useState } from "react";
import { DOWNLOAD_URL, LIGHT_LOGO_SRC, LOGO_SRC, navLinks } from "../../data/links";
import AcessibilidadeMenu from "../AcessibilidadeMenu/AcessibilidadeMenu";
import "./Header.css";

function Header() {
  const [isSolid, setIsSolid] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState(navLinks[0].href);

  // fundo sólido depois de 80px de rolagem
  useEffect(() => {
    const onScroll = () => setIsSolid(window.scrollY > 80);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // link ativo acompanha a seção visível
  useEffect(() => {
    const sections = navLinks
      .map((link) => document.querySelector<HTMLElement>(link.href))
      .filter((section): section is HTMLElement => section !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveHref(`#${entry.target.id}`);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    sections.forEach((section) => observer.observe(section));

    return () => observer.disconnect();
  }, []);

  // menu mobile: Esc fecha e a página não rola por trás
  useEffect(() => {
    if (!isMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className={`header ${isSolid || isMenuOpen ? "is-solid" : ""}`}>
      <div className="header-content">
        <a href="#inicio" className="logo" aria-label="PASI, voltar ao início" onClick={closeMenu}>
          <img className="logo-light" src={LIGHT_LOGO_SRC} alt="" aria-hidden="true" />
          <img className="logo-dark" src={LOGO_SRC} alt="" aria-hidden="true" />
        </a>

        <nav className="navigation" aria-label="Principal">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={activeHref === link.href ? "active" : undefined}
              aria-current={activeHref === link.href ? "true" : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="header-acoes">
          <AcessibilidadeMenu />
          <a href={DOWNLOAD_URL} className="download-button">Baixar o app</a>
        </div>

        <button
          className="menu-button"
          type="button"
          aria-label={isMenuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={isMenuOpen}
          aria-controls="menu-mobile"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <i className={`fa-solid ${isMenuOpen ? "fa-xmark" : "fa-bars"}`} aria-hidden="true"></i>
        </button>
      </div>

      <div className={`menu-mobile ${isMenuOpen ? "is-open" : ""}`} id="menu-mobile" hidden={!isMenuOpen}>
        <nav aria-label="Menu">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={activeHref === link.href ? "active" : undefined}
              onClick={closeMenu}
            >
              {link.label}
              <i className="fa-solid fa-chevron-right" aria-hidden="true"></i>
            </a>
          ))}
        </nav>

        <a href={DOWNLOAD_URL} className="btn btn-primary menu-mobile-cta" onClick={closeMenu}>
          <i className="fa-solid fa-download" aria-hidden="true"></i>
          Baixar o aplicativo
        </a>
      </div>
    </header>
  );
}

export default Header;
