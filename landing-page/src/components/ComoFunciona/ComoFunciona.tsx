import { useState } from "react";
import { useReveal } from "../../hooks/useReveal";
import "./ComoFunciona.css";

const etapas = [
  {
    numero: "01",
    icon: "fa-right-to-bracket",
    titulo: "Acesse o PASI",
    texto:
      "Entre com seu e-mail ou CPF e sua senha. Esqueceu a senha? Dá para recuperar pelo próprio aplicativo.",
    detalhe: "Acesso",
  },
  {
    numero: "02",
    icon: "fa-id-card",
    titulo: "Identifique-se",
    texto:
      "Na primeira vez, crie sua conta: escolha o perfil de paciente ou de profissional e informe dados básicos, como nome, CPF, e-mail e telefone.",
    detalhe: "Identificação",
  },
  {
    numero: "03",
    icon: "fa-list-check",
    titulo: "Faça a triagem",
    texto:
      "Responda o formulário em etapas curtas: sintomas ou encaminhamento, histórico e o que mais quiser contar.",
    detalhe: "Triagem",
  },
  {
    numero: "04",
    icon: "fa-paper-plane",
    titulo: "Envie suas informações",
    texto:
      "Anexe os documentos pedidos e envie tudo pelo aplicativo, sem levar papel até a unidade.",
    detalhe: "Envio de informações",
  },
  {
    numero: "05",
    icon: "fa-user-doctor",
    titulo: "Avaliação profissional",
    texto:
      "Um profissional do CRAS, do CAPS ou do CREAS analisa as respostas, valida as informações e faz o encaminhamento.",
    detalhe: "Avaliação",
  },
  {
    numero: "06",
    icon: "fa-circle-check",
    titulo: "Acompanhe pelo PASI",
    texto:
      "O que você enviou fica registrado no aplicativo, e você pode manter suas informações básicas sempre atualizadas.",
    detalhe: "Acompanhamento",
  },
];

function ComoFunciona() {
  const sectionRef = useReveal<HTMLElement>("como-funciona-visible");
  const [etapaAtiva, setEtapaAtiva] = useState(0);
  const etapaSelecionada = etapas[etapaAtiva];

  return (
    <section
      ref={sectionRef}
      className="como-funciona"
      id="como-funciona"
      aria-labelledby="como-funciona-titulo"
    >

      {/* INTRODUÇÃO */}
      <div className="como-funciona-header">

        <span className="section-tag">
          COMO FUNCIONA
        </span>

        <h2 id="como-funciona-titulo">
          Na prática, <span>é simples.</span>
        </h2>

        <p>
          Do primeiro acesso à avaliação profissional, o PASI guia cada etapa{" "}
          <br />
          de forma clara, segura e acessível.
        </p>

      </div>


      <div className="etapas-interativo">
        <nav className="etapas-navegacao" aria-label="Etapas da triagem">
          <ol>
            {etapas.map((etapa, index) => (
              <li key={etapa.numero}>
                <button
                  className={etapaAtiva === index ? "is-active" : undefined}
                  type="button"
                  aria-pressed={etapaAtiva === index}
                  aria-controls="etapa-detalhe"
                  onClick={() => setEtapaAtiva(index)}
                >
                  <span className="etapa-botao-numero">{etapa.numero}</span>
                  <span className="etapa-botao-titulo">{etapa.titulo}</span>
                  <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <article className="etapa-painel" id="etapa-detalhe" aria-live="polite">
          <div className="etapa-painel-cabecalho">
            <span className="etapa-painel-icone" aria-hidden="true">
              <i className={`fa-solid ${etapaSelecionada.icon}`}></i>
            </span>
            <span className="etapa-painel-detalhe">{etapaSelecionada.detalhe}</span>
          </div>
          <span className="etapa-painel-numero">ETAPA {etapaSelecionada.numero}</span>
          <h3>{etapaSelecionada.titulo}</h3>
          <p>{etapaSelecionada.texto}</p>
          <div className="etapa-painel-progresso">
            <span>Etapa {etapaAtiva + 1} de {etapas.length}</span>
            <span
              className="etapa-painel-trilho"
              role="progressbar"
              aria-label="Progresso da triagem"
              aria-valuemin={1}
              aria-valuemax={etapas.length}
              aria-valuenow={etapaAtiva + 1}
            >
              <span style={{ width: `${((etapaAtiva + 1) / etapas.length) * 100}%` }}></span>
            </span>
          </div>
        </article>
      </div>

    </section>
  );
}

export default ComoFunciona;