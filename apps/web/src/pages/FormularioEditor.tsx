import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as formApi from '../api/formularios';
import type { NovaPergunta, Pergunta } from '../api/formularios';
import * as docApi from '../api/documentos';
import type { Documento } from '../api/documentos';
import * as apoio from '../api/apoio';
import { mensagemErro } from '../api/client';
import { useCarregar } from '../hooks';
import { PageHead } from '../components/Layout';
import { Alerta, MensagemErro } from '../components/Form';
import { Estado } from '../components/Estado';
import { EsqArquivos, EsqBotoes, EsqCabecalho, EsqCampos, EsqItens, EsqPainel, TelaCarregando } from '../components/Esqueleto';
import { Modal, ModalCerteza } from '../components/Modal';
import { useAvisos } from '../components/Avisos';
import { ArquivoDoc, SoltarArquivo } from '../components/Documentos';
import { EscanearComIA, type FormularioImportado } from '../components/EscanearFormulario';
import { D, Ic, IcCadeado, IcFormulario, IcLapis, IcMais } from '../components/icons';
import { nomeTipoPergunta, temOpcoes, TipoPergunta, TIPOS_PERGUNTA } from '../lib/perguntas';
import { plural } from '../lib/format';

/** Pergunta como o editor a manipula (nova ou já salva). */
interface PerguntaEd extends NovaPergunta {
  id_pergunta?: number;
  respondida?: boolean;
  /** chave estável na lista (animação de entrada e rolagem até ela) */
  uid?: string;
}

let contador = 0;
const novaUid = () => `n${++contador}`;

function daApi(p: Pergunta): PerguntaEd {
  return {
    id_pergunta: p.id_pergunta,
    uid: `p${p.id_pergunta}`,
    pergunta: p.pergunta,
    id_tipo_pergunta: p.id_tipo_pergunta,
    obrigatoria: p.obrigatoria !== false,
    valor_minimo: p.valor_minimo ?? undefined,
    valor_maximo: p.valor_maximo ?? undefined,
    opcoes: p.opcao_pergunta.map((o) => ({ texto_opcao: o.texto_opcao, valor_opcao: o.valor_opcao ?? undefined })),
    respondida: (p._count?.resposta ?? 0) > 0,
  };
}

/** Corpo enviado à API: só os campos que valem para o tipo escolhido. */
function paraApi(p: PerguntaEd): NovaPergunta {
  const numero = p.id_tipo_pergunta === TipoPergunta.NUMERO;
  return {
    pergunta: p.pergunta.trim(),
    id_tipo_pergunta: p.id_tipo_pergunta,
    obrigatoria: p.obrigatoria ?? true,
    valor_minimo: numero ? p.valor_minimo : undefined,
    valor_maximo: numero ? p.valor_maximo : undefined,
    opcoes: temOpcoes(p.id_tipo_pergunta)
      ? (p.opcoes ?? []).filter((o) => o.texto_opcao.trim()).map((o) => ({ ...o, texto_opcao: o.texto_opcao.trim() }))
      : undefined,
  };
}

const VAZIA: PerguntaEd = {
  pergunta: '',
  id_tipo_pergunta: TipoPergunta.ESCOLHA_UNICA,
  obrigatoria: true,
  opcoes: [{ texto_opcao: '' }, { texto_opcao: '' }],
};

/** Janela de pergunta aberta: incluir uma nova ou editar a de índice `indice`. */
type Janela = null | { modo: 'incluir' } | { modo: 'editar'; indice: number };

