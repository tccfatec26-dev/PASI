import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ouvirSessao, tokenStore } from '../api/client';
import * as authApi from '../api/auth';
import * as usuariosApi from '../api/usuarios';
import { SituacaoUsuario, TipoUsuario, type Usuario } from '../api/types';

interface AuthValor {
  usuario: Usuario | null;
  carregando: boolean;
  ehMaximo: boolean;
  entrar: (login: string, senha: string) => Promise<Usuario>;
  sair: () => void;
  recarregar: () => Promise<Usuario | null>;
  /** Atualiza o usuário em memória depois de uma chamada que já devolveu o cadastro. */
  definirUsuario: (u: Usuario) => void;
  /** Senha provisória usada no login (só em memória), para conferir que a nova é diferente. */
  senhaProvisoria: string | null;
}

const AuthCtx = createContext<AuthValor | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [senhaProvisoria, setSenhaProvisoria] = useState<string | null>(null);

  const sair = useCallback(() => {
    tokenStore.clear();
    setUsuario(null);
    setSenhaProvisoria(null);
  }, []);

  const recarregar = useCallback(async () => {
    if (!tokenStore.get()) {
      setUsuario(null);
      return null;
    }
    try {
      const u = await usuariosApi.me();
      setUsuario(u);
      return u;
    } catch {
      tokenStore.clear();
      setUsuario(null);
      return null;
    }
  }, []);

  useEffect(() => {
    recarregar().finally(() => setCarregando(false));
  }, [recarregar]);

  useEffect(
    () =>
      ouvirSessao((evento) => {
        if (evento === 'sessao-expirada') sair();
        else void recarregar();
      }),
    [recarregar, sair],
  );

  const entrar = useCallback(async (login: string, senha: string) => {
    const r = await authApi.login(login, senha);
    tokenStore.set(r.access_token);
    // /usuarios/me traz perfil, situação, profissão e unidades
    const completo = await usuariosApi.me().catch(() => r.usuario);
    setSenhaProvisoria(completo.id_situacao_usuario === SituacaoUsuario.PENDENCIA_I ? senha : null);
    setUsuario(completo);
    return completo;
  }, []);

  const valor = useMemo<AuthValor>(
    () => ({
      usuario,
      carregando,
      ehMaximo: usuario?.id_tipo_usuario === TipoUsuario.MAXIMO,
      entrar,
      sair,
      recarregar,
      definirUsuario: setUsuario,
      senhaProvisoria,
    }),
    [usuario, carregando, entrar, sair, recarregar, senhaProvisoria],
  );

  return <AuthCtx.Provider value={valor}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}

/** Para onde mandar o usuário logado, conforme a situação do cadastro. */
export function rotaInicial(u: Usuario | null): string {
  if (!u) return '/login';
  if (u.id_situacao_usuario === SituacaoUsuario.PENDENCIA_I) return '/primeiro-acesso';
  if (u.id_situacao_usuario === SituacaoUsuario.PENDENCIA_II) return '/inicio';
  return '/atendimentos';
}
