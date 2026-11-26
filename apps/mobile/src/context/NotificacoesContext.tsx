import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { useFeedback } from './FeedbackContext';
import { notificacoesService, type ListaNotificacoes } from '../services/notificacoes';

/** De quanto em quanto tempo o app pergunta se chegou notificação nova (com o app aberto). */
const INTERVALO = 30_000;

interface Valor {
  /** quantas não lidas (número no sino) */
  naoLidas: number;
  /** muda quando chega notificação nova ou alguma é lida (as listas recarregam) */
  versao: number;
  atualizar: () => Promise<void>;
  marcarLida: (id: number) => Promise<void>;
  marcarTodas: () => Promise<void>;
}

const Ctx = createContext<Valor>({
  naoLidas: 0,
  versao: 0,
  atualizar: async () => {},
  marcarLida: async () => {},
  marcarTodas: async () => {},
});

/** usuário que já recebeu o aviso "você tem N notificações" nesta abertura do app */
let avisouAoAbrir: number | null = null;

/**
 * Consulta as notificações do paciente a cada 30 s enquanto o app está aberto
 * (e na hora, quando ele volta para a frente). Notificação nova aparece no
 * aviso da parte de baixo da tela — e é lida em voz alta se a leitura estiver
 * ligada. Ao entrar, avisa uma vez quantas estão sem ler.
 */
export function NotificacoesProvider({ children }: { children: React.ReactNode }) {
  const { token, usuario } = useAuth();
  const { toast } = useFeedback();
  const idUsuario = token ? usuario?.id_usuario ?? null : null;
  const [naoLidas, setNaoLidas] = useState(0);
  const [versao, setVersao] = useState(0);
  /** maior id já visto: o que vier acima disso é novo */
  const ultimoVisto = useRef<number | null>(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const consultar = useCallback(async () => {
    if (idUsuario === null) return;
    let r: ListaNotificacoes;
    try {
      r = await notificacoesService.listar({ limit: 10 });
    } catch {
      return; // sem internet: tenta de novo na próxima volta
    }
    setNaoLidas(r.nao_lidas);
    const maior = r.data[0]?.id_notificacao ?? 0;
    if (ultimoVisto.current === null) {
      if (r.nao_lidas > 0 && avisouAoAbrir !== idUsuario) {
        toastRef.current(
          r.nao_lidas === 1 ? 'Você tem 1 notificação nova.' : `Você tem ${r.nao_lidas} notificações novas.`,
          'info',
        );
      }
      avisouAoAbrir = idUsuario;
    } else if (maior > ultimoVisto.current) {
      const novas = r.data.filter((n) => n.id_notificacao > (ultimoVisto.current ?? 0) && !n.lida);
      // um aviso por vez na tela: a mais recente, ou o total
      if (novas.length === 1) toastRef.current(`${novas[0].titulo}. ${novas[0].mensagem}`, 'info');
      else if (novas.length > 1) toastRef.current(`Você tem ${novas.length} notificações novas.`, 'info');
      setVersao((v) => v + 1);
    }
    ultimoVisto.current = Math.max(ultimoVisto.current ?? 0, maior);
  }, [idUsuario]);

  // saiu ou trocou de conta: começa do zero
  useEffect(() => {
    ultimoVisto.current = null;
    setNaoLidas(0);
    if (idUsuario === null) avisouAoAbrir = null;
  }, [idUsuario]);

  useEffect(() => {
    if (idUsuario === null) return;
    void consultar();
    let ativo = AppState.currentState === 'active';
    const t = setInterval(() => {
      if (ativo) void consultar();
    }, INTERVALO);
    const sub = AppState.addEventListener('change', (estado) => {
      const voltou = !ativo && estado === 'active';
      ativo = estado === 'active';
      if (voltou) void consultar();
    });
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, [idUsuario, consultar]);

  const marcarLida = useCallback(async (id: number) => {
    const r = await notificacoesService.marcarLida(id);
    setNaoLidas(r.nao_lidas);
    setVersao((v) => v + 1);
  }, []);

  const marcarTodas = useCallback(async () => {
    const r = await notificacoesService.marcarTodasLidas();
    setNaoLidas(r.nao_lidas);
    setVersao((v) => v + 1);
  }, []);

  const valor = useMemo(
    () => ({ naoLidas, versao, atualizar: consultar, marcarLida, marcarTodas }),
    [naoLidas, versao, consultar, marcarLida, marcarTodas],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useNotificacoes = () => useContext(Ctx);
