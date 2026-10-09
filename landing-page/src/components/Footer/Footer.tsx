import { LOGO_SRC, navLinks } from "../../data/links";
import "./Footer.css";

const projetoLinks = [
  { href: "#acessibilidade", label: "Acessibilidade" },
  { href: "#seguranca", label: "Segurança" },
  { href: "#contato", label: "Tirar dúvidas" },
  { href: "#baixar", label: "Baixar o aplicativo" },
];

const equipe = ["Anna Carolina de Azevedo Leite", "Ellen Eufrasio de Oliveira", "Hector Ferreira da Silva"];

function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-marca">
            <img src={LOGO_SRC} alt="PASI" />
            <p>
              Plataforma de Atendimento de Sistemas Integrados. A triagem da assistência social,
              digital, organizada e humana.
            </p>
            <span className="footer-servicos">CRAS · CAPS · CREAS</span>
          </div>

          <nav aria-label="Navegação do rodapé">
            <h2>Navegação</h2>
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </nav>

          <nav aria-label="Sobre o projeto">
            <h2>O projeto</h2>
            {projetoLinks.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </nav>

          <div className="footer-equipe">
            <h2>Equipe</h2>
            <ul>
              {equipe.map((nome) => (
                <li key={nome}>{nome}</li>
              ))}
            </ul>
            <p>
              Orientação: Bruno Zolotareff, Carlos Ronny e Lucas Bonilha.
            </p>
          </div>
        </div>

        <div className="footer-base">
          <span>
            © 2026 PASI · Projeto Interdisciplinar de Desenvolvimento de Software Multiplataforma · Fatec Mauá
          </span>
          <a href="#inicio" className="footer-topo">
            Voltar ao topo
            <i className="fa-solid fa-arrow-up" aria-hidden="true"></i>
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
