import { useState } from 'react';
import { useParams } from 'react-router-dom';
import * as gestao from '../api/gestao';
import { mensagemErro } from '../api/client';
import { SituacaoUsuario, TipoUsuario, type VinculoUnidade } from '../api/types';
import { useCarregar } from '../hooks';
import { PageHead, PanelTitle } from '../components/Layout';
import { Alerta } from '../components/Form';
import { Estado } from '../components/Estado';
import { ConfirmaSimples, ItemUnidade, ModalVincular } from '../components/GestaoUnidades';
import { ModalAcaoUsuario, type AcaoUsuario } from '../components/AcoesUsuario';
import { D, Ic, IcCadeado, IcCheck, IcInativar, IcMais } from '../components/icons';
import { cpf, data, dataHora, iniciais, primeiroNome, telefone } from '../lib/format';
import { ordenarUnidades, SEXOS } from '../lib/perfil';
import { PERFIS, SITUACOES } from '../lib/usuarios';


const ACOES_LOG: Record<string, string> = {
  'Cadastrar usuário': 'Profissional cadastrado',
  'Reenviar senha provisória': 'Senha provisória reenviada',
  'Corrigir e-mail': 'E-mail corrigido',
  'Inativar usuário': 'Usuário inativado',
  'Reativar usuário': 'Usuário reativado',
  'Promover a máximo': 'Promovido a máximo',
  'Vincular unidade': 'Unidade vinculada',
  'Desvincular unidade': 'Unidade desvinculada',
  'Trocar sede': 'Sede trocada',
};

type Janela = null | 'vincular' | { sede: VinculoUnidade } | { tirar: VinculoUnidade } | { acao: AcaoUsuario };

