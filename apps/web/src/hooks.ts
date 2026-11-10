import { useCallback, useEffect, useRef, useState } from 'react';
import { mensagemErro } from './api/client';
import * as apoio from './api/apoio';
import type { Unidade } from './api/types';
import { useAuth } from './auth/AuthContext';

/** Carrega dados da API com estado de carregamento e erro. */
export function useCarregar<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const versao = useRef(0);

  const recarregar = useCallback(async () => {
    const v = ++versao.current;
    setCarregando(true);
    setErro(null);
    try {
      const r = await fn();
      if (v === versao.current) setDados(r);
      return r;
    } catch (e) {
      if (v === versao.current) setErro(mensagemErro(e));
      return null;
    } finally {
      if (v === versao.current) setCarregando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  return { dados, setDados, carregando, erro, recarregar };
}

/** Valor que só muda depois de um tempo sem digitação (buscas). */
export function useAtrasado<T>(valor: T, ms = 300) {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return v;
}

/**
 * Unidades em que o usuário pode criar atendimentos (RN-USR-20): o
 * intermediário usa as dele; o máximo, qualquer unidade. Vem com a sede.
 */
export function useUnidadesPermitidas() {
  const { usuario, ehMaximo } = useAuth();
  const [todas, setTodas] = useState<Unidade[] | null>(null);
  useEffect(() => {
    if (!ehMaximo) return;
    apoio.unidades().then(setTodas).catch(() => setTodas([]));
  }, [ehMaximo]);
  const minhas = usuario?.unidades ?? [];
  const sede = minhas.find((u) => u.sede)?.id_unidade_atendimento ?? null;
  const lista: Unidade[] = ehMaximo ? (todas ?? []) : minhas.map((v) => v.unidade_atendimento);
  return { lista, sede, carregando: ehMaximo && todas === null };
}
