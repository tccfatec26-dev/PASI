import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as atendApi from '../api/atendimentos';
import * as avApi from '../api/avaliacoes';
import type { Resposta } from '../api/avaliacoes';
import type { Pergunta } from '../api/formularios';
import { mensagemErro } from '../api/client';
import { SituacaoFormulario as SF } from '../api/types';
import { useCarregar } from '../hooks';
import { PageHead, PanelTitle } from '../components/Layout';
import { Alerta } from '../components/Form';
import { Modal } from '../components/Modal';
import { useAvisos } from '../components/Avisos';
import { Estado } from '../components/Estado';
import { D, Ic } from '../components/icons';
import { data, dataHora, protocolo } from '../lib/format';

const TP = { TEXTO: 1, NUMERO: 2, BOOLEANO: 3, ESCOLHA_UNICA: 4, ESCOLHA_MULTIPLA: 5 };

/** 2.6 Avaliar formulário / ver respostas e avaliação (AvaliarFormulario.dc.html). */
export function AvaliarFormulario() {
  const { id, idFormulario } = useParams();
  const idAt = Number(id);
  const idF = Number(idFormulario);
  const carga = useCarregar(
    () => Promise.all([atendApi.obter(idAt), avApi.respostas(idAt, idF), avApi.avaliacoes(idAt, idF)]),
    [idAt, idF],
  );
  const [obs, setObs] = useState('');
  const [erroObs, setErroObs] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const avisar = useAvisos();

  if (carga.carregando && !carga.dados) return <Estado texto="Carregando respostas…" />;
  if (carga.erro || !carga.dados) return <Estado texto={carga.erro ?? 'Formulário não encontrado.'} erro />;

  const [a, det, avaliacoes] = carga.dados;
  const sit = det.formulario_paciente?.id_situacao_formulario ?? null;
  const avaliacao = avaliacoes[0];
  const avaliado = sit === SF.AVALIADO || !!avaliacao;
  const proto = protocolo(a.id_atendimento, a.dt_cadastro);
  const perguntas = det.formulario.pergunta;
  const porPergunta = new Map<number, Resposta[]>();
  det.respostas.forEach((r) => porPergunta.set(r.id_pergunta, [...(porPergunta.get(r.id_pergunta) ?? []), r]));
  const respondidas = perguntas.filter((p) => (porPergunta.get(p.id_pergunta) ?? []).some(temValor)).length;
  const ultima = det.respostas.reduce<string | null>((m, r) => (!m || r.dt_resposta > m ? r.dt_resposta : m), null);

  async function finalizar() {
    setEnviando(true);
    setErro(null);
    try {
      await avApi.avaliar(idAt, idF, obs.trim());
      setConfirmando(false);
      avisar({ titulo: 'Avaliação registrada', texto: `“${det.formulario.nome}” foi avaliado.` });
      await carga.recarregar();
    } catch (e) {
      setConfirmando(false);
      setErro(mensagemErro(e));
    } finally {
      setEnviando(false);
    }
  }

  const badge = avaliado
    ? { c: 'ps-badge success', t: 'Avaliado' }
    : sit === SF.EM_AVALIACAO
      ? { c: 'ps-badge evaluating', t: 'Em avaliação' }
      : { c: 'ps-badge warning', t: 'Respondido' };

  return (
    <>
      <PageHead
        migalhas={[
          { rotulo: 'Início', para: '/atendimentos' },
          { rotulo: 'Atendimentos', para: '/atendimentos' },
          { rotulo: proto, para: `/atendimentos/${idAt}` },
          { rotulo: avaliado ? 'Respostas' : 'Avaliar' },
        ]}
        voltar={`/atendimentos/${idAt}`}
        linhaTitulo="flex"
        titulo={avaliado ? 'Respostas e avaliação' : 'Avaliar formulário'}
        extra={<span className={badge.c}>{badge.t}</span>}
      />

      <div className="page-body">
        {erro && (
          <Alerta tipo="error" titulo="Não foi possível finalizar">
            {erro}
          </Alerta>
        )}
        <div className="split">
          <section className="panel">
            <header>
              <h2>
                Respostas do paciente ({respondidas} de {perguntas.length})
              </h2>
            </header>
            <div className="pb">
              {perguntas.map((p, i) => (
                <div className="item" style={{ alignItems: 'flex-start' }} key={p.id_pergunta}>
                  <span className="qnum">{i + 1}</span>
                  <div className="meta" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <strong style={{ fontWeight: 600 }}>{p.pergunta}</strong>
                    <RespostaVisual pergunta={p} respostas={porPergunta.get(p.id_pergunta) ?? []} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section className="panel">
              <header>
                <h2>Resumo</h2>
              </header>
              <div className="pb">
                <div className="kv" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                  <div>
                    <span>Formulário</span>
                    <strong>{det.formulario.nome}</strong>
                  </div>
                  <div>
                    <span>Paciente</span>
                    <strong>{a.usuario_atendimento_id_usuario_pacienteTousuario.nome}</strong>
                  </div>
                  <div>
                    <span>Respondido em</span>
                    <strong>{data(ultima)}</strong>
                  </div>
                </div>
              </div>
            </section>

            {!avaliado ? (
              <section className="panel">
                <header>
                  <PanelTitle id="h-obs" dica="Obrigatória. Depois de finalizar, não é possível avaliar de novo.">
                    Observação da avaliação{' '}
                    <span className="req" aria-hidden="true">
                      *
                    </span>
                  </PanelTitle>
                </header>
                <div className="pb">
                  <div className="ps-field">
                    <div className={'ps-control ps-textarea' + (erroObs ? ' is-error' : '')} style={{ alignItems: 'flex-start' }}>
                      <textarea
                        id="obs"
                        aria-labelledby="h-obs"
                        maxLength={500}
                        placeholder="Registre sua observação final sobre as respostas..."
                        aria-invalid={erroObs || undefined}
                        style={{ minHeight: 180 }}
                        value={obs}
                        onChange={(e) => {
                          setObs(e.target.value);
                          if (e.target.value.trim()) setErroObs(false);
                        }}
                      />
                    </div>
                    {erroObs && <div className="ps-helper error">A observação da avaliação é obrigatória.</div>}
                    <div className="ps-helper">
                      Até 500 caracteres.<span className="ps-counter">{obs.length}/500</span>
                    </div>
                  </div>
                </div>
                <footer>
                  <Link className="ps-btn secondary cancelar" to={`/atendimentos/${idAt}`}>
                    Cancelar
                  </Link>
                  <button
                    type="button"
                    className="ps-btn primary"
                    onClick={() => {
                      if (!obs.trim()) {
                        setErroObs(true);
                        return;
                      }
                      setConfirmando(true);
                    }}
                  >
                    Finalizar avaliação
                  </button>
                </footer>
              </section>
            ) : (
              <section className="panel">
                <header>
                  <PanelTitle
                    dica={avaliacao ? `${avaliacao.usuario?.nome ?? '—'} · ${dataHora(avaliacao.dt_avaliacao)}` : undefined}
                  >
                    Avaliação registrada
                  </PanelTitle>
                </header>
                <div className="pb">
                  <p style={{ margin: 0, font: '400 15px/1.6 var(--font-sans)', color: 'var(--Ink)', whiteSpace: 'pre-wrap' }}>
                    {avaliacao?.observacao ?? '—'}
                  </p>
                </div>
                <footer>
                  <Link className="ps-btn secondary" to={`/atendimentos/${idAt}`}>
                    Voltar ao atendimento
                  </Link>
                </footer>
              </section>
            )}
          </aside>
        </div>
      </div>

      {confirmando && (
        <Modal
          alerta
          titulo="Finalizar avaliação?"
          aoFechar={enviando ? undefined : () => setConfirmando(false)}
          rodape={
            <>
              <button type="button" className="ps-btn secondary" onClick={() => setConfirmando(false)} disabled={enviando}>
                Continuar revisando
              </button>
              <button type="button" className="ps-btn primary" onClick={() => void finalizar()} aria-busy={enviando}>
                {enviando ? 'Finalizando…' : 'Finalizar avaliação'}
              </button>
            </>
          }
        >
          A avaliação será registrada e não será possível avaliar este formulário novamente. Se todos os formulários do atendimento
          estiverem avaliados, ele passa para Avaliado.
        </Modal>
      )}
    </>
  );
}

function temValor(r: Resposta) {
  return (
    (r.valor_texto !== null && r.valor_texto !== '') || r.valor_numero !== null || r.valor_binario !== null || r.valor_data !== null
  );
}

function Marcado({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <Ic d={D.checkCirculo} style={{ color: 'var(--Success)' }} />
      {children}
    </span>
  );
}

function RespostaVisual({ pergunta, respostas }: { pergunta: Pergunta; respostas: Resposta[] }) {
  const validas = respostas.filter(temValor);
  if (!validas.length) return <div className="answer empty">Sem resposta</div>;
  const t = pergunta.id_tipo_pergunta;
  if (t === TP.ESCOLHA_UNICA || t === TP.ESCOLHA_MULTIPLA) {
    const textos = validas.map(
      (r) => pergunta.opcao_pergunta.find((o) => o.id_opcao === Number(r.valor_numero))?.texto_opcao ?? r.valor_texto ?? '—',
    );
    if (textos.length === 1)
      return (
        <div className="answer" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ic d={D.checkCirculo} style={{ color: 'var(--Success)' }} />
          {textos[0]}
        </div>
      );
    return (
      <div className="answer" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {textos.map((x, i) => (
          <Marcado key={i}>{x}</Marcado>
        ))}
      </div>
    );
  }
  const r = validas[0];
  if (t === TP.BOOLEANO || r.valor_binario !== null) return <div className="answer">{r.valor_binario ? 'Sim' : 'Não'}</div>;
  if (t === TP.NUMERO || r.valor_numero !== null) return <div className="answer">{String(Number(r.valor_numero))}</div>;
  if (r.valor_data) return <div className="answer">{data(r.valor_data)}</div>;
  return (
    <div className="answer" style={{ whiteSpace: 'pre-wrap' }}>
      {r.valor_texto}
    </div>
  );
}
