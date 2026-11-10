import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo-pasi.png';
import { useAuth } from '../auth/AuthContext';
import { primeiroAcesso } from '../api/auth';
import { mensagemErro } from '../api/client';
import { AuthHeroTopo } from '../components/AuthHero';
import { Alerta, ListaCriterios } from '../components/Form';
import { IcCadeado } from '../components/icons';
import { Modal } from '../components/Modal';
import { cpfMascarado, dataHora } from '../lib/format';
import { criteriosSenha } from '../lib/senha';

/** 1.3 Primeiro acesso: troca obrigatória da senha provisória (RN-USR-08). */
export function PrimeiroAcesso() {
  const { usuario, sair, senhaProvisoria } = useAuth();
  const navegar = useNavigate();
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);

  const criterios = criteriosSenha(
    nova,
    senhaProvisoria ? { valor: senhaProvisoria, rotulo: 'Diferente da senha provisória' } : undefined,
  );
  const tudo = criterios.every((c) => c[1]);
  const confere = conf.length > 0 && conf === nova;

  async function salvar() {
    setTentou(true);
    if (!tudo || !confere || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await primeiroAcesso(nova);
      setSalvo(true);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  }

  function irParaLogin() {
    sair();
    navegar('/login', { replace: true });
  }

  const expira = usuario?.senha_provisoria_expira_em;

  return (
    <div className="ps auth">
      <section className="auth-hero" aria-label="Sobre o primeiro acesso">
        <AuthHeroTopo
          voltar="/login"
          aoVoltar={sair}
          tag="primeiro acesso"
          titulo={
            <>
              Crie a sua <em>senha de acesso</em>
            </>
          }
        >
          <p style={{ fontSize: 20 }}>
            Você entrou com a senha provisória que recebeu por e-mail. Para continuar, defina uma senha só sua.
          </p>
        </AuthHeroTopo>
        <ul className="passos">
          <li>
            <span className="i">1</span>Criar a sua senha (agora)
          </li>
          <li>
            <span className="i">2</span>Entrar de novo com a senha nova
          </li>
          <li>
            <span className="i">3</span>Revisar e confirmar os seus dados
          </li>
        </ul>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '4px 12px' }}>
            <h1>Criar senha</h1>
            <p style={{ margin: 0, font: '400 15px/1.55 var(--font-sans)', color: 'var(--Text-muted)' }}>
              {usuario?.nome} · CPF {cpfMascarado(usuario?.cpf ?? '')}
            </p>
          </div>

          <Alerta tipo="info" titulo="Troca obrigatória">
            Até criar a sua senha, nenhuma outra tela do painel fica disponível.
            {expira ? ` A senha provisória vale até ${dataHora(expira)}.` : ''}
          </Alerta>

          <div className="ps-field">
            <label className="ps-label" htmlFor="s1">
              Nova senha{' '}
              <span className="req" aria-hidden="true">
                *
              </span>
            </label>
            <div className={'ps-control' + (tentou && !tudo ? ' is-error' : '')}>
              <IcCadeado style={{ color: 'var(--Text-muted)' }} />
              <input
                id="s1"
                type="password"
                autoComplete="new-password"
                value={nova}
                onChange={(e) => setNova(e.target.value)}
                aria-invalid={(tentou && !tudo) || undefined}
              />
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
              <input
                id="s2"
                type="password"
                autoComplete="new-password"
                value={conf}
                onChange={(e) => setConf(e.target.value)}
              />
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
            {enviando ? 'Salvando…' : 'Salvar senha'}
          </button>

          {erro && (
            <Alerta tipo="error" titulo="Não foi possível salvar">
              {erro}
            </Alerta>
          )}

          <p className="alt">Não reconhece este cadastro? Fale com a gestão da sua unidade.</p>
        </form>
      </main>

      {salvo && (
        <Modal
          alerta
          icone="ok"
          titulo="Senha criada"
          rodape={
            <button type="button" className="ps-btn primary" onClick={irParaLogin}>
              Ir para o login
            </button>
          }
        >
          Por segurança, a sua sessão foi encerrada. Entre de novo usando a senha que você acabou de criar. Em seguida, você
          vai revisar e confirmar os seus dados.
        </Modal>
      )}
    </div>
  );
}