/** 5.2 Detalhe do usuário (UsuarioDetalhe.dc.html) — só o máximo. */
export function UsuarioDetalhe() {
  const { id } = useParams();
  const idU = Number(id);
  const { dados: u, setDados, carregando, erro, recarregar } = useCarregar(() => gestao.detalhar(idU), [idU]);
  const [janela, setJanela] = useState<Janela>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (carregando && !u) return <Estado texto="Carregando usuário…" />;
  if (erro || !u) return <Estado texto={erro ?? 'Usuário não encontrado.'} erro />;

  const perfil = PERFIS[u.id_tipo_usuario] ?? PERFIS[TipoUsuario.PACIENTE];
  const sit = SITUACOES[u.id_situacao_usuario];
  const ehMax = u.id_tipo_usuario === TipoUsuario.MAXIMO;
  const ehPac = u.id_tipo_usuario === TipoUsuario.PACIENTE;
  const ehP1 = u.id_situacao_usuario === SituacaoUsuario.PENDENCIA_I;
  const p = u.permissoes;
  const nome1 = primeiroNome(u.nome);
  const unidades = ordenarUnidades(u.unidades);
  const so1 = unidades.length === 1;
  const fem = u.sexo === 'F';
  const expira = u.senha_provisoria_expira_em;
  const vencida = expira ? new Date(expira).getTime() < Date.now() : false;

  async function operar(fn: () => Promise<VinculoUnidade[]>, msg: string) {
    if (!u) return;
    setOcupado(true);
    setErroAcao(null);
    try {
      const lista = await fn();
      setDados({ ...u, unidades: lista });
      setJanela(null);
      setAviso(msg);
      void recarregar();
    } catch (e) {
      setErroAcao(mensagemErro(e));
      setJanela(null);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="pg-usuario" style={{ display: 'contents' }}>
      <PageHead
        migalhas={[{ rotulo: 'Início', para: '/atendimentos' }, { rotulo: 'Usuários', para: '/usuarios' }, { rotulo: u.nome }]}
        voltar="/usuarios"
        linhaTitulo="flex"
        antesDoTitulo={
          <span className="avatar" aria-hidden="true" style={{ width: 48, height: 48, lineHeight: '48px', fontSize: 16 }}>
            {iniciais(u.nome)}
          </span>
        }
        titulo={<h1>{u.nome}</h1>}
        extra={
          <>
            <span className={perfil.c}>{perfil.t}</span>
            {sit && (
              <span className={sit.c}>
                <Ic d={sit.i} />
                {sit.t}
              </span>
            )}
            <span className={u.ativo ? 'ps-badge success' : 'ps-badge neutral'}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
          </>
        }
      />

      <div className="page-body">
        {aviso && (
          <Alerta tipo="success" titulo="Pronto">
            {aviso}
          </Alerta>
        )}
        {erroAcao && (
          <Alerta tipo="error" titulo="Não foi possível concluir">
            {erroAcao}
          </Alerta>
        )}
        {ehMax && p.somente_leitura && (
          <div className="ps-alert info">
            <IcCadeado lg style={{ color: 'var(--Link)' }} />
            <div className="body">
              <strong>Somente leitura</strong>
              Um máximo não altera, inativa nem rebaixa outro máximo. As unidades e a sede de um máximo são cuidadas por ele mesmo, na
              tela Meu perfil.
            </div>
          </div>
        )}
        {ehP1 && (
          <div className="ps-alert warning">
            <Ic d={D.cadeadoAberto} lg style={{ color: 'var(--Warning)' }} />
            <div className="body">
              <strong>Aguardando o primeiro acesso</strong>
              {expira
                ? `A senha provisória enviada para ${u.email} ${vencida ? 'venceu' : 'vence'} em ${dataHora(expira)}. `
                : `A senha provisória foi enviada para ${u.email}. `}
              Até trocar a senha, {nome1} não consegue usar o sistema.
            </div>
          </div>
        )}

        <div className="split">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <section className="panel">
              <header>
                <h2>Dados do usuário</h2>
              </header>
              <div className="pb">
                <div className="kv">
                  <div>
                    <span>ID de Acesso</span>
                    <strong>{u.id_usuario}</strong>
                  </div>
                  <div>
                    <span>CPF</span>
                    <strong>{cpf(u.cpf)}</strong>
                  </div>
                  <div>
                    <span>E-mail</span>
                    <strong>{u.email}</strong>
                  </div>
                  <div>
                    <span>Celular</span>
                    <strong>{telefone(u.tel_celular)}</strong>
                  </div>
                  <div>
                    <span>Sexo</span>
                    <strong>{SEXOS.find((s) => s.valor === u.sexo)?.rotulo ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Profissão</span>
                    <strong>{u.profissao?.nome ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Cadastrado em</span>
                    <strong>{data(u.dt_cadastro)}</strong>
                  </div>
                  <div>
                    <span>Cadastrado por</span>
                    <strong>{u.cadastrado_por?.nome ?? (ehPac ? 'Própria pessoa (app)' : '—')}</strong>
                  </div>
                </div>
              </div>
            </section>

            {!ehPac && (
              <section className="panel">
                <header>
                  <PanelTitle
                    dica={
                      ehMax
                        ? `Privilégio máximo vê todas as unidades; estas são as unidades em que ${fem ? 'ela' : 'ele'} trabalha.`
                        : `${fem ? 'Ela' : 'Ele'} vê e avalia só os atendimentos destas unidades.`
                    }
                  >
                    Unidades de atendimento
                  </PanelTitle>
                  {p.gerir_unidades && (
                    <button type="button" className="ps-btn primary sm" onClick={() => setJanela('vincular')}>
                      <IcMais />
                      Vincular unidade
                    </button>
                  )}
                </header>
                <div className="pb">
                  {unidades.map((un) => (
                    <ItemUnidade
                      key={un.id_unidade_atendimento}
                      un={un}
                      so1={so1}
                      gerir={p.gerir_unidades}
                      aoTornarSede={() => setJanela({ sede: un })}
                      aoTirar={() => setJanela({ tirar: un })}
                    />
                  ))}
                  {p.gerir_unidades && (
                    <p className="ps-results-meta" style={{ margin: 0 }}>
                      Sempre fica pelo menos uma unidade. Para desvincular a sede, marque outra unidade como sede antes.
                    </p>
                  )}
                </div>
              </section>
            )}

            <section className="panel">
              <header>
                <h2>Histórico</h2>
              </header>
              <div className="table-wrap">
                <table className="tbl" style={{ minWidth: 560 }}>
                  <thead>
                    <tr>
                      <th>Data e hora</th>
                      <th>Ação</th>
                      <th>Por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {u.historico.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="vazio">
                          Nenhuma ação de gestão registrada.
                        </td>
                      </tr>
                    ) : (
                      u.historico.map((h) => (
                        <tr key={h.id}>
                          <td className="num">{dataHora(h.data).replace(' às ', ' ')}</td>
                          <td>
                            <strong style={{ fontWeight: 600 }}>{ACOES_LOG[h.acao] ?? h.acao}</strong>
                            {h.detalhe && <small>{h.detalhe}</small>}
                          </td>
                          <td>{h.por?.nome ?? '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <aside className="panel">
            <header>
              <h2>Ações</h2>
            </header>
            <div className="pb">
              {p.reenviar_senha && (
                <button type="button" className="ps-btn primary block" onClick={() => setJanela({ acao: 'reenviar' })}>
                  <Ic d="M3 6h18v12H3zM3 7l9 6 9-6" />
                  Reenviar senha provisória
                </button>
              )}
              {p.corrigir_email && (
                <button type="button" className="ps-btn secondary block" onClick={() => setJanela({ acao: 'email' })}>
                  <Ic d={D.lapisLinha} />
                  Corrigir e-mail
                </button>
              )}
              {p.promover && (
                <button type="button" className="ps-btn secondary block" onClick={() => setJanela({ acao: 'promover' })}>
                  <Ic d="M12 19V5M5 12l7-7 7 7" />
                  Promover a máximo
                </button>
              )}
              {p.inativar && (
                <button type="button" className="ps-btn danger-outline block" onClick={() => setJanela({ acao: 'inativar' })}>
                  <IcInativar />
                  Inativar usuário
                </button>
              )}
              {p.reativar && (
                <button type="button" className="ps-btn secondary block" onClick={() => setJanela({ acao: 'reativar' })}>
                  <IcCheck />
                  Reativar usuário
                </button>
              )}
              {p.promover && (
                <p className="ps-results-meta" style={{ margin: 0 }}>
                  Promover não pode ser desfeito pela tela: entre máximos, ninguém altera ninguém.
                </p>
              )}
              {p.corrigir_email && (
                <p className="ps-results-meta" style={{ margin: 0 }}>
                  Errou o e-mail no cadastro? Corrija aqui: a nova senha provisória vai para o e-mail corrigido.
                </p>
              )}
              {ehMax && p.somente_leitura && !p.reenviar_senha && !p.corrigir_email && (
                <p style={{ margin: 0, font: '400 14px/1.5 var(--font-sans)', color: 'var(--Text-muted)' }}>
                  Nenhuma ação disponível para outro usuário de privilégio máximo.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      {janela === 'vincular' && (
        <ModalVincular
          nome={nome1}
          fem={fem}
          jaVinculadas={unidades.map((x) => x.id_unidade_atendimento)}
          ocupado={ocupado}
          aoFechar={() => setJanela(null)}
          aoVincular={(idUn, sede, nomeUn) =>
            void operar(() => gestao.vincularUnidade(u.id_usuario, idUn, sede), `${nomeUn} foi vinculada a ${u.nome}.`)
          }
        />
      )}
      {janela && typeof janela === 'object' && 'sede' in janela && (
        <ConfirmaSimples
          titulo="Trocar a sede?"
          texto={`${janela.sede.unidade_atendimento.nome} passa a ser a sede de ${nome1}. A sede atual continua vinculada.`}
          botao="Trocar sede"
          ocupado={ocupado}
          aoFechar={() => setJanela(null)}
          aoConfirmar={() =>
            void operar(
              () => gestao.trocarSede(u.id_usuario, janela.sede.id_unidade_atendimento),
              `${janela.sede.unidade_atendimento.nome} agora é a sede de ${u.nome}.`,
            )
          }
        />
      )}
      {janela && typeof janela === 'object' && 'tirar' in janela && (
        <ConfirmaSimples
          titulo="Desvincular unidade?"
          texto={`${nome1} deixa de ver os atendimentos de ${janela.tirar.unidade_atendimento.nome}.`}
          botao="Desvincular"
          perigo
          ocupado={ocupado}
          aoFechar={() => setJanela(null)}
          aoConfirmar={() =>
            void operar(
              () => gestao.desvincularUnidade(u.id_usuario, janela.tirar.id_unidade_atendimento),
              `${janela.tirar.unidade_atendimento.nome} foi desvinculada de ${u.nome}.`,
            )
          }
        />
      )}
      {janela && typeof janela === 'object' && 'acao' in janela && (
        <ModalAcaoUsuario
          acao={janela.acao}
          alvo={u}
          aoFechar={() => setJanela(null)}
          aoConcluir={(msg) => {
            setJanela(null);
            setAviso(msg);
            void recarregar();
          }}
        />
      )}
    </div>
  );
}
