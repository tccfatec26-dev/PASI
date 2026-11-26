import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as notifApi from '../api/notificacoes';
import { TipoNotificacao, type Notificacao } from '../api/notificacoes';
import { mensagemErro } from '../api/client';
import { useCarregar } from '../hooks';
import { PageHead } from '../components/Layout';
import { Paginacao } from '../components/Lista';
import { Seg } from '../components/Seg';
import { Alerta } from '../components/Form';
import { useAvisos } from '../components/Avisos';
import { IcSino, useNotificacoes } from '../components/Notificacoes';
import { D, Ic } from '../components/icons';
import { dataHora } from '../lib/format';

const POR_PAGINA = 15;

/** "agora", "há 5 min", "há 3 h"; depois de um dia, a data e a hora. */
function quando(dt: string) {
  const min = Math.floor((Date.now() - new Date(dt).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.floor(min / 60)} h`;
  return dataHora(dt);
}

/** Para onde a notificação leva. */
function destino(n: Notificacao) {
  if (!n.id_atendimento) return null;
  if (n.id_tipo_notificacao === TipoNotificacao.FORMULARIO_RESPONDIDO && n.id_formulario) {
    return `/atendimentos/${n.id_atendimento}/formularios/${n.id_formulario}`;
  }
  return `/atendimentos/${n.id_atendimento}`;
}

/** Notificações do profissional: formulários respondidos nos atendimentos que ele criou. */
export function Notificacoes() {
  const [filtro, setFiltro] = useState<'todas' | 'nao_lidas'>('todas');
  const [pagina, setPagina] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const { naoLidas, versao, marcarLida, marcarTodas } = useNotificacoes();
  const avisar = useAvisos();
  const navegar = useNavigate();

  const { dados, carregando, erro, recarregar } = useCarregar(
    () => notifApi.listar({ page: pagina, limit: POR_PAGINA, nao_lidas: filtro === 'nao_lidas' || undefined }),
    [pagina, filtro],
  );
  // chegou notificação nova ou alguma foi lida em outro lugar: atualiza a lista
  useEffect(() => {
    if (versao > 0) void recarregar();
  }, [versao, recarregar]);

  async function abrir(n: Notificacao) {
    const para = destino(n);
    try {
      if (!n.lida) await marcarLida(n.id_notificacao);
    } catch {
      /* não conseguiu marcar: abre assim mesmo */
    }
    if (para) navegar(para);
  }

  async function lerUma(n: Notificacao) {
    try {
      await marcarLida(n.id_notificacao);
    } catch (e) {
      avisar({ tipo: 'error', titulo: 'Não foi possível marcar como lida', texto: mensagemErro(e) });
    }
  }

  async function lerTodas() {
    setOcupado(true);
    try {
      await marcarTodas();
      avisar({ titulo: 'Todas as notificações foram marcadas como lidas' });
    } catch (e) {
      avisar({ tipo: 'error', titulo: 'Não foi possível marcar como lidas', texto: mensagemErro(e) });
    } finally {
      setOcupado(false);
    }
  }

  const lista = dados?.data ?? [];
  return (
    <>
      <PageHead
        migalhas={[{ rotulo: 'Início', para: '/atendimentos' }, { rotulo: 'Notificações' }]}
        titulo="Notificações"
        dica="Você é avisado quando um paciente responde um formulário de um atendimento criado por você."
        acoes={
          <button type="button" className="ps-btn secondary" onClick={lerTodas} disabled={ocupado || naoLidas === 0}>
            <Ic d={D.check} />
            Marcar todas como lidas
          </button>
        }
        acoesAlinhadas
      />
      <div className="page-body">
        <section className="panel lista-notificacoes" aria-labelledby="h-notif">
          <header>
            <h2 id="h-notif">{naoLidas === 0 ? 'Todas lidas' : naoLidas === 1 ? '1 não lida' : `${naoLidas} não lidas`}</h2>
            <Seg
              rotulo="Mostrar"
              opcoes={[
                { valor: 'todas', rotulo: 'Todas' },
                { valor: 'nao_lidas', rotulo: 'Não lidas' },
              ]}
              valor={filtro}
              aoMudar={(v) => {
                setFiltro(v);
                setPagina(1);
              }}
            />
          </header>
          {erro ? (
            <div className="pb">
              <Alerta tipo="error" titulo="Não foi possível carregar as notificações">
                {erro}
              </Alerta>
            </div>
          ) : carregando && !dados ? (
            <p className="ps-results-meta notif-vazia" role="status">
              Carregando…
            </p>
          ) : lista.length === 0 ? (
            <div className="notif-vazia">
              <span className="si empty" aria-hidden="true">
                <IcSino lg />
              </span>
              <p>{filtro === 'nao_lidas' ? 'Nenhuma notificação sem ler.' : 'Nenhuma notificação por enquanto.'}</p>
            </div>
          ) : (
            <ul className="notif-lista">
              {lista.map((n) => (
                <li key={n.id_notificacao} className={'ps-notif' + (n.lida ? '' : ' unread')}>
                  <span className="ni" aria-hidden="true">
                    <Ic d={n.id_tipo_notificacao === TipoNotificacao.FORMULARIO_RESPONDIDO ? D.respostas : D.novoDoc} />
                  </span>
                  <button type="button" className="notif-abrir" onClick={() => abrir(n)}>
                    <h5>
                      {!n.lida && <span className="ps-sr">Não lida: </span>}
                      {n.titulo}
                    </h5>
                    <p>{n.mensagem}</p>
                    <time dateTime={n.dt_cadastro} title={dataHora(n.dt_cadastro)}>
                      {quando(n.dt_cadastro)}
                    </time>
                  </button>
                  {!n.lida && (
                    <button type="button" className="act tt notif-ler" onClick={() => lerUma(n)} aria-label="Marcar como lida" data-tip="Marcar como lida">
                      <Ic d={D.check} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {dados && dados.total > POR_PAGINA && (
            <Paginacao pagina={pagina} totalPaginas={dados.totalPages} total={dados.total} porPagina={POR_PAGINA} aoMudar={setPagina} mostrarPorPagina={false} />
          )}
        </section>
      </div>
    </>
  );
}
