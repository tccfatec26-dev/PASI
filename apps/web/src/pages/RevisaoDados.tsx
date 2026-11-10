import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import * as apoio from '../api/apoio';
import { atualizarMe, confirmarDados } from '../api/usuarios';
import { mensagemErro } from '../api/client';
import type { Profissao } from '../api/types';
import { PageHead, PanelTitle } from '../components/Layout';
import { Alerta, Campo, Entrada, Select, SoLeitura } from '../components/Form';
import { Seg } from '../components/Seg';
import { resetarSlides, Slide } from '../components/Slide';
import { Modal, ModalCerteza } from '../components/Modal';
import { ListaUnidadesKv } from '../components/Unidades';
import { Ic, D } from '../components/icons';
import { cpfMascarado, iniciais, soDigitos, telefone } from '../lib/format';
import { nomePerfil, SEXOS } from '../lib/perfil';

/** 2.1 Revisão dos dados em Pendência II (RevisaoDados.dc.html, RN-USR-09). */
export function RevisaoDados() {
  const { usuario, recarregar } = useAuth();
  const navegar = useNavigate();
  const [nome, setNome] = useState(usuario?.nome ?? '');
  const [tel, setTel] = useState(telefone(usuario?.tel_celular ?? ''));
  const [sexo, setSexo] = useState(usuario?.sexo ?? 'F');
  const [idProfissao, setIdProfissao] = useState<number | ''>(usuario?.id_profissao ?? '');
  const [profissoes, setProfissoes] = useState<Profissao[]>([]);
  const [marcado, setMarcado] = useState(false);
  const [certeza, setCerteza] = useState(false);
  const [ok, setOk] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tentou, setTentou] = useState(false);

  useEffect(() => {
    apoio.profissoes().then(setProfissoes).catch(() => undefined);
  }, []);

  const erros = {
    nome: !nome.trim() ? 'Informe o nome completo.' : null,
    tel: soDigitos(tel).length < 10 ? 'Informe o celular com DDD.' : null,
    prof: idProfissao === '' ? 'Escolha a profissão.' : null,
  };
  const valido = !erros.nome && !erros.tel && !erros.prof;

  async function confirmar() {
    setEnviando(true);
    setErro(null);
    try {
      await atualizarMe({
        nome: nome.trim(),
        tel_celular: soDigitos(tel),
        sexo,
        id_profissao: Number(idProfissao),
      });
      await confirmarDados();
      setCerteza(false);
      // o cadastro novo (Deferido) só é carregado ao sair, para o aviso aparecer aqui
      setOk(true);
    } catch (e) {
      setCerteza(false);
      setErro(mensagemErro(e));
      resetarSlides();
    } finally {
      setEnviando(false);
    }
  }

  if (!usuario) return null;

  return (
    <>
      <PageHead
        migalhas={[{ rotulo: 'Início', para: '/inicio' }, { rotulo: 'Meu perfil' }]}
        voltar="/inicio"
        estiloBloco={{ flex: 1 }}
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
            <span className="ps-badge info" style={{ marginLeft: 'auto' }}>
              <Ic d={D.lapisLinha} />
              Pendência II – Revisão de dados
            </span>
          </>
        }
        gapTitulo={16}
      />

      <div className="page-body">
        <Alerta tipo="warning" titulo="Revise e confirme os seus dados para liberar o painel">
          Estes dados foram cadastrados pela gestão da sua unidade. Corrija o que for preciso e confirme no fim da página. Enquanto
          não confirmar, só esta tela fica disponível.
        </Alerta>

        {erro && (
          <Alerta tipo="error" titulo="Não foi possível confirmar">
            {erro}
          </Alerta>
        )}

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
                <Entrada
                  id="tel"
                  type="tel"
                  inputMode="numeric"
                  valor={tel}
                  aoMudar={(v) => setTel(telefone(v))}
                  invalido={tentou && !!erros.tel}
                />
              </Campo>
            </div>
            <Campo rotulo="E-mail" estatico ajuda="O e-mail não muda nesta etapa. Se estiver errado, fale com a gestão da sua unidade.">
              <SoLeitura valor={usuario.email} />
            </Campo>
            <div className="cols-2">
              <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <legend className="ps-label" style={{ padding: 0, marginBottom: 6 }}>
                  Sexo{' '}
                  <span className="req" aria-hidden="true">
                    *
                  </span>
                </legend>
                <Seg opcoes={SEXOS} valor={sexo} aoMudar={setSexo} />
              </fieldset>
              <Campo id="prof" rotulo="Profissão" obrigatorio erro={tentou ? erros.prof : null}>
                <Select id="prof" valor={idProfissao} aoMudar={(v) => setIdProfissao(v ? Number(v) : '')} invalido={tentou && !!erros.prof}>
                  <option value="">Selecione</option>
                  {profissoes.map((p) => (
                    <option key={p.id_profissao} value={p.id_profissao}>
                      {p.nome}
                    </option>
                  ))}
                </Select>
              </Campo>
            </div>
          </div>
        </section>

        <section className="panel">
          <header>
            <PanelTitle dica="Definidos pela gestão. Se algo estiver errado, fale com o gestor da sua unidade.">Perfil e unidades</PanelTitle>
          </header>
          <div className="pb">
            <div className="kv">
              <div>
                <span>Perfil</span>
                <strong className="bul">{nomePerfil(usuario.id_tipo_usuario)}</strong>
              </div>
              <div>
                <span>Unidades de atendimento</span>
                <ListaUnidadesKv unidades={usuario.unidades ?? []} />
              </div>
            </div>
          </div>
        </section>

        <hr className="sep-claro" aria-hidden="true" />

        <section className="panel confirm-card" aria-label="Confirmação dos dados">
          <div className="confirm-foot">
            <button
              type="button"
              className={'ps-check confirm' + (marcado ? ' is-checked' : '')}
              aria-pressed={marcado}
              onClick={() => {
                if (!marcado && !valido) {
                  setTentou(true);
                  return;
                }
                setMarcado(!marcado);
              }}
              style={{ fontSize: 18 }}
            >
              <span className="ps-box">{marcado ? '✓' : ''}</span>
              <span>Conferi e confirmo que os meus dados estão corretos.</span>
            </button>
            <Slide
              classeExtra="confirm-slide"
              texto="Deslize para confirmar"
              rotuloAcessivel="Deslize para confirmar os seus dados"
              liberado={marcado && valido}
              dicaBloqueado="Marque a caixa de confirmação para liberar"
              ajuda={marcado ? 'Arraste até o fim para confirmar. No teclado, use as setas.' : 'Marque a caixa ao lado para liberar.'}
              rotuloBotao="Confirmar dados"
              aoConcluir={() => setCerteza(true)}
            />
          </div>
        </section>
      </div>

      {certeza && (
        <ModalCerteza
          rotulo="Sim, confirmar"
          ocupado={enviando}
          aoCancelar={() => {
            setCerteza(false);
            resetarSlides();
          }}
          aoConfirmar={() => void confirmar()}
        />
      )}

      {ok && (
        <Modal
          alerta
          icone="ok"
          titulo="Dados confirmados"
          rodape={
            <button
              type="button"
              className="ps-btn primary"
              onClick={async () => {
                await recarregar();
                navegar('/atendimentos', { replace: true });
              }}
            >
              Ir para atendimentos
            </button>
          }
        >
          Pronto! O seu cadastro passou para Deferido e o painel está liberado.
        </Modal>
      )}
    </>
  );
}
