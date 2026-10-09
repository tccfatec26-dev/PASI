import { useState } from "react";
import "./Desafio.css";

const desafios = [
  ["fa-file-lines", "Muitos documentos", "Informações dispersas e repetitivas dificultam o atendimento eficiente."],
  ["fa-clock", "Filas longas", "Tempo de espera que poderia ser evitado com processos digitais."],
  ["fa-code-branch", "Falta de integração", "Serviços que não se comunicam entre si, gerando retrabalho constante."],
    ["fa-lock", "Dados sensíveis vulneráveis", "Fichas em papel podem se perder por falhas no arquivamento ou até por desastres naturais."],
  ["fa-clipboard", "Muita papelada", "Fichas físicas e processos manuais que ocupam espaço e atrasam o atendimento."],
  ["fa-circle-question", "Informações confusas", "Dificuldade para entender o que é necessário em cada etapa."],
  ["fa-location-dot", "Deslocamentos obrigatórios", "Ir até a unidade só para preencher a triagem pesa para quem mais precisa do serviço."],
  ["fa-users", "Sobrecarga das equipes", "Profissionais sob estresse, com retrabalho e tarefas administrativas repetitivas."],
];

function Desafio() {
  const [activeIndex, setActiveIndex] = useState(Math.floor(desafios.length / 2));

  // loop: do último volta pro primeiro, e vice-versa
  const showPrevious = () => {
    setActiveIndex((current) => (current - 1 + desafios.length) % desafios.length);
  };

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % desafios.length);
  };

  return (
    <section className="desafio" id="desafio">
      <div className="desafio-top">
        <div className="desafio-label">o desafio atual</div>
      </div>
      <div className='colorwhite'>
        <div className="desafio-intro">
        <h2>por que a triagem da assistência social <span>precisa evoluir?</span></h2>
        <p>As filas, a papelada e a falta de integração ainda dificultam o acesso a <br />quem mais precisa. Conheça alguns dos principais desafios.</p>
      </div>
      <div className="desafios-carousel" aria-label="Principais desafios da triagem">
        <button
          className="carousel-control carousel-control-prev"
          type="button"
          onClick={showPrevious}
          aria-label="Ver desafio anterior"
        >
          <i className="fa-solid fa-arrow-left" aria-hidden="true"></i>
        </button>

        <div className="desafios-viewport">
          <div
            className="desafios-track"
            style={{ "--active-index": activeIndex } as React.CSSProperties}
          >
            {desafios.map(([icon, title, description], index) => (
              <article
                className={`desafio-card ${index === activeIndex ? "is-active" : ""}`}
                key={title}
                role="button"
                tabIndex={0}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setActiveIndex(index);
                  }
                }}
                aria-current={index === activeIndex ? "true" : undefined}
              >
                <div className="desafio-card-content">
                <span className="desafio-card-number">0{index + 1}</span>
                <div className="desafio-icon" aria-hidden="true"><i className={`fa-solid ${icon}`}></i></div>
                <h3>{title}</h3>
                <p>{description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        <button
          className="carousel-control carousel-control-next"
          type="button"
          onClick={showNext}
          aria-label="Ver próximo desafio"
        >
          <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
        </button>

        <p className="sr-only" aria-live="polite">
          Desafio {activeIndex + 1} de {desafios.length}: {desafios[activeIndex][1]}
        </p>

        <div className="carousel-dots" aria-label="Selecionar desafio">
          {desafios.map(([, title], index) => (
            <button
              className={`carousel-dot ${index === activeIndex ? "is-active" : ""}`}
              type="button"
              key={title}
              onClick={() => setActiveIndex(index)}
              aria-label={`Ir para o desafio ${index + 1}: ${title}`}
              aria-current={index === activeIndex ? "true" : undefined}
            />
          ))}
        </div>
      </div>
      <div className="desafio-cta"><div className="cta-content">
        <h2><span className="cta-icon" aria-hidden="true"><i className="fa-solid fa-bolt"></i></span>Com o PASI, isso pode mudar.</h2>
        <p>Tecnologia a favor das pessoas — simplificando a triagem, integrando os <br />serviços e colocando o atendimento humano no centro.</p>
        <a href="#projeto" className="cta-button">Conhecer o PASI <i className="fa-solid fa-arrow-right" aria-hidden="true"></i></a>
      </div></div>
      </div>
      
    </section>
  );
}

export default Desafio;