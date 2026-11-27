import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { acordarApi, obterSessao, perguntar, renovarSessao } from "./api";
import {
  MENSAGEM_RISCO,
  OPCOES_INICIAIS,
  OPCOES_TRIAGEM,
  SERVICOS,
  classificar,
  formatarCep,
  indicaRisco,
  linkDoMapa,
  opcoesDepoisDoServico,
} from "./servicos";
import type { Opcao, TipoServico } from "./servicos";
import TextoFormatado from "./TextoFormatado";
import "./Assistente.css";

type Mensagem =
  | { id: number; autor: "pessoa"; texto: string }
  | { id: number; autor: "assistente"; texto: string; opcoes?: Opcao[]; mapa?: string; fontes?: string[] }
  | { id: number; autor: "assistente"; servico: TipoServico; opcoes?: Opcao[] };

type NovaMensagem = Mensagem extends infer M ? (M extends Mensagem ? Omit<M, "id"> : never) : never;

type ModoCep = { servico: TipoServico | null } | null;

const CHAVE_AVISO = "pasi-assistente-aviso-fechado";
const ATRASO_AVISO_MS = 5000;
const ATRASO_DEMORA_MS = 6000;

const BOAS_VINDAS: NovaMensagem[] = [
  {
    autor: "assistente",
    texto:
      "Oi! Eu sou a assistente digital do PASI.\nPosso te ajudar a descobrir qual serviço procurar (CRAS, CAPS ou CREAS) e encontrar a unidade mais perto de você.",
  },
  {
    autor: "assistente",
    texto: "Sobre o que você precisa de ajuda? Escolha uma opção ou escreva com suas palavras.",
    opcoes: OPCOES_INICIAIS,
  },
];

function avisoJaFechado() {
  try {
    return localStorage.getItem(CHAVE_AVISO) === "1";
  } catch {
    return false;
  }
}

