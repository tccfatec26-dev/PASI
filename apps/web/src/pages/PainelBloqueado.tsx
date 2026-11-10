import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { PageHead, PanelTitle } from '../components/Layout';
import { Alerta } from '../components/Form';
import { IcCadeadoMenu } from '../components/icons';
import { primeiroNome } from '../lib/format';

/** 2.0 Painel bloqueado em Pendência II (PainelBloqueado.dc.html). */
export function PainelBloqueado() {
  const { usuario } = useAuth();
  return (
    <>
      <PageHead
        migalhas={[{ rotulo: 'Início' }]}
        titulo={`Olá, ${primeiroNome(usuario?.nome)}`}
        dica="Falta só um passo para liberar o painel."
      />
      <div className="page-body">
        <Alerta
          tipo="warning"
          titulo="Revisão dos dados obrigatória"
          estilo={{ alignItems: 'center' }}
          acao={
            <Link className="ps-btn primary" to="/revisao">
              Revisar meus dados
            </Link>
          }
        >
          O seu cadastro foi feito pela gestão da unidade. Confira os seus dados em Meu perfil e confirme que estão corretos. Até
          lá, atendimentos e formulários ficam bloqueados.
        </Alerta>

        <section className="panel" aria-label="Atendimentos (bloqueado)">
          <header>
            <PanelTitle dica="Seus atendimentos aparecem aqui depois da confirmação.">Atendimentos</PanelTitle>
          </header>
          <div className="locked-state">
            <span className="ico">
              <IcCadeadoMenu lg />
            </span>
            <strong>Disponível após a confirmação dos seus dados</strong>
            <span>Assim que você confirmar, o painel libera atendimentos, formulários e tudo o que o seu perfil permite.</span>
            <Link className="ps-btn secondary" to="/revisao">
              Ir para Meu perfil
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
