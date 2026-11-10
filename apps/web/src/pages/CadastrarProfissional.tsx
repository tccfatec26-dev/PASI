import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as gestao from '../api/gestao';
import * as apoio from '../api/apoio';
import { mensagemErro } from '../api/client';
import type { Profissao, Unidade } from '../api/types';
import { PageHead } from '../components/Layout';
import { Alerta, Campo, Entrada, Select } from '../components/Form';
import { Seg } from '../components/Seg';
import { Modal } from '../components/Modal';
import { Ic } from '../components/icons';
import { cpf as mascaraCpf, dataHora, plural, soDigitos, telefone } from '../lib/format';
import { SEXOS } from '../lib/perfil';

const ENVELOPE = 'M3 6h18v12H3zM3 7l9 6 9-6';

function cpfValido(v: string) {
  const d = soDigitos(v);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const dv = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

/** 5.3 Cadastrar profissional (CadastrarProfissional.dc.html) — RN-USR-02 a 04 e 11. */
export function CadastrarProfissional() {
  const navegar = useNavigate();
  const [perfil, setPerfil] = useState<'intermediario' | 'maximo'>('intermediario');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [sexo, setSexo] = useState('F');
  const [idProfissao, setIdProfissao] = useState<number | ''>('');
  const [profissoes, setProfissoes] = useState<Profissao[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [marcadas, setMarcadas] = useState<number[]>([]);
  const [sede, setSede] = useState<number | null>(null);
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<null | { nome: string; email: string; sede: string; expira: string; enviado: boolean }>(null);

  useEffect(() => {
    apoio.profissoes().then(setProfissoes).catch(() => undefined);
    apoio.unidades().then(setUnidades).catch(() => undefined);
  }, []);

  const max = perfil === 'maximo';
  const erros = {
    nome: !nome.trim() ? 'Informe o nome completo.' : null,
    cpf: !cpfValido(cpf) ? 'Informe um CPF válido.' : null,
    tel: soDigitos(tel).length < 10 ? 'Informe o celular com DDD.' : null,
    email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? 'Informe um e-mail válido.' : null,
    prof: idProfissao === '' ? 'Escolha a profissão.' : null,
    un: !marcadas.length || sede === null ? 'Marque pelo menos uma unidade e escolha a sede.' : null,
  };
  const valido = Object.values(erros).every((x) => !x);
  const nomeSede = unidades.find((x) => x.id_unidade_atendimento === sede)?.nome;

  function alternar(id: number) {
    const on = marcadas.includes(id);
    const nova = on ? marcadas.filter((x) => x !== id) : [...marcadas, id];
    let s = sede;
    if (on && s === id) s = nova[0] ?? null;
    if (!on && s === null) s = id;
    setMarcadas(nova);
    setSede(s);
  }

  function limpar() {
    setPerfil('intermediario');
    setNome('');
    setCpf('');
    setTel('');
    setEmail('');
    setSexo('F');
    setIdProfissao('');
    setMarcadas([]);
    setSede(null);
    setTentou(false);
    setErro(null);
  }

  async function salvar() {
    setTentou(true);
    if (!valido || enviando || sede === null) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await gestao.cadastrarProfissional({
        nome: nome.trim(),
        cpf: soDigitos(cpf),
        email: email.trim().toLowerCase(),
        tel_celular: soDigitos(tel),
        sexo,
        id_profissao: Number(idProfissao),
        perfil,
        unidades: marcadas.map((id) => ({ id_unidade_atendimento: id, sede: id === sede })),
      });
      setSucesso({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        sede: nomeSede ?? '—',
        expira: r.senha_provisoria_expira_em,
        enviado: r.email_enviado,
      });
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setEnviando(false);
    }
  }

  const err = (k: keyof typeof erros) => (tentou ? erros[k] : null);

  return (
    <div className="pg-cadastro" style={{ display: 'contents' }}>
      <PageHead
        migalhas={[
          { rotulo: 'Início', para: '/atendimentos' },
          { rotulo: 'Usuários', para: '/usuarios' },
          { rotulo: 'Cadastrar profissional' },
        ]}
        voltar="/usuarios"
        titulo="Cadastrar profissional"
      />

      <div className="page-body">
        {erro && (
          <Alerta tipo="error" titulo="Não foi possível cadastrar">
            {erro}
          </Alerta>
        )}
        <div className="split">
          <form
            style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
            onSubmit={(e) => {
              e.preventDefault();
              void salvar();
            }}
            noValidate
          >
            <section className="panel">
              <header>
                <h2>Perfil</h2>
              </header>
              <div className="pb">
                <Seg
                  rotulo="Perfil do profissional"
                  valor={perfil}
                  aoMudar={setPerfil}
                  opcoes={[
                    { valor: 'intermediario', rotulo: 'Intermediário (padrão)' },
                    { valor: 'maximo', rotulo: 'Máximo' },
                  ]}
                />
                <p className="ps-results-meta" style={{ margin: 0 }}>
                  {max
                    ? 'Máximo: cadastra profissionais, gerencia usuários e vê todas as unidades. As unidades abaixo dizem onde ele trabalha; depois, ele mesmo cuida delas no Meu perfil.'
                    : 'Intermediário: vê e avalia só os atendimentos das unidades marcadas abaixo.'}
                </p>
              </div>
            </section>

            <section className="panel">
              <header>
                <h2>Dados do profissional</h2>
              </header>
              <div className="pb">
                <Campo id="nome" rotulo="Nome completo" obrigatorio erro={err('nome')}>
                  <Entrada id="nome" type="text" maxLength={70} valor={nome} aoMudar={setNome} invalido={!!err('nome')} />
                </Campo>
                <div className="cols-2">
                  <Campo id="cpf" rotulo="CPF" obrigatorio erro={err('cpf')}>
                    <Entrada
                      id="cpf"
                      type="text"
                      inputMode="numeric"
                      placeholder="000.000.000-00"
                      valor={cpf}
                      aoMudar={(v) => setCpf(mascaraCpf(v))}
                      invalido={!!err('cpf')}
                    />
                  </Campo>
                  <Campo id="tel" rotulo="Celular" obrigatorio erro={err('tel')}>
                    <Entrada
                      id="tel"
                      type="tel"
                      inputMode="numeric"
                      placeholder="(00) 00000-0000"
                      valor={tel}
                      aoMudar={(v) => setTel(telefone(v))}
                      invalido={!!err('tel')}
                    />
                  </Campo>
                </div>
                <Campo
                  id="email"
                  rotulo="E-mail"
                  obrigatorio
                  erro={err('email')}
                  ajuda="A senha provisória vai para este e-mail. Confira com o profissional antes de salvar."
                >
                  <Entrada id="email" type="email" maxLength={50} valor={email} aoMudar={setEmail} invalido={!!err('email')} />
                </Campo>
                <div className="cols-2">
                  <fieldset>
                    <legend className="ps-label">
                      Sexo{' '}
                      <span className="req" aria-hidden="true">
                        *
                      </span>
                    </legend>
                    <Seg opcoes={SEXOS} valor={sexo} aoMudar={setSexo} />
                  </fieldset>
                  <Campo id="prof" rotulo="Profissão" obrigatorio erro={err('prof')}>
                    <Select id="prof" valor={idProfissao} aoMudar={(v) => setIdProfissao(v ? Number(v) : '')} invalido={!!err('prof')}>
                      <option value="">Selecione</option>
                      {profissoes.map((p) => (
                        <option key={p.id_profissao} value={p.id_profissao}>
                          {p.nome}
                        </option>
                      ))}
                    </Select>
                  </Campo>
                </div>
                <p className="ps-results-meta" style={{ margin: 0 }}>
                  CPF, e-mail e celular não podem estar em outro cadastro, de profissional ou de paciente.
                </p>
              </div>
            </section>

            <section className="panel">
              <header>
                <h2>Unidades de atendimento</h2>
                <span className="ps-results-meta">
                  {plural(marcadas.length, 'unidade', 'unidades')}
                  {nomeSede ? ` · sede: ${nomeSede}` : ' · sem sede'}
                </span>
              </header>
              <div className="pb">
                {unidades.map((un) => {
                  const id = un.id_unidade_atendimento;
                  const on = marcadas.includes(id);
                  const ehSede = sede === id;
                  return (
                    <div key={id} className={'un-row' + (on ? ' is-on' : '')}>
                      <button
                        type="button"
                        className={'ps-check' + (on ? ' is-checked' : '')}
                        aria-pressed={on}
                        aria-label={`Vincular ${un.nome}`}
                        onClick={() => alternar(id)}
                      >
                        <span className="ps-box">{on ? '✓' : ''}</span>
                      </button>
                      <span className="nm">{un.nome}</span>
                      <button
                        type="button"
                        className={'sede-pick' + (ehSede ? ' is-checked' : '')}
                        aria-disabled={!on}
                        data-tip={on ? '' : 'Marque esta unidade antes de escolher como sede'}
                        aria-pressed={ehSede}
                        aria-label={`Sede: ${un.nome}`}
                        onClick={() => {
                          if (on) setSede(id);
                        }}
                      >
                        <span className="ps-box radio">{ehSede ? '●' : ''}</span>
                        Sede
                      </button>
                    </div>
                  );
                })}
                {err('un') && <div className="ps-helper error">{erros.un}</div>}
              </div>
            </section>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 }}>
            <aside className="panel">
              <header>
                <h2>O que acontece depois</h2>
              </header>
              <div className="pb">
                <ol className="steps">
                  <li>
                    <span className="n">1</span>
                    <div>
                      <strong>Pendência I – Senha de acesso</strong>
                      <span>O profissional entra com a senha provisória e é levado direto para criar a própria senha. Depois volta ao login.</span>
                    </div>
                  </li>
                  <li>
                    <span className="n">2</span>
                    <div>
                      <strong>Pendência II – Revisão de dados</strong>
                      <span>Entra com a senha nova, revisa os dados no Meu perfil e confirma. Até lá, só pode editar e confirmar.</span>
                    </div>
                  </li>
                  <li>
                    <span className="n">3</span>
                    <div>
                      <strong>Deferido</strong>
                      <span>Passa a usar tudo o que o perfil permite.</span>
                    </div>
                  </li>
                </ol>
                <p className="ps-results-meta" style={{ margin: 0 }}>
                  Se a senha vencer, reenvie uma nova pela lista de usuários. O cadastro fica registrado no histórico.
                </p>
              </div>
            </aside>
            <div className="side-actions">
              <Link className="ps-btn secondary lg cancelar" to="/usuarios">
                Cancelar
              </Link>
              <button type="button" className="ps-btn primary lg" onClick={() => void salvar()} aria-busy={enviando}>
                <Ic d={ENVELOPE} />
                {enviando ? 'Cadastrando…' : 'Cadastrar e enviar senha'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {sucesso && (
        <Modal
          alerta
          icone="ok"
          titulo="Profissional cadastrado"
          rodape={
            <>
              <button
                type="button"
                className="ps-btn secondary"
                onClick={() => {
                  setSucesso(null);
                  limpar();
                }}
              >
                Cadastrar outro
              </button>
              <button type="button" className="ps-btn primary" onClick={() => navegar('/usuarios')}>
                Ir para usuários
              </button>
            </>
          }
        >
          {sucesso.nome} foi cadastrado(a) como {max ? 'máximo' : 'intermediário'}, com sede em {sucesso.sede}.{' '}
          {sucesso.enviado
            ? `A senha provisória foi enviada para ${sucesso.email} e vale até ${dataHora(sucesso.expira)}.`
            : `O cadastro foi salvo, mas o e-mail com a senha não saiu. Use “Reenviar senha provisória” na lista de usuários.`}
        </Modal>
      )}
    </div>
  );
}
