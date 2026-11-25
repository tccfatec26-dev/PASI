import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../assets/logo-pasi.png';
import { useAuth } from '../auth/AuthContext';
import { SituacaoUsuario } from '../api/types';
import { iniciais } from '../lib/format';
import { contarPendentes } from '../api/gestao';
import { SinoMovel } from './Notificacoes';
import { IcAtendimentos, IcCadeadoMenu, IcFormulario, IcPessoa, IcUsuarios } from './icons';

const cls = ({ isActive }: { isActive: boolean }) => 'aba-movel' + (isActive ? ' is-active' : '');

/**
 * Navegação do celular (até 560px), como no layout do celular do painel:
 * barra superior (logo, "Profissional" e avatar) e abas fixas embaixo.
 * Só aparece nessa largura (ver styles/responsivo.css); acima dela o painel
 * continua com o menu lateral / gaveta de sempre. As abas levam às mesmas telas
 * do menu lateral; o avatar abre a gaveta (Aparência e Sair).
 */
export function NavMovel({ aoAbrirMenu }: { aoAbrirMenu: () => void }) {
  const { usuario, ehMaximo } = useAuth();
  const bloqueado = usuario?.id_situacao_usuario !== SituacaoUsuario.DEFERIDO;
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    if (!ehMaximo || bloqueado) return;
    let vivo = true;
    contarPendentes()
      .then((n) => vivo && setPendentes(n))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [ehMaximo, bloqueado]);

  return (
    <>
      <header className="topo-movel">
        <img src={logo} alt="PASI" />
        <span className="topo-movel-rotulo">Profissional</span>
        {!bloqueado && <SinoMovel />}
        <button type="button" className="topo-movel-avatar" onClick={aoAbrirMenu} aria-label="Abrir menu: aparência e sair" aria-haspopup="dialog">
          {iniciais(usuario?.nome)}
        </button>
      </header>

      <nav className="abas-movel" aria-label="Principal">
        {!bloqueado ? (
          <>
            <NavLink className={cls} to="/atendimentos">
              <IcAtendimentos lg />
              <span>Atendimentos</span>
            </NavLink>
            <NavLink className={cls} to="/formularios">
              <IcFormulario lg />
              <span>Formulários</span>
            </NavLink>
          </>
        ) : (
          <>
            <span className="aba-movel is-disabled" aria-disabled="true" tabIndex={0}>
              <IcAtendimentos lg />
              <IcCadeadoMenu className="aba-cadeado" />
              <span>Atendimentos</span>
            </span>
            <span className="aba-movel is-disabled" aria-disabled="true" tabIndex={0}>
              <IcFormulario lg />
              <IcCadeadoMenu className="aba-cadeado" />
              <span>Formulários</span>
            </span>
          </>
        )}
        {ehMaximo && !bloqueado && (
          <NavLink className={cls} to="/usuarios">
            <span className="aba-icone">
              <IcUsuarios lg />
              {pendentes > 0 && (
                <span className="ps-count aba-contagem" aria-label={`${pendentes} cadastros pendentes`}>
                  {pendentes}
                </span>
              )}
            </span>
            <span>Usuários</span>
          </NavLink>
        )}
        <NavLink className={cls} to={bloqueado ? '/revisao' : '/perfil'}>
          <IcPessoa lg />
          <span>Meu perfil</span>
        </NavLink>
      </nav>
    </>
  );
}
