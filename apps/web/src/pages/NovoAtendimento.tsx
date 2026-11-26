import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as atendApi from '../api/atendimentos';
import * as formApi from '../api/formularios';
import * as apoio from '../api/apoio';
import { buscarPacientes } from '../api/usuarios';
import { mensagemErro } from '../api/client';
import type { PacienteResumo } from '../api/types';
import { useAtrasado, useCarregar, useUnidadesPermitidas } from '../hooks';
import { PageHead, PanelTitle } from '../components/Layout';
import { BarraBusca, PainelFiltros } from '../components/Lista';
import { Alerta, Select, MensagemErro } from '../components/Form';
import { useAvisos } from '../components/Avisos';
import { Esq, EsqEscolhas } from '../components/Esqueleto';
import { D, Ic, IcBusca, IcFormulario } from '../components/icons';
import { cpf, iniciais, plural } from '../lib/format';

/** 2.3 Novo atendimento (NovoAtendimento.dc.html). */
export function NovoAtendimento() {
  const navegar = useNavigate();
  const avisar = useAvisos();
  const unidades = useUnidadesPermitidas();

  // Paciente
  const [buscaPac, setBuscaPac] = useState('');
  const buscaPacAtrasada = useAtrasado(buscaPac);
  const [pacientes, setPacientes] = useState<PacienteResumo[]>([]);
  const [buscandoPac, setBuscandoPac] = useState(false);
  const [paciente, setPaciente] = useState<PacienteResumo | null>(null);

  useEffect(() => {
    const termo = buscaPacAtrasada.trim();
    if (termo.length < 2) {
      setPacientes([]);
      return;
    }
    let vivo = true;
    setBuscandoPac(true);
    buscarPacientes(termo)
      .then((r) => vivo && setPacientes(r))
      .catch(() => vivo && setPacientes([]))
      .finally(() => vivo && setBuscandoPac(false));
    return () => {
      vivo = false;
    };
  }, [buscaPacAtrasada]);

  // escolhido: o nome vai para o Resumo e o e-mail para o título da seção;
  // a busca é limpa (a lista some) e o foco volta para o campo
  const campoPac = useRef<HTMLInputElement>(null);
  function escolherPaciente(p: PacienteResumo) {
    setPaciente(p);
    setBuscaPac('');
    setPacientes([]);
    campoPac.current?.focus();
  }

  // Unidade
  const [idUnidade, setIdUnidade] = useState<number | ''>('');
  useEffect(() => {
    if (idUnidade === '' && unidades.lista.length) {
      const padrao = unidades.lista.find((u) => u.id_unidade_atendimento === unidades.sede) ?? unidades.lista[0];
      setIdUnidade(padrao.id_unidade_atendimento);
    }
  }, [unidades.lista, unidades.sede, idUnidade]);

  // Formulários ativos
  const [buscaForm, setBuscaForm] = useState('');
  const [fAberto, setFAberto] = useState(false);
  const [fRasc, setFRasc] = useState<number | 'todos'>('todos');
  const [fAp, setFAp] = useState<number | 'todos'>('todos');
  const [sel, setSel] = useState<Set<number>>(new Set());
  const { dados: forms, carregando: carregandoForms } = useCarregar(
    () => formApi.listar({ ativo: true, limit: 200, ordenar_por: 'nome' }),
    [],
  );
  const { dados: tipos } = useCarregar(() => apoio.tiposFormulario(), []);
  const visiveis = useMemo(() => {
    const termo = buscaForm.trim().toLowerCase();
    return (forms?.data ?? [])
      .filter((f) => fAp === 'todos' || f.id_tipo_formulario === fAp)
      .filter((f) => !termo || (f.nome ?? '').toLowerCase().includes(termo));
  }, [forms, fAp, buscaForm]);

  // Descrição
  const [descricao, setDescricao] = useState('');

  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const n = sel.size;
  const nomeUnidade = unidades.lista.find((u) => u.id_unidade_atendimento === idUnidade)?.nome;

  async function criar() {
    setTentou(true);
    if (!paciente || n === 0 || idUnidade === '' || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const a = await atendApi.criar({
        id_usuario_paciente: paciente.id_usuario,
        id_unidade_atendimento: Number(idUnidade),
        formularios: [...sel],
        descricao: descricao.trim() || undefined,
      });
      avisar({ titulo: 'Atendimento criado', texto: `${paciente.nome} já pode responder pelo app.` });
      navegar(`/atendimentos/${a.id_atendimento}`, { replace: true });
    } catch (e) {
      setErro(mensagemErro(e));
      setEnviando(false);
    }
  }

  return (
    <>
      <PageHead
        migalhas={[
          { rotulo: 'Início', para: '/atendimentos' },
          { rotulo: 'Atendimentos', para: '/atendimentos' },
          { rotulo: 'Novo atendimento' },
        ]}
        voltar="/atendimentos"
        titulo="Novo atendimento"
      />

      <div className="page-body">
        {erro && (
          <Alerta tipo="error" titulo="Não foi possível criar o atendimento">
            {erro}
          </Alerta>
        )}
        <div className="split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section className="panel">
              <header>
                <PanelTitle id="h-pac">
                  Paciente{' '}
                  <span className="req" aria-hidden="true">
                    *
                  </span>
                </PanelTitle>
                {/* e-mail do paciente escolhido, no lado oposto do título */}
                <span className="pac-escolhido" id="pac-escolhido" aria-live="polite">
                  {paciente && (
                    <>
                      <span className="ps-sr">Paciente selecionado: {paciente.nome}, e-mail </span>
                      <Ic d={D.email} />
                      <span className="pac-email" title={paciente.email}>
                        {paciente.email}
                      </span>
                    </>
                  )}
                </span>
              </header>
              <div className="pb">
                <div className="ps-field">
                  <label className="ps-search" style={{ maxWidth: 'none' }}>
                    <IcBusca style={{ color: 'var(--Text-muted)' }} />
                    <input
                      ref={campoPac}
                      id="pac"
                      aria-labelledby="h-pac"
                      aria-describedby={paciente ? 'pac-escolhido' : undefined}
                      type="search"
                      placeholder={paciente ? 'Para trocar, digite o nome ou o CPF de outro paciente...' : 'Digite o nome ou o CPF do paciente...'}
                      value={buscaPac}
                      onChange={(e) => setBuscaPac(e.target.value)}
                      aria-autocomplete="list"
                    />
                  </label>
                  {tentou && !paciente && <MensagemErro>Escolha o paciente.</MensagemErro>}
                </div>
                {buscaPac.trim().length >= 2 && pacientes.length > 0 && (
                  <div className="ps-menu" role="listbox" aria-label="Pacientes encontrados" style={{ maxWidth: 'none' }}>
                    {pacientes.map((p) => {
                      const on = p.id_usuario === paciente?.id_usuario;
                      return (
                        <button
                          key={p.id_usuario}
                          type="button"
                          className={'ps-option' + (on ? ' is-selected' : '')}
                          role="option"
                          aria-selected={on}
                          onClick={() => escolherPaciente(p)}
                          style={{ width: '100%', border: 0, backgroundColor: 'transparent', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <span className="avatar" aria-hidden="true" style={{ width: 32, height: 32, lineHeight: '32px', fontSize: 12 }}>
                            {iniciais(p.nome)}
                          </span>
                          <span style={{ flex: 1 }}>
                            {p.nome}
                            <small>
                              CPF {cpf(p.cpf)} · {p.email}
                            </small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {buscaPac.trim().length >= 2 && !buscandoPac && pacientes.length === 0 && (
                  <div className="ps-helper">Nenhum paciente ativo encontrado com “{buscaPac.trim()}”.</div>
                )}
              </div>
            </section>

            <section className="panel">
              <header>
                <PanelTitle id="unidade-titulo">
                  Unidade de atendimento{' '}
                  <span className="req" aria-hidden="true">
                    *
                  </span>
                </PanelTitle>
              </header>
              <div className="pb">
                <div className="ps-field">
                  {unidades.carregando ? (
                    <div role="status" aria-busy="true">
                      <span className="ps-sr">Carregando unidades…</span>
                      <Esq h={48} r={10} />
                    </div>
                  ) : (
                  <Select
                    id="unidade"
                    valor={idUnidade}
                    aoMudar={(v) => setIdUnidade(v ? Number(v) : '')}
                    invalido={tentou && idUnidade === ''}
                    desabilitado={unidades.carregando}
                    rotuladoPor="unidade-titulo"
                    descritoPor={tentou && idUnidade === '' ? 'unidade-erro' : undefined}
                  >
                    {idUnidade === '' && <option value="">Selecione</option>}
                    {unidades.lista.map((u) => (
                      <option key={u.id_unidade_atendimento} value={u.id_unidade_atendimento}>
                        {u.nome}
                        {u.id_unidade_atendimento === unidades.sede ? ' (sede)' : ''}
                      </option>
                    ))}
                  </Select>
                  )}
                  {tentou && idUnidade === '' && (
                    <MensagemErro id="unidade-erro">Escolha a unidade do atendimento.</MensagemErro>
                  )}
                </div>
              </div>
            </section>

            <section className="panel">
              <header>
                <PanelTitle>Formulários</PanelTitle>
              </header>
              <div className="pb">
                <BarraBusca
                  inline
                  busca={buscaForm}
                  aoBuscar={setBuscaForm}
                  placeholder="Buscar formulários por nome..."
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
                    <label className="ps-label" htmlFor="f-tipo">
                      Tipo de unidade
                    </label>
                    <Select id="f-tipo" valor={fRasc} aoMudar={(v) => setFRasc(v === 'todos' ? 'todos' : Number(v))}>
                      <option value="todos">Todos</option>
                      {(tipos ?? []).map((t) => (
                        <option key={t.id_tipo_formulario} value={t.id_tipo_formulario}>
                          {t.nome}
                        </option>
                      ))}
                    </Select>
                  </div>
                </PainelFiltros>
                {carregandoForms && !forms ? (
                  <EsqEscolhas n={3} />
                ) : visiveis.length === 0 ? (
                  <div className="ps-helper">Nenhum formulário ativo encontrado.</div>
                ) : (
                  visiveis.map((f) => {
                    const on = sel.has(f.id_formulario);
                    return (
                      <button
                        key={f.id_formulario}
                        type="button"
                        className={'ps-choice' + (on ? ' is-checked' : '')}
                        aria-pressed={on}
                        onClick={() => {
                          const novo = new Set(sel);
                          if (on) novo.delete(f.id_formulario);
                          else novo.add(f.id_formulario);
                          setSel(novo);
                        }}
                        style={{ textAlign: 'left', fontFamily: 'inherit' }}
                      >
                        <span className="ico">
                          <IcFormulario lg />
                        </span>
                        <span style={{ flex: 1 }}>
                          <strong>{f.nome}</strong>
                          <span className="d">
                            {f.tipo_formulario?.nome} · {plural(f._count?.pergunta ?? 0, 'pergunta', 'perguntas')}
                          </span>
                        </span>
                        <span className="ps-box">{on ? '✓' : ''}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            <section className="panel">
              <header>
                <PanelTitle id="h-desc">
                  Descrição <span className="opt">(opcional)</span>
                </PanelTitle>
              </header>
              <div className="pb">
                <div className="ps-field">
                  <div className="ps-control ps-textarea" style={{ alignItems: 'flex-start' }}>
                    <textarea
                      id="desc"
                      aria-labelledby="h-desc"
                      maxLength={150}
                      placeholder="Descreva brevemente o motivo do atendimento..."
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                    />
                  </div>
                  <div className="ps-helper">
                    Até 150 caracteres.<span className="ps-counter">{descricao.length}/150</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="panel resumo-fixo">
            <header>
              <h2>Resumo</h2>
            </header>
            <div className="pb">
              <div className="kv" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <div>
                  <span>Paciente</span>
                  <strong>{paciente?.nome ?? '—'}</strong>
                </div>
                <div>
                  <span>Unidade</span>
                  <strong>{nomeUnidade ?? '—'}</strong>
                </div>
                <div>
                  <span>Formulários</span>
                  <strong>{plural(n, 'selecionado', 'selecionados')}</strong>
                </div>
                <div>
                  <span>Situação inicial</span>
                  <strong>
                    <span className="ps-badge info">Criado</span>
                  </strong>
                </div>
              </div>
              {tentou && n === 0 && <MensagemErro>Escolha pelo menos 1 formulário.</MensagemErro>}
            </div>
            <footer>
              <Link className="ps-btn secondary lg cancelar" to="/atendimentos">
                Cancelar
              </Link>
              <button type="button" className="ps-btn primary lg" style={{ fontSize: 16 }} onClick={() => void criar()} aria-busy={enviando}>
                {enviando ? 'Criando…' : 'Criar atendimento'}
              </button>
            </footer>
          </aside>
        </div>
      </div>
    </>
  );
}
