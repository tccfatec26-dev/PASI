import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as formApi from '../api/formularios';
import type { Formulario, OrdemFormulario } from '../api/formularios';
import * as apoio from '../api/apoio';
import { mensagemErro } from '../api/client';
import { useAtrasado, useCarregar } from '../hooks';
import { PageHead } from '../components/Layout';
import { BarraBusca, LinhaEstado, PainelFiltros, Paginacao } from '../components/Lista';
import { Alerta, Select } from '../components/Form';
import { Seg } from '../components/Seg';
import { Modal } from '../components/Modal';
import { SeloTipo } from '../components/Situacao';
import { D, Ic, IcLapis, IcMais, IcOlhoAcao } from '../components/icons';
import { data, plural } from '../lib/format';

const POR_PAGINA = 10;
interface Filtros {
  tipo: number | 'todos';
  status: 'todos' | 'ativos' | 'inativos';
  ordem: OrdemFormulario;
}
const F0: Filtros = { tipo: 'todos', status: 'todos', ordem: 'data_desc' };

/** 3.1 Lista de formulários (Formularios.dc.html). */
export function Formularios() {
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useAtrasado(busca);
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState(false);
  const [rasc, setRasc] = useState<Filtros>(F0);
  const [ap, setAp] = useState<Filtros>(F0);
  const [alvo, setAlvo] = useState<Formulario | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const { dados: tipos } = useCarregar(() => apoio.tiposFormulario(), []);

  const { dados, carregando, erro, recarregar } = useCarregar(
    () =>
      formApi.listar({
        page: pagina,
        limit: POR_PAGINA,
        search: buscaAtrasada,
        id_tipo_formulario: ap.tipo === 'todos' ? undefined : ap.tipo,
        ativo: ap.status === 'todos' ? undefined : ap.status === 'ativos',
        ordenar_por: ap.ordem,
      }),
    [pagina, buscaAtrasada, ap],
  );

  const nAtivos = (ap.tipo !== 'todos' ? 1 : 0) + (ap.status !== 'todos' ? 1 : 0) + (ap.ordem !== F0.ordem ? 1 : 0);
  const total = dados?.total ?? 0;
  const alvoInativo = alvo ? alvo.ativo === false : false;

  async function confirmar() {
    if (!alvo) return;
    setOcupado(true);
    try {
      if (alvoInativo) await formApi.reativar(alvo.id_formulario);
      else await formApi.desativar(alvo.id_formulario);
      setAlvo(null);
      setErroAcao(null);
      await recarregar();
    } catch (e) {
      setAlvo(null);
      setErroAcao(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <PageHead
        migalhas={[{ rotulo: 'Início', para: '/atendimentos' }, { rotulo: 'Formulários' }]}
        voltar="/atendimentos"
        titulo="Formulários"
        dica={`${plural(total, 'formulário', 'formulários')}. Desativar impede novas atribuições; o que já foi atribuído continua valendo.`}
        acoes={
          <Link className="ps-btn primary" to="/formularios/novo">
            <IcMais />
            Criar formulário
          </Link>
        }
      />

      <div className="page-body">
        {erroAcao && (
          <Alerta tipo="error" titulo="Não foi possível concluir">
            {erroAcao}
          </Alerta>
        )}
        <section className="panel" aria-label="Lista de formulários">
          <BarraBusca
            busca={busca}
            aoBuscar={(v) => {
              setBusca(v);
              setPagina(1);
            }}
            placeholder="Buscar por nome ou descrição..."
            filtrosAbertos={aberto}
            aoAlternarFiltros={() => {
              setAberto(!aberto);
              setRasc(ap);
            }}
            nFiltros={nAtivos}
          />
          <PainelFiltros
            aberto={aberto}
            aoLimpar={() => {
              setRasc(F0);
              setAp(F0);
              setPagina(1);
            }}
            aoAplicar={() => {
              setAp(rasc);
              setAberto(false);
              setPagina(1);
            }}
          >
            <div className="fg">
              <span className="ps-label">Tipo de unidade</span>
              <Seg
                papel="group"
                rotulo="Tipo de unidade"
                valor={rasc.tipo}
                aoMudar={(v) => setRasc({ ...rasc, tipo: v })}
                opcoes={[{ valor: 'todos' as const, rotulo: 'Todos' }, ...(tipos ?? []).map((t) => ({ valor: t.id_tipo_formulario, rotulo: t.nome }))]}
              />
            </div>
            <div className="fg">
              <span className="ps-label">Status</span>
              <Seg
                papel="group"
                rotulo="Status"
                valor={rasc.status}
                aoMudar={(v) => setRasc({ ...rasc, status: v })}
                opcoes={[
                  { valor: 'todos', rotulo: 'Todos' },
                  { valor: 'ativos', rotulo: 'Ativos' },
                  { valor: 'inativos', rotulo: 'Inativos' },
                ]}
              />
            </div>
            <div className="fg">
              <label className="ps-label" htmlFor="ord">
                Ordenar por
              </label>
              <Select id="ord" valor={rasc.ordem} aoMudar={(v) => setRasc({ ...rasc, ordem: v as OrdemFormulario })}>
                <option value="data_desc">Mais recentes</option>
                <option value="data_asc">Mais antigos</option>
                <option value="nome">Nome</option>
                <option value="mais_respondidos">Mais respondidos</option>
              </Select>
            </div>
          </PainelFiltros>

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Formulário</th>
                  <th>Tipo</th>
                  <th>Perguntas</th>
                  <th>Respostas</th>
                  <th>Criado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {carregando && !dados ? (
                  <LinhaEstado colunas={6}>Carregando formulários…</LinhaEstado>
                ) : erro ? (
                  <LinhaEstado colunas={6}>
                    {erro}{' '}
                    <button type="button" className="ps-text-action" onClick={() => void recarregar()}>
                      Tentar de novo
                    </button>
                  </LinhaEstado>
                ) : !dados?.data.length ? (
                  <LinhaEstado colunas={6}>{busca || nAtivos ? 'Nenhum formulário com esses filtros.' : 'Nenhum formulário cadastrado.'}</LinhaEstado>
                ) : (
                  dados.data.map((f) => {
                    const inativo = f.ativo === false;
                    const dot = inativo ? 'Formulário inativo' : 'Formulário ativo';
                    const acao = inativo ? 'Ativar formulário' : 'Desativar formulário';
                    return (
                      <tr key={f.id_formulario}>
                        <td>
                          <div className="nm">
                            <span className={'dot tt ' + (inativo ? 'off' : 'on')} data-tip={dot} tabIndex={0} role="img" aria-label={dot} />
                            <div className="nm-txt">
                              <strong>{f.nome}</strong>
                              <small>{f.descricao || '—'}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          <SeloTipo nome={f.tipo_formulario?.nome} />
                        </td>
                        <td className="num">{f._count?.pergunta ?? 0}</td>
                        <td className="num">{f._count?.formulario_paciente ?? 0}</td>
                        <td className="num">{data(f.dt_cadastro)}</td>
                        <td>
                          <div className="row-actions">
                            <Link className="act tt" to={`/formularios/${f.id_formulario}`} aria-label="Visualizar formulário" data-tip="Visualizar formulário">
                              <IcOlhoAcao />
                            </Link>
                            <Link className="act tt" to={`/formularios/${f.id_formulario}/editar`} aria-label="Editar formulário" data-tip="Editar formulário">
                              <IcLapis />
                            </Link>
                            <button
                              type="button"
                              className={'act tt ' + (inativo ? 'ok' : 'danger')}
                              aria-label={acao}
                              data-tip={acao}
                              onClick={() => setAlvo(f)}
                            >
                              <Ic d={inativo ? D.checkCirculo : D.proibido} />
                            </button>
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
            mostrarPorPagina={false}
          />
        </section>
      </div>

      {alvo && (
        <Modal
          alerta
          icone="warning"
          titulo={alvoInativo ? 'Reativar formulário?' : 'Desativar formulário?'}
          aoFechar={ocupado ? undefined : () => setAlvo(null)}
          rodape={
            <>
              <button type="button" className="ps-btn secondary cancelar" onClick={() => setAlvo(null)} disabled={ocupado}>
                Cancelar
              </button>
              <button type="button" className="ps-btn primary" onClick={() => void confirmar()} aria-busy={ocupado}>
                {ocupado ? 'Aguarde…' : alvoInativo ? 'Reativar' : 'Desativar'}
              </button>
            </>
          }
        >
          {alvoInativo
            ? `“${alvo.nome}” volta a poder ser atribuído a atendimentos.`
            : `“${alvo.nome}” deixa de aparecer para novas atribuições. Atendimentos que já têm este formulário não mudam.`}
        </Modal>
      )}
    </>
  );
}
