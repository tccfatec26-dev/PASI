import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TextInput, Linking, AppState } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TouchableOpacity } from '../acessibilidade/Leitura';
import { falar, lerAviso } from '../acessibilidade/fala';
import { useCores } from '../acessibilidade/useTema';
import { ScreenHeader } from '../components/ScreenHeader';
import { TelaComTeclado, useTecladoAberto } from '../components/TelaComTeclado';
import { useAuth } from '../context/AuthContext';
import { PacienteNavProp, PacienteStackParamList } from '../navigation/types';
import { acordarApi, novaSessao, perguntar, ServicoIndicado } from '../services/assistente';
import { atendimentosService, Atendimento } from '../services/atendimentos';
import { apoioService } from '../services/apoio';
import { SituacaoAtendimento, SituacaoFormulario } from '../constants/dominio';
import { formatProtocolo } from '../utils/format';
import {
  MENSAGEM_RISCO,
  OPCOES_INICIAIS,
  OPCOES_TRIAGEM,
  SERVICOS,
  classificar,
  formatarCep,
  indicaRisco,
  linkDoMapa,
  opcoesDepoisDoServico,
  Opcao,
  TipoServico,
} from '../assistente/servicos';
import { TOPICOS, TOPICOS_POR_ID } from '../assistente/conteudo';
import { TextoFormatado } from '../assistente/TextoFormatado';
import { ControleConversa, MENSAGEM_INATIVIDADE } from '../assistente/conversa';
import {
  OrigemServico,
  Resolucao,
  UnidadeDoUsuario,
  Vinculo,
  chaveDoVinculo,
  contextoParaIa,
  resolverVinculo,
  unidadesDoUsuario,
  vinculoDoAtendimento,
  vinculoEscolhido,
} from '../assistente/vinculo';

/**
 * Assistente digital do PASI no app: a mesma conversa da landing page
 * (landing-page/src/components/Assistente/Assistente.tsx), com a mesma API (PASIBot), os mesmos
 * botões de triagem, cartões de serviço, busca por CEP e mensagem de risco. No app ela também:
 *  - cumprimenta pelo nome e explica como usar o aplicativo;
 *  - liga a conversa à unidade em que o paciente já é atendido (assistente/vinculo.ts), a partir
 *    do formulário com dúvida ou do serviço indicado pela IA;
 *  - descarta respostas atrasadas de uma conversa encerrada (Recomeçar ou 15 min sem atividade,
 *    ver assistente/conversa.ts).
 * Todas as cores vêm do tema (claro, escuro, alto contraste).
 */

type Mensagem =
  | { id: number; autor: 'pessoa'; texto: string }
  | { id: number; autor: 'assistente'; texto: string; opcoes?: Opcao[]; mapa?: string; fontes?: string[] }
  | { id: number; autor: 'assistente'; servico: TipoServico; opcoes?: Opcao[] };

type NovaMensagem = Mensagem extends infer M ? (M extends Mensagem ? Omit<M, 'id'> : never) : never;

type ModoCep = { servico: TipoServico | null } | null;

const ATRASO_DEMORA_MS = 6000;
/** De quanto em quanto tempo a tela confere a inatividade (o limite é 15 min). */
const VERIFICAR_INATIVIDADE_MS = 30_000;

const primeiroNome = (nome?: string) => (nome ?? '').trim().split(/\s+/)[0] || '';

/** Texto sem os símbolos de markdown, para a leitura em voz alta. */
const paraFala = (t: string) =>
  t
    .replace(/\*\*?([^*]+)\*\*?/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/https?:\/\/\S+/g, '');

const pendentesDe = (a: Atendimento) =>
  a.atendimento_formulario.filter(
    (af) =>
      !af.status_formulario_paciente ||
      af.status_formulario_paciente.id_situacao_formulario < SituacaoFormulario.RESPONDIDO,
  ).length;

/** Situações em que o paciente ainda pode responder formulários. */
const SITUACOES_RESPONDIVEIS: number[] = [
  SituacaoAtendimento.CRIADO,
  SituacaoAtendimento.INICIADO,
  SituacaoAtendimento.RESPONDIDO,
];

function boasVindas(nome: string): NovaMensagem[] {
  return [
    {
      autor: 'assistente',
      texto:
        `Oi${nome ? `, ${nome}` : ''}! Eu sou a assistente digital do PASI.\n` +
        'Posso te ajudar a descobrir qual serviço procurar (CRAS, CAPS ou CREAS), encontrar a unidade mais perto de você e tirar dúvidas sobre o aplicativo.',
    },
    {
      autor: 'assistente',
      texto: 'Sobre o que você precisa de ajuda? Escolha uma opção ou escreva com suas palavras.',
      opcoes: OPCOES_INICIAIS,
    },
  ];
}

