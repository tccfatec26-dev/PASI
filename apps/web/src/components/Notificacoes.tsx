import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import * as notifApi from '../api/notificacoes';
import { SituacaoUsuario } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useAvisos } from './Avisos';
import { Ic } from './icons';

/** Sino (contorno de sino com o badalo). */
export const D_SINO = 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0';
export const IcSino = ({ lg }: { lg?: boolean }) => <Ic d={D_SINO} lg={lg} />;

/** De quanto em quanto tempo o painel pergunta se chegou notificação nova. */
const INTERVALO = 30_000;

interface Valor {
  /** quantas não lidas (badge do sino) */
  naoLidas: number;
  /** muda quando chega notificação nova ou alguma é lida (a tela de notificações recarrega) */
  versao: number;
  marcarLida: (id: number) => Promise<void>;
  marcarTodas: () => Promise<void>;
}

const Ctx = createContext<Valor>({ naoLidas: 0, versao: 0, marcarLida: async () => {}, marcarTodas: async () => {} });

/**
 * Consulta as notificações do profissional logado a cada 30 s (só com a aba
 * visível e o painel liberado) e, quando chega uma nova, mostra o aviso no
 * canto da tela. Ao entrar, avisa uma vez quantas estão sem ler.
 */
export function NotificacoesProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const avisar = useAvisos();
  const idUsuario = usuario?.id_situacao_usuario === SituacaoUsuario.DEFERIDO ? usuario.id_usuario : null;
  const [naoLidas, setNaoLidas] = useState(0);
  const [versao, setVersao] = useState(0);
  /** maior id já visto: o que vier acima disso é novo */
  const ultimoVisto = useRef<number | null>(null);

  const consultar = useCallback(async () => {
    if (idUsuario === null) return;
    let r: notifApi.ListaNotificacoes;
    try {
      r = await notifApi.listar({ limit: 10 });
    } catch {
      return; // sem rede ou API fora: tenta de novo na próxima volta
    }
    setNaoLidas(r.nao_lidas);
    const maior = r.data[0]?.id_notificacao ?? 0;
    if (ultimoVisto.current === null) {
      // primeira consulta da sessão: um aviso só, com o total sem ler
      const chave = `pasi.notificacoes.avisou.${idUsuario}`;
      let jaAvisou = false;
      try {
        jaAvisou = sessionStorage.getItem(chave) === '1';
        sessionStorage.setItem(chave, '1');
      } catch {
        /* sem armazenamento: avisa a cada vez que o painel abre */
      }
      if (r.nao_lidas > 0 && !jaAvisou) {
        avisar({
          tipo: 'info',
          titulo: r.nao_lidas === 1 ? 'Você tem 1 notificação não lida' : `Você tem ${r.nao_lidas} notificações não lidas`,
          texto: 'Veja em Notificações, no menu.',
        });
      }
    } else if (maior > ultimoVisto.current) {
      const novas = r.data.filter((n) => n.id_notificacao > (ultimoVisto.current ?? 0) && !n.lida);
      novas.slice(0, 2).forEach((n) => avisar({ tipo: 'info', titulo: n.titulo, texto: n.mensagem }));
      if (novas.length > 2) avisar({ tipo: 'info', titulo: `E mais ${novas.length - 2} notificações novas`, texto: 'Veja em Notificações, no menu.' });
      setVersao((v) => v + 1);
    }
    ultimoVisto.current = Math.max(ultimoVisto.current ?? 0, maior);
  }, [idUsuario, avisar]);

  // troca de usuário (sair/entrar): começa do zero
  useEffect(() => {
    ultimoVisto.current = null;
    setNaoLidas(0);
  }, [idUsuario]);

  useEffect(() => {
    if (idUsuario === null) return;
    void consultar();
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void consultar();
    }, INTERVALO);
    // voltou para a aba: confere na hora
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void consultar();
    };
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [idUsuario, consultar]);

  const marcarLida = useCallback(async (id: number) => {
    const r = await notifApi.marcarLida(id);
    setNaoLidas(r.nao_lidas);
    setVersao((v) => v + 1);
  }, []);

  const marcarTodas = useCallback(async () => {
    const r = await notifApi.marcarTodasLidas();
    setNaoLidas(r.nao_lidas);
    setVersao((v) => v + 1);
  }, []);

  const valor = useMemo(() => ({ naoLidas, versao, marcarLida, marcarTodas }), [naoLidas, versao, marcarLida, marcarTodas]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export const useNotificacoes = () => useContext(Ctx);

const rotuloContagem = (n: number) => (n === 1 ? '1 notificação não lida' : `${n} notificações não lidas`);

/** Item "Notificações" do menu lateral, com a contagem de não lidas. */
export function ItemMenuNotificacoes({ className }: { className: (a: { isActive: boolean }) => string }) {
  const { naoLidas } = useNotificacoes();
  return (
    <NavLink className={className} to="/notificacoes">
      <IcSino lg />
      Notificações
      {naoLidas > 0 && (
        <span className="ps-count" style={{ marginLeft: 'auto' }} aria-label={rotuloContagem(naoLidas)}>
          {naoLidas > 99 ? '99+' : naoLidas}
        </span>
      )}
    </NavLink>
  );
}

/** Sino da barra superior do celular. */
export function SinoMovel() {
  const { naoLidas } = useNotificacoes();
  return (
    <NavLink
      to="/notificacoes"
      className={({ isActive }) => 'topo-movel-sino' + (isActive ? ' is-active' : '')}
      aria-label={naoLidas > 0 ? `Notificações: ${rotuloContagem(naoLidas)}` : 'Notificações'}
    >
      <IcSino lg />
      {naoLidas > 0 && (
        <span className="ps-count" aria-hidden="true">
          {naoLidas > 99 ? '99+' : naoLidas}
        </span>
      )}
    </NavLink>
  );
}
