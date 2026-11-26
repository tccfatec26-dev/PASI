import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthContext';
import { notificacoesService, type ListaNotificacoes } from '../services/notificacoes';
import { dadosDoPush, registrarPush } from '../services/push';
import { navigate, navigationRef } from '../navigation/navigationRef';

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

/**
 * Notificações do paciente.
 *
 * O aviso de notificação nova é o PUSH do Android (services/push.ts): chega na
 * barra do celular mesmo com o app fechado e, com ele aberto, aparece no topo
 * da tela. Tocar nele abre o atendimento. Ao entrar, o app registra o aparelho
 * para o push.
 *
 * O número do sino vem da API: consultada ao chegar um push, a cada 30 s com o
 * app aberto e quando ele volta para a frente.
 */
export function NotificacoesProvider({ children }: { children: React.ReactNode }) {
  const { token, usuario } = useAuth();
  const idUsuario = token ? usuario?.id_usuario ?? null : null;
  const [naoLidas, setNaoLidas] = useState(0);
  const [versao, setVersao] = useState(0);
  /** maior id já visto: o que vier acima disso é novo */
  const ultimoVisto = useRef<number | null>(null);

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
    // chegou notificação nova: as listas abertas (sino, atendimentos) recarregam
    if (ultimoVisto.current !== null && maior > ultimoVisto.current) setVersao((v) => v + 1);
    ultimoVisto.current = Math.max(ultimoVisto.current ?? 0, maior);
  }, [idUsuario]);

  // saiu ou trocou de conta: começa do zero
  useEffect(() => {
    ultimoVisto.current = null;
    setNaoLidas(0);
  }, [idUsuario]);

  // entrou: registra este aparelho para receber o push desta conta
  useEffect(() => {
    if (idUsuario !== null) void registrarPush();
  }, [idUsuario]);

  // push chegou com o app aberto: atualiza o número do sino na hora
  useEffect(() => {
    if (idUsuario === null) return;
    const sub = Notifications.addNotificationReceivedListener(() => void consultar());
    return () => sub.remove();
  }, [idUsuario, consultar]);

  // tocou no push (com o app aberto, em segundo plano ou fechado): marca como
  // lida e abre o atendimento. Com o app fechado, espera o login e a navegação.
  const resposta = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!resposta || idUsuario === null) return;
    if (resposta.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const dados = dadosDoPush(resposta.notification);
    let tentativas = 0;
    let t: ReturnType<typeof setTimeout> | undefined;
    const abrir = () => {
      if (!navigationRef.isReady()) {
        if (++tentativas < 20) t = setTimeout(abrir, 250);
        return;
      }
      void Notifications.clearLastNotificationResponseAsync();
      if (dados.id_notificacao) {
        notificacoesService
          .marcarLida(dados.id_notificacao)
          .then((r) => {
            setNaoLidas(r.nao_lidas);
            setVersao((v) => v + 1);
          })
          .catch(() => null);
      }
      if (dados.id_atendimento) navigate('FormulariosAtendimento', { idAtendimento: dados.id_atendimento, descricao: 'Atendimento' });
      else navigate('Notificacoes');
    };
    abrir();
    return () => clearTimeout(t);
  }, [resposta, idUsuario]);

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
