import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as atendApi from '../api/atendimentos';
import { iniciarAvaliacao } from '../api/avaliacoes';
import { mensagemErro } from '../api/client';
import { SituacaoAtendimento as SA, SituacaoFormulario as SF, type AtendimentoFormulario } from '../api/types';
import { useCarregar } from '../hooks';
import { PageHead, PanelTitle } from '../components/Layout';
import { Estado } from '../components/Estado';
import { useAvisos } from '../components/Avisos';
import { Modal, ModalCerteza } from '../components/Modal';
import { resetarSlides, Slide } from '../components/Slide';
import { SeloAtendimento, SeloFormulario } from '../components/Situacao';
import { D, Ic, IcFormulario, IcInativar, IcLapis, IcOlhoAcao } from '../components/icons';
import { cpf, data, plural, protocolo } from '../lib/format';

type Janela = null | 'certeza' | 'encerrado' | 'inativar' | { avaliar: AtendimentoFormulario };

/** 2.4 Detalhes do atendimento (DetalhesAtendimento.dc.html). */
export function DetalhesAtendimento() {
  const { id } = useParams();
  const idAt = Number(id);
  const navegar = useNavigate();
  const { dados: a, setDados, carregando, erro } = useCarregar(() => atendApi.obter(idAt), [idAt]);
  const [janela, setJanela] = useState<Janela>(null);
  const [ocupado, setOcupado] = useState(false);
  const avisar = useAvisos();

  if (carregando && !a) return <Estado texto="Carregando atendimento…" />;
  if (erro || !a) return <Estado texto={erro ?? 'Atendimento não encontrado.'} erro />;

  const pac = a.usuario_atendimento_id_usuario_pacienteTousuario;
  const s = a.id_situacao_atendimento;
  const proto = protocolo(a.id_atendimento, a.dt_cadastro);
  const fechado = s === SA.ENCERRADO || s === SA.INATIVO;
  const forms = a.atendimento_formulario;
  const sitF = (f: AtendimentoFormulario) => f.status_formulario_paciente?.id_situacao_formulario ?? null;
  const faltaAvaliar = forms.filter((f) => sitF(f) === SF.RESPONDIDO || sitF(f) === SF.EM_AVALIACAO).length;
  const faltaResponder = forms.filter((f) => sitF(f) === null || sitF(f) === SF.RASCUNHO).length;

  async function acao(fn: () => Promise<unknown>, depois?: () => void) {
    setOcupado(true);
    try {
      await fn();
      depois?.();
    } catch (e) {
      setJanela(null);
      avisar({ tipo: 'error', titulo: 'Não foi possível concluir', texto: mensagemErro(e) });
      resetarSlides();
    } finally {
      setOcupado(false);
    }
  }

  let aviso: { tipo: 'info' | 'success'; titulo: string; texto: string; icone: string };
  if (s === SA.AVALIADO)
    aviso = {
      tipo: 'success',
      titulo: 'Pronto para encerrar',
      texto: 'Todos os formulários foram avaliados. Deslize o botão abaixo até o fim para encerrar.',
      icone: D.checkCirculo,
    };
  else if (s === SA.ENCERRADO)
    aviso = { tipo: 'info', titulo: 'Atendimento encerrado', texto: 'Não recebe mais formulários nem alterações.', icone: D.cadeado };
  else if (s === SA.INATIVO)
    aviso = { tipo: 'info', titulo: 'Atendimento inativo', texto: 'Foi inativado e não recebe mais formulários nem alterações.', icone: D.proibido };
  else {
    const partes = [
      faltaAvaliar ? `falta avaliar ${plural(faltaAvaliar, 'formulário', 'formulários')}` : '',
      faltaResponder ? `o paciente ainda precisa concluir ${plural(faltaResponder, 'formulário', 'formulários')}` : '',
    ].filter(Boolean);
    const texto = partes.length ? partes.join(' e ') + '.' : 'Aguardando a próxima etapa.';
    aviso = {
      tipo: 'info',
      titulo: 'Encerrar fica disponível em Avaliado',
      texto: texto.charAt(0).toUpperCase() + texto.slice(1),
      icone: D.info,
    };
  }

  return (
    <>
      <PageHead
        migalhas={[
          { rotulo: 'Início', para: '/atendimentos' },
          { rotulo: 'Atendimentos', para: '/atendimentos' },
          { rotulo: proto },
        ]}
        voltar="/atendimentos"
        linhaTitulo="flex"
        titulo={<h1>{pac.nome}</h1>}
        extra={<SeloAtendimento id={s} morph />}
        dica={`${proto} · cadastrado em ${data(a.dt_cadastro)}`}
        acoesAlinhadas
        acoes={
          !fechado && (
            <>
              <Link className="ps-btn secondary" to={`/atendimentos/${a.id_atendimento}/alterar`}>
                <IcLapis />
                Alterar
              </Link>
              <button type="button" className="ps-btn danger-outline" onClick={() => setJanela('inativar')}>
                <IcInativar />
                Inativar
              </button>
            </>
          )
        }
      />

      <div className="page-body">
        <div className="split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section className="panel">
              <header>
                <h2>Informações</h2>
              </header>
              <div className="pb">
                <div className="kv">
                  <div>
                    <span>Paciente</span>
                    <strong>{pac.nome}</strong>
                  </div>
                  <div>
                    <span>CPF</span>
                    <strong>{cpf(pac.cpf)}</strong>
                  </div>
                  <div>
                    <span>E-mail</span>
                    <strong>{pac.email}</strong>
                  </div>
                  <div>
                    <span>Cadastrado por</span>
                    <strong>{a.usuario_atendimento_id_usuario_cadTousuario?.nome ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Unidade de atendimento</span>
                    <strong>{a.unidade_atendimento?.nome ?? '—'}</strong>
                  </div>
                </div>
                <div className="kv" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                  <div>
                    <span>Descrição</span>
                    <strong>{a.descricao || '—'}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel">
              <header>
                <PanelTitle dica="A situação de cada formulário vale só para este atendimento.">Formulários ({forms.length})</PanelTitle>
              </header>
              <div className="pb">
                {forms.map((f) => (
                  <ItemFormulario
                    key={f.id_formulario}
                    f={f}
                    idAt={a.id_atendimento}
                    podeAvaliar={!fechado}
                    aoAvaliar={() => {
                      if (sitF(f) === SF.EM_AVALIACAO) navegar(`/atendimentos/${a.id_atendimento}/formularios/${f.id_formulario}`);
                      else setJanela({ avaliar: f });
                    }}
                  />
                ))}
              </div>
            </section>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
            <section className="panel">
              <header>
                <h2>O que dá para fazer agora</h2>
              </header>
              <div className="pb" style={{ gap: 12, fontSize: 14, color: 'var(--Text-muted)' }}>
                <div className={`ps-alert ${aviso.tipo}`} id="enc-help">
                  <Ic d={aviso.icone} lg style={{ color: aviso.tipo === 'success' ? 'var(--Success)' : 'var(--Link)' }} />
                  <div className="body">
                    <strong>{aviso.titulo}</strong>
                    {aviso.texto}
                  </div>
                </div>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: 'var(--Navy-600)' }}>Avaliar:</strong> só formulários Respondidos ou Em avaliação. Cada
                  formulário recebe uma única avaliação.
                </p>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: 'var(--Navy-600)' }}>Adicionar formulário:</strong> permitido, menos em Inativo, Avaliado e
                  Encerrado.
                </p>
                <p style={{ margin: 0 }}>
                  <strong style={{ color: 'var(--Navy-600)' }}>Inativar</strong>
                  <br />
                  Para atendimentos criados por engano. Não vale para Encerrado.
                </p>
              </div>
            </section>

            {!fechado && (
              <Slide
                texto="Deslize para encerrar"
                rotuloAcessivel="Deslize para encerrar o atendimento"
                liberado={s === SA.AVALIADO}
                dicaBloqueado="Disponível quando o atendimento estiver Avaliado"
                ajuda={
                  s === SA.AVALIADO
                    ? 'Arraste até o fim para encerrar. No teclado, use as setas.'
                    : 'Disponível quando todos os formulários estiverem avaliados.'
                }
                rotuloBotao="Encerrar"
                aoConcluir={() => setJanela('certeza')}
              />
            )}
          </aside>
        </div>
      </div>

      {janela && typeof janela === 'object' && (
        <Modal
          titulo="Iniciar avaliação?"
          aoFechar={ocupado ? undefined : () => setJanela(null)}
          rodape={
            <>
              <button type="button" className="ps-btn secondary cancelar" onClick={() => setJanela(null)} disabled={ocupado}>
                Cancelar
              </button>
              <button
                type="button"
                className="ps-btn primary"
                aria-busy={ocupado}
                onClick={() =>
                  void acao(
                    () => iniciarAvaliacao(a.id_atendimento, janela.avaliar.id_formulario),
                    () => navegar(`/atendimentos/${a.id_atendimento}/formularios/${janela.avaliar.id_formulario}`),
                  )
                }
              >
                {ocupado ? 'Iniciando…' : 'Iniciar avaliação'}
              </button>
            </>
          }
        >
          O formulário “{janela.avaliar.formulario.nome}” fica Em avaliação, e o atendimento também.
        </Modal>
      )}

      {janela === 'certeza' && (
        <ModalCerteza
          rotulo="Sim, encerrar"
          ocupado={ocupado}
          aoCancelar={() => {
            setJanela(null);
            resetarSlides();
          }}
          aoConfirmar={() =>
            void acao(
              () => atendApi.encerrar(a.id_atendimento),
              () => {
                setDados({ ...a, id_situacao_atendimento: SA.ENCERRADO });
                setJanela('encerrado');
              },
            )
          }
        />
      )}

      {janela === 'encerrado' && (
        <Modal
          alerta
          icone="ok"
          titulo="Atendimento encerrado"
          aoFechar={() => setJanela(null)}
          rodape={
            <>
              <button type="button" className="ps-btn secondary" onClick={() => setJanela(null)}>
                Fechar
              </button>
              <Link className="ps-btn primary" to="/atendimentos">
                Ir para atendimentos
              </Link>
            </>
          }
        >
          O atendimento de {pac.nome} foi encerrado em {data(new Date().toISOString())}. Ele não recebe mais formulários nem
          alterações.
        </Modal>
      )}

      {janela === 'inativar' && (
        <Modal
          alerta
          icone="error"
          titulo="Inativar este atendimento?"
          aoFechar={ocupado ? undefined : () => setJanela(null)}
          rodape={
            <>
              <button type="button" className="ps-btn secondary" onClick={() => setJanela(null)} disabled={ocupado}>
                Manter atendimento
              </button>
              <button
                type="button"
                className="ps-btn danger"
                aria-busy={ocupado}
                onClick={() =>
                  void acao(
                    () => atendApi.inativar(a.id_atendimento),
                    () => {
                      setDados({ ...a, id_situacao_atendimento: SA.INATIVO });
                      setJanela(null);
                      avisar({ titulo: 'Atendimento inativado', texto: `${proto} não recebe mais respostas nem formulários.` });
                    },
                  )
                }
              >
                {ocupado ? 'Inativando…' : 'Sim, inativar'}
              </button>
            </>
          }
        >
          Use só se ele foi criado por engano. O paciente deixa de poder responder, e não será possível adicionar formulários nem
          reativar.
        </Modal>
      )}
    </>
  );
}

