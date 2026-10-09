import { DOWNLOAD_URL } from "../../data/links";
import "./Hero.css";

function Hero() {
  return (
    <section className="hero" id="inicio">
      <div className="hero-content">
        <h1>a assistência social brasileira de cara nova. sem filas. <span className="hero-emphasis">sem papel.</span></h1>
        <p className="hero-description">O PASI digitaliza a triagem e integra os atendimentos em um só lugar, tornando o acesso aos serviços públicos de assistência mais simples, humano e eficiente.</p>
        <div className="hero-buttons">
          <a href={DOWNLOAD_URL} className="primary-button"><i className="fa-solid fa-download" aria-hidden="true"></i>Baixar o aplicativo</a>
          <a href="#projeto" className="secondary-button">Saiba mais</a>
        </div>
      </div>
      <div className="benefits">
        <div className="benefit-card"><div className="benefit-icon heart" aria-hidden="true"><i className="fa-solid fa-heart"></i></div><p><strong>Mais acesso e inclusão</strong><br />com uma gestão mais eficiente.</p></div>
        <div className="benefit-card"><div className="benefit-icon people" aria-hidden="true"><i className="fa-solid fa-people-group"></i></div><p><strong>Menos burocracia</strong> para o<br />cidadão em vulnerabilidade.</p></div>
        <div className="benefit-card"><div className="benefit-icon care" aria-hidden="true"><i className="fa-solid fa-hand-holding-heart"></i></div><p><strong>Mais clareza</strong> para<br />profissionais focarem no<br /><strong>atendimento</strong> humano.</p></div>
      </div>
    </section>
  );
}

export default Hero;
