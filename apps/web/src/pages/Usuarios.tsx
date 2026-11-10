import { useState } from 'react';
import { Link } from 'react-router-dom';
import * as gestao from '../api/gestao';
import type { FiltrosUsuarios, UsuarioLista } from '../api/gestao';
import * as apoio from '../api/apoio';
import { SituacaoUsuario, TipoUsuario } from '../api/types';
import { useAtrasado, useCarregar } from '../hooks';
import { PageHead } from '../components/Layout';
import { BarraBusca, LinhaEstado, PainelFiltros, Paginacao } from '../components/Lista';
import { Alerta, Select } from '../components/Form';
import { Seg } from '../components/Seg';
import { ModalAcaoUsuario, type AcaoUsuario } from '../components/AcoesUsuario';
import { D, Ic, IcMais, IcOlhoAcao } from '../components/icons';
import { data, plural } from '../lib/format';
import { observacao, PERFIS, SITUACOES } from '../lib/usuarios';

const POR_PAGINA = 50;
type Aba = 'todos' | 1 | 2 | 3;
interface Filtros {
  perfil: 'todos' | 'paciente' | 'intermediario' | 'maximo';
  profissao: number | 'todas';
  acesso: 'ativos' | 'inativos' | 'todos';
  ordem: 'nome' | 'recentes' | 'antigos';
}
const INICIAL: Filtros = { perfil: 'todos', profissao: 'todas', acesso: 'ativos', ordem: 'nome' };
const LIMPO: Filtros = { perfil: 'todos', profissao: 'todas', acesso: 'todos', ordem: 'nome' };

