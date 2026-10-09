import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { DOWNLOAD_URL } from "../../data/links";
import { useReveal } from "../../hooks/useReveal";
import "./Publicos.css";

type Publico = {
  id: string;
  aba: string;
  icon: string;
  titulo: string;
  intro: string;
  itens: { icon: string; titulo: string; texto: string }[];
  cta: { href: string; label: string; icon: string; estilo: string };
  telaTitulo: string;
  tela: string[];
  telaBotao: string;
};

const publicos: Publico[] = [
  {
    id: "cidadao",
    aba: "Cidadão",
    icon: "fa-user",
    titulo: "Para quem busca atendimento",
    intro: "Com o perfil de paciente, você faz a sua parte da triagem pelo celular, sem fila e sem papel.",
    itens: [
      { icon: "fa-list-check", titulo: "Realizar a triagem", texto: "Responda o formulário de mapeamento no seu tempo, em etapas curtas." },
      { icon: "fa-pen-to-square", titulo: "Preencher formulários", texto: "Formulários iniciais ou de avaliação, com campos simples de texto e de escolha." },
      { icon: "fa-paperclip", titulo: "Enviar informações", texto: "Anexe documentos e conte o que for importante no campo descritivo." },
      { icon: "fa-circle-check", titulo: "Acompanhar", texto: "Consulte o que enviou e atualize suas informações básicas quando precisar." },
      { icon: "fa-universal-access", titulo: "Acessibilidade", texto: "Leitura em voz alta das telas prevista para quem tem dificuldade de leitura." },
    ],
    cta: { href: DOWNLOAD_URL, label: "Baixar o aplicativo", icon: "fa-download", estilo: "btn-primary" },
    telaTitulo: "Triagem",
    tela: ["Sintomas ou encaminhamento", "Histórico médico e social", "Detalhes adicionais", "Documentos anexados"],
    telaBotao: "Continuar",
  },
  {
    id: "profissional",
    aba: "Profissional",
    icon: "fa-user-doctor",
    titulo: "Para quem atende no CRAS, CAPS e CREAS",
    intro: "Com o perfil de profissional, confirmado por um ID de Acesso, a equipe recebe as triagens já organizadas.",
    itens: [
      { icon: "fa-inbox", titulo: "Gerenciar atendimentos", texto: "Veja as triagens recebidas e dê o encaminhamento adequado a cada caso." },
      { icon: "fa-file-circle-plus", titulo: "Gerenciar formulários", texto: "Crie formulários e novas versões, adaptados à rotina de cada serviço." },
      { icon: "fa-table-list", titulo: "Visualizar respostas", texto: "Respostas agrupadas por nome do paciente e por tipo de avaliação." },
      { icon: "fa-clipboard-check", titulo: "Avaliar", texto: "Analise e valide as informações e os documentos enviados." },
      { icon: "fa-users", titulo: "Organizar pacientes", texto: "Pacientes cadastrados em listas e cards fáceis de encontrar." },
    ],
    cta: { href: "#seguranca", label: "Entenda os níveis de acesso", icon: "fa-shield-halved", estilo: "btn-secondary" },
    telaTitulo: "Respostas",
    tela: ["Por nome do paciente", "Por tipo de avaliação", "Validar informações", "Nova versão do formulário"],
    telaBotao: "Avaliar",
  },
];

function Publicos() {
  const sectionRef = useReveal<HTMLElement>();
  const [ativo, setAtivo] = useState(0);
  const abasRef = useRef<(HTMLButtonElement | null)[]>([]);

  // links para "#aba-profissional" (ou "#aba-cidadao") já abrem a aba certa
  useEffect(() => {
    const abrirPeloHash = () => {
      const index = publicos.findIndex((publico) => `#aba-${publico.id}` === window.location.hash);
      if (index >= 0) setAtivo(index);
    };

    abrirPeloHash();
    window.addEventListener("hashchange", abrirPeloHash);

    return () => window.removeEventListener("hashchange", abrirPeloHash);
  }, []);

  // setas movem entre as abas (padrão de tabs acessível)
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;

    event.preventDefault();
    const proximo = (ativo + (event.key === "ArrowRight" ? 1 : -1) + publicos.length) % publicos.length;
    setAtivo(proximo);
    abasRef.current[proximo]?.focus();
  };

  return (
    <section ref={sectionRef} className="publicos" id="para-quem" aria-labelledby="publicos-titulo">
      <div className="container">
        <div className="publicos-header reveal">
          <span className="section-tag">Para quem é</span>
          <h2 className="section-headline" id="publicos-titulo">
            Um sistema, <span>dois jeitos de usar.</span>
          </h2>
          <p className="section-lead">
            O PASI tem dois perfis de acesso. Cada um vê o que precisa para a sua parte do atendimento.
          </p>
        </div>

        <div className="publicos-abas reveal" role="tablist" aria-label="Escolha o público">
          {publicos.map((publico, index) => (
            <button
              key={publico.id}
              ref={(el) => { abasRef.current[index] = el; }}
              type="button"
              role="tab"
              id={`aba-${publico.id}`}
              aria-selected={ativo === index}
              aria-controls={`painel-${publico.id}`}
              tabIndex={ativo === index ? 0 : -1}
              className={ativo === index ? "is-selected" : undefined}
              onClick={() => setAtivo(index)}
              onKeyDown={onKeyDown}
            >
              <i className={`fa-solid ${publico.icon}`} aria-hidden="true"></i>
              {publico.aba}
            </button>
          ))}
        </div>

        {publicos.map((publico, index) => (
          <div
            key={publico.id}
            className="publicos-painel reveal"
            role="tabpanel"
            id={`painel-${publico.id}`}
            aria-labelledby={`aba-${publico.id}`}
            hidden={ativo !== index}
          >
            <div className="publicos-texto">
              <h3>{publico.titulo}</h3>
              <p className="publicos-intro">{publico.intro}</p>

              <ul className="publicos-lista">
                {publico.itens.map((item) => (
                  <li key={item.titulo}>
                    <span className="icon-tile" aria-hidden="true">
                      <i className={`fa-solid ${item.icon}`}></i>
                    </span>
                    <div>
                      <strong>{item.titulo}</strong>
                      <span>{item.texto}</span>
                    </div>
                  </li>
                ))}
              </ul>

              <a href={publico.cta.href} className={`btn ${publico.cta.estilo}`}>
                <i className={`fa-solid ${publico.cta.icon}`} aria-hidden="true"></i>
                {publico.cta.label}
              </a>
            </div>

            <div className="publicos-visual" aria-hidden="true">
              <div className="publicos-prancheta">
                <span className="publicos-prancheta-clip"></span>
                <div className="publicos-prancheta-chip">
                  <span className="publicos-prancheta-chip-dot"></span>
                  <span className="publicos-prancheta-chip-bar"></span>
                </div>
                <span className="publicos-prancheta-logo">pasi</span>
                <strong>{publico.telaTitulo}</strong>
                <div className="publicos-prancheta-lista">
                  {publico.tela.map((linha) => (
                    <span className="publicos-prancheta-item" key={linha}>
                      <i className="fa-solid fa-circle-check"></i>
                      {linha}
                    </span>
                  ))}
                </div>
                <span className="publicos-prancheta-botao">{publico.telaBotao}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default Publicos;
