import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as formApi from '../api/formularios';
import type { Pergunta } from '../api/formularios';
import * as docApi from '../api/documentos';
import { mensagemErro } from '../api/client';
import { useCarregar } from '../hooks';
import { PageHead } from '../components/Layout';
import { useAvisos } from '../components/Avisos';
import { Modal } from '../components/Modal';
import { Estado } from '../components/Estado';
import { SeloTipo } from '../components/Situacao';
import { ArquivoDoc } from '../components/Documentos';
import { D, Ic, IcLapis } from '../components/icons';
import { data } from '../lib/format';
import { nomeTipoPergunta, TipoPergunta } from '../lib/perguntas';

/** 3.3 Visualizar formulário (VisualizarFormulario.dc.html). */
export function VisualizarFormulario() {
  const { id } = useParams();
  const idF = Number(id);
  const { dados: f, setDados, carregando, erro } = useCarregar(() => formApi.obter(idF), [idF]);
  const { dados: docs } = useCarregar(() => docApi.listar(idF), [idF]);
  const [confirmar, setConfirmar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const avisar = useAvisos();

  if (carregando && !f) return <Estado texto="Carregando formulário…" />;
  if (erro || !f) return <Estado texto={erro ?? 'Formulário não encontrado.'} erro />;

  const inativo = f.ativo === false;

  async function alternar() {
    if (!f) return;
    setOcupado(true);
    try {
      const novo = inativo ? await formApi.reativar(f.id_formulario) : await formApi.desativar(f.id_formulario);
      setDados({ ...f, ativo: novo.ativo ?? !inativo });
      setConfirmar(false);
      avisar({ titulo: inativo ? 'Formulário reativado' : 'Formulário desativado', texto: `“${f.nome}”` });
    } catch (e) {
      setConfirmar(false);
      avisar({ tipo: 'error', titulo: 'Não foi possível concluir', texto: mensagemErro(e) });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <PageHead
        migalhas={[
          { rotulo: 'Início', para: '/atendimentos' },
          { rotulo: 'Formulários', para: '/formularios' },
          { rotulo: 'Visualizar' },
        ]}
        voltar="/formularios"
        linhaTitulo="flex"
        titulo={<h1>{f.nome}</h1>}
        extra={
          <>
            <SeloTipo nome={f.tipo_formulario?.nome} />
            <span className={'ps-badge ' + (inativo ? 'neutral' : 'success')}>{inativo ? 'Inativo' : 'Ativo'}</span>
          </>
        }
        acoes={
          <>
            <Link className="ps-btn secondary" to={`/formularios/${f.id_formulario}/editar`}>
              <IcLapis />
              Editar
            </Link>
            <button type="button" className={'ps-btn ' + (inativo ? 'secondary' : 'danger-outline')} onClick={() => setConfirmar(true)}>
              {inativo ? 'Reativar' : 'Desativar'}
            </button>
          </>
        }
      />

      <div className="page-body">
        <div className="split">
          <section className="panel">
            <header>
              <h2>Perguntas</h2>
            </header>
            <div className="pb">
              {f.descricao && (
                <p style={{ margin: 0, font: '400 15px/1.6 var(--font-sans)', color: 'var(--Text-muted)' }}>{f.descricao}</p>
              )}
              {f.pergunta.length === 0 && <p className="ps-results-meta">Este formulário ainda não tem perguntas.</p>}
              {f.pergunta.map((p, i) => (
                <div className="item" style={{ alignItems: 'flex-start' }} key={p.id_pergunta}>
                  <span className="qnum">{i + 1}</span>
                  <div className="meta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span style={{ display: 'flex', gap: 8 }}>
                      <span className="ps-badge info">{nomeTipoPergunta(p.id_tipo_pergunta, p.valor_minimo, p.valor_maximo)}</span>
                      {p.obrigatoria !== false && <span className="ps-badge error">Obrigatória</span>}
                    </span>
                    <strong style={{ fontWeight: 600 }}>{p.pergunta}</strong>
                    <Previa p={p} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
            <section className="panel">
              <header>
                <h2>Resumo</h2>
              </header>
              <div className="pb">
                <div className="kv" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                  <div>
                    <span>Criado em</span>
                    <strong>{data(f.dt_cadastro)}</strong>
                  </div>
                  <div>
                    <span>Perguntas</span>
                    <strong>{f._count?.pergunta ?? f.pergunta.length}</strong>
                  </div>
                  <div>
                    <span>Respostas</span>
                    <strong>{f._count?.formulario_paciente ?? 0}</strong>
                  </div>
                </div>
              </div>
            </section>
            <aside className="panel">
              <header>
                <h2>Documentos de apoio</h2>
              </header>
              <div className="pb">
                {docs?.length ? (
                  docs.map((d) => <ArquivoDoc key={d.id_documento} doc={d} />)
                ) : (
                  <p className="ps-results-meta" style={{ margin: 0 }}>
                    Nenhum documento enviado.
                  </p>
                )}
                <Link className="ps-text-action" to={`/formularios/${f.id_formulario}/editar`}>
                  Gerenciar documentos <Ic d={D.seta} />
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {confirmar && (
        <Modal
          alerta
          icone="warning"
          titulo={inativo ? 'Reativar formulário?' : 'Desativar formulário?'}
          aoFechar={ocupado ? undefined : () => setConfirmar(false)}
          rodape={
            <>
              <button type="button" className="ps-btn secondary cancelar" onClick={() => setConfirmar(false)} disabled={ocupado}>
                Cancelar
              </button>
              <button type="button" className="ps-btn primary" onClick={() => void alternar()} aria-busy={ocupado}>
                {ocupado ? 'Aguarde…' : inativo ? 'Reativar' : 'Desativar'}
              </button>
            </>
          }
        >
          {inativo
            ? `“${f.nome}” volta a poder ser atribuído a atendimentos.`
            : `“${f.nome}” deixa de aparecer para novas atribuições. Atendimentos que já têm este formulário não mudam.`}
        </Modal>
      )}
    </>
  );
}

/** Como o paciente vê a pergunta no app (só para conferência). */
function Previa({ p }: { p: Pergunta }) {
  const estilo = { padding: '2px 0', minHeight: 0 };
  if (p.id_tipo_pergunta === TipoPergunta.ESCOLHA_UNICA || p.id_tipo_pergunta === TipoPergunta.ESCOLHA_MULTIPLA) {
    const radio = p.id_tipo_pergunta === TipoPergunta.ESCOLHA_UNICA;
    return (
      <>
        {p.opcao_pergunta.map((o) => (
          <label key={o.id_opcao} className="ps-check is-disabled" style={estilo}>
            <span className={'ps-box' + (radio ? ' radio' : '')} />
            {o.texto_opcao}
          </label>
        ))}
      </>
    );
  }
  if (p.id_tipo_pergunta === TipoPergunta.NUMERO) {
    const faixa =
      p.valor_minimo != null && p.valor_maximo != null
        ? `Escala de ${p.valor_minimo} a ${p.valor_maximo}`
        : p.valor_minimo != null
          ? `Número a partir de ${p.valor_minimo}`
          : p.valor_maximo != null
            ? `Número até ${p.valor_maximo}`
            : 'Número';
    return (
      <div className="ps-control is-disabled" style={{ maxWidth: 280 }}>
        <span className="val">{faixa}</span>
      </div>
    );
  }
  if (p.id_tipo_pergunta === TipoPergunta.BOOLEANO) {
    return (
      <div className="ps-seg" aria-disabled="true">
        <button type="button" disabled>
          Sim
        </button>
        <button type="button" disabled>
          Não
        </button>
      </div>
    );
  }
  return (
    <div className="ps-control ps-textarea is-disabled">
      <span className="val">Digite sua resposta...</span>
    </div>
  );
}
