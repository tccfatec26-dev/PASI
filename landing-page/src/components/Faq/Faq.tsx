import { useState } from "react";
import { useReveal } from "../../hooks/useReveal";
import "./Faq.css";

// Respostas baseadas somente na documentação do projeto PASI.
const perguntas = [
  {
    id: "o-que-e",
    pergunta: "O que é o PASI?",
    resposta:
      "PASI significa Plataforma de Atendimento de Sistemas Integrados. É um aplicativo que digitaliza a triagem dos serviços públicos de assistência social: troca as fichas de papel por formulários digitais e reúne tudo em um sistema único.",
  },
  {
    id: "servicos",
    pergunta: "Para quais serviços o PASI foi pensado?",
    resposta:
      "Para o CRAS (Centro de Referência de Assistência Social), o CAPS (Centro de Atenção Psicossocial) e o CREAS (Centro de Referência Especializado de Assistência Social).",
  },
  {
    id: "substitui",
    pergunta: "O PASI substitui o atendimento na unidade?",
    resposta:
      "Não. O PASI digitaliza a triagem e organiza as informações. A análise, a validação e o encaminhamento de cada caso continuam sendo feitos pelos profissionais do serviço.",
  },
  {
    id: "ir-ate-a-unidade",
    pergunta: "Preciso ir até a unidade para fazer a triagem?",
    resposta:
      "Não necessariamente. A triagem pode ser feita online, pelo aplicativo. Quem preferir, ou não tiver smartphone, pode fazer a triagem presencialmente, com o profissional registrando as informações no PASI.",
  },
  {
    id: "quem-pode-usar",
    pergunta: "Quem pode usar o PASI?",
    resposta:
      "Há dois perfis: paciente, para quem busca atendimento, e profissional, para quem trabalha no CRAS, no CAPS ou no CREAS. O cadastro do profissional é confirmado por um ID de Acesso, que comprova o vínculo com a unidade.",
  },
  {
    id: "dificuldade-leitura",
    pergunta: "E quem tem dificuldade para ler?",
    resposta:
      "O projeto prevê a leitura em voz alta das telas, além de formulários divididos em etapas e feedback visual e sonoro. Esses recursos foram pensados para pessoas idosas, crianças e pessoas com pouca familiaridade com a leitura.",
  },
  {
    id: "seguranca",
    pergunta: "Meus dados ficam seguros?",
    resposta:
      "O acesso exige login com e-mail ou CPF e senha, e é dividido em níveis: só profissionais autorizados avaliam as informações. As ações ficam registradas para auditoria, e o tratamento dos dados segue a LGPD (Lei Geral de Proteção de Dados Pessoais).",
  },
  {
    id: "celulares",
    pergunta: "Em quais celulares o PASI funciona?",
    resposta:
      "O aplicativo é desenvolvido em React Native, uma tecnologia multiplataforma, para funcionar em diferentes sistemas operacionais de celular.",
  },
  {
    id: "quem-desenvolveu",
    pergunta: "Quem desenvolveu o PASI?",
    resposta:
      "O PASI nasceu como Projeto Interdisciplinar do curso de Desenvolvimento de Software Multiplataforma da Fatec Mauá, criado em 2026 por Anna Carolina de Azevedo Leite, Ellen Eufrasio de Oliveira e Hector Ferreira da Silva. O aplicativo é funcional e já pode ser adotado por unidades de assistência social, não se trata apenas de um exercício teórico.",
  },
  {
    id: "futuro",
    pergunta: "O que pode vir no futuro?",
    resposta:
      "A documentação cita possíveis melhorias, que ainda não fazem parte do PASI: inteligência artificial para apoiar a análise das respostas, assistentes virtuais, geolocalização e painéis administrativos para análise de dados.",
  },
];

function Faq() {
  const sectionRef = useReveal<HTMLElement>();
  const [abertas, setAbertas] = useState<string[]>([perguntas[0].id]);

  // várias podem ficar abertas ao mesmo tempo, para comparar respostas
  const alternar = (id: string) => {
    setAbertas((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]));
  };

  return (
    <section ref={sectionRef} className="faq" id="duvidas" aria-labelledby="faq-titulo">
      <div className="container faq-grid">
        <div className="faq-intro reveal">
          <span className="section-tag">Dúvidas</span>
          <h2 className="section-headline" id="faq-titulo">
            Perguntas <span>frequentes</span>
          </h2>
          <p className="section-lead">
            O essencial sobre o PASI, com base na documentação do projeto.
          </p>
          <a href="#contato" className="text-action">
            Ainda ficou com dúvida? Escreva para a equipe
            <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
          </a>
        </div>

        <div className="faq-lista reveal">
          {perguntas.map((item) => {
            const aberta = abertas.includes(item.id);

            return (
              <div className={`faq-item ${aberta ? "is-open" : ""}`} key={item.id}>
                <h3>
                  <button
                    type="button"
                    id={`pergunta-${item.id}`}
                    aria-expanded={aberta}
                    aria-controls={`resposta-${item.id}`}
                    onClick={() => alternar(item.id)}
                  >
                    {item.pergunta}
                    <span className="faq-chevron" aria-hidden="true">
                      <i className="fa-solid fa-chevron-down"></i>
                    </span>
                  </button>
                </h3>
                <div
                  className="faq-resposta"
                  id={`resposta-${item.id}`}
                  role="region"
                  aria-labelledby={`pergunta-${item.id}`}
                  aria-hidden={!aberta}
                >
                  <div className="faq-resposta-inner">
                    <p>{item.resposta}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default Faq;