/** 5.1 Gestão de usuários (Usuarios.dc.html) — só o máximo. */
export function Usuarios() {
  const [aba, setAba] = useState<Aba>('todos');
  const [busca, setBusca] = useState('');
  const buscaAtrasada = useAtrasado(busca);
  const [pagina, setPagina] = useState(1);
  const [aberto, setAberto] = useState(false);
  const [rasc, setRasc] = useState<Filtros>(INICIAL);
  const [ap, setAp] = useState<Filtros>(INICIAL);
  const [modal, setModal] = useState<{ acao: AcaoUsuario; alvo: UsuarioLista } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const { dados: profissoes } = useCarregar(() => apoio.profissoes(), []);

  const filtros: FiltrosUsuarios = {
    page: pagina,
    limit: POR_PAGINA,
    search: buscaAtrasada.trim() || undefined,
    situacao: aba === 'todos' ? undefined : aba,
    perfil: ap.perfil === 'todos' ? undefined : ap.perfil,
    id_profissao: ap.profissao === 'todas' ? undefined : ap.profissao,
    acesso: ap.acesso === 'todos' ? undefined : ap.acesso,
    ordenar: ap.ordem,
  };
  const { dados, carregando, erro, recarregar } = useCarregar(() => gestao.listar(filtros), [JSON.stringify(filtros)]);

  const nAtivos =
    (ap.perfil !== 'todos' ? 1 : 0) + (ap.acesso !== 'todos' ? 1 : 0) + (ap.profissao !== 'todas' ? 1 : 0) + (ap.ordem !== 'nome' ? 1 : 0);
  const c = dados?.contagem;
  const abas: { id: Aba; nome: string; n: number }[] = [
    { id: 'todos', nome: 'Todos', n: c?.todos ?? 0 },
    { id: SituacaoUsuario.PENDENCIA_I, nome: 'Pendência I', n: c?.pendencia_i ?? 0 },
    { id: SituacaoUsuario.PENDENCIA_II, nome: 'Pendência II', n: c?.pendencia_ii ?? 0 },
    { id: SituacaoUsuario.DEFERIDO, nome: 'Deferidos', n: c?.deferido ?? 0 },
  ];
  const total = dados?.total ?? 0;
  const abrir = (acao: AcaoUsuario, alvo: UsuarioLista) => () => {
    setAviso(null);
    setModal({ acao, alvo });
  };

  return (
    <>
      <PageHead
        migalhas={[{ rotulo: 'Início', para: '/atendimentos' }, { rotulo: 'Usuários' }]}
        voltar="/atendimentos"
        titulo="Usuários"
        acoes={
          <Link className="ps-btn primary" to="/usuarios/novo">
            <IcMais />
            Cadastrar profissional
          </Link>
        }
      />

      <div className="page-body">
        {aviso && (
          <Alerta tipo="success" titulo="Pronto">
            {aviso}
          </Alerta>
        )}
        <section className="panel" aria-label="Lista de usuários">
          <div className="tabs-bar" role="tablist" aria-label="Situação do cadastro">
            {abas.map((a) => (
              <button
                key={String(a.id)}
                type="button"
                role="tab"
                className={'ps-tab' + (a.id === aba ? ' is-selected' : '')}
                aria-selected={a.id === aba}
                onClick={() => {
                  setAba(a.id);
                  setPagina(1);
                }}
              >
                {a.nome} <span className="ps-count">{a.n}</span>
              </button>
            ))}
          </div>
          <BarraBusca
            busca={busca}
            aoBuscar={(v) => {
              setBusca(v);
              setPagina(1);
            }}
            placeholder="Buscar por nome, CPF ou e-mail..."
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
              setRasc(LIMPO);
              setAp(LIMPO);
              setPagina(1);
            }}
            aoAplicar={() => {
              setAp(rasc);
              setAberto(false);
              setPagina(1);
            }}
          >
            <div className="fg">
              <label className="ps-label" htmlFor="f-perfil">
                Perfil
              </label>
              <Select id="f-perfil" valor={rasc.perfil} aoMudar={(v) => setRasc({ ...rasc, perfil: v as Filtros['perfil'] })}>
                <option value="todos">Todos</option>
                <option value="paciente">Paciente</option>
                <option value="intermediario">Intermediário</option>
                <option value="maximo">Máximo</option>
              </Select>
            </div>
            <div className="fg">
              <label className="ps-label" htmlFor="f-prof">
                Profissão
              </label>
              <Select
                id="f-prof"
                valor={rasc.profissao}
                aoMudar={(v) => setRasc({ ...rasc, profissao: v === 'todas' ? 'todas' : Number(v) })}
              >
                <option value="todas">Todas</option>
                {(profissoes ?? []).map((p) => (
                  <option key={p.id_profissao} value={p.id_profissao}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            </div>
            <div className="fg">
              <span className="ps-label">Acesso</span>
              <Seg
                papel="group"
                rotulo="Ativo ou inativo"
                valor={rasc.acesso}
                aoMudar={(v) => setRasc({ ...rasc, acesso: v })}
                opcoes={[
                  { valor: 'ativos', rotulo: 'Ativos' },
                  { valor: 'inativos', rotulo: 'Inativos' },
                  { valor: 'todos', rotulo: 'Todos' },
                ]}
              />
            </div>
            <div className="fg">
              <label className="ps-label" htmlFor="ord">
                Ordenar por
              </label>
              <Select id="ord" valor={rasc.ordem} aoMudar={(v) => setRasc({ ...rasc, ordem: v as Filtros['ordem'] })}>
                <option value="nome">Nome (A–Z)</option>
                <option value="recentes">Cadastro mais recente</option>
                <option value="antigos">Cadastro mais antigo</option>
              </Select>
            </div>
          </PainelFiltros>

          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Perfil</th>
                  <th>Situação</th>
                  <th>Observação</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {carregando && !dados ? (
                  <LinhaEstado colunas={5}>Carregando usuários…</LinhaEstado>
                ) : erro ? (
                  <LinhaEstado colunas={5}>
                    {erro}{' '}
                    <button type="button" className="ps-text-action" onClick={() => void recarregar()}>
                      Tentar de novo
                    </button>
                  </LinhaEstado>
                ) : !dados?.data.length ? (
                  <LinhaEstado colunas={5}>Nenhum usuário com esses filtros.</LinhaEstado>
                ) : (
                  dados.data.map((u) => <Linha key={u.id_usuario} u={u} abrir={abrir} />)
                )}
              </tbody>
            </table>
          </div>
          {dados && dados.totalPages > 1 ? (
            <Paginacao pagina={pagina} totalPaginas={dados.totalPages} total={total} porPagina={POR_PAGINA} aoMudar={setPagina} />
          ) : (
            <footer>
              <span className="ps-results-meta">{plural(total, 'usuário', 'usuários')} nesta visão</span>
              <span className="ps-results-meta">
                Toda ação desta tela fica registrada no histórico (log) com autor, usuário alvo, data e hora.
              </span>
            </footer>
          )}
        </section>
      </div>

      {modal && (
        <ModalAcaoUsuario
          acao={modal.acao}
          alvo={modal.alvo}
          aoFechar={() => setModal(null)}
          aoConcluir={(msg) => {
            setModal(null);
            setAviso(msg);
            void recarregar();
          }}
        />
      )}
    </>
  );
}

function Linha({ u, abrir }: { u: UsuarioLista; abrir: (a: AcaoUsuario, alvo: UsuarioLista) => () => void }) {
  const perfil = PERFIS[u.id_tipo_usuario] ?? PERFIS[TipoUsuario.PACIENTE];
  const sit = SITUACOES[u.id_situacao_usuario];
  const nota = observacao(u.id_situacao_usuario, u.senha_provisoria_expira_em);
  const dot = u.ativo ? 'Usuário(a) ativo(a)' : u.inativado_em ? `Usuário inativado em ${data(u.inativado_em)}` : 'Usuário inativo';
  const p = u.permissoes;
  return (
    <tr>
      <td>
        <div className="nm">
          <span className={'dot tt ' + (u.ativo ? 'on' : 'off')} data-tip={dot} tabIndex={0} role="img" aria-label={dot} />
          <div className="nm-txt">
            <strong className="with-tag">
              {u.nome}
              {u.eu && <span className="you-tag">Você</span>}
            </strong>
            <small>{u.email}</small>
          </div>
        </div>
      </td>
      <td>
        <span className={perfil.c}>{perfil.t}</span>
        <small style={{ marginTop: 4 }}>{u.profissao?.nome ?? '—'}</small>
      </td>
      <td>
        {sit && (
          <span className={sit.c}>
            <Ic d={sit.i} />
            {sit.t}
          </span>
        )}
      </td>
      <td>
        {nota ? (
          <span className={'refusals' + (nota.alerta ? ' high' : '')}>
            <Ic d={nota.icone} style={{ width: 14, height: 14 }} />
            {nota.texto}
          </span>
        ) : (
          <span style={{ color: 'var(--Text-muted)' }}>—</span>
        )}
      </td>
      <td>
        <div className="row-actions">
          {p.reenviar_senha && !u.eu && (
            <button type="button" className="act tt" aria-label="Reenviar senha provisória" data-tip="Reenviar senha provisória" onClick={abrir('reenviar', u)}>
              <Ic d="M3 6h18v12H3zM3 7l9 6 9-6" />
            </button>
          )}
          {u.eu ? (
            <Link className="act tt" to="/perfil" aria-label="Meu perfil" data-tip="Meu perfil">
              <Ic d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" />
            </Link>
          ) : (
            <Link className="act tt" to={`/usuarios/${u.id_usuario}`} aria-label="Ver detalhes" data-tip="Ver detalhes">
              <IcOlhoAcao />
            </Link>
          )}
          {p.promover && (
            <button type="button" className="act tt" aria-label="Promover a máximo" data-tip="Promover a máximo" onClick={abrir('promover', u)}>
              <Ic d="M12 19V5M5 12l7-7 7 7" />
            </button>
          )}
          {p.inativar && (
            <button type="button" className="act tt danger" aria-label="Inativar usuário" data-tip="Inativar usuário" onClick={abrir('inativar', u)}>
              <Ic d={D.proibido} />
            </button>
          )}
          {p.reativar && (
            <button type="button" className="act tt ok" aria-label="Reativar usuário" data-tip="Reativar usuário" onClick={abrir('reativar', u)}>
              <Ic d={D.checkCirculo} />
            </button>
          )}
          {p.somente_leitura && (
            <span className="act tt muted" tabIndex={0} role="img" aria-label="Somente leitura" data-tip="Somente leitura">
              <Ic d="M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4" />
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