/** 3.2 Criar / editar formulário (FormularioEditor.dc.html). */
export function FormularioEditor() {
  const { id } = useParams();
  const idF = id ? Number(id) : null;
  const novo = idF === null;
  const navegar = useNavigate();
  const avisar = useAvisos();
  const { dados: tipos } = useCarregar(() => apoio.tiposFormulario(), []);
  const carga = useCarregar(() => (idF ? formApi.obter(idF) : Promise.resolve(null)), [idF]);
  const docsCarga = useCarregar(() => (idF ? docApi.listar(idF) : Promise.resolve([] as Documento[])), [idF]);

  const [tipo, setTipo] = useState<number | null>(null);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [perguntas, setPerguntas] = useState<PerguntaEd[]>([]);
  const [janela, setJanela] = useState<Janela>(null);
  const [rasc, setRasc] = useState<PerguntaEd>(VAZIA);
  const [erroPergunta, setErroPergunta] = useState<string | null>(null);
  /** qual botão da janela está trabalhando (mostra a barra de carregamento nele) */
  const [salvandoPergunta, setSalvandoPergunta] = useState<null | 'fechar' | 'mais'>(null);
  /** pergunta recém-incluída ou alterada: ganha a animação na lista, atrás do vidro */
  const [destaque, setDestaque] = useState<{ uid: string; tipo: 'nova' | 'alterada' } | null>(null);
  const [remover, setRemover] = useState<number | null>(null);
  const [fila, setFila] = useState<File[]>([]);
  const [enviandoDoc, setEnviandoDoc] = useState(false);
  const [excluirDoc, setExcluirDoc] = useState<Documento | null>(null);
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** quantas perguntas vieram do último "Escanear com IA" (mostra o aviso de revisar) */
  const [importadas, setImportadas] = useState<number | null>(null);
  const tempoDestaque = useRef(0);

  useEffect(() => {
    const f = carga.dados;
    if (!f) return;
    setTipo(f.id_tipo_formulario);
    setNome(f.nome ?? '');
    setDescricao(f.descricao ?? '');
    setPerguntas(f.pergunta.map(daApi));
  }, [carga.dados]);

  // A pergunta incluída/alterada aparece atrás do vidro da janela: rola até ela
  // e tira a classe de animação quando a animação termina.
  useEffect(() => {
    if (!destaque) return;
    const el = document.querySelector<HTMLElement>(`[data-uid="${destaque.uid}"]`);
    const semMovimento =
      document.documentElement.classList.contains('a11y-movimento') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el?.scrollIntoView({ block: 'center', behavior: semMovimento ? 'auto' : 'smooth' });
    window.clearTimeout(tempoDestaque.current);
    tempoDestaque.current = window.setTimeout(() => setDestaque(null), 1300);
    return () => window.clearTimeout(tempoDestaque.current);
  }, [destaque]);

  if (!novo && carga.carregando && !carga.dados)
    return (
      <TelaCarregando rotulo="Carregando formulário…">
        <EsqCabecalho migalhas={3} titulo={240} />
        <div className="page-body">
          <div className="split">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <EsqPainel titulo={190}>
                <EsqCampos n={3} />
              </EsqPainel>
              <EsqPainel titulo={140} acao>
                <EsqItens n={3} numero selos acoes={2} />
              </EsqPainel>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <EsqPainel titulo={190}>
                <EsqArquivos n={2} />
              </EsqPainel>
              <EsqPainel titulo={120}>
                <EsqBotoes n={1} />
              </EsqPainel>
            </div>
          </div>
        </div>
      </TelaCarregando>
    );
  if (!novo && (carga.erro || !carga.dados)) return <Estado texto={carga.erro ?? 'Formulário não encontrado.'} erro />;

  const respondido = perguntas.some((p) => p.respondida);
  const nRespostas = carga.dados?._count?.formulario_paciente ?? 0;
  // com respostas, não entram perguntas novas (as não respondidas ainda podem ser editadas)
  const podeIncluir = !respondido;
  const erros = {
    tipo: tipo === null ? 'Escolha o tipo do formulário.' : null,
    nome: !nome.trim() ? 'Informe o título do formulário.' : null,
    perguntas: novo && perguntas.length === 0 ? 'Inclua pelo menos 1 pergunta.' : null,
  };

  function validarPergunta(p: PerguntaEd) {
    if (!p.pergunta.trim()) return 'Escreva o texto da pergunta.';
    if (temOpcoes(p.id_tipo_pergunta) && (p.opcoes ?? []).filter((o) => o.texto_opcao.trim()).length < 2)
      return 'Perguntas de escolha precisam de pelo menos 2 opções.';
    if (
      p.id_tipo_pergunta === TipoPergunta.NUMERO &&
      p.valor_minimo !== undefined &&
      p.valor_maximo !== undefined &&
      p.valor_minimo > p.valor_maximo
    )
      return 'O valor mínimo não pode ser maior que o máximo.';
    return null;
  }

  function abrirInclusao() {
    setRasc(VAZIA);
    setErroPergunta(null);
    setJanela({ modo: 'incluir' });
  }

  function abrirEdicao(i: number) {
    const q = perguntas[i];
    setRasc({ ...q, opcoes: q.opcoes?.length ? q.opcoes : VAZIA.opcoes });
    setErroPergunta(null);
    setJanela({ modo: 'editar', indice: i });
  }

  function fecharJanela() {
    if (salvandoPergunta) return;
    setJanela(null);
    setErroPergunta(null);
  }

  /**
   * Inclui a pergunta (ou salva a edição). `continuar` = "Incluir essa e mais uma":
   * a janela fica aberta e limpa para a próxima; senão, ela fecha.
   */
  async function gravarPergunta(continuar: boolean) {
    if (!janela || salvandoPergunta) return;
    const problema = validarPergunta(rasc);
    if (problema) {
      setErroPergunta(problema);
      return;
    }
    setErroPergunta(null);
    const editando = janela.modo === 'editar' ? janela.indice : null;

    const depois = (uid: string | undefined, tipoDestaque: 'nova' | 'alterada') => {
      if (uid) setDestaque({ uid, tipo: tipoDestaque });
      if (continuar) {
        setRasc(VAZIA);
        // o cursor volta para o texto da próxima pergunta
        window.setTimeout(() => document.getElementById('qt')?.focus(), 0);
      } else {
        setJanela(null);
      }
    };

    // formulário novo: tudo fica na tela até "Salvar formulário"
    if (novo || !idF) {
      if (editando !== null) {
        const uid = perguntas[editando].uid ?? novaUid();
        setPerguntas(perguntas.map((p, i) => (i === editando ? { ...rasc, uid } : p)));
        depois(uid, 'alterada');
      } else {
        const uid = novaUid();
        setPerguntas([...perguntas, { ...rasc, uid }]);
        depois(uid, 'nova');
      }
      return;
    }

    setSalvandoPergunta(continuar ? 'mais' : 'fechar');
    try {
      const corpo = paraApi(rasc);
      const alvo = editando !== null ? perguntas[editando] : null;
      const antes = new Set(perguntas.map((p) => p.id_pergunta));
      if (alvo?.id_pergunta) await formApi.alterarPergunta(idF, alvo.id_pergunta, corpo);
      else await formApi.adicionarPergunta(idF, corpo);
      const f = await carga.recarregar();
      const lista = f ? f.pergunta.map(daApi) : perguntas;
      if (f) setPerguntas(lista);
      if (alvo?.id_pergunta) depois(`p${alvo.id_pergunta}`, 'alterada');
      else depois(lista.find((p) => !antes.has(p.id_pergunta))?.uid, 'nova');
    } catch (e) {
      setErroPergunta(mensagemErro(e));
    } finally {
      setSalvandoPergunta(null);
    }
  }

  async function confirmarRemocao() {
    if (remover === null) return;
    const alvo = perguntas[remover];
    if (novo || !idF || !alvo.id_pergunta) {
      setPerguntas(perguntas.filter((_, i) => i !== remover));
      setRemover(null);
      return;
    }
    setOcupado(true);
    try {
      await formApi.removerPergunta(idF, alvo.id_pergunta);
      const f = await carga.recarregar();
      if (f) setPerguntas(f.pergunta.map(daApi));
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setRemover(null);
      setOcupado(false);
    }
  }

  async function escolherArquivo(arq: File) {
    if (arq.size > docApi.TAMANHO_MAXIMO) {
      setErro(`“${arq.name}” passa de 10 MB.`);
      return;
    }
    setErro(null);
    if (!idF) {
      setFila([...fila, arq]);
      return;
    }
    setEnviandoDoc(true);
    try {
      await docApi.enviar(idF, arq);
      await docsCarga.recarregar();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setEnviandoDoc(false);
    }
  }

  async function salvar() {
    setTentou(true);
    if (erros.tipo || erros.nome || erros.perguntas || tipo === null) {
      // o botão fica na coluna lateral: sem isso, o erro aparece lá em cima,
      // fora da tela, e parece que "Salvar" não fez nada
      const alvo = erros.tipo
        ? document.querySelector<HTMLElement>('[role="radiogroup"][aria-label="Tipo de formulário"] [role="radio"]')
        : erros.nome
          ? document.getElementById('tit')
          : document.querySelector<HTMLElement>('.add-perguntas button');
      const semMovimento =
        document.documentElement.classList.contains('a11y-movimento') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      alvo?.scrollIntoView({ block: 'center', behavior: semMovimento ? 'auto' : 'smooth' });
      alvo?.focus({ preventScroll: true });
      return;
    }
    if (salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      if (novo) {
        const f = await formApi.criar({
          id_tipo_formulario: tipo,
          nome: nome.trim(),
          descricao: descricao.trim() || undefined,
          perguntas: perguntas.map(paraApi),
        });
        for (const arq of fila) await docApi.enviar(f.id_formulario, arq);
        avisar({ titulo: 'Formulário criado', texto: `“${nome.trim()}” já pode ser atribuído a atendimentos.` });
        navegar(`/formularios/${f.id_formulario}`, { replace: true });
      } else if (idF) {
        await formApi.alterar(idF, { id_tipo_formulario: tipo, nome: nome.trim(), descricao: descricao.trim() });
        avisar({ titulo: 'Formulário salvo', texto: `As alterações de “${nome.trim()}” foram salvas.` });
        navegar(`/formularios/${idF}`);
      }
    } catch (e) {
      setErro(mensagemErro(e));
      setSalvando(false);
    }
  }

  /** Perguntas escaneadas entram no fim da lista; título e descrição só se estiverem vazios. */
  function usarImportado(f: FormularioImportado) {
    const novas = f.perguntas.map((p) => ({ ...p, uid: novaUid() }));
    setPerguntas([...perguntas, ...novas]);
    if (!nome.trim() && f.titulo) setNome(f.titulo);
    if (!descricao.trim() && f.descricao) setDescricao(f.descricao);
    setImportadas(novas.length);
    if (novas[0]?.uid) setDestaque({ uid: novas[0].uid, tipo: 'nova' });
  }

  // escanear do papel: só na criação (na edição cada pergunta é salva na hora)
  const botaoEscanear = (grande: boolean) => novo && <EscanearComIA aoUsar={usarImportado} pequeno={!grande} />;

  const botaoAdicionar = (grande: boolean) => (
    <button type="button" className={'ps-btn primary' + (grande ? '' : ' sm')} onClick={abrirInclusao}>
      <IcMais />
      Adicionar perguntas
    </button>
  );

  return (
    <>
      <PageHead
        migalhas={[
          { rotulo: 'Início', para: '/atendimentos' },
          { rotulo: 'Formulários', para: '/formularios' },
          { rotulo: novo ? 'Criar' : 'Editar' },
        ]}
        voltar={novo ? '/formularios' : `/formularios/${idF}`}
        titulo={novo ? 'Criar formulário' : 'Editar formulário'}
      />

      <div className="page-body">
        {erro && (
          <Alerta tipo="error" titulo="Não foi possível concluir">
            {erro}
          </Alerta>
        )}
        <div className="split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section className="panel">
              <header>
                <h2>Informações básicas</h2>
              </header>
              <div className="pb">
                <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <legend className="ps-label" style={{ padding: 0, marginBottom: 8 }}>
                    Tipo de formulário{' '}
                    <span className="req" aria-hidden="true">
                      *
                    </span>
                  </legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="radiogroup" aria-label="Tipo de formulário" aria-describedby={tentou && erros.tipo ? 'tipo-erro' : undefined}>
                    {(tipos ?? []).map((t) => (
                      <button
                        key={t.id_tipo_formulario}
                        type="button"
                        role="radio"
                        aria-checked={tipo === t.id_tipo_formulario}
                        className={'ps-chip' + (tipo === t.id_tipo_formulario ? ' is-selected' : '')}
                        onClick={() => setTipo(t.id_tipo_formulario)}
                        style={{ cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {t.nome}
                      </button>
                    ))}
                  </div>
                  {tentou && erros.tipo && <MensagemErro id="tipo-erro">{erros.tipo}</MensagemErro>}
                </fieldset>
                <div className="ps-field">
                  <label className="ps-label" htmlFor="tit">
                    Título do formulário{' '}
                    <span className="req" aria-hidden="true">
                      *
                    </span>
                  </label>
                  <div className={'ps-control' + (tentou && erros.nome ? ' is-error' : '')}>
                    <input
                      id="tit"
                      type="text"
                      maxLength={50}
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      aria-invalid={(tentou && !!erros.nome) || undefined}
                      aria-describedby={tentou && erros.nome ? 'tit-erro' : undefined}
                    />
                  </div>
                  {tentou && erros.nome && <MensagemErro id="tit-erro">{erros.nome}</MensagemErro>}
                  <div className="ps-helper">
                    Obrigatório.<span className="ps-counter">{nome.length}/50</span>
                  </div>
                </div>
                <div className="ps-field">
                  <label className="ps-label" htmlFor="dsc">
                    Descrição <span className="opt">(opcional)</span>
                  </label>
                  <div className="ps-control ps-textarea" style={{ alignItems: 'flex-start' }}>
                    <textarea id="dsc" maxLength={500} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
                  </div>
                  <div className="ps-helper">Até 500 caracteres. Nome, descrição e tipo podem mudar mesmo com respostas.</div>
                </div>
              </div>
            </section>

            {perguntas.length === 0 ? (
              // Sem perguntas ainda: só o botão. A seção "Perguntas" aparece com a primeira.
              <div className="add-perguntas">
                {podeIncluir && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {botaoEscanear(true)}
                    {botaoAdicionar(true)}
                  </div>
                )}
                {tentou && erros.perguntas && <MensagemErro>{erros.perguntas}</MensagemErro>}
              </div>
            ) : (
              <section className="panel painel-entra">
                <header>
                  <h2>Perguntas ({perguntas.length})</h2>
                  {podeIncluir && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {botaoEscanear(false)}
                      {botaoAdicionar(false)}
                    </div>
                  )}
                </header>
                <div className="pb">
                  {importadas !== null && (
                    <Alerta tipo="info" titulo={plural(importadas, 'pergunta escaneada', 'perguntas escaneadas')}>
                      Revise o texto, o tipo de resposta e as opções de cada uma: a leitura automática pode errar letras. Nada foi salvo
                      ainda — o formulário só é criado em “Salvar formulário”.
                    </Alerta>
                  )}
                  {respondido && (
                    <div className="ps-alert warning">
                      <IcCadeado lg style={{ color: 'var(--Warning)' }} />
                      <div className="body">
                        <strong>Este formulário já tem {plural(nRespostas, 'resposta', 'respostas')}</strong>
                        Não é possível incluir perguntas. Perguntas já respondidas não podem ser editadas nem excluídas.
                      </div>
                    </div>
                  )}
                  {perguntas.map((q, i) => {
                    const anima =
                      destaque && destaque.uid === q.uid ? (destaque.tipo === 'nova' ? ' pergunta-nova' : ' pergunta-alterada') : '';
                    return (
                      <div className={'item' + anima} style={{ alignItems: 'center' }} key={q.uid ?? `i${i}`} data-uid={q.uid}>
                        <span className="qnum">{i + 1}</span>
                        <div className="meta">
                          <strong style={{ fontWeight: 600 }}>{q.pergunta}</strong>
                          <span className="selos-linha" style={{ marginTop: 6 }}>
                            <span className="ps-badge info">{nomeTipoPergunta(q.id_tipo_pergunta, q.valor_minimo, q.valor_maximo)}</span>
                            {q.obrigatoria !== false && <span className="ps-badge error">Obrigatória</span>}
                            {q.respondida && <span className="ps-badge neutral">Respondida</span>}
                          </span>
                        </div>
                        {!q.respondida && (
                          <div className="acts">
                            <button
                              type="button"
                              className="act tt"
                              aria-label={`Editar pergunta ${i + 1}`}
                              data-tip="Editar pergunta"
                              onClick={() => abrirEdicao(i)}
                            >
                              <IcLapis />
                            </button>
                            <button
                              type="button"
                              className="act tt danger"
                              aria-label={`Remover pergunta ${i + 1}`}
                              data-tip="Remover pergunta"
                              onClick={() => setRemover(i)}
                            >
                              <Ic d={D.lixeira} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <aside className="resumo-fixo" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section className="panel">
              <header>
                <h2>Documentos de apoio</h2>
              </header>
              <div className="pb">
                <SoltarArquivo aoEscolher={(f) => void escolherArquivo(f)} enviando={enviandoDoc} />
                {fila.map((arq, i) => (
                  <div className="ps-file" key={arq.name + i}>
                    <span className="fi">
                      <IcFormulario lg />
                    </span>
                    <div className="meta">
                      <div className="name">{arq.name}</div>
                      <div className="sub">Será enviado ao salvar o formulário</div>
                    </div>
                    <button
                      type="button"
                      className="act tt danger"
                      aria-label="Tirar da lista"
                      data-tip="Tirar da lista"
                      onClick={() => setFila(fila.filter((_, j) => j !== i))}
                    >
                      <Ic d={D.lixeira} />
                    </button>
                  </div>
                ))}
                {(docsCarga.dados ?? []).map((d) => (
                  <ArquivoDoc key={d.id_documento} doc={d} aoExcluir={() => setExcluirDoc(d)} />
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="pb">
                <div className="duo-actions">
                  <Link className="ps-btn secondary cancelar" to={novo ? '/formularios' : `/formularios/${idF}`}>
                    Cancelar
                  </Link>
                  <button type="button" className="ps-btn primary" onClick={() => void salvar()} aria-busy={salvando}>
                    {salvando ? 'Salvando…' : 'Salvar formulário'}
                  </button>
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>

      {janela && (
        <Modal
          vidro
          alta
          largura={760}
          titulo={janela.modo === 'editar' ? `Editar pergunta ${janela.indice + 1}` : 'Adicionar pergunta'}
          subtitulo={
            janela.modo === 'incluir'
              ? perguntas.length
                ? `${plural(perguntas.length, 'pergunta', 'perguntas')} no formulário até agora.`
                : 'A primeira pergunta do formulário.'
              : undefined
          }
          aoFechar={salvandoPergunta ? undefined : fecharJanela}
          fecharNoX
          focoInicial="#qt"
          estiloCorpo={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          rodape={
            janela.modo === 'incluir' ? (
              <>
                {erroPergunta && (
                  <div className="erro-rodape">
                    <MensagemErro>{erroPergunta}</MensagemErro>
                  </div>
                )}
                <button type="button" className="ps-btn secondary cancelar" onClick={fecharJanela} disabled={!!salvandoPergunta}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="ps-btn primary"
                  onClick={() => void gravarPergunta(false)}
                  aria-busy={salvandoPergunta === 'fechar'}
                >
                  {salvandoPergunta === 'fechar' ? 'Incluindo…' : 'Incluir e fechar'}
                </button>
                <button
                  type="button"
                  className="ps-btn secondary"
                  onClick={() => void gravarPergunta(true)}
                  aria-busy={salvandoPergunta === 'mais'}
                >
                  <IcMais />
                  {salvandoPergunta === 'mais' ? 'Incluindo…' : 'Incluir essa e mais uma'}
                </button>
              </>
            ) : (
              <>
                {erroPergunta && (
                  <div className="erro-rodape">
                    <MensagemErro>{erroPergunta}</MensagemErro>
                  </div>
                )}
                <button type="button" className="ps-btn secondary cancelar" onClick={fecharJanela} disabled={!!salvandoPergunta}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className="ps-btn primary"
                  onClick={() => void gravarPergunta(false)}
                  aria-busy={salvandoPergunta === 'fechar'}
                >
                  {salvandoPergunta === 'fechar' ? 'Salvando…' : 'Salvar pergunta'}
                </button>
              </>
            )
          }
        >
          <EditorPergunta p={rasc} aoMudar={setRasc} />
          <button
            type="button"
            className={'ps-check' + (rasc.obrigatoria !== false ? ' is-checked' : '')}
            aria-pressed={rasc.obrigatoria !== false}
            onClick={() => setRasc({ ...rasc, obrigatoria: rasc.obrigatoria === false })}
            style={{ alignSelf: 'flex-start', alignItems: 'center', minHeight: 0, padding: 0, border: 0, background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <span className="ps-switch" />
            Pergunta obrigatória
          </button>
        </Modal>
      )}

      {remover !== null && (
        <ModalCerteza
          rotulo="Sim, remover"
          ocupado={ocupado}
          aoCancelar={() => setRemover(null)}
          aoConfirmar={() => void confirmarRemocao()}
        />
      )}
      {excluirDoc && (
        <ModalCerteza
          rotulo="Sim, excluir"
          ocupado={ocupado}
          aoCancelar={() => setExcluirDoc(null)}
          aoConfirmar={async () => {
            setOcupado(true);
            try {
              await docApi.excluir(excluirDoc.id_documento);
              await docsCarga.recarregar();
            } catch (e) {
              setErro(mensagemErro(e));
            } finally {
              setOcupado(false);
              setExcluirDoc(null);
            }
          }}
        />
      )}
    </>
  );
}

/** Texto, tipo de resposta, opções ou faixa de valores. */
function EditorPergunta({ p, aoMudar }: { p: PerguntaEd; aoMudar: (p: PerguntaEd) => void }) {
  const opcoes = p.opcoes ?? [];
  const radio = p.id_tipo_pergunta === TipoPergunta.ESCOLHA_UNICA;
  const numero = (v: string) => (v === '' ? undefined : Number(v));
  return (
    <>
      <div className="ps-field">
        <label className="ps-label" htmlFor="qt">
          Texto da pergunta{' '}
          <span className="req" aria-hidden="true">
            *
          </span>
        </label>
        <div className="ps-control ps-textarea" style={{ alignItems: 'flex-start' }}>
          <textarea id="qt" maxLength={500} style={{ minHeight: 72 }} value={p.pergunta} onChange={(e) => aoMudar({ ...p, pergunta: e.target.value })} />
        </div>
        <div className="ps-helper">Até 500 caracteres.</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="ps-label">
          Tipo de resposta{' '}
          <span className="req" aria-hidden="true">
            *
          </span>
        </span>
        <div className="cols-3" style={{ gap: 10 }}>
          {TIPOS_PERGUNTA.map((t) => {
            const sel = t.id === p.id_tipo_pergunta;
            return (
              <button
                key={t.id}
                type="button"
                className={'ps-choice' + (sel ? ' is-checked' : '')}
                aria-pressed={sel}
                onClick={() =>
                  aoMudar({
                    ...p,
                    id_tipo_pergunta: t.id,
                    opcoes: temOpcoes(t.id) && !(p.opcoes ?? []).length ? VAZIA.opcoes : p.opcoes,
                  })
                }
                style={{ textAlign: 'left', fontFamily: 'inherit', padding: '12px 14px', minHeight: 0 }}
              >
                <span style={{ flex: 1 }}>
                  <strong style={{ fontSize: 14 }}>{t.nome}</strong>
                  <span className="d">{t.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {temOpcoes(p.id_tipo_pergunta) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="ps-label">Opções (mínimo 2)</span>
          {opcoes.map((o, i) => (
            <div className="ps-control" key={i}>
              <span className={'ps-box' + (radio ? ' radio' : '')} aria-hidden="true" />
              <input
                type="text"
                aria-label={`Opção ${i + 1}`}
                maxLength={255}
                value={o.texto_opcao}
                onChange={(e) => aoMudar({ ...p, opcoes: opcoes.map((x, j) => (j === i ? { ...x, texto_opcao: e.target.value } : x)) })}
              />
              {opcoes.length > 2 && (
                <button
                  type="button"
                  className="olho"
                  aria-label={`Remover opção ${i + 1}`}
                  data-tip="Remover opção"
                  onClick={() => aoMudar({ ...p, opcoes: opcoes.filter((_, j) => j !== i) })}
                >
                  <Ic d={D.fechar} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="ps-btn tertiary sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => aoMudar({ ...p, opcoes: [...opcoes, { texto_opcao: '' }] })}
          >
            <IcMais />
            Adicionar opção
          </button>
        </div>
      )}
      {p.id_tipo_pergunta === TipoPergunta.NUMERO && (
        <div className="cols-2">
          <div className="ps-field">
            <label className="ps-label" htmlFor="vmin">
              Valor mínimo <span className="opt">(opcional)</span>
            </label>
            <div className="ps-control">
              <input id="vmin" type="number" value={p.valor_minimo ?? ''} onChange={(e) => aoMudar({ ...p, valor_minimo: numero(e.target.value) })} />
            </div>
          </div>
          <div className="ps-field">
            <label className="ps-label" htmlFor="vmax">
              Valor máximo <span className="opt">(opcional)</span>
            </label>
            <div className="ps-control">
              <input id="vmax" type="number" value={p.valor_maximo ?? ''} onChange={(e) => aoMudar({ ...p, valor_maximo: numero(e.target.value) })} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
