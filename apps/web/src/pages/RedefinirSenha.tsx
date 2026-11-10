import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import logo from '../assets/logo-pasi.png';
import { useAuth } from '../auth/AuthContext';
import { redefinirSenha } from '../api/auth';
import { mensagemErro } from '../api/client';
import { AuthHeroTopo } from '../components/AuthHero';
import { Alerta, ListaCriterios } from '../components/Form';
import { IcCadeado } from '../components/icons';
import { Modal } from '../components/Modal';
import { criteriosSenha } from '../lib/senha';

/**
 * Nova senha pelo link do e-mail (/redefinir-senha?token=…). Não existia no
 * protótipo: segue o mesmo desenho do primeiro acesso.
 */
export function RedefinirSenha() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { usuario, sair } = useAuth();
  const navegar = useNavigate();
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const criterios = criteriosSenha(nova);
  const tudo = criterios.every((c) => c[1]);
  const confere = conf.length > 0 && conf === nova;

  async function salvar() {
    setTentou(true);
    if (!token || !tudo || !confere || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await redefinirSenha(token, nova);
      setSalvo(true);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  function irParaLogin() {
    if (usuario) sair();
    navegar('/login', { replace: true });
  }

  return (
    <div className="ps auth">
      <section className="auth-hero" aria-label="Sobre a nova senha">
        <AuthHeroTopo
          voltar="/login"
          tag="recuperar acesso"
          titulo={
            <>
              Crie uma <em>nova senha</em>
            </>
          }
        >
          <p style={{ fontSize: 20 }}>Use uma senha que você não usou antes no PASI. Depois, entre de novo com ela.</p>
        </AuthHeroTopo>
      </section>

      <main className="form-side">
        <form
          className="box"
          onSubmit={(e) => {
            e.preventDefault();
            void salvar();
          }}
          noValidate
        >
          <img className="logo" src={logo} alt="PASI" />
          <div>
            <h1>Nova senha</h1>
          </div>

          {!token ? (
            <Alerta tipo="error" titulo="Link incompleto">
              Abra o link exatamente como chegou no e-mail ou peça um novo em{' '}
              <Link className="ps-link" to="/esqueci-senha">
                Esqueci a senha
              </Link>
              .
            </Alerta>
          ) : (
            <>
              <div className="ps-field">
                <label className="ps-label" htmlFor="s1">
                  Nova senha{' '}
                  <span className="req" aria-hidden="true">
                    *
                  </span>
                </label>
                <div className={'ps-control' + (tentou && !tudo ? ' is-error' : '')}>
                  <IcCadeado style={{ color: 'var(--Text-muted)' }} />
                  <input id="s1" type="password" autoComplete="new-password" value={nova} onChange={(e) => setNova(e.target.value)} />
                </div>
              </div>
              <ListaCriterios criterios={criterios} rotulo="Requisitos da senha" />
              <div className="ps-field">
                <label className="ps-label" htmlFor="s2">
                  Confirmar nova senha{' '}
                  <span className="req" aria-hidden="true">
                    *
                  </span>
                </label>
                <div className={'ps-control' + (conf ? (confere ? ' is-success' : ' is-error') : tentou ? ' is-error' : '')}>
                  <IcCadeado style={{ color: 'var(--Text-muted)' }} />
                  <input id="s2" type="password" autoComplete="new-password" value={conf} onChange={(e) => setConf(e.target.value)} />
                </div>
                {conf ? (
                  <div className={'ps-helper ' + (confere ? 'success' : 'error')}>
                    {confere ? 'As senhas conferem.' : 'As senhas não conferem.'}
                  </div>
                ) : (
                  tentou && <div className="ps-helper error">Repita a nova senha.</div>
                )}
              </div>
              <button type="submit" className="ps-btn primary lg block" aria-busy={enviando}>
                {enviando ? 'Salvando…' : 'Salvar nova senha'}
              </button>
              {erro && (
                <Alerta tipo="error" titulo="Não foi possível salvar">
                  {erro}
                </Alerta>
              )}
            </>
          )}
        </form>
      </main>

      {salvo && (
        <Modal
          alerta
          icone="ok"
          titulo="Senha redefinida"
          rodape={
            <button type="button" className="ps-btn primary" onClick={irParaLogin}>
              Ir para o login
            </button>
          }
        >
          Pronto! Entre no painel com a senha que você acabou de criar.
        </Modal>
      )}
    </div>
  );
}