const OPCOES_APP: Opcao[] = [
  ...TOPICOS.map((t) => ({ rotulo: t.pergunta, acao: { tipo: 'topico' as const, topico: t.id } })),
  { rotulo: 'Voltar ao início', acao: { tipo: 'inicio' } },
];

/** Por que a conversa foi ligada a esta unidade (o critério aparece para a pessoa). */
function motivoDoVinculo(v: Vinculo, atendimentos: Atendimento[]) {
  if (v.origem === 'formulario' && v.idAtendimento) {
    const a = atendimentos.find((x) => x.id_atendimento === v.idAtendimento);
    return `a sua dúvida é sobre o atendimento ${a ? formatProtocolo(a.id_atendimento, a.dt_cadastro) : ''}, que é dessa unidade`;
  }
  if (v.origem === 'escolha') return 'foi a unidade que você escolheu';
  return `é o ${v.servico} em que você já é atendido(a)`;
}

export function AssistenteScreen() {
  const cores = useCores();
  const insets = useSafeAreaInsets();
  const tecladoAberto = useTecladoAberto();
  const navigation = useNavigation<PacienteNavProp>();
  const params = useRoute<RouteProp<PacienteStackParamList, 'Assistente'>>().params;
  const { usuario } = useAuth();
  const nome = primeiroNome(usuario?.nome);

  const proximoId = useRef(1);
  const comId = (novas: NovaMensagem[]) => novas.map((m) => ({ ...m, id: proximoId.current++ }) as Mensagem);

  const [mensagens, setMensagens] = useState<Mensagem[]>(() => comId(boasVindas(nome)));
  const [rascunho, setRascunho] = useState('');
  const [pensando, setPensando] = useState(false);
  const [demorando, setDemorando] = useState(false);
  const [modoCep, setModoCep] = useState<ModoCep>(null);
  const [ultimoServico, setUltimoServico] = useState<TipoServico | null>(null);
  const [encerrada, setEncerrada] = useState(false);

  // dados do paciente para o vínculo: atendimentos e as unidades deles (null = ainda carregando)
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([]);
  const [unidades, setUnidades] = useState<UnidadeDoUsuario[] | null>(null);
  const [vinculo, setVinculo] = useState<Vinculo | null>(null);

  const controle = useRef(new ControleConversa());
  const sessao = useRef(novaSessao());
  const contextoEnviado = useRef(false);
  /** Vínculo já informado à IA nesta sessão (manda o contexto só quando muda). */
  const vinculoInformado = useRef('');
  /** Último serviço indicado pela IA já tratado (para não repetir a mesma pergunta). */
  const servicoIaTratado = useRef('');
  const rolagem = useRef<ScrollView>(null);
  const campo = useRef<TextInput>(null);

  // ---------- mensagens ----------
  const adicionar = (...novas: NovaMensagem[]) => {
    setMensagens((atuais) => [...atuais, ...comId(novas)]);
    // TalkBack e leitura em voz alta: a última resposta da assistente é anunciada
    const ultimaTexto = [...novas].reverse().find((m) => m.autor === 'assistente' && 'texto' in m);
    if (ultimaTexto && 'texto' in ultimaTexto) lerAviso(paraFala(ultimaTexto.texto));
  };

  // ---------- carga inicial ----------
  useEffect(() => {
    acordarApi();
    let ativo = true;
    Promise.all([
      atendimentosService.listar({ page: 1, limit: 50, ordenar_por: 'data_desc' }),
      apoioService.getUnidades(),
    ])
      .then(([lista, cadastro]) => {
        if (!ativo) return;
        setAtendimentos(lista.data);
        setUnidades(unidadesDoUsuario(lista.data, cadastro, [SituacaoAtendimento.INATIVO]));
      })
      .catch(() => {
        // sem os dados, a conversa segue normalmente, só não liga a nenhuma unidade
        if (ativo) setUnidades([]);
      });
    const controleDaTela = controle.current;
    return () => {
      ativo = false;
      controleDaTela.encerrar(); // saiu da tela: cancela o que estiver pendente
    };
  }, []);

  // quando os dados chegam: contexto do formulário (veio da tela do formulário) ou dos pendentes
  const contextoInicialMostrado = useRef(false);
  useEffect(() => {
    if (unidades === null || contextoInicialMostrado.current) return;
    contextoInicialMostrado.current = true;
    mostrarContextoInicial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unidades]);

  /** `atual`: vínculo em vigor (null logo depois de recomeçar, antes do estado atualizar). */
  const mostrarContextoInicial = (lista = unidades ?? [], atual: Vinculo | null = vinculo) => {
    if (params?.idAtendimento) {
      const r = vinculoDoAtendimento(params.idAtendimento, lista);
      if (r.status === 'vinculada') {
        aplicarResolucao(r, { anunciar: true, atual });
        adicionar({
          autor: 'assistente',
          texto: params.nomeFormulario
            ? `Qual é a sua dúvida no formulário **${params.nomeFormulario}**? Pode escrever com suas palavras.`
            : 'Qual é a sua dúvida? Pode escrever com suas palavras.',
          opcoes: [
            { rotulo: 'Como respondo um formulário?', acao: { tipo: 'topico', topico: 'responder' } },
            { rotulo: 'Posso parar e continuar depois?', acao: { tipo: 'topico', topico: 'rascunho' } },
          ],
        });
        return;
      }
    }
    const comPendencia = atendimentos.find(
      (a) => SITUACOES_RESPONDIVEIS.includes(a.id_situacao_atendimento) && pendentesDe(a) > 0,
    );
    if (comPendencia) {
      const n = pendentesDe(comPendencia);
      const unidade = comPendencia.unidade_atendimento?.nome;
      adicionar({
        autor: 'assistente',
        texto:
          `O atendimento ${formatProtocolo(comPendencia.id_atendimento, comPendencia.dt_cadastro)}` +
          `${unidade ? ` (${unidade})` : ''} tem ${n === 1 ? '1 formulário pendente' : `${n} formulários pendentes`}.`,
        opcoes: [
          {
            rotulo: 'Tenho dúvida nesses formulários',
            acao: { tipo: 'formulario', idAtendimento: comPendencia.id_atendimento },
          },
          ...OPCOES_INICIAIS,
        ],
      });
    }
  };

  // ---------- vínculo com a unidade ----------
  const aplicarResolucao = (
    r: Resolucao,
    { anunciar, atual = vinculo }: { anunciar: boolean; atual?: Vinculo | null },
  ) => {
    if (r.status === 'vinculada') {
      const v = r.vinculo;
      if (v.servico) setUltimoServico(v.servico);
      if (chaveDoVinculo(v) === chaveDoVinculo(atual) && atual?.origem === v.origem) return;
      setVinculo(v);
      if (anunciar) {
        adicionar({
          autor: 'assistente',
          texto: `Vou considerar a unidade **${v.unidade.nome}** nesta conversa: ${motivoDoVinculo(v, atendimentos)}.`,
        });
      }
    } else if (r.status === 'escolher') {
      adicionar({
        autor: 'assistente',
        texto: `Você é atendido(a) em mais de uma unidade de ${r.servico}. Sobre qual delas é a sua dúvida?`,
        opcoes: [
          ...r.opcoes.map((u) => ({
            rotulo: u.nome,
            acao: { tipo: 'unidade' as const, idUnidade: u.id, servico: r.servico },
          })),
          { rotulo: 'Nenhuma delas', acao: { tipo: 'escrever' } },
        ],
      });
    } else if (r.status === 'confirmar') {
      adicionar({
        autor: 'assistente',
        texto: `Pelo que você escreveu, parece ser um assunto do ${r.servico}. É isso?`,
        opcoes: [
          { rotulo: `Sim, é sobre o ${r.servico}`, acao: { tipo: 'confirmarServico', servico: r.servico } },
          { rotulo: 'Não, quero ver as opções', acao: { tipo: 'triagem' } },
        ],
      });
    } else if (r.status === 'sem-unidade' && anunciar) {
      adicionar({
        autor: 'assistente',
        texto:
          `Você ainda não é atendido(a) em um ${r.servico} pelo PASI, então não liguei esta conversa a nenhuma unidade. ` +
          `Posso buscar o ${r.servico} mais perto de você pelo CEP.`,
        opcoes: [
          { rotulo: `Encontrar o ${r.servico} mais próximo`, acao: { tipo: 'cep', servico: r.servico } },
          { rotulo: 'Voltar ao início', acao: { tipo: 'inicio' } },
        ],
      });
    }
  };

  /** Serviço indicado por um critério válido -> unidade do paciente (se os dados já chegaram). */
  const vincularPorServico = (servico: TipoServico, origem: OrigemServico) => {
    if (unidades === null) return; // ainda carregando: sem dados, não vincula
    aplicarResolucao(resolverVinculo(servico, origem, unidades), { anunciar: true });
  };

  /** Serviço que veio da IA: só trata quando muda, para não repetir a mesma mensagem. */
  const tratarServicoDaIa = (indicado: ServicoIndicado | null | undefined) => {
    if (!indicado) return;
    const chave = `${indicado.servico}:${indicado.origem}`;
    if (chave === servicoIaTratado.current) return;
    servicoIaTratado.current = chave;
    setUltimoServico(indicado.servico);
    if (vinculo?.servico === indicado.servico) return; // já ligada a uma unidade desse serviço
    vincularPorServico(indicado.servico, indicado.origem);
  };

  // ---------- ciclo de vida da conversa ----------
  /** Zera tudo e começa uma conversa nova (sessão nova na API, sem histórico). */
  const reiniciarEstado = () => {
    controle.current.encerrar(); // cancela a pergunta pendente; resposta atrasada é descartada
    sessao.current = novaSessao();
    contextoEnviado.current = false;
    vinculoInformado.current = '';
    servicoIaTratado.current = '';
    setPensando(false);
    setDemorando(false);
    setModoCep(null);
    setUltimoServico(null);
    setVinculo(null);
    setRascunho('');
  };

  const recomecar = () => {
    reiniciarEstado();
    setEncerrada(false);
    setMensagens(comId(boasVindas(nome)));
    mostrarContextoInicial(unidades ?? [], null);
  };

  const encerrarPorInatividade = () => {
    reiniciarEstado();
    setEncerrada(true);
    setMensagens(
      comId([
        {
          autor: 'assistente',
          texto: `${MENSAGEM_INATIVIDADE} Para continuar, comece uma nova conversa.`,
          opcoes: [{ rotulo: 'Começar nova conversa', acao: { tipo: 'novaConversa' } }],
        },
      ]),
    );
    lerAviso(MENSAGEM_INATIVIDADE);
  };

  // confere a inatividade a cada 30 s e quando o app volta para a frente
  useEffect(() => {
    const conferir = () => {
      if (!encerrada && controle.current.inativa()) encerrarPorInatividade();
    };
    const timer = setInterval(conferir, VERIFICAR_INATIVIDADE_MS);
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') conferir();
    });
    return () => {
      clearInterval(timer);
      assinatura.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encerrada]);

  // ---------- respostas ----------
  const indicarServico = (servico: TipoServico, origem: OrigemServico) => {
    setUltimoServico(servico);
    adicionar(
      { autor: 'assistente', texto: `Pelo que você contou, o lugar indicado é o ${servico}.` },
      { autor: 'assistente', servico, opcoes: opcoesDepoisDoServico(servico) },
    );
    vincularPorServico(servico, origem);
  };

  /** Envia a pergunta para a IA. `textoOriginal` é usado na triagem local se a API falhar. */
  const consultarIa = async (
    mensagemApi: string,
    textoOriginal: string,
    extras: { mapa?: string; opcoes?: Opcao[]; servicoCep?: TipoServico | null; chaveVinculo?: string } = {},
  ) => {
    const req = controle.current.iniciarRequisicao();
    const sessaoDaPergunta = sessao.current;
    const ehDestaConversa = () => controle.current.ehAtual(req.numero) && sessao.current === sessaoDaPergunta;
    setPensando(true);
    setDemorando(false);
    const avisoDemora = setTimeout(() => {
      if (ehDestaConversa()) setDemorando(true);
    }, ATRASO_DEMORA_MS);
    try {
      const r = await perguntar(mensagemApi, sessaoDaPergunta, req.signal);
      if (!ehDestaConversa()) return; // resposta de uma conversa encerrada: descarta
      controle.current.registrarAtividade();
      contextoEnviado.current = true;
      if (extras.chaveVinculo !== undefined) vinculoInformado.current = extras.chaveVinculo;
      adicionar({ autor: 'assistente', texto: r.resposta, fontes: r.fontes, mapa: extras.mapa, opcoes: extras.opcoes });
      tratarServicoDaIa(r.servico_indicado);
    } catch {
      if (!ehDestaConversa()) return; // cancelada pelo Recomeçar ou pela inatividade
      if (extras.servicoCep !== undefined) {
        adicionar({
          autor: 'assistente',
          texto:
            'Não consegui consultar as unidades agora. Tente de novo em instantes, abra o mapa abaixo ou ligue ' +
            'para a prefeitura (Secretaria de Saúde ou de Assistência Social) para saber qual unidade atende o seu endereço.',
          mapa: extras.mapa,
          opcoes: extras.opcoes,
        });
      } else {
        const servico = classificar(textoOriginal);
        adicionar({
          autor: 'assistente',
          texto: servico
            ? 'Estou sem conexão com a assistente completa agora, mas posso te orientar pelo que você escreveu.'
            : 'Estou sem conexão com a assistente completa agora. Pode escolher uma das opções abaixo?',
          opcoes: servico ? undefined : OPCOES_INICIAIS,
        });
        // palpite por palavras: mostra o serviço, mas só vincula depois que a pessoa confirmar
        if (servico) indicarServico(servico, 'palavras');
      }
    } finally {
      clearTimeout(avisoDemora);
      req.concluir();
      if (ehDestaConversa()) {
        setPensando(false);
        setDemorando(false);
      }
    }
  };

  const pedirCep = (servico: TipoServico | null) => {
    setModoCep({ servico });
    setRascunho('');
    const alvo = servico ? `o ${servico} mais próximo` : 'as unidades de CRAS, CAPS e CREAS mais próximas';
    adicionar({
      autor: 'assistente',
      texto: `Digite o CEP que você quer pesquisar (só os números) e eu mostro ${alvo}.`,
      opcoes: [
        { rotulo: 'Não sei meu CEP', acao: { tipo: 'semCep' } },
        { rotulo: 'Voltar ao início', acao: { tipo: 'inicio' } },
      ],
    });
    campo.current?.focus();
  };

  const buscarCep = (digitos: string, servico: TipoServico | null) => {
    const cep = formatarCep(digitos);
    setModoCep(null);
    adicionar({ autor: 'pessoa', texto: cep });
    const pergunta = servico
      ? `Meu CEP é ${cep}. Qual o ${servico} mais próximo?`
      : `Meu CEP é ${cep}. Quais são o CRAS, o CREAS e o CAPS mais próximos?`;
    void consultarIa(pergunta, cep, {
      servicoCep: servico,
      mapa: linkDoMapa(servico, cep),
      opcoes: [
        { rotulo: 'Buscar outro CEP', acao: { tipo: 'cep', servico } },
        { rotulo: 'Como começar a triagem', acao: { tipo: 'comoComecar' } },
        { rotulo: 'Voltar ao início', acao: { tipo: 'inicio' } },
      ],
    });
  };

  const escolher = (opcao: Opcao) => {
    if (pensando) return;
    // o relógio de inatividade conta a partir das ações da pessoa (abrir o chat não conta)
    controle.current.registrarAtividade();
    const { acao } = opcao;
    if (acao.tipo === 'novaConversa') {
      recomecar();
      return;
    }
    adicionar({ autor: 'pessoa', texto: opcao.rotulo });
    switch (acao.tipo) {
      case 'servico':
        indicarServico(acao.servico, 'botao');
        break;
      case 'triagem':
        adicionar({
          autor: 'assistente',
          texto: 'Sem problema, vamos descobrir juntos. O que mais se parece com a sua situação agora?',
          opcoes: OPCOES_TRIAGEM,
        });
        break;
      case 'cep':
        pedirCep(acao.servico ?? ultimoServico);
        break;
      case 'semCep':
        setModoCep(null);
        adicionar({
          autor: 'assistente',
          texto:
            'Você encontra o CEP numa conta de luz ou de água, ou no site dos Correios: https://buscacepinter.correios.com.br. Quando tiver, é só me mandar aqui.',
          opcoes: [
            { rotulo: 'Já tenho o CEP', acao: { tipo: 'cep', servico: ultimoServico } },
            { rotulo: 'Voltar ao início', acao: { tipo: 'inicio' } },
          ],
        });
        break;
      case 'comoComecar':
        adicionar({
          autor: 'assistente',
          texto:
            'Você já está no app! A triagem são os formulários do seu atendimento: em **Meus Atendimentos**, toque em **Responder formulários**.\n' +
            'Ainda não tem atendimento? Procure a unidade: o profissional cria o seu atendimento e os formulários aparecem aqui. A triagem também pode ser feita na unidade, com ajuda de um profissional.',
          opcoes: [
            { rotulo: 'Como respondo um formulário?', acao: { tipo: 'topico', topico: 'responder' } },
            { rotulo: 'Buscar unidade pelo CEP', acao: { tipo: 'cep', servico: ultimoServico } },
            { rotulo: 'Voltar ao início', acao: { tipo: 'inicio' } },
          ],
        });
        break;
      case 'app':
        adicionar({ autor: 'assistente', texto: 'Claro! Qual é a sua dúvida sobre o aplicativo?', opcoes: OPCOES_APP });
        break;
      case 'topico': {
        const t = TOPICOS_POR_ID[acao.topico];
        const texto = [t.introducao, ...(t.passos ?? []).map((p, i) => `${i + 1}. ${p}`), t.observacao ?? '']
          .filter(Boolean)
          .join('\n');
        adicionar({
          autor: 'assistente',
          texto,
          opcoes: [
            { rotulo: 'Outra dúvida sobre o app', acao: { tipo: 'app' } },
            { rotulo: 'Voltar ao início', acao: { tipo: 'inicio' } },
          ],
        });
        break;
      }
      case 'formulario':
        aplicarResolucao(vinculoDoAtendimento(acao.idAtendimento, unidades ?? []), { anunciar: true });
        adicionar({
          autor: 'assistente',
          texto: 'Qual é a sua dúvida? Escreva com suas palavras ou escolha uma das opções.',
          opcoes: [
            { rotulo: 'Como respondo um formulário?', acao: { tipo: 'topico', topico: 'responder' } },
            { rotulo: 'Posso parar e continuar depois?', acao: { tipo: 'topico', topico: 'rascunho' } },
            { rotulo: 'O que significa cada situação?', acao: { tipo: 'topico', topico: 'situacoes' } },
          ],
        });
        break;
      case 'unidade':
        aplicarResolucao(vinculoEscolhido(acao.idUnidade, unidades ?? [], acao.servico), { anunciar: true });
        break;
      case 'confirmarServico':
        // a pessoa confirmou: agora o serviço tem critério válido
        vincularPorServico(acao.servico, 'botao');
        break;
      case 'escrever':
        adicionar({ autor: 'assistente', texto: 'Tudo bem. Me conte com suas palavras o que você precisa.' });
        campo.current?.focus();
        break;
      case 'inicio':
        setModoCep(null);
        adicionar({ autor: 'assistente', texto: 'Claro! Sobre o que você precisa de ajuda?', opcoes: OPCOES_INICIAIS });
        break;
    }
  };

  const enviar = () => {
    const texto = rascunho.trim();
    if (!texto || pensando) return;
    setRascunho('');
    controle.current.registrarAtividade();

    // depois de "Atendimento finalizado por inatividade", a mensagem abre uma conversa nova
    let vinculoAtual = vinculo;
    let servicoAtual = ultimoServico;
    if (encerrada) {
      reiniciarEstado();
      setEncerrada(false);
      setMensagens(comId(boasVindas(nome)));
      vinculoAtual = null;
      servicoAtual = null;
    }

    if (modoCep && !encerrada) {
      const digitos = texto.replace(/\D/g, '');
      if (digitos.length === 8) {
        buscarCep(digitos, modoCep.servico);
      } else {
        adicionar(
          { autor: 'pessoa', texto },
          { autor: 'assistente', texto: 'O CEP precisa ter 8 números, por exemplo 09370-000. Pode tentar de novo?' },
        );
      }
      return;
    }

    const cepNoTexto = texto.match(/\b\d{5}-?\d{3}\b/);
    if (cepNoTexto && texto.replace(/\D/g, '').length === 8) {
      buscarCep(cepNoTexto[0].replace(/\D/g, ''), servicoAtual);
      return;
    }

    adicionar({ autor: 'pessoa', texto });
    if (indicaRisco(texto)) adicionar({ autor: 'assistente', texto: MENSAGEM_RISCO });

    // contexto para a IA, no mesmo formato "(Contexto: ...)" de antes:
    //  - a unidade em que a pessoa já é atendida, quando o vínculo é novo nesta sessão;
    //  - o serviço já indicado pelos botões, na primeira pergunta.
    const chaveVinculo = chaveDoVinculo(vinculoAtual);
    const partes: string[] = [];
    if (vinculoAtual && chaveVinculo !== vinculoInformado.current) partes.push(contextoParaIa(vinculoAtual));
    if (servicoAtual && !contextoEnviado.current) {
      partes.push(`(Contexto: a pessoa já foi orientada a procurar o ${servicoAtual}.)`);
    }
    void consultarIa([...partes, texto].join(' '), texto, { chaveVinculo });
  };

  const aoDigitar = (valor: string) => {
    controle.current.registrarAtividade();
    setRascunho(modoCep ? formatarCep(valor) : valor);
  };

  // com o teclado aberto, a última mensagem continua à vista
  useEffect(() => {
    if (tecladoAberto) rolagem.current?.scrollToEnd({ animated: true });
  }, [tecladoAberto]);

  const ultima = mensagens[mensagens.length - 1];

  return (
    <TelaComTeclado className="flex-1 bg-white">
      <ScreenHeader
        title="Assistente PASI"
        subtitle="Orientação sobre CRAS, CAPS e CREAS"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity
            onPress={recomecar}
            className="w-9 h-9 rounded-xl bg-sobre-primaria/15 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Recomeçar conversa"
            hitSlop={6}
          >
            <MaterialIcons name="restart-alt" size={22} color={cores.sobrePrimaria} />
          </TouchableOpacity>
        }
      />

      {vinculo && (
        <View className="flex-row items-center bg-gray-100 border-b border-border px-4 py-2">
          <MaterialIcons name="place" size={18} color={cores.destaque} style={{ marginRight: 6 }} />
          <Text className="flex-1 text-xs text-gray-700" numberOfLines={2}>
            Unidade desta conversa: <Text className="text-xs font-bold text-primary">{vinculo.unidade.nome}</Text>
          </Text>
          <TouchableOpacity
            onPress={() => {
              setVinculo(null);
              vinculoInformado.current = '';
              adicionar({
                autor: 'assistente',
                texto: 'Certo, não vou considerar nenhuma unidade. Se quiser, me conte o que você precisa.',
              });
            }}
            className="h-9 px-3 rounded-full border border-border bg-white items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={`Desligar a conversa da unidade ${vinculo.unidade.nome}`}
          >
            <Text className="text-xs font-semibold text-primary">Remover</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        ref={rolagem}
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => rolagem.current?.scrollToEnd({ animated: true })}
      >
        {mensagens.map((m) => {
          if (m.autor === 'pessoa') {
            return (
              <View
                key={m.id}
                className="self-end bg-primary rounded-2xl rounded-br-md px-4 py-3 mb-3"
                style={{ maxWidth: '82%' }}
              >
                <Text className="text-white text-sm leading-5">{m.texto}</Text>
              </View>
            );
          }
          const opcoes = m === ultima && !pensando ? m.opcoes : undefined;
          return (
            <View key={m.id} className="mb-3">
              {'servico' in m ? (
                <CartaoServico servico={m.servico} />
              ) : (
                <View
                  className="self-start bg-white border border-border rounded-2xl rounded-bl-md px-4 py-3"
                  style={{ maxWidth: '92%' }}
                >
                  <TextoFormatado texto={m.texto} />
                  {m.fontes && m.fontes.length > 0 && (
                    <Text className="text-xs text-gray-600 mt-2">Fonte: {m.fontes.join(' · ')}</Text>
                  )}
                  <TouchableOpacity
                    onPress={() => falar(paraFala(m.texto))}
                    className="flex-row items-center self-start mt-2 py-1"
                    accessibilityRole="button"
                    accessibilityLabel="Ouvir esta mensagem"
                    lerAoTocar={false}
                    hitSlop={8}
                  >
                    <MaterialIcons name="volume-up" size={16} color={cores.destaque} style={{ marginRight: 4 }} />
                    <Text className="text-xs font-semibold text-primary">Ouvir</Text>
                  </TouchableOpacity>
                </View>
              )}

              {'mapa' in m && m.mapa ? (
                <TouchableOpacity
                  onPress={() => void Linking.openURL(m.mapa as string).catch(() => undefined)}
                  className="flex-row items-center self-start h-11 px-4 rounded-xl border-2 border-primary bg-white mt-2"
                  accessibilityRole="link"
                >
                  <MaterialIcons name="map" size={18} color={cores.destaque} style={{ marginRight: 6 }} />
                  <Text className="text-sm font-semibold text-primary">Abrir no mapa</Text>
                </TouchableOpacity>
              ) : null}

              {opcoes && (
                <View className="mt-2" accessibilityLabel="Respostas sugeridas">
                  {opcoes.map((opcao) => (
                    <TouchableOpacity
                      key={opcao.rotulo}
                      onPress={() => escolher(opcao)}
                      className="self-start bg-white border border-primary rounded-full px-4 py-2 mb-2"
                      style={{ minHeight: 44, justifyContent: 'center', maxWidth: '100%' }}
                      accessibilityRole="button"
                    >
                      <Text className="text-sm font-semibold text-primary">{opcao.rotulo}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}

        {pensando && (
          <View
            className="self-start flex-row items-center bg-white border border-border rounded-2xl px-4 py-3 mb-3"
            style={{ maxWidth: '92%' }}
            accessibilityRole="progressbar"
          >
            <View className="flex-row mr-2">
              <View className="w-2 h-2 rounded-full bg-primary mr-1" />
              <View className="w-2 h-2 rounded-full bg-primary/60 mr-1" />
              <View className="w-2 h-2 rounded-full bg-primary/30" />
            </View>
            <Text className="flex-1 text-sm text-gray-600">
              {demorando
                ? 'Estou consultando as informações. Na primeira pergunta isso pode levar até 1 minuto.'
                : 'A assistente está escrevendo…'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* com o teclado aberto, a borda de baixo do sistema fica atrás dele: não precisa da folga */}
      <View
        className="bg-white border-t border-border px-3 pt-3"
        style={{ paddingBottom: tecladoAberto ? 12 : Math.max(insets.bottom, 12) }}
      >
        <View className="flex-row items-center">
          <TextInput
            ref={campo}
            className="flex-1 bg-input-bg border border-border rounded-xl px-4 h-12 text-base text-gray-800"
            placeholder={modoCep ? 'Digite o CEP, ex.: 09370-000' : 'Escreva sua mensagem…'}
            placeholderTextColor={cores.placeholder}
            value={rascunho}
            onChangeText={aoDigitar}
            onSubmitEditing={enviar}
            submitBehavior="submit"
            returnKeyType="send"
            keyboardType={modoCep ? 'number-pad' : 'default'}
            autoComplete={modoCep ? 'postal-code' : 'off'}
            maxLength={modoCep ? 9 : 500}
            accessibilityLabel={modoCep ? 'CEP para buscar a unidade mais próxima' : 'Mensagem para a assistente'}
          />
          <TouchableOpacity
            onPress={enviar}
            disabled={pensando}
            className={`w-12 h-12 rounded-xl bg-primary items-center justify-center ml-2 ${pensando ? 'opacity-50' : ''}`}
            accessibilityRole="button"
            accessibilityLabel="Enviar"
            accessibilityState={{ disabled: pensando }}
          >
            <MaterialIcons name="send" size={20} color={cores.sobrePrimaria} />
          </TouchableOpacity>
        </View>
        {!tecladoAberto && (
          <Text className="text-xs text-gray-600 leading-4 mt-2">
            Não compartilhe documentos ou dados de saúde aqui. A assistente orienta, mas não substitui o atendimento.
          </Text>
        )}
      </View>
    </TelaComTeclado>
  );
}

function CartaoServico({ servico }: { servico: TipoServico }) {
  const cores = useCores();
  const s = SERVICOS[servico];
  return (
    <View className="bg-white border border-border rounded-2xl overflow-hidden" style={{ maxWidth: '92%' }}>
      <View className="flex-row items-center bg-gray-100 px-4 py-3">
        <View className="w-10 h-10 rounded-full bg-primary items-center justify-center mr-3">
          <MaterialIcons name={s.icone} size={20} color={cores.sobrePrimaria} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-primary">{s.sigla}</Text>
          <Text className="text-xs text-gray-600">{s.nome}</Text>
        </View>
      </View>
      <View className="px-4 py-3">
        <Text className="text-sm text-gray-800 leading-5">{s.descricao}</Text>
        <Text className="text-xs font-semibold text-gray-500 uppercase mt-3 mb-1">O que atende</Text>
        {s.atende.map((item) => (
          <View key={item} className="flex-row items-start mt-1">
            <MaterialIcons name="check" size={16} color={cores.sucessoTexto} style={{ marginRight: 6, marginTop: 2 }} />
            <Text className="flex-1 text-sm text-gray-800 leading-5">{item}</Text>
          </View>
        ))}
        {s.alerta && (
          <View
            className="flex-row items-start bg-orange-50 border border-orange-200 rounded-xl p-3 mt-3"
            accessibilityRole="alert"
          >
            <MaterialIcons
              name="warning-amber"
              size={18}
              color={cores.avisoTexto}
              style={{ marginRight: 8, marginTop: 1 }}
            />
            <Text className="flex-1 text-sm text-orange-700 leading-5">{s.alerta}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