function Assistente() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [rascunho, setRascunho] = useState("");
  const [pensando, setPensando] = useState(false);
  const [demorando, setDemorando] = useState(false);
  const [modoCep, setModoCep] = useState<ModoCep>(null);
  const [ultimoServico, setUltimoServico] = useState<TipoServico | null>(null);
  const [mostrarAviso, setMostrarAviso] = useState(false);

  const proximoId = useRef(1);
  const sessao = useRef<string | null>(null);
  const contextoEnviado = useRef(false);
  const listaRef = useRef<HTMLDivElement | null>(null);
  const campoRef = useRef<HTMLInputElement | null>(null);
  const botaoRef = useRef<HTMLButtonElement | null>(null);

  // balão de convite, uma vez por visitante, alguns segundos depois de abrir o site
  useEffect(() => {
    if (avisoJaFechado()) return;
    const timer = window.setTimeout(() => setMostrarAviso(true), ATRASO_AVISO_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // mantém a última mensagem à vista
  useEffect(() => {
    const lista = listaRef.current;
    if (lista) lista.scrollTop = lista.scrollHeight;
  }, [mensagens, pensando, demorando]);

  // ao abrir, o foco vai para o campo de texto
  useEffect(() => {
    if (aberto) campoRef.current?.focus({ preventScroll: true });
  }, [aberto]);

  const adicionar = (...novas: NovaMensagem[]) => {
    const comId = novas.map((m) => ({ ...m, id: proximoId.current++ }) as Mensagem);
    setMensagens((atuais) => [...atuais, ...comId]);
  };

  const fecharAviso = () => {
    setMostrarAviso(false);
    try {
      localStorage.setItem(CHAVE_AVISO, "1");
    } catch {
      // sem localStorage: o aviso pode voltar na próxima visita
    }
  };

  const abrir = () => {
    fecharAviso();
    setAberto(true);
    if (mensagens.length === 0) adicionar(...BOAS_VINDAS);
    acordarApi();
  };

  const fechar = () => {
    setAberto(false);
    botaoRef.current?.focus();
  };

  const recomecar = () => {
    sessao.current = renovarSessao();
    contextoEnviado.current = false;
    setModoCep(null);
    setUltimoServico(null);
    setRascunho("");
    setMensagens([]);
    adicionar(...BOAS_VINDAS);
    campoRef.current?.focus();
  };

  const indicarServico = (servico: TipoServico) => {
    setUltimoServico(servico);
    adicionar(
      { autor: "assistente", texto: `Pelo que você contou, o lugar indicado é o ${servico}.` },
      { autor: "assistente", servico, opcoes: opcoesDepoisDoServico(servico) }
    );
  };

  /** Envia a pergunta para a IA. `textoOriginal` é usado na triagem local se a API falhar. */
  const consultarIa = async (
    mensagemApi: string,
    textoOriginal: string,
    extras: { mapa?: string; opcoes?: Opcao[]; servicoCep?: TipoServico | null } = {}
  ) => {
    sessao.current ??= obterSessao();
    setPensando(true);
    setDemorando(false);
    const avisoDemora = window.setTimeout(() => setDemorando(true), ATRASO_DEMORA_MS);
    try {
      const { resposta, fontes } = await perguntar(mensagemApi, sessao.current);
      contextoEnviado.current = true;
      adicionar({ autor: "assistente", texto: resposta, fontes, mapa: extras.mapa, opcoes: extras.opcoes });
    } catch {
      if (extras.servicoCep !== undefined) {
        adicionar({
          autor: "assistente",
          texto:
            "Não consegui consultar as unidades agora. Tente de novo em instantes, abra o mapa abaixo ou ligue " +
            "para a prefeitura (Secretaria de Saúde ou de Assistência Social) para saber qual unidade atende o seu endereço.",
          mapa: extras.mapa,
          opcoes: extras.opcoes,
        });
      } else {
        const servico = classificar(textoOriginal);
        adicionar({
          autor: "assistente",
          texto: servico
            ? "Estou sem conexão com a assistente completa agora, mas posso te orientar pelo que você escreveu."
            : "Estou sem conexão com a assistente completa agora. Pode escolher uma das opções abaixo?",
          opcoes: servico ? undefined : OPCOES_INICIAIS,
        });
        if (servico) indicarServico(servico);
      }
    } finally {
      window.clearTimeout(avisoDemora);
      setPensando(false);
      setDemorando(false);
    }
  };

  const pedirCep = (servico: TipoServico | null) => {
    setModoCep({ servico });
    setRascunho("");
    const alvo = servico ? `o ${servico} mais próximo` : "as unidades de CRAS, CAPS e CREAS mais próximas";
    adicionar({
      autor: "assistente",
      texto: `Digite o CEP que você quer pesquisar (só os números) e eu mostro ${alvo}.`,
      opcoes: [
        { rotulo: "Não sei meu CEP", acao: { tipo: "semCep" } },
        { rotulo: "Voltar ao início", acao: { tipo: "inicio" } },
      ],
    });
    campoRef.current?.focus();
  };

  const buscarCep = (digitos: string, servico: TipoServico | null) => {
    const cep = formatarCep(digitos);
    setModoCep(null);
    adicionar({ autor: "pessoa", texto: cep });
    const pergunta = servico
      ? `Meu CEP é ${cep}. Qual o ${servico} mais próximo?`
      : `Meu CEP é ${cep}. Quais são o CRAS, o CREAS e o CAPS mais próximos?`;
    void consultarIa(pergunta, cep, {
      servicoCep: servico,
      mapa: linkDoMapa(servico, cep),
      opcoes: [
        { rotulo: "Buscar outro CEP", acao: { tipo: "cep", servico } },
        { rotulo: "Como começar a triagem", acao: { tipo: "comoComecar" } },
        { rotulo: "Voltar ao início", acao: { tipo: "inicio" } },
      ],
    });
  };

  const escolher = (opcao: Opcao) => {
    if (pensando) return;
    adicionar({ autor: "pessoa", texto: opcao.rotulo });
    const { acao } = opcao;
    switch (acao.tipo) {
      case "servico":
        indicarServico(acao.servico);
        break;
      case "triagem":
        adicionar({
          autor: "assistente",
          texto: "Sem problema, vamos descobrir juntos. O que mais se parece com a sua situação agora?",
          opcoes: OPCOES_TRIAGEM,
        });
        break;
      case "cep":
        pedirCep(acao.servico ?? ultimoServico);
        break;
      case "semCep":
        setModoCep(null);
        adicionar({
          autor: "assistente",
          texto:
            "Você encontra o CEP numa conta de luz ou de água, ou no site dos Correios: https://buscacepinter.correios.com.br. Quando tiver, é só me mandar aqui.",
          opcoes: [
            { rotulo: "Já tenho o CEP", acao: { tipo: "cep", servico: ultimoServico } },
            { rotulo: "Voltar ao início", acao: { tipo: "inicio" } },
          ],
        });
        break;
      case "comoComecar":
        adicionar({
          autor: "assistente",
          texto:
            "É simples: baixe o PASI, crie sua conta com seu e-mail ou CPF e responda a triagem em etapas curtas, de onde estiver.\nNão tem smartphone? A triagem também pode ser feita na unidade, com ajuda de um profissional.",
          opcoes: [
            { rotulo: "Buscar unidade pelo CEP", acao: { tipo: "cep", servico: ultimoServico } },
            { rotulo: "Voltar ao início", acao: { tipo: "inicio" } },
          ],
        });
        break;
      case "inicio":
        setModoCep(null);
        adicionar({ autor: "assistente", texto: "Claro! Sobre o que você precisa de ajuda?", opcoes: OPCOES_INICIAIS });
        break;
    }
  };

  const enviar = (event: FormEvent) => {
    event.preventDefault();
    const texto = rascunho.trim();
    if (!texto || pensando) return;
    setRascunho("");

    if (modoCep) {
      const digitos = texto.replace(/\D/g, "");
      if (digitos.length === 8) {
        buscarCep(digitos, modoCep.servico);
      } else {
        adicionar(
          { autor: "pessoa", texto },
          { autor: "assistente", texto: "O CEP precisa ter 8 números, por exemplo 09370-000. Pode tentar de novo?" }
        );
      }
      return;
    }

    const cepNoTexto = texto.match(/\b\d{5}-?\d{3}\b/);
    if (cepNoTexto && texto.replace(/\D/g, "").length === 8) {
      buscarCep(cepNoTexto[0].replace(/\D/g, ""), ultimoServico);
      return;
    }

    adicionar({ autor: "pessoa", texto });
    if (indicaRisco(texto)) adicionar({ autor: "assistente", texto: MENSAGEM_RISCO });

    // a primeira pergunta à IA leva o serviço já indicado pelos botões, para ela não perder o contexto
    const mensagemApi =
      ultimoServico && !contextoEnviado.current
        ? `(Contexto: a pessoa já foi orientada a procurar o ${ultimoServico}.) ${texto}`
        : texto;
    void consultarIa(mensagemApi, texto);
  };

  const aoDigitar = (valor: string) => setRascunho(modoCep ? formatarCep(valor) : valor);

  const aoApertarTecla = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") fechar();
  };

  const ultima = mensagens[mensagens.length - 1];

  return (
    <div className="assistente">
      {mostrarAviso && !aberto && (
        <div className="assistente-aviso">
          <button type="button" className="assistente-aviso-texto" onClick={abrir}>
            <strong>Não sabe se precisa do CRAS, CAPS ou CREAS?</strong> Eu te ajudo a descobrir.
          </button>
          <button type="button" className="assistente-aviso-fechar" aria-label="Fechar aviso da assistente" onClick={fecharAviso}>
            <i className="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
      )}

      {aberto && (
        <div
          className="assistente-painel"
          id="assistente-painel"
          role="dialog"
          aria-labelledby="assistente-titulo"
          onKeyDown={aoApertarTecla}
        >
          <div className="assistente-topo">
            <span className="assistente-avatar" aria-hidden="true">
              <i className="fa-solid fa-comment-dots"></i>
            </span>
            <div className="assistente-topo-textos">
              <p id="assistente-titulo">Assistente PASI</p>
              <span>Orientação sobre CRAS, CAPS e CREAS</span>
            </div>
            <button type="button" className="assistente-icone" aria-label="Recomeçar conversa" onClick={recomecar}>
              <i className="fa-solid fa-rotate-left" aria-hidden="true"></i>
            </button>
            <button type="button" className="assistente-icone" aria-label="Fechar assistente" onClick={fechar}>
              <i className="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>

          <div className="assistente-mensagens" ref={listaRef} aria-live="polite">
            {mensagens.map((m) => {
              if (m.autor === "pessoa") {
                return (
                  <div key={m.id} className="assistente-balao assistente-balao-pessoa">
                    {m.texto}
                  </div>
                );
              }
              const opcoes = m === ultima && !pensando ? m.opcoes : undefined;
              return (
                <div key={m.id} className="assistente-grupo">
                  {"servico" in m ? (
                    <CartaoServico servico={m.servico} />
                  ) : (
                    <div className="assistente-balao assistente-balao-bot">
                      <TextoFormatado texto={m.texto} />
                      {m.fontes && m.fontes.length > 0 && (
                        <p className="assistente-fontes">Fonte: {m.fontes.join(" · ")}</p>
                      )}
                    </div>
                  )}
                  {"mapa" in m && m.mapa && (
                    <a className="assistente-mapa" href={m.mapa} target="_blank" rel="noopener noreferrer">
                      <i className="fa-solid fa-map-location-dot" aria-hidden="true"></i>
                      Abrir no mapa
                    </a>
                  )}
                  {opcoes && (
                    <div className="assistente-opcoes" role="group" aria-label="Respostas sugeridas">
                      {opcoes.map((opcao) => (
                        <button key={opcao.rotulo} type="button" onClick={() => escolher(opcao)}>
                          {opcao.rotulo}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {pensando && (
              <div className="assistente-pensando" role="status">
                <span className="assistente-pontos" aria-hidden="true">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
                <span className="assistente-pensando-texto">
                  {demorando
                    ? "Estou consultando as informações. Na primeira pergunta isso pode levar até 1 minuto."
                    : "A assistente está escrevendo…"}
                </span>
              </div>
            )}
          </div>

          <form className="assistente-form" onSubmit={enviar}>
            <div className="assistente-form-linha">
              <label htmlFor="assistente-campo" className="sr-only">
                {modoCep ? "CEP para buscar a unidade mais próxima" : "Mensagem para a assistente"}
              </label>
              <input
                id="assistente-campo"
                ref={campoRef}
                type="text"
                autoComplete={modoCep ? "postal-code" : "off"}
                inputMode={modoCep ? "numeric" : "text"}
                maxLength={modoCep ? 9 : 500}
                placeholder={modoCep ? "Digite o CEP, ex.: 09370-000" : "Escreva sua mensagem…"}
                value={rascunho}
                onChange={(event) => aoDigitar(event.target.value)}
              />
              <button type="submit" className="assistente-enviar" aria-label="Enviar" disabled={pensando}>
                <i className="fa-solid fa-paper-plane" aria-hidden="true"></i>
              </button>
            </div>
            <p className="assistente-privacidade">
              Não compartilhe documentos ou dados de saúde aqui. A assistente orienta, mas não substitui o atendimento.
            </p>
          </form>
        </div>
      )}

      <button
        ref={botaoRef}
        type="button"
        className={`assistente-botao ${aberto ? "is-open" : ""}`}
        aria-expanded={aberto}
        aria-controls="assistente-painel"
        aria-label={aberto ? "Fechar assistente digital do PASI" : "Abrir assistente digital do PASI"}
        onClick={aberto ? fechar : abrir}
      >
        <span className="assistente-botao-icone" aria-hidden="true">
          <i className={`fa-solid ${aberto ? "fa-xmark" : "fa-comment-dots"}`}></i>
        </span>
        <span className="assistente-botao-rotulo">{aberto ? "Fechar assistente" : "Fale com a assistente"}</span>
      </button>
    </div>
  );
}

function CartaoServico({ servico }: { servico: TipoServico }) {
  const s = SERVICOS[servico];
  return (
    <div className={`assistente-cartao assistente-cartao-${servico.toLowerCase()}`}>
      <div className="assistente-cartao-topo">
        <span className="assistente-cartao-icone" aria-hidden="true">
          <i className={`fa-solid ${s.icone}`}></i>
        </span>
        <div>
          <p className="assistente-cartao-sigla">{s.sigla}</p>
          <p className="assistente-cartao-nome">{s.nome}</p>
        </div>
      </div>
      <div className="assistente-cartao-corpo">
        <p>{s.descricao}</p>
        <p className="assistente-cartao-rotulo">O que atende</p>
        <ul>
          {s.atende.map((item) => (
            <li key={item}>
              <i className="fa-solid fa-check" aria-hidden="true"></i>
              {item}
            </li>
          ))}
        </ul>
        {s.alerta && (
          <p className="assistente-alerta" role="note">
            <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
            <span>{s.alerta}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default Assistente;
