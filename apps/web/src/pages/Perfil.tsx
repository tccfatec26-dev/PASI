import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import * as apoio from '../api/apoio';
import * as usuariosApi from '../api/usuarios';
import { mensagemErro } from '../api/client';
import type { Genero, VinculoUnidade } from '../api/types';
import { PageHead, PanelTitle } from '../components/Layout';
import { Campo, Entrada, EntradaSenha, ListaCriterios, Select, SoLeitura } from '../components/Form';
import { Seg } from '../components/Seg';
import { Modal } from '../components/Modal';
import { useAvisos } from '../components/Avisos';
import { ConfirmaSimples, ItemUnidade, ModalVincular } from '../components/GestaoUnidades';
import { IcCadeado, IcInfo, IcMais } from '../components/icons';
import { cpfMascarado, iniciais, soDigitos, telefone } from '../lib/format';
import { ordenarUnidades, SEXOS } from '../lib/perfil';
import { criteriosSenha } from '../lib/senha';

type JanelaUn = null | 'vincular' | { sede: VinculoUnidade } | { tirar: VinculoUnidade };

/** 4.1 Meu perfil (Perfil.dc.html): dados, atuação e segurança. */
export function Perfil() {
  const { usuario, ehMaximo, definirUsuario, recarregar } = useAuth();
  const [generos, setGeneros] = useState<Genero[]>([]);
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [sexo, setSexo] = useState('F');
  const [idGenero, setIdGenero] = useState<number | ''>('');
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const avisar = useAvisos();

  // segurança
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [trocando, setTrocando] = useState(false);
  const [erroSenha, setErroSenha] = useState<string | null>(null);
  const [trocada, setTrocada] = useState(false);

  // unidades do próprio máximo (RN-USR-15)
  const [janela, setJanela] = useState<JanelaUn>(null);
  const [ocupado, setOcupado] = useState(false);

  function preencher() {
    if (!usuario) return;
    setNome(usuario.nome);
    setTel(telefone(usuario.tel_celular));
    setEmail(usuario.email);
    setSexo(usuario.sexo);
    setIdGenero(usuario.id_genero ?? '');
  }
  useEffect(preencher, [usuario?.id_usuario]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    apoio.generos().then(setGeneros).catch(() => undefined);
  }, []);

  if (!usuario) return null;

  const erros = {
    nome: !nome.trim() ? 'Informe o nome completo.' : null,
    tel: soDigitos(tel).length < 10 ? 'Informe o celular com DDD.' : null,
    email: !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? 'Informe um e-mail válido.' : null,
  };
  const valido = !erros.nome && !erros.tel && !erros.email;

  async function salvar() {
    setTentou(true);
    if (!valido || salvando) return;
    setSalvando(true);
    try {
      const u = await usuariosApi.atualizarMe({
        nome: nome.trim(),
        tel_celular: soDigitos(tel),
        email: email.trim().toLowerCase(),
        sexo,
        ...(idGenero !== '' ? { id_genero: Number(idGenero) } : {}),
      });
      definirUsuario(u);
      setTentou(false);
      avisar({ titulo: 'Dados salvos', texto: 'As alterações do seu cadastro foram salvas.' });
    } catch (e) {
      avisar({ tipo: 'error', titulo: 'Não foi possível salvar', texto: mensagemErro(e) });
    } finally {
      setSalvando(false);
    }
  }

  const criterios = criteriosSenha(nova, { valor: atual, rotulo: 'Diferente da senha atual' });
  const tudo = criterios.every((c) => c[1]);
  const confere = conf.length > 0 && conf === nova;
  const pode = atual.length > 0 && tudo && confere;

  async function trocarSenha() {
    if (!pode || trocando) return;
    setTrocando(true);
    setErroSenha(null);
    try {
      await usuariosApi.trocarSenha(atual, nova);
      setTrocada(true);
    } catch (e) {
      setErroSenha(mensagemErro(e));
    } finally {
      setTrocando(false);
    }
  }

  async function operar(fn: () => Promise<VinculoUnidade[]>, msg: string) {
    setOcupado(true);
    try {
      const lista = await fn();
      if (usuario) definirUsuario({ ...usuario, unidades: lista });
      avisar({ titulo: 'Unidades atualizadas', texto: msg });
      void recarregar();
    } catch (e) {
      avisar({ tipo: 'error', titulo: 'Não foi possível alterar as unidades', texto: mensagemErro(e) });
    } finally {
      setOcupado(false);
      setJanela(null);
    }
  }

  const unidades = ordenarUnidades(usuario.unidades);
  const textoUnidades = unidades.map((u) => u.unidade_atendimento.nome + (u.sede ? ' (sede)' : '')).join(' · ') || '—';

  return (
    <>
      <PageHead
        migalhas={[{ rotulo: 'Início', para: '/atendimentos' }, { rotulo: 'Meu perfil' }]}
        voltar="/atendimentos"
        gapTitulo={16}
        titulo={
          <>
            <span className="avatar" aria-hidden="true" style={{ width: 64, height: 64, lineHeight: '64px', fontSize: 20 }}>
              {iniciais(usuario.nome)}
            </span>
            <div>
              <div className="title-row">
                <h1>Meu perfil</h1>
              </div>
            </div>
          </>
        }
      />

      <div className="page-body">
        <section className="panel">
          <header>
            <h2>Dados pessoais</h2>
          </header>
          <div className="pb">
            <Campo id="nome" rotulo="Nome completo" obrigatorio erro={tentou ? erros.nome : null}>
              <Entrada id="nome" type="text" maxLength={70} valor={nome} aoMudar={setNome} invalido={tentou && !!erros.nome} />
            </Campo>
            <div className="cols-2">
              <Campo rotulo="CPF" estatico>
                <SoLeitura valor={cpfMascarado(usuario.cpf)} />
              </Campo>
              <Campo id="tel" rotulo="Celular" obrigatorio erro={tentou ? erros.tel : null}>
                <Entrada id="tel" type="tel" inputMode="numeric" valor={tel} aoMudar={(v) => setTel(telefone(v))} invalido={tentou && !!erros.tel} />
              </Campo>
            </div>
            <Campo
              id="email"
              rotulo="E-mail"
              obrigatorio
              erro={tentou ? erros.email : null}
              ajuda="E-mail e celular não podem estar em outro cadastro."
            >
              <Entrada id="email" type="email" maxLength={50} valor={email} aoMudar={setEmail} invalido={tentou && !!erros.email} />
            </Campo>
            <div className="cols-2">
              <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <legend className="ps-label" style={{ padding: 0, marginBottom: 6 }}>
                  Sexo
                </legend>
                <Seg opcoes={SEXOS} valor={sexo} aoMudar={setSexo} />
              </fieldset>
              <Campo id="gen" rotulo="Gênero" opcional>
                <Select id="gen" valor={idGenero} aoMudar={(v) => setIdGenero(v ? Number(v) : '')}>
                  <option value="">Prefiro não informar</option>
                  {generos.map((g) => (
                    <option key={g.id_genero} value={g.id_genero}>
                      {g.nome}
                    </option>
                  ))}
                </Select>
              </Campo>
            </div>
          </div>
        </section>

        <section className="panel">
          <header>
            <PanelTitle
              dica={
                ehMaximo
                  ? 'A profissão foi definida no cadastro. As suas unidades e a sua sede você mesmo(a) gerencia aqui.'
                  : 'Definidas no cadastro. Hoje não podem ser alteradas pelo perfil.'
              }
            >
              Atuação
            </PanelTitle>
            {ehMaximo && (
              <button type="button" className="ps-btn primary sm" onClick={() => setJanela('vincular')}>
                <IcMais />
                Vincular unidade
              </button>
            )}
          </header>
          <div className="pb">
            <div className="cols-2">
              <Campo rotulo="Profissão" estatico>
                <SoLeitura valor={usuario.profissao?.nome ?? '—'} cadeado={false} />
              </Campo>
              {!ehMaximo && (
                <Campo rotulo={unidades.length > 1 ? 'Unidades de atendimento' : 'Unidade de atendimento'} estatico>
                  <SoLeitura valor={textoUnidades} cadeado={false} />
                </Campo>
              )}
            </div>
            {ehMaximo && (
              <>
                {unidades.map((un) => (
                  <ItemUnidade
                    key={un.id_unidade_atendimento}
                    un={un}
                    so1={unidades.length === 1}
                    gerir
                    aoTornarSede={() => setJanela({ sede: un })}
                    aoTirar={() => setJanela({ tirar: un })}
                  />
                ))}
                <p className="ps-results-meta" style={{ margin: 0 }}>
                  Sempre fica pelo menos uma unidade. Para desvincular a sede, marque outra unidade como sede antes.
                </p>
              </>
            )}
          </div>
        </section>

        <div className="page-actions">
          <button
            type="button"
            className="ps-btn secondary cancelar"
            onClick={() => {
              preencher();
              setTentou(false);
            }}
          >
            Cancelar
          </button>
          <button type="button" className="ps-btn primary" onClick={() => void salvar()} aria-busy={salvando}>
            {salvando ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>

        <section className="panel">
          <header>
            <h2>Segurança</h2>
          </header>
          <div className="pb">
            <div className="ps-field">
              <label className="ps-label" htmlFor="s0">
                Senha atual{' '}
                <span className="req" aria-hidden="true">
                  *
                </span>
              </label>
              <EntradaSenha id="s0" valor={atual} aoMudar={setAtual} autoComplete="current-password" />
            </div>
            <div className="cols-2">
              <div className="ps-field">
                <label className="ps-label" htmlFor="s1">
                  Nova senha{' '}
                  <span className="req" aria-hidden="true">
                    *
                  </span>
                </label>
                <EntradaSenha id="s1" valor={nova} aoMudar={setNova} autoComplete="new-password" />
              </div>
              <div className="ps-field">
                <label className="ps-label" htmlFor="s2">
                  Confirmar nova senha{' '}
                  <span className="req" aria-hidden="true">
                    *
                  </span>
                </label>
                <EntradaSenha
                  id="s2"
                  valor={conf}
                  aoMudar={setConf}
                  autoComplete="new-password"
                  estado={conf.length > 0 ? (confere ? 'sucesso' : 'erro') : null}
                />
                {conf.length > 0 && (
                  <div className={'ps-helper ' + (confere ? 'success' : 'error')}>{confere ? 'As senhas conferem.' : 'As senhas não conferem.'}</div>
                )}
              </div>
            </div>
            <ListaCriterios criterios={criterios} rotulo="Critérios da nova senha" />
            {erroSenha && <div className="ps-helper error">{erroSenha}</div>}
          </div>
          <footer style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="ps-results-meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 17 }}>
              <IcInfo style={{ width: 18, height: 18, color: 'var(--Link)' }} />A nova senha vale a partir do próximo login.
            </span>
            <button
              type="button"
              className="ps-btn primary"
              aria-disabled={!pode}
              data-tip={pode ? '' : 'Preencha a senha atual e atenda a todos os critérios'}
              onClick={() => void trocarSenha()}
              aria-busy={trocando}
            >
              <IcCadeado />
              {trocando ? 'Alterando…' : 'Alterar senha'}
            </button>
          </footer>
        </section>
      </div>

      {trocada && (
        <Modal
          alerta
          icone="ok"
          titulo="Senha alterada"
          rodape={
            <button
              type="button"
              className="ps-btn primary"
              onClick={() => {
                setTrocada(false);
                setAtual('');
                setNova('');
                setConf('');
              }}
            >
              Entendi
            </button>
          }
        >
          Pronto! Use a nova senha no próximo acesso ao painel.
        </Modal>
      )}

      {janela === 'vincular' && (
        <ModalVincular
          nome="você"
          fem={false}
          texto="Escolha outra unidade em que você atende."
          jaVinculadas={unidades.map((x) => x.id_unidade_atendimento)}
          ocupado={ocupado}
          aoFechar={() => setJanela(null)}
          aoVincular={(idUn, sede, nomeUn) => void operar(() => usuariosApi.vincularPropria(idUn, sede), `${nomeUn} foi vinculada a você.`)}
        />
      )}
      {janela && typeof janela === 'object' && 'sede' in janela && (
        <ConfirmaSimples
          titulo="Trocar a sede?"
          texto={`${janela.sede.unidade_atendimento.nome} passa a ser a sua sede. A sede atual continua vinculada.`}
          botao="Trocar sede"
          ocupado={ocupado}
          aoFechar={() => setJanela(null)}
          aoConfirmar={() =>
            void operar(
              () => usuariosApi.trocarSedePropria(janela.sede.id_unidade_atendimento),
              `${janela.sede.unidade_atendimento.nome} agora é a sua sede.`,
            )
          }
        />
      )}
      {janela && typeof janela === 'object' && 'tirar' in janela && (
        <ConfirmaSimples
          titulo="Desvincular unidade?"
          texto={`${janela.tirar.unidade_atendimento.nome} deixa de aparecer entre as suas unidades.`}
          botao="Desvincular"
          perigo
          ocupado={ocupado}
          aoFechar={() => setJanela(null)}
          aoConfirmar={() =>
            void operar(
              () => usuariosApi.desvincularPropria(janela.tirar.id_unidade_atendimento),
              `${janela.tirar.unidade_atendimento.nome} foi desvinculada.`,
            )
          }
        />
      )}
    </>
  );
}
