import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as atendApi from '../api/atendimentos';
import * as formApi from '../api/formularios';
import * as apoio from '../api/apoio';
import { mensagemErro } from '../api/client';
import { SituacaoAtendimento as SA, SituacaoFormulario as SF } from '../api/types';
import { useCarregar, useUnidadesPermitidas } from '../hooks';
import { PageHead, PanelTitle } from '../components/Layout';
import { Alerta, Campo, Select, SoLeitura } from '../components/Form';
import { BarraBusca, PainelFiltros } from '../components/Lista';
import { Modal } from '../components/Modal';
import { Seg } from '../components/Seg';
import { Estado } from '../components/Estado';
import { SeloAtendimento, SeloFormulario } from '../components/Situacao';
import { D, Ic, IcFormulario, IcMais, IcOlhoAcao } from '../components/icons';
import { cpf, protocolo } from '../lib/format';

/** 2.5 Alterar atendimento (AlterarAtendimento.dc.html). */
export function AlterarAtendimento() {
  const { id } = useParams();
  const idAt = Number(id);
  const navegar = useNavigate();
  const unidades = useUnidadesPermitidas();
  const { dados: a, setDados, carregando, erro } = useCarregar(() => atendApi.obter(idAt), [idAt]);
  const [descricao, setDescricao] = useState('');
  const [idUnidade, setIdUnidade] = useState<number | ''>('');
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [modal, setModal] = useState(false);

  useEffect(() => {
    if (!a) return;
    setDescricao(a.descricao ?? '');
    setIdUnidade(a.id_unidade_atendimento ?? '');
  }, [a?.id_atendimento]); // eslint-disable-line react-hooks/exhaustive-deps

  if (carregando && !a) return <Estado texto="Carregando atendimento…" />;
  if (erro || !a) return <Estado texto={erro ?? 'Atendimento não encontrado.'} erro />;

  const s = a.id_situacao_atendimento;
  const proto = protocolo(a.id_atendimento, a.dt_cadastro);
  const pac = a.usuario_atendimento_id_usuario_pacienteTousuario;
  const podeAdicionar = s !== SA.INATIVO && s !== SA.AVALIADO && s !== SA.ENCERRADO;
  const podeRemover = s === SA.CRIADO && a.atendimento_formulario.length > 1;
  // a unidade atual aparece mesmo que não esteja entre as do intermediário
  const opcoesUnidade = [...unidades.lista];
  if (a.unidade_atendimento && !opcoesUnidade.some((u) => u.id_unidade_atendimento === a.id_unidade_atendimento)) {
    opcoesUnidade.unshift(a.unidade_atendimento);
  }

  async function salvar() {
    if (!a || salvando) return;
    setSalvando(true);
    setErroAcao(null);
    try {
      const dados: { descricao?: string; id_unidade_atendimento?: number } = {};
      if (descricao.trim() !== (a.descricao ?? '')) dados.descricao = descricao.trim();
      if (idUnidade !== '' && idUnidade !== a.id_unidade_atendimento) dados.id_unidade_atendimento = Number(idUnidade);
      if (Object.keys(dados).length) await atendApi.alterar(a.id_atendimento, dados);
      navegar(`/atendimentos/${a.id_atendimento}`);
    } catch (e) {
      setErroAcao(mensagemErro(e));
      setSalvando(false);
    }
  }

  async function remover(idFormulario: number) {
    if (!a) return;
    setErroAcao(null);
    try {
      setDados(await atendApi.removerFormulario(a.id_atendimento, idFormulario));
    } catch (e) {
      setErroAcao(mensagemErro(e));
    }
  }

  return (
    <>
      <PageHead
        migalhas={[
          { rotulo: 'Início', para: '/atendimentos' },
          { rotulo: 'Atendimentos', para: '/atendimentos' },
          { rotulo: proto, para: `/atendimentos/${a.id_atendimento}` },
          { rotulo: 'Alterar' },
        ]}
        voltar={`/atendimentos/${a.id_atendimento}`}
        linhaTitulo="flex"
        titulo="Alterar atendimento"
        extra={<SeloAtendimento id={s} />}
        dica={`${proto} · ${pac.nome}`}
      />

      <div className="page-body">
        {erroAcao && (
          <Alerta tipo="error" titulo="Não foi possível concluir">
            {erroAcao}
          </Alerta>
        )}
        <section className="panel">
          <header>
            <h2>Dados do atendimento</h2>
          </header>
          <div className="pb">
            <div className="ps-field">
              <label className="ps-label" htmlFor="desc">
                Descrição <span className="opt">(opcional)</span>
              </label>
              <div className="ps-control ps-textarea" style={{ alignItems: 'flex-start' }}>
                <textarea id="desc" maxLength={150} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
              </div>
              <div className="ps-helper">
                Pode ser alterada em qualquer situação.<span className="ps-counter">{descricao.length}/150</span>
              </div>
            </div>
            <Campo rotulo="Paciente" estatico ajuda="O paciente não pode ser trocado.">
              <SoLeitura valor={`${pac.nome} · CPF ${cpf(pac.cpf)}`} />
            </Campo>
            <Campo id="unidade" rotulo="Unidade de atendimento" obrigatorio>
              <Select id="unidade" valor={idUnidade} aoMudar={(v) => setIdUnidade(v ? Number(v) : '')} desabilitado={unidades.carregando}>
                {opcoesUnidade.map((u) => (
                  <option key={u.id_unidade_atendimento} value={u.id_unidade_atendimento}>
                    {u.nome}
                  </option>
                ))}
              </Select>
            </Campo>
          </div>
        </section>

        <section className="panel">
          <header>
            <PanelTitle dica="Remover só é possível em Criado. Adicionar, em qualquer situação menos Inativo, Avaliado e Encerrado.">
              Formulários vinculados ({a.atendimento_formulario.length})
            </PanelTitle>
            {podeAdicionar && (
              <button type="button" className="ps-btn primary sm" onClick={() => setModal(true)}>
                <IcMais />
                Adicionar formulários
              </button>
            )}
          </header>
          <div className="pb">
            {a.atendimento_formulario.map((f) => {
              const sit = f.status_formulario_paciente?.id_situacao_formulario ?? null;
              const temRespostas = sit === SF.RESPONDIDO || sit === SF.EM_AVALIACAO || sit === SF.AVALIADO;
              return (
                <div className="item" key={f.id_formulario}>
                  <span className="ico">
                    <IcFormulario lg />
                  </span>
                  <div className="meta">
                    <strong>{f.formulario.nome}</strong>
                    <span>{f.formulario.descricao || '—'}</span>
                  </div>
                  <SeloFormulario id={sit} />
                  <div className="acts">
                    {temRespostas ? (
                      <Link className="act tt" to={`/atendimentos/${a.id_atendimento}/formularios/${f.id_formulario}`} aria-label="Ver respostas" data-tip="Ver respostas">
                        <Ic d={D.respostas} />
                      </Link>
                    ) : (
                      <Link className="act tt" to={`/formularios/${f.id_formulario}`} aria-label="Ver modelo do formulário" data-tip="Ver modelo do formulário">
                        <IcOlhoAcao />
                      </Link>
                    )}
                    {podeRemover && (
                      <button
                        type="button"
                        className="act tt danger"
                        aria-label="Remover do atendimento"
                        data-tip="Remover do atendimento"
                        onClick={() => void remover(f.id_formulario)}
                      >
                        <Ic d={D.fechar} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <footer>
            <Link className="ps-btn secondary cancelar" to={`/atendimentos/${a.id_atendimento}`}>
              Cancelar
            </Link>
            <button type="button" className="ps-btn primary" onClick={() => void salvar()} aria-busy={salvando}>
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </footer>
        </section>
      </div>

      {modal && (
        <ModalAdicionar
          jaVinculados={a.atendimento_formulario.map((f) => f.id_formulario)}
          aoFechar={() => setModal(false)}
          aoAdicionar={async (ids) => {
            const novo = await atendApi.adicionarFormularios(a.id_atendimento, ids);
            setDados(novo);
            setModal(false);
          }}
        />
      )}
    </>
  );
}

function ModalAdicionar({
  jaVinculados,
  aoFechar,
  aoAdicionar,
}: {
  jaVinculados: number[];
  aoFechar: () => void;
  aoAdicionar: (ids: number[]) => Promise<void>;
}) {
  const [busca, setBusca] = useState('');
  const [fAberto, setFAberto] = useState(false);
  const [fRasc, setFRasc] = useState<number | 'todos'>('todos');
  const [fAp, setFAp] = useState<number | 'todos'>('todos');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { dados: forms } = useCarregar(() => formApi.listar({ ativo: true, limit: 200, ordenar_por: 'nome' }), []);
  const { dados: tipos } = useCarregar(() => apoio.tiposFormulario(), []);
  const disponiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return (forms?.data ?? [])
      .filter((f) => !jaVinculados.includes(f.id_formulario))
      .filter((f) => fAp === 'todos' || f.id_tipo_formulario === fAp)
      .filter((f) => !termo || (f.nome ?? '').toLowerCase().includes(termo));
  }, [forms, jaVinculados, fAp, busca]);

  async function adicionar() {
    if (!sel.size || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await aoAdicionar([...sel]);
    } catch (e) {
      setErro(mensagemErro(e));
      setEnviando(false);
    }
  }

  return (
    <Modal
      titulo="Adicionar formulários"
      subtitulo="Formulários ativos que ainda não estão neste atendimento."
      fecharNoX
      aoFechar={aoFechar}
      largura={560}
      estiloCorpo={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      rodape={
        <>
          <button type="button" className="ps-btn secondary cancelar" onClick={aoFechar}>
            Cancelar
          </button>
          <button type="button" className="ps-btn primary" onClick={() => void adicionar()} aria-disabled={!sel.size} aria-busy={enviando}>
            {enviando ? 'Adicionando…' : `Adicionar (${sel.size})`}
          </button>
        </>
      }
    >
      <>
        <BarraBusca
          inline
          busca={busca}
          aoBuscar={setBusca}
          placeholder="Buscar formulários..."
          rotuloBusca="Buscar formulários"
          filtrosAbertos={fAberto}
          aoAlternarFiltros={() => {
            setFAberto(!fAberto);
            setFRasc(fAp);
          }}
          nFiltros={fAp === 'todos' ? 0 : 1}
        />
        <PainelFiltros
          aberto={fAberto}
          aoLimpar={() => {
            setFRasc('todos');
            setFAp('todos');
          }}
          aoAplicar={() => {
            setFAp(fRasc);
            setFAberto(false);
          }}
        >
          <div className="fg">
            <span className="ps-label">Tipo de unidade</span>
            <Seg
              papel="group"
              rotulo="Tipo de unidade"
              valor={fRasc}
              aoMudar={setFRasc}
              opcoes={[{ valor: 'todos' as const, rotulo: 'Todos' }, ...(tipos ?? []).map((t) => ({ valor: t.id_tipo_formulario, rotulo: t.nome }))]}
            />
          </div>
        </PainelFiltros>
        {erro && <div className="ps-helper error">{erro}</div>}
        {!forms ? (
          <div className="ps-helper">Carregando formulários…</div>
        ) : disponiveis.length === 0 ? (
          <div className="ps-helper">Nenhum formulário disponível para adicionar.</div>
        ) : (
          disponiveis.map((f) => {
            const on = sel.has(f.id_formulario);
            return (
              <button
                key={f.id_formulario}
                type="button"
                className={'ps-choice' + (on ? ' is-checked' : '')}
                aria-pressed={on}
                onClick={() => {
                  const n = new Set(sel);
                  if (on) n.delete(f.id_formulario);
                  else n.add(f.id_formulario);
                  setSel(n);
                }}
                style={{ textAlign: 'left', fontFamily: 'inherit' }}
              >
                <span className="ico">
                  <IcFormulario lg />
                </span>
                <span style={{ flex: 1 }}>
                  <strong>{f.nome}</strong>
                  <span className="d">
                    {f.tipo_formulario?.nome}
                    {f.descricao ? ` · ${f.descricao}` : ''}
                  </span>
                </span>
                <span className="ps-box">{on ? '✓' : ''}</span>
              </button>
            );
          })
        )}
      </>
    </Modal>
  );
}
