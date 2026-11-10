import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as atendApi from '../api/atendimentos';
import type { OrdemAtendimento } from '../api/atendimentos';
import { mensagemErro } from '../api/client';
import { SituacaoAtendimento, type Atendimento } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { useAtrasado, useCarregar } from '../hooks';
import { PageHead } from '../components/Layout';
import { BarraBusca, LinhaEstado, PainelFiltros, Paginacao } from '../components/Lista';
import { infoSituacaoAtendimento, SeloAtendimento } from '../components/Situacao';
import { Modal } from '../components/Modal';
import { Select } from '../components/Form';
import { useAvisos } from '../components/Avisos';
import { IcCadeado, IcChevron, IcEncerrar, IcLapis, IcMais, IcOlhoAcao } from '../components/icons';
import { cpfMascarado, data, plural, protocolo } from '../lib/format';
import { fimDoDia, inicioDoDia } from '../lib/datas';

const POR_PAGINA = 10;
const SITUACOES_FILTRO = [1, 2, 3, 4, 5, 6] as const;

interface Filtros {
  situacoes: number[];
  de: string;
  ate: string;
  ordem: OrdemAtendimento;
}
const F0: Filtros = { situacoes: [], de: '', ate: '', ordem: 'data_desc' };

/** 2.2 Lista de atendimentos (Atendimentos.dc.html). */
export function Atendimentos() {
  const { ehMaximo } = useAuth();
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useAtrasado(busca);
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rasc, setRasc] = useState<Filtros>(F0);
  const [ap, setAp] = useState<Filtros>(F0);
  const [encerrar, setEncerrar] = useState<Atendimento | null>(null);
  const [encerrando, setEncerrando] = useState(false);
  const avisar = useAvisos();

  const { dados, carregando, erro, recarregar } = useCarregar(
    () =>
      atendApi.listar({
        page: pagina,
        limit: POR_PAGINA,
        search: buscaAtrasada,
        situacoes: ap.situacoes,
        data_inicio: inicioDoDia(ap.de),
        data_fim: fimDoDia(ap.ate),
        ordenar_por: ap.ordem,
      }),
    [pagina, buscaAtrasada, ap],
  );

  const nAtivos = (ap.situacoes.length ? 1 : 0) + (ap.de || ap.ate ? 1 : 0) + (ap.ordem !== F0.ordem ? 1 : 0);
  const resumo =
    rasc.situacoes.length === 0
      ? 'Todas as situações'
      : rasc.situacoes.length === 1
        ? infoSituacaoAtendimento(rasc.situacoes[0]).t
        : `${rasc.situacoes.length} situações selecionadas`;

  const total = dados?.total ?? 0;
  const dica = `${plural(total, 'atendimento encontrado', 'atendimentos encontrados')}. ${
    ehMaximo ? 'Você vê os atendimentos de todas as unidades.' : 'Você vê os atendimentos das suas unidades.'
  }`;

  async function confirmarEncerrar() {
    if (!encerrar) return;
    setEncerrando(true);
    try {
      await atendApi.encerrar(encerrar.id_atendimento);
      avisar({
        titulo: 'Atendimento encerrado',
        texto: `${protocolo(encerrar.id_atendimento, encerrar.dt_cadastro)} não recebe mais formulários nem alterações.`,
      });
      setEncerrar(null);
      await recarregar();
    } catch (e) {
      setEncerrar(null);
      avisar({ tipo: 'error', titulo: 'Não foi possível encerrar', texto: mensagemErro(e) });
    } finally {
      setEncerrando(false);
    }
  }

  return (
    <>
      <PageHead
        migalhas={[{ rotulo: 'Início', para: '/atendimentos' }, { rotulo: 'Atendimentos' }]}
        voltar="/atendimentos"
        titulo="Atendimentos"
        dica={carregando && !dados ? undefined : dica}
        acoes={
          <Link className="ps-btn primary" to="/atendimentos/novo">
            <IcMais />
            Novo atendimento
          </Link>
        }
      />

      <div className="page-body">
        <section className="panel" aria-label="Lista de atendimentos">
          <BarraBusca
            busca={busca}
            aoBuscar={(v) => {
              setBusca(v);
              setPagina(1);
            }}
            placeholder="Buscar paciente ou descrição..."
            filtrosAbertos={aberto}
            aoAlternarFiltros={() => {
              setAberto(!aberto);
              setRasc(ap);
              setMenu(false);
            }}
            nFiltros={nAtivos}
          />

          <PainelFiltros
            aberto={aberto}
            aoLimpar={() => {
              setRasc(F0);
              setAp(F0);
              setMenu(false);
              setPagina(1);
            }}
            aoAplicar={() => {
              setAp(rasc);
              setAberto(false);
              setMenu(false);
              setPagina(1);
            }}
          >
            <div className="fg">
              <span className="ps-label" id="sit-l">
                Situação do atendimento
              </span>
              <div className="ms">
                <button
                  type="button"
                  className="ps-control ms-trigger"
                  aria-haspopup="listbox"
                  aria-expanded={menu}
                  aria-labelledby="sit-l"
                  onClick={() => setMenu(!menu)}
                >
                  <span className={'val' + (rasc.situacoes.length === 0 ? ' ph' : '')}>{resumo}</span>
                  <IcChevron style={{ color: 'var(--Link)' }} />
                </button>
                {menu && (
                  <div className="ms-menu" role="listbox" aria-multiselectable="true">
                    {SITUACOES_FILTRO.map((id) => {
                      const on = rasc.situacoes.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          role="option"
                          className={'ps-check ms-opt' + (on ? ' is-checked' : '')}
                          aria-selected={on}
                          onClick={() =>
                            setRasc({
                              ...rasc,
                              situacoes: on ? rasc.situacoes.filter((x) => x !== id) : [...rasc.situacoes, id],
                            })
                          }
                        >
                          <span className="ps-box">{on ? '✓' : ''}</span>
                          <span>{infoSituacaoAtendimento(id).t}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="fg">
              <span className="ps-label">Data de cadastro</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <div className="ps-control" style={{ flex: 1, minWidth: 0 }}>
                  <input type="date" aria-label="De" value={rasc.de} max={rasc.ate || undefined} onChange={(e) => setRasc({ ...rasc, de: e.target.value })} />
                </div>
                <div className="ps-control" style={{ flex: 1, minWidth: 0 }}>
                  <input type="date" aria-label="Até" value={rasc.ate} min={rasc.de || undefined} onChange={(e) => setRasc({ ...rasc, ate: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="fg">
              <label className="ps-label" htmlFor="ord">
                Ordenar por
              </label>
              <Select id="ord" valor={rasc.ordem} aoMudar={(v) => setRasc({ ...rasc, ordem: v as OrdemAtendimento })}>
                <option value="data_desc">Data de cadastro (mais recente)</option>
                <option value="data_asc">Data de cadastro (mais antiga)</option>
                <option value="paciente">Nome do paciente</option>
                <option value="situacao">Situação</option>
              </Select>
            </div>
          </PainelFiltros>

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Paciente</th>
                  <th>Descrição</th>
                  <th>Formulários</th>
                  <th>Situação</th>
                  <th>Cadastro</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {carregando && !dados ? (
                  <LinhaEstado colunas={7}>Carregando atendimentos…</LinhaEstado>
                ) : erro ? (
                  <LinhaEstado colunas={7}>
                    {erro}{' '}
                    <button type="button" className="ps-text-action" onClick={() => void recarregar()}>
                      Tentar de novo
                    </button>
                  </LinhaEstado>
                ) : !dados?.data.length ? (
                  <LinhaEstado colunas={7}>
                    {busca || nAtivos ? 'Nenhum atendimento com esses filtros.' : 'Nenhum atendimento por enquanto.'}
                  </LinhaEstado>
                ) : (
                  dados.data.map((a) => {
                    const pac = a.usuario_atendimento_id_usuario_pacienteTousuario;
                    const n = a.atendimento_formulario.length;
                    const s = a.id_situacao_atendimento;
                    const fechado = s === SituacaoAtendimento.ENCERRADO || s === SituacaoAtendimento.INATIVO;
                    return (
                      <tr key={a.id_atendimento}>
                        <td className="num">{protocolo(a.id_atendimento, a.dt_cadastro)}</td>
                        <td>
                          <strong>{pac.nome}</strong>
                          <small>CPF {cpfMascarado(pac.cpf)}</small>
                        </td>
                        <td style={{ maxWidth: 260, color: 'var(--Text-muted)' }}>{a.descricao || '—'}</td>
                        <td>{plural(n, 'formulário', 'formulários')}</td>
                        <td>
                          <SeloAtendimento id={s} />
                        </td>
                        <td className="num">{data(a.dt_cadastro)}</td>
                        <td>
                          <div className="row-actions">
                            <Link className="act tt" to={`/atendimentos/${a.id_atendimento}`} aria-label="Ver detalhes" data-tip="Ver detalhes">
                              <IcOlhoAcao />
                            </Link>
                            {!fechado && (
                              <Link
                                className="act tt"
                                to={`/atendimentos/${a.id_atendimento}/alterar`}
                                aria-label="Alterar atendimento"
                                data-tip="Alterar atendimento"
                              >
                                <IcLapis />
                              </Link>
                            )}
                            {s === SituacaoAtendimento.AVALIADO && (
                              <button
                                type="button"
                                className="act tt danger"
                                aria-label="Encerrar atendimento"
                                data-tip="Encerrar atendimento"
                                onClick={() => setEncerrar(a)}
                              >
                                <IcEncerrar />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <Paginacao
            pagina={pagina}
            totalPaginas={dados?.totalPages ?? 1}
            total={total}
            porPagina={POR_PAGINA}
            aoMudar={setPagina}
          />
        </section>
      </div>

      {encerrar && (
        <Modal
          alerta
          icone={
            <div className="ico warning">
              <IcCadeado lg />
            </div>
          }
          titulo="Encerrar atendimento?"
          aoFechar={encerrando ? undefined : () => setEncerrar(null)}
          rodape={
            <>
              <button type="button" className="ps-btn secondary cancelar" onClick={() => setEncerrar(null)} disabled={encerrando}>
                Cancelar
              </button>
              <button type="button" className="ps-btn danger" onClick={() => void confirmarEncerrar()} aria-busy={encerrando}>
                {encerrando ? 'Encerrando…' : 'Encerrar'}
              </button>
            </>
          }
        >
          O atendimento {protocolo(encerrar.id_atendimento, encerrar.dt_cadastro)} de{' '}
          {encerrar.usuario_atendimento_id_usuario_pacienteTousuario.nome} será encerrado. Depois disso ele não pode ser reaberto,
          inativado nem receber formulários.
        </Modal>
      )}
    </>
  );
}
