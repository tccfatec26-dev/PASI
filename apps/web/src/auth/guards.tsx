import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { rotaInicial, useAuth } from './AuthContext';
import { SituacaoUsuario } from '../api/types';

function Carregando() {
  return (
    <div className="ps" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="ps-results-meta" role="status">
        Carregando…
      </span>
    </div>
  );
}

/** Só para quem NÃO está logado (login, esqueci a senha, redefinir senha). */
export function SoVisitante() {
  const { usuario, carregando } = useAuth();
  if (carregando) return <Carregando />;
  if (usuario) return <Navigate to={rotaInicial(usuario)} replace />;
  return <Outlet />;
}

/**
 * Exige login e uma das situações permitidas (RN-USR-08 e 09):
 * Pendência I só troca a senha; Pendência II só revisa os dados.
 */
export function ExigeSituacao({ situacoes, soMaximo = false }: { situacoes: number[]; soMaximo?: boolean }) {
  const { usuario, carregando, ehMaximo } = useAuth();
  const local = useLocation();
  if (carregando) return <Carregando />;
  if (!usuario) return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  if (!situacoes.includes(usuario.id_situacao_usuario)) return <Navigate to={rotaInicial(usuario)} replace />;
  if (soMaximo && !ehMaximo) return <Navigate to="/atendimentos" replace />;
  return <Outlet />;
}

export const SO_DEFERIDO = [SituacaoUsuario.DEFERIDO];
export const SO_PENDENCIA_I = [SituacaoUsuario.PENDENCIA_I];
export const SO_PENDENCIA_II = [SituacaoUsuario.PENDENCIA_II];
