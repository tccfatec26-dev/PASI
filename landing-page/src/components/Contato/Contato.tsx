import { useState, type FormEvent } from "react";
import { CONTACT_EMAIL } from "../../data/links";
import { useReveal } from "../../hooks/useReveal";
import "./Contato.css";

function Contato() {
  const sectionRef = useReveal<HTMLElement>();
  const [status, setStatus] = useState("");

  const enviarDuvida = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!CONTACT_EMAIL) {
      setStatus("O formulário está pronto, mas falta configurar o e-mail que receberá as mensagens.");
      return;
    }

    const dados = new FormData(event.currentTarget);
    const assunto = encodeURIComponent(`Dúvida sobre o PASI: ${dados.get("assunto")}`);
    const mensagem = encodeURIComponent(
      `Nome: ${dados.get("nome")}\nE-mail para retorno: ${dados.get("email")}\n\n${dados.get("mensagem")}`
    );

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${assunto}&body=${mensagem}`;
    setStatus("Seu aplicativo de e-mail foi aberto. Revise a mensagem e envie por lá.");
  };

  return (
    <section ref={sectionRef} className="contato" id="contato" aria-labelledby="contato-titulo">
      <div className="container contato-grid">
        <div className="contato-intro reveal">
          <span className="section-tag">Conversa aberta</span>
          <h2 className="section-headline" id="contato-titulo">
            Ficou com <span>alguma dúvida?</span>
          </h2>
          <p className="section-lead">
            Quer saber mais sobre o PASI, os perfis de acesso ou como funciona a triagem? Escreva para a equipe.
          </p>
          <div className="contato-nota">
            <i className="fa-solid fa-shield-heart" aria-hidden="true"></i>
            <p>Não envie documentos nem informações pessoais ou de saúde por este formulário.</p>
          </div>
        </div>

        <form className="contato-formulario reveal" onSubmit={enviarDuvida}>
          <div className="contato-formulario-intro">
            <span className="contato-formulario-icone" aria-hidden="true">
              <i className="fa-solid fa-envelope-open-text"></i>
            </span>
            <div>
              <h3>Sua mensagem</h3>
              <p>Preencha os campos e conte para a equipe como podemos ajudar.</p>
            </div>
          </div>

          <div className="contato-campos-duplos">
            <label>
              Seu nome
              <input name="nome" type="text" autoComplete="name" required />
            </label>
            <label>
              Seu e-mail
              <input name="email" type="email" autoComplete="email" required />
            </label>
          </div>

          <label>
            Assunto
            <select name="assunto" defaultValue="duvida">
              <option value="duvida">Dúvida geral</option>
              <option value="atendimento">Triagem e atendimento</option>
              <option value="profissional">Perfil profissional</option>
              <option value="acessibilidade">Acessibilidade</option>
              <option value="projeto">Sobre o projeto</option>
            </select>
          </label>

          <label>
            Como podemos ajudar?
            <textarea name="mensagem" rows={5} maxLength={1000} required></textarea>
          </label>

          <div className="contato-formulario-rodape">
            <p id="contato-status" role="status" aria-live="polite">
              {status || (CONTACT_EMAIL
                ? "A mensagem será aberta no seu aplicativo de e-mail para você revisar."
                : "O envio será ativado quando a equipe configurar um endereço de contato.")}
            </p>
            <button className="btn btn-primary" type="submit">
              Preparar mensagem
              <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default Contato;