import { DOWNLOAD_URL } from "../../data/links";
import { useReveal } from "../../hooks/useReveal";
import "./CtaFinal.css";

function CtaFinal() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section ref={sectionRef} className="cta-final" id="baixar" aria-labelledby="cta-final-titulo">
      <div className="como-funciona-cta reveal">

        {/* TEXTO */}
        <div className="cta-text">
          <span>COMECE PELO PASI</span>


          <h2 id="cta-final-titulo">
            Menos fila, menos papel{" "}
            <br />
            e mais cuidado.
          </h2>

          <p>
            Baixe o aplicativo, crie sua conta e faça a triagem{" "}
            <br />
            de onde você estiver.
          </p>

          <div className="cta-buttons">
            <a href={DOWNLOAD_URL} className="btn btn-primary">
              <i className="fa-solid fa-download" aria-hidden="true"></i>
              Baixar o aplicativo
            </a>
            <a href="#aba-profissional" className="btn btn-secondary">
              Sou profissional
            </a>
          </div>
        </div>


        {/* CELULAR (ilustrativo: blocos abstratos, não é a tela real do app) */}
        <div className="cta-visual" aria-hidden="true">
          <div className="phone-decoration">
            <div className="phone-top"></div>
            <div className="phone-logo">pasi</div>
            <div className="phone-skeleton">
              <span className="phone-row phone-row-wide"></span>
              <span className="phone-row"></span>
              <span className="phone-check">
                <i className="fa-solid fa-circle-check"></i>
                <span className="phone-row phone-row-mid"></span>
              </span>
            </div>
            <div className="phone-button">
              <i className="fa-solid fa-download"></i>
            </div>
          </div>
        </div>


        {/* ANOTAÇÃO */}
        <div className="cta-note" aria-hidden="true">
          <span>é só baixar<br />e começar.</span>
          <i className="fa-solid fa-arrow-down-long"></i>
        </div>

      </div>

      {/* ALTERNATIVA SEM SMARTPHONE */}
      <div className="cta-alternativa reveal">
        <span className="icon-tile" aria-hidden="true">
          <i className="fa-solid fa-building-user"></i>
        </span>
        <div>
          <strong>Não tem smartphone?</strong>
          <p>A triagem também pode ser feita na unidade, com a ajuda de um profissional, direto no PASI.</p>
        </div>
      </div>
    </section>
  );
}

export default CtaFinal;
