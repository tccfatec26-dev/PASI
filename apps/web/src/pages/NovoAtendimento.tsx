import { useEffect, useMemo, useState } from 'react';
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
import { Alerta, Select } from '../components/Form';
import { Seg } from '../components/Seg';
import { IcBusca, IcFormulario } from '../components/icons';
import { cpf, iniciais, plural } from '../lib/format';

/** 2.3 Novo atendimento (NovoAtendimento.dc.html). */
export function NovoAtendimento() {
  const navegar = useNavigate();
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
        dica="Escolha o paciente e os formulários que ele vai responder no app."
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
                <PanelTitle id="h-pac" dica="Busque por nome ou CPF (a partir de 2 caracteres, até 20 resultados).">
                  Paciente{' '}
                  <span className="req" aria-hidden="true">
                    *
                  </span>
                </PanelTitle>
              </header>
              <div className="pb">
                <div className="ps-field">
                  <label className="ps-search" style={{ maxWidth: 'none' }}>
                    <IcBusca style={{ color: 'var(--Text-muted)' }} />
                    <input
                      id="pac"
                      aria-labelledby="h-pac"
                      type="search"
                      placeholder="Digite o nome ou o CPF do paciente..."
                      value={buscaPac}
                      onChange={(e) => setBuscaPac(e.target.value)}
                      aria-autocomplete="list"
                    />
                  </label>
                  {tentou && !paciente && <div className="ps-helper error">Escolha o paciente.</div>}
                </div>
                {(pacientes.length > 0 || paciente) && (
                  <div className="ps-menu" role="listbox" aria-label="Pacientes encontrados" style={{ maxWidth: 'none' }}>
                    {(pacientes.some((p) => p.id_usuario === paciente?.id_usuario) || !paciente ? pacientes : [paciente, ...pacientes]).map(
                      (p) => {
                        const on = p.id_usuario === paciente?.id_usuario;
                        return (
                          <button
                            key={p.id_usuario}
                            type="button"
                            className={'ps-option' + (on ? ' is-selected' : '')}
                            role="option"
                            aria-selected={on}
                            onClick={() => setPaciente(p)}
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
                      },
                    )}
                  </div>
                )}
                {buscaPac.trim().length >= 2 && !buscandoPac && pacientes.length === 0 && (
                  <div className="ps-helper">Nenhum paciente ativo encontrado com “{buscaPac.trim()}”.</div>
                )}
              </div>
            </section>

            <section className="panel">
              <header>
                <PanelTitle dica="O intermediário escolhe entre as unidades dele; o máximo, qualquer unidade.">
                  Unidade de atendimento{' '}
                  <span className="req" aria-hidden="true">
                    *
                  </span>
                </PanelTitle>
              </header>
              <div className="pb">
                <div className="ps-field">
                  <Select
                    id="unidade"
                    valor={idUnidade}
                    aoMudar={(v) => setIdUnidade(v ? Number(v) : '')}
                    invalido={tentou && idUnidade === ''}
                    desabilitado={unidades.carregando}
                  >
                    {idUnidade === '' && <option value="">{unidades.carregando ? 'Carregando…' : 'Selecione'}</option>}
                    {unidades.lista.map((u) => (
                      <option key={u.id_unidade_atendimento} value={u.id_unidade_atendimento}>
                        {u.nome}
                        {u.id_unidade_atendimento === unidades.sede ? ' (sede)' : ''}
                      </option>
                    ))}
                  </Select>
                  {tentou && idUnidade === '' && <div className="ps-helper error">Escolha a unidade do atendimento.</div>}
                </div>
              </div>
            </section>

            <section className="panel">
              <header>
                <PanelTitle dica="Só formulários ativos aparecem. Escolha pelo menos 1.">Formulários</PanelTitle>
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
                    <span className="ps-label">Tipo de unidade</span>
                    <Seg
                      papel="group"
                      rotulo="Tipo de unidade"
                      valor={fRasc}
                      aoMudar={setFRasc}
                      opcoes={[
                        { valor: 'todos' as const, rotulo: 'Todos' },
                        ...(tipos ?? []).map((t) => ({ valor: t.id_tipo_formulario, rotulo: t.nome })),
                      ]}
                    />
                  </div>
                </PainelFiltros>
                {carregandoForms && !forms ? (
                  <div className="ps-helper">Carregando formulários…</div>
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
                <PanelTitle id="h-desc" dica="Opcional. Ajuda a identificar o atendimento na lista.">
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

          <aside className="panel" style={{ position: 'sticky', top: 24 }}>
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
              {tentou && n === 0 && <div className="ps-helper error">Escolha pelo menos 1 formulário.</div>}
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
