import { useState, type FormEvent } from 'react';
import logo from '../assets/logo-pasi.png';
import { esqueceuSenha } from '../api/auth';
import { mensagemErro } from '../api/client';
import { AuthHeroTopo } from '../components/AuthHero';
import { Alerta } from '../components/Form';
import { IcEmail } from '../components/icons';

/** 1.2 Esqueci a senha (EsqueciSenha.dc.html). A API manda um link válido por 1 hora. */
export function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setErro('Informe um e-mail válido.');
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      await esqueceuSenha(email.trim().toLowerCase());
      setEnviado(true);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="ps auth">
      <section className="auth-hero" aria-label="Sobre a recuperação de senha">
        <AuthHeroTopo
          voltar="/login"
          tag="recuperar acesso"
          titulo={
            <>
              Vamos te ajudar <em>a recuperar sua senha</em>
            </>
          }
        />
        <p style={{ fontSize: 20, fontWeight: 400, fontStyle: 'italic' }}>
          Informe o e-mail do seu cadastro. Enviaremos um link para criar uma nova senha, válido por 1 hora.
        </p>
      </section>

      <main className="form-side">
        <form className="box" onSubmit={enviar} noValidate>
          <img className="logo" src={logo} alt="PASI" />
          <div>
            <h1>Esqueci a senha</h1>
            <p style={{ margin: '6px 0 0', font: '400 15px/1.55 var(--font-sans)', color: 'var(--Text-muted)' }}>
              Digite o e-mail usado no cadastro.
            </p>
          </div>

          {!enviado ? (
            <>
              <div className="ps-field">
                <label className="ps-label" htmlFor="email">
                  E-mail
                </label>
                <div className={'ps-control' + (erro ? ' is-error' : '')}>
                  <IcEmail style={{ color: 'var(--Text-muted)' }} />
                  <input
                    id="email"
                    type="email"
                    placeholder="nome@dominio.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!erro || undefined}
                  />
                </div>
                {erro && <div className="ps-helper error">{erro}</div>}
              </div>
              <button type="submit" className="ps-btn primary lg block" aria-busy={enviando}>
                {enviando ? 'Enviando…' : 'Enviar link de recuperação'}
              </button>
            </>
          ) : (
            <Alerta tipo="success" titulo="Pedido recebido">
              Se o e-mail estiver cadastrado, você receberá as instruções em breve. O link vale por 1 hora; confira também a
              caixa de spam.
            </Alerta>
          )}
        </form>
      </main>
    </div>
  );
}
