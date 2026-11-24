import { CHATBOT_URL } from "../../data/links";
import { useReveal } from "../../hooks/useReveal";
import "./Suporte.css";

const assuntos = [
  { icon: "fa-people-roof", texto: "O que é e o que faz o CRAS" },
  { icon: "fa-brain", texto: "Como funciona o atendimento no CAPS" },
  { icon: "fa-hand-holding-heart", texto: "Quando procurar o CREAS" },
  { icon: "fa-mobile-screen", texto: "Como usar o PASI" },
];

function Suporte() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section ref={sectionRef} className="suporte" id="suporte" aria-labelledby="suporte-titulo">
      <div className="container suporte-grid">
        <div className="suporte-intro reveal">
          <span className="section-tag">Suporte</span>
          <h2 className="section-headline" id="suporte-titulo">
            Converse com o <span>suporte do PASI.</span>
          </h2>
          <p className="section-lead">
            Tire dúvidas sobre como funcionam os serviços públicos de assistência social, o CRAS, o CAPS e o CREAS, e sobre
            como usar a nossa plataforma. É uma conversa normal: escreva do seu jeito.
          </p>

          <ul className="suporte-assuntos" aria-label="Assuntos que você pode perguntar">
            {assuntos.map((assunto) => (
              <li key={assunto.texto}>
                <span className="icon-tile" aria-hidden="true">
                  <i className={`fa-solid ${assunto.icon}`}></i>
                </span>
                {assunto.texto}
              </li>
            ))}
          </ul>

          <div className="suporte-nota">
            <i className="fa-solid fa-shield-heart" aria-hidden="true"></i>
            <p>
              O assistente é um apoio para tirar dúvidas e não substitui o atendimento na unidade. Não envie documentos nem
              informações pessoais ou de saúde na conversa.
            </p>
          </div>
        </div>

        <div className="suporte-chat reveal">
          {CHATBOT_URL ? (
            <>
              <iframe
                className="suporte-chat-quadro"
                src={CHATBOT_URL}
                title="Chat de suporte do PASI"
                loading="lazy"
                allow="clipboard-write"
              />
              <a className="suporte-chat-aberto" href={CHATBOT_URL} target="_blank" rel="noopener noreferrer">
                Abrir o chat em uma nova aba
                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
              </a>
            </>
          ) : (
            <div className="suporte-chat-vazio" role="status">
              <span className="icon-tile" aria-hidden="true">
                <i className="fa-solid fa-comments"></i>
              </span>
              <strong>O chat de suporte chega em breve.</strong>
              <p>Enquanto isso, veja as perguntas frequentes ou escreva para a equipe pelo formulário de contato.</p>
              <a href="#contato" className="btn btn-primary">
                Falar com a equipe
                <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Suporte;
