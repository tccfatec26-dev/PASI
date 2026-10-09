import { useReveal } from "../../hooks/useReveal";
import "./Seguranca.css";

const niveis = [
  {
    nivel: "Privilégio máximo",
    quem: "Profissional com cargo de gestão, como gerente",
    texto: "Acesso mais amplo, de acordo com a função na unidade.",
    icon: "fa-user-tie",
  },
  {
    nivel: "Privilégio intermediário",
    quem: "Profissional de apoio, como recepcionista",
    texto: "Acesso ao que a função pede, com mais restrições.",
    icon: "fa-user-gear",
  },
  {
    nivel: "Privilégio mínimo",
    quem: "Paciente",
    texto: "Preenche formulários e anexa documentos. Não aprova nem valida.",
    icon: "fa-user",
  },
];

// cartões decorativos do núcleo de segurança (resumo visual dos níveis de acesso)
const perfisVisual = [
  { titulo: "Gestão", texto: "Acesso amplo para gerenciar a unidade.", icon: "fa-user-tie" },
  { titulo: "Atendimento", texto: "Acesso às funções do dia a dia da unidade.", icon: "fa-user-gear" },
  { titulo: "Paciente", texto: "Preenche formulários e envia documentos.", icon: "fa-user" },
];

function Seguranca() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section ref={sectionRef} className="seguranca" id="seguranca" aria-labelledby="seguranca-titulo">
      <div className="container">

        <div className="seguranca-grid">
          <div className="seguranca-texto reveal">
            <div className="seguranca-bloco">
              <div className="seguranca-header reveal">
              <span className="section-tag">Segurança</span>
              <h2 className="section-headline" id="seguranca-titulo">
                Cada pessoa vê <span>só o que precisa.</span>
              </h2>
              <p className="section-lead">
                O PASI lida com informações sensíveis de saúde e de assistência social. Por isso,
                o acesso é dividido em níveis, e cada ação importante fica registrada.
              </p>
            </div>

              <h3 className="seguranca-subtitulo">Níveis de acesso</h3>
              <ol className="seguranca-lista">
                {niveis.map((item) => (
                  <li key={item.nivel}>
                    <span className="icon-tile" aria-hidden="true">
                      <i className={`fa-solid ${item.icon}`}></i>
                    </span>
                    <div>
                      <strong>{item.nivel}</strong>
                      <span>{item.quem}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <p className="seguranca-nota">
              <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
              Menos papel também é menos risco: sem fichas físicas, diminui a chance de perder
              informações por falhas no arquivamento ou por desastres.
            </p>
          </div>

          <div className="seguranca-visual reveal" aria-hidden="true">
            <span className="seguranca-anel seguranca-anel-1"></span>
            <span className="seguranca-anel seguranca-anel-2"></span>

            <svg className="seguranca-linhas" viewBox="0 0 480 440" preserveAspectRatio="none">
              <path d="M240,220 Q200,150 165,85" />
              <path d="M240,220 Q280,205 300,190" />
              <path d="M240,220 Q210,300 195,345" />
            </svg>

            <div className="seguranca-nucleo">
              <i className="fa-solid fa-shield-halved"></i>
            </div>

            {perfisVisual.map((perfil, index) => (
              <div className={`seguranca-card seguranca-card-${index + 1}`} key={perfil.titulo}>
                <span className="seguranca-card-icon">
                  <i className={`fa-solid ${perfil.icon}`}></i>
                </span>
                <strong>{perfil.titulo}</strong>
                <span>{perfil.texto}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Seguranca;
