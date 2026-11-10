import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import logo from '../assets/logo-pasi.png';
import { useAuth } from '../auth/AuthContext';
import { SituacaoUsuario, TipoUsuario } from '../api/types';
import { iniciais } from '../lib/format';
import { contarPendentes } from '../api/gestao';
import { IcAtendimentos, IcCadeadoMenu, IcFormulario, IcPessoa, IcUsuarios, Ic, D } from './icons';

const cls = ({ isActive }: { isActive: boolean }) => 'nav-item' + (isActive ? ' is-active' : '');

/** Menu lateral do painel (Sidebar.dc.html). */
export function Sidebar() {
  const { usuario, ehMaximo, sair } = useAuth();
  const navegar = useNavigate();
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

  const profissao = usuario?.profissao?.nome;
  const sede = usuario?.unidades?.find((u) => u.sede)?.unidade_atendimento.nome;
  const cargo =
    usuario?.id_tipo_usuario === TipoUsuario.MAXIMO
      ? ['Perfil Máximo', profissao].filter(Boolean).join(' · ')
      : [profissao, sede].filter(Boolean).join(' · ');

  return (
    <aside className="ps side" aria-label="Menu do painel">
      <div className="brand">
        <img src={logo} alt="PASI" />
        <span>Profissional</span>
      </div>
      <nav aria-label="Principal">
        <span className="nav-label">Menu</span>
        {!bloqueado ? (
          <>
            <NavLink className={cls} to="/atendimentos">
              <IcAtendimentos lg />
              Atendimentos
            </NavLink>
            <NavLink className={cls} to="/formularios">
              <IcFormulario lg />
              Formulários
            </NavLink>
          </>
        ) : (
          <>
            <span className="nav-item is-disabled" aria-disabled="true" tabIndex={0} data-tip="Disponível após confirmar seus dados">
              <IcAtendimentos lg />
              Atendimentos
              <IcCadeadoMenu className="lock" />
            </span>
            <span className="nav-item is-disabled" aria-disabled="true" tabIndex={0} data-tip="Disponível após confirmar seus dados">
              <IcFormulario lg />
              Formulários
              <IcCadeadoMenu className="lock" />
            </span>
          </>
        )}
        <NavLink className={cls} to={bloqueado ? '/revisao' : '/perfil'}>
          <IcPessoa lg />
          Meu perfil
        </NavLink>
      </nav>
      {ehMaximo && !bloqueado && (
        <nav aria-label="Gestão">
          <span className="nav-label">Gestão</span>
          <NavLink className={cls} to="/usuarios">
            <IcUsuarios lg />
            Usuários
            {pendentes > 0 && (
              <span className="ps-count" style={{ marginLeft: 'auto' }} aria-label={`${pendentes} cadastros pendentes`}>
                {pendentes}
              </span>
            )}
          </NavLink>
        </nav>
      )}
      <div className="user">
        <span className="avatar" aria-hidden="true">
          {iniciais(usuario?.nome)}
        </span>
        <div style={{ minWidth: 0 }}>
          <strong>{usuario?.nome}</strong>
          <small>{cargo}</small>
        </div>
        <button
          type="button"
          className="logout"
          aria-label="Sair"
          data-tip="Sair"
          onClick={() => {
            sair();
            navegar('/login', { replace: true });
          }}
        >
          <Ic d={D.sair} />
        </button>
      </div>
    </aside>
  );
}