function ItemFormulario({
  f,
  idAt,
  podeAvaliar,
  aoAvaliar,
}: {
  f: AtendimentoFormulario;
  idAt: number;
  podeAvaliar: boolean;
  aoAvaliar: () => void;
}) {
  const fp = f.status_formulario_paciente;
  const sit = fp?.id_situacao_formulario ?? null;
  const av = fp?.formulario_avaliacao?.[0];
  let meta: string;
  if (sit === SF.AVALIADO)
    meta = av ? `Avaliado por ${av.usuario?.nome ?? '—'} em ${data(av.dt_avaliacao)}` : 'Avaliação registrada';
  else if (sit === SF.EM_AVALIACAO) meta = 'Respondido pelo paciente · avaliação em andamento';
  else if (sit === SF.RESPONDIDO) meta = 'Respondido pelo paciente · aguardando avaliação';
  else meta = `Atribuído em ${data(f.dt_atribuicao)} · o paciente ainda não concluiu`;
  const temRespostas = sit === SF.RESPONDIDO || sit === SF.EM_AVALIACAO || sit === SF.AVALIADO;
  const avaliavel = podeAvaliar && (sit === SF.RESPONDIDO || sit === SF.EM_AVALIACAO);
  const rotuloVer = sit === SF.AVALIADO ? 'Ver respostas e avaliação' : 'Ver respostas';
  return (
    <div
      className="item"
      style={sit === SF.EM_AVALIACAO ? { borderColor: 'color-mix(in srgb, var(--Link) 35%, white)' } : undefined}
    >
      <span className="ico">
        <IcFormulario lg />
      </span>
      <div className="meta">
        <strong>{f.formulario.nome}</strong>
        <span>{meta}</span>
      </div>
      <SeloFormulario id={sit} />
      <div className="acts">
        {temRespostas ? (
          <Link className="act tt" to={`/atendimentos/${idAt}/formularios/${f.id_formulario}`} aria-label={rotuloVer} data-tip={rotuloVer}>
            <Ic d={D.respostas} />
          </Link>
        ) : (
          <Link className="act tt" to={`/formularios/${f.id_formulario}`} aria-label="Ver modelo do formulário" data-tip="Ver modelo do formulário">
            <IcOlhoAcao />
          </Link>
        )}
        {avaliavel && (
          <button type="button" className="act tt primary" aria-label="Avaliar formulário" data-tip="Avaliar formulário" onClick={aoAvaliar}>
            <Ic d={D.avaliar} />
          </button>
        )}
      </div>
    </div>
  );
}
