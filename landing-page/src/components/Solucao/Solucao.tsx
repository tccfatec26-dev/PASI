import { useReveal } from "../../hooks/useReveal";
import "./Solucao.css";

const hoje = [
  "Fichas e formulários preenchidos em papel",
  "Filas e longo tempo de espera",
  "Deslocamento até a unidade só para a triagem",
  "Risco de perder informações sensíveis",
  "Estresse para equipes e para quem é atendido",
];

const comPasi = [
  "Formulários digitais, divididos em etapas",
  "Triagem online, de onde a pessoa estiver",
  "Informações reunidas em um sistema único",
  "Registros protegidos por login e níveis de acesso",
  "Mais tempo para o atendimento humano",
];

const ganhos = [
  { icon: "fa-bolt", titulo: "Agilidade", texto: "Menos espera e etapas manuais." },
  { icon: "fa-box-archive", titulo: "Menos arquivo físico", texto: "Menos papel para guardar e perder." },
  { icon: "fa-universal-access", titulo: "Acessibilidade", texto: "Pensado para diferentes públicos." },
  { icon: "fa-leaf", titulo: "Sustentabilidade", texto: "Menor consumo de papel." },
];

function Solucao() {
  const sectionRef = useReveal<HTMLElement>();

  return (
    <section ref={sectionRef} className="solucao" id="projeto" aria-labelledby="solucao-titulo">
      <div className="container">
        <div className="solucao-header reveal">
          <div>
            <span className="section-tag">A solução</span>
            <h2 className="section-display" id="solucao-titulo">
              do papel <span>para o celular.</span>
            </h2>
          </div>
          <p className="section-lead">
            O PASI transforma a triagem do CRAS, do CAPS e do CREAS em formulários digitais,
            reunidos em um só sistema. Quem precisa de atendimento ganha tempo, e quem atende
            recebe as informações organizadas.
          </p>
        </div>

        <div className="comparacao reveal">
          <div className="comparacao-lado comparacao-hoje">
            <span className="comparacao-tag">Hoje</span>
            <h3>Papel, fila e deslocamento</h3>
            <ul>
              {hoje.map((item) => (
                <li key={item}>
                  <i className="fa-solid fa-xmark" aria-hidden="true"></i>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="comparacao-seta" aria-hidden="true">
            <i className="fa-solid fa-arrow-right"></i>
          </div>

          <div className="comparacao-lado comparacao-pasi">
            <span className="comparacao-tag">Com o PASI</span>
            <h3>Triagem digital e organizada</h3>
            <ul>
              {comPasi.map((item) => (
                <li key={item}>
                  <i className="fa-solid fa-check" aria-hidden="true"></i>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ul className="ganhos reveal" aria-label="Ganhos do PASI">
          {ganhos.map((ganho) => (
            <li className="ganho" key={ganho.titulo}>
              <span className="icon-tile" aria-hidden="true">
                <i className={`fa-solid ${ganho.icon}`}></i>
              </span>
              <div>
                <strong>{ganho.titulo}</strong>
                <span>{ganho.texto}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default Solucao;
