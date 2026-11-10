import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo-pasi.png';
import { rotaInicial, useAuth } from '../auth/AuthContext';
import { mensagemErro, statusErro } from '../api/client';
import { Alerta } from '../components/Form';
import { D, Ic, IcCadeado, IcEmail } from '../components/icons';

/** 1.1 Login do profissional (Main.dc.html). */
export function Login() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ titulo: string; texto: string } | null>(null);

  const rotuloOlho = mostrar ? 'Ocultar senha' : 'Mostrar senha';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (!login.trim() || !senha) {
      setErro({ titulo: 'Preencha os dois campos', texto: 'Informe o e-mail ou CPF e a senha.' });
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const u = await entrar(login.trim(), senha);
      const de = (local.state as { de?: string } | null)?.de;
      const destino = rotaInicial(u);
      navegar(de && destino === '/atendimentos' ? de : destino, { replace: true });
    } catch (err) {
      const msg = mensagemErro(err);
      if (statusErro(err) === 401 && msg === 'Credenciais inválidas') {
        setErro({ titulo: 'Credenciais inválidas', texto: 'Confira o e-mail ou CPF e a senha e tente de novo.' });
      } else {
        setErro({ titulo: 'Não foi possível entrar', texto: msg });
      }
      setEnviando(false);
    }
  }

  return (
    <div className="ps auth">
      <section className="auth-hero" aria-label="Sobre o painel">
        <div>
          <span className="tag">
            <span className="grad-txt">painel do profissional</span>
          </span>
          <h2 style={{ fontSize: 70 }}>
            Acesse o <em>PASI</em>
          </h2>
        </div>
        <div className="hero-welcome" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 460 }}>
          <h3 style={{ margin: 0, font: '700 22px/1.3 var(--font-sans)', color: 'var(--White)', fontSize: 29 }}>
            Bem-vindo(a) ao painel do profissional!
          </h3>
          <p
            style={{
              margin: 0,
              font: '400 16px/1.55 var(--font-sans)',
              color: 'var(--Info-on-dark)',
              fontSize: 20,
              maxWidth: 458,
              fontStyle: 'italic',
            }}
          >
            Acesse a plataforma com o seu e-mail cadastrado ou CPF.
          </p>
        </div>
      </section>

      <main className="form-side">
        <form className="box" onSubmit={enviar} noValidate>
          <img className="logo" src={logo} alt="PASI" />
          <div>
            <h1>Entrar no painel</h1>
          </div>

          <div className="ps-field">
            <label className="ps-label" htmlFor="login">
              E-mail ou CPF
            </label>
            <div className={'ps-control' + (erro ? ' is-error' : '')}>
              <IcEmail style={{ color: 'var(--Text-muted)' }} />
              <input
                id="login"
                type="text"
                placeholder="nome@dominio.com ou 000.000.000-00"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                aria-invalid={!!erro || undefined}
              />
            </div>
          </div>

          <div className="ps-field">
            <label className="ps-label" htmlFor="senha">
              Senha
            </label>
            <div className={'ps-control' + (erro ? ' is-error' : '')}>
              <IcCadeado style={{ color: 'var(--Text-muted)' }} />
              <input
                id="senha"
                type={mostrar ? 'text' : 'password'}
                placeholder="Sua senha"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                aria-invalid={!!erro || undefined}
              />
              <button
                type="button"
                className="olho tt"
                onClick={() => setMostrar(!mostrar)}
                aria-label={rotuloOlho}
                aria-pressed={mostrar}
                data-tip={rotuloOlho}
              >
                <Ic d={mostrar ? D.olhoFechado : D.olho} />
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Link className="ps-link" to="/esqueci-senha" style={{ fontSize: 13 }}>
                Esqueci a senha
              </Link>
            </div>
          </div>

          <button type="submit" className="ps-btn primary lg block" style={{ fontSize: 17 }} aria-busy={enviando}>
            {enviando ? 'Entrando…' : 'Acessar'}
          </button>

          {erro && (
            <Alerta tipo="error" titulo={erro.titulo}>
              {erro.texto}
            </Alerta>
          )}
        </form>
      </main>
    </div>
  );
}
