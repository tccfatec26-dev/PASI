import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TouchableOpacity } from '../acessibilidade/Leitura';
import { falar, lerAviso } from '../acessibilidade/fala';
import { useCores, useMovimentoReduzido } from '../acessibilidade/useTema';
import { CamadaTema } from '../acessibilidade/CamadaTema';
import { ScreenHeader } from '../components/ScreenHeader';
import { RadioList } from '../components/RadioList';
import { useAuth } from '../context/AuthContext';
import { PacienteNavProp } from '../navigation/types';
import { atendimentosService, Atendimento } from '../services/atendimentos';
import {
  assistenteService,
  acordarPasiBot,
  novaSessaoPasiBot,
  perguntarPasiBot,
  MensagemConversa,
} from '../services/assistente';
import {
  TOPICOS,
  Topico,
  MENSAGEM_RISCO,
  indicaRisco,
  pedeAtendente,
  topicoDoTexto,
  textoDoTopico,
} from '../assistente/conteudo';
import { SituacaoAtendimento, SituacaoFormulario } from '../constants/dominio';
import { formatProtocolo } from '../utils/format';
import { mensagemErroApi } from '../utils/errors';

type Acao =
  | { tipo: 'responder'; atendimento: Atendimento }
  | { tipo: 'atendente' }
  | { tipo: 'ligar'; telefone: string; unidade: string };

interface Mensagem {
  id: number;
  autor: 'paciente' | 'assistente';
  texto: string;
  topico?: Topico;
  acoes?: Acao[];
  /** Mostra "Isso ajudou?" embaixo (respostas sobre o app). */
  avaliar?: boolean;
}

/** Situações em que o paciente ainda pode responder formulários. */
const SITUACOES_RESPONDIVEIS: number[] = [
  SituacaoAtendimento.CRIADO,
  SituacaoAtendimento.INICIADO,
  SituacaoAtendimento.RESPONDIDO,
];

const pendentesDe = (a: Atendimento) =>
  a.atendimento_formulario.filter(
    (af) =>
      !af.status_formulario_paciente ||
      af.status_formulario_paciente.id_situacao_formulario < SituacaoFormulario.RESPONDIDO,
  ).length;

const primeiroNome = (nome?: string) => (nome ?? '').trim().split(/\s+/)[0] || '';

/** O PASIBot responde em markdown; aqui o texto é mostrado sem os símbolos. */
const semMarkdown = (t: string) =>
  t
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/(^|\s)\*(\S.+?)\*/g, '$1$2')
    .replace(/^#+\s*/gm, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .trim();

const soDigitos = (t: string) => t.replace(/\D/g, '');

/** Assistente virtual do paciente: dúvidas sobre o app, PASIBot e pedido de atendente. */
export function AssistenteScreen() {
  const cores = useCores();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<PacienteNavProp>();
  const { usuario } = useAuth();
  const nome = primeiroNome(usuario?.nome);

  const [mensagens, setMensagens] = useState<Mensagem[]>(() => [
    {
      id: 1,
      autor: 'assistente',
      texto:
        `Olá${nome ? `, ${nome}` : ''}! Sou o assistente virtual do PASI. ` +
        'Posso te explicar como usar o app ou chamar uma pessoa da equipe da sua unidade para falar com você.',
    },
  ]);
  const [texto, setTexto] = useState('');
  const [pensando, setPensando] = useState(false);
  const [avaliadas, setAvaliadas] = useState<Record<number, 'sim' | 'nao'>>({});
  const [atendimentos, setAtendimentos] = useState<Atendimento[] | null>(null);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [assuntoAtual, setAssuntoAtual] = useState('Dúvida sobre o aplicativo');
  /** Lista de dúvidas comuns aberta (fecha depois da primeira pergunta, para a resposta ficar à vista). */
  const [sugestoesAbertas, setSugestoesAbertas] = useState(true);

  const proximoId = useRef(2);
  const sessao = useRef(novaSessaoPasiBot());
  const rolagem = useRef<ScrollView>(null);

  const adicionar = (m: Omit<Mensagem, 'id'>) => {
    const nova = { ...m, id: proximoId.current++ };
    setMensagens((atual) => [...atual, nova]);
    // TalkBack e leitura em voz alta: a resposta do assistente é anunciada
    if (m.autor === 'assistente') lerAviso(m.texto);
    return nova.id;
  };

  // Atendimentos do paciente: contexto (formulários pendentes) e escolha no pedido de atendente.
  useEffect(() => {
    acordarPasiBot();
    let ativo = true;
    atendimentosService
      .listar({ page: 1, limit: 30, ordenar_por: 'data_desc' })
      .then((r) => {
        if (!ativo) return;
        const lista = r.data.filter((a) => a.id_situacao_atendimento !== SituacaoAtendimento.INATIVO);
        setAtendimentos(lista);
        const comPendencia = lista.find(
          (a) => SITUACOES_RESPONDIVEIS.includes(a.id_situacao_atendimento) && pendentesDe(a) > 0,
        );
        if (comPendencia) {
          const n = pendentesDe(comPendencia);
          adicionar({
            autor: 'assistente',
            texto:
              `Vi que o atendimento ${formatProtocolo(comPendencia.id_atendimento, comPendencia.dt_cadastro)} ` +
              `tem ${n === 1 ? '1 formulário pendente' : `${n} formulários pendentes`}. Quer ajuda para responder?`,
            acoes: [{ tipo: 'responder', atendimento: comPendencia }],
          });
        }
      })
      .catch(() => {
        if (ativo) setAtendimentos([]);
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const atendimentoComPendencia = useMemo(
    () =>
      atendimentos?.find((a) => SITUACOES_RESPONDIVEIS.includes(a.id_situacao_atendimento) && pendentesDe(a) > 0) ??
      null,
    [atendimentos],
  );

  const responderTopico = (t: Topico) => {
    setAssuntoAtual(t.pergunta.replace(/\?$/, ''));
    adicionar({
      autor: 'assistente',
      texto: textoDoTopico(t),
      topico: t,
      avaliar: true,
      acoes:
        t.id === 'responder' && atendimentoComPendencia
          ? [{ tipo: 'responder', atendimento: atendimentoComPendencia }]
          : undefined,
    });
  };

  const escolherTopico = (t: Topico) => {
    setSugestoesAbertas(false);
    adicionar({ autor: 'paciente', texto: t.pergunta });
    responderTopico(t);
  };

  const enviarTexto = async () => {
    const pergunta = texto.trim();
    if (!pergunta || pensando) return;
    setTexto('');
    setSugestoesAbertas(false);
    adicionar({ autor: 'paciente', texto: pergunta });

    if (indicaRisco(pergunta)) {
      adicionar({ autor: 'assistente', texto: MENSAGEM_RISCO, acoes: [{ tipo: 'atendente' }] });
      return;
    }
    if (pedeAtendente(pergunta)) {
      setAssuntoAtual('Quer falar com um atendente');
      adicionar({
        autor: 'assistente',
        texto: 'Claro! Vou te passar para uma pessoa da equipe da sua unidade.',
        acoes: [{ tipo: 'atendente' }],
      });
      setFolhaAberta(true);
      return;
    }
    const topico = topicoDoTexto(pergunta);
    if (topico) {
      responderTopico(topico);
      return;
    }

    setPensando(true);
    setAssuntoAtual(pergunta.length > 90 ? `${pergunta.slice(0, 89)}…` : pergunta);
    try {
      const r = await perguntarPasiBot(pergunta, sessao.current);
      adicionar({
        autor: 'assistente',
        texto: semMarkdown(r.resposta) || 'Não entendi. Pode explicar de outro jeito?',
      });
    } catch {
      adicionar({
        autor: 'assistente',
        texto:
          'Não consegui responder agora. Você pode escolher uma das dúvidas abaixo ou falar com uma pessoa da equipe da sua unidade.',
        acoes: [{ tipo: 'atendente' }],
      });
    } finally {
      setPensando(false);
    }
  };

  const avaliar = (m: Mensagem, valor: 'sim' | 'nao') => {
    setAvaliadas((a) => ({ ...a, [m.id]: valor }));
    if (valor === 'sim') {
      adicionar({ autor: 'assistente', texto: 'Que bom! Se precisar, é só tocar em Ajuda.' });
    } else {
      adicionar({
        autor: 'assistente',
        texto: 'Poxa, desculpe. Quer que eu chame uma pessoa da equipe da sua unidade para te ajudar?',
        acoes: [{ tipo: 'atendente' }],
      });
    }
  };

  const executar = (acao: Acao) => {
    if (acao.tipo === 'responder') {
      navigation.navigate('FormulariosAtendimento', {
        idAtendimento: acao.atendimento.id_atendimento,
        descricao: acao.atendimento.descricao ?? 'Atendimento',
      });
    } else if (acao.tipo === 'atendente') {
      setFolhaAberta(true);
    } else {
      void Linking.openURL(`tel:${soDigitos(acao.telefone)}`);
    }
  };

  /** As últimas mensagens, para o atendente entender a dúvida sem perguntar de novo. */
  const resumoConversa = (): MensagemConversa[] =>
    mensagens.slice(-8).map((m) => ({ autor: m.autor, texto: m.texto.slice(0, 600) }));

  const aoEnviarPedido = (r: {
    enviado: boolean;
    unidade: { nome: string; telefone: string | null } | null;
    erro?: string;
  }) => {
    setFolhaAberta(false);
    const ligar: Acao[] = r.unidade?.telefone
      ? [{ tipo: 'ligar', telefone: r.unidade.telefone, unidade: r.unidade.nome }]
      : [];
    if (r.erro) {
      adicionar({ autor: 'assistente', texto: r.erro, acoes: ligar });
    } else if (r.enviado) {
      adicionar({
        autor: 'assistente',
        texto:
          `Pronto${nome ? `, ${nome}` : ''}! Enviei seu pedido para ${r.unidade?.nome ?? 'a sua unidade'}. ` +
          'A equipe vai entrar em contato pelo seu e-mail ou celular cadastrados.' +
          (r.unidade?.telefone ? ' Se for urgente, você também pode ligar para a unidade.' : ''),
        acoes: ligar,
      });
    } else {
      adicionar({
        autor: 'assistente',
        texto:
          'Não consegui enviar o pedido agora.' +
          (r.unidade?.telefone
            ? ' Você pode ligar para a unidade pelo botão abaixo.'
            : ' Tente de novo em alguns minutos.'),
        acoes: ligar,
      });
    }
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title="Assistente PASI"
        subtitle="Assistente virtual"
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity
            onPress={() => setFolhaAberta(true)}
            className="w-9 h-9 rounded-xl bg-sobre-primaria/15 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Falar com um atendente"
            hitSlop={6}
          >
            <MaterialIcons name="support-agent" size={22} color={cores.sobrePrimaria} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        ref={rolagem}
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => rolagem.current?.scrollToEnd({ animated: true })}
      >
        {mensagens.map((m) => (
          <Balao key={m.id} m={m} avaliacao={avaliadas[m.id]} onAvaliar={(v) => avaliar(m, v)} onAcao={executar} />
        ))}

        {pensando && (
          <View className="flex-row items-center self-start bg-white border border-border rounded-2xl px-4 py-3 mb-3">
            <ActivityIndicator size="small" color={cores.destaque} />
            <Text className="text-sm text-gray-600 ml-2">Pensando… pode levar alguns segundos</Text>
          </View>
        )}

        {/* Sugestões */}
        {!sugestoesAbertas ? (
          <TouchableOpacity
            onPress={() => setSugestoesAbertas(true)}
            className="flex-row items-center self-start h-11 px-4 rounded-full border border-border bg-white mt-1"
            accessibilityRole="button"
          >
            <MaterialIcons name="help-outline" size={18} color={cores.destaque} style={{ marginRight: 6 }} />
            <Text className="text-sm text-primary font-semibold">Ver outras dúvidas</Text>
          </TouchableOpacity>
        ) : (
          <>
            <Text className="text-sm font-semibold text-gray-700 mt-2 mb-2" accessibilityRole="header">
              Dúvidas comuns
            </Text>
            {TOPICOS.map((t) => (
              <TouchableOpacity
                key={t.id}
                onPress={() => escolherTopico(t)}
                className="flex-row items-center bg-white border border-border rounded-xl px-4 mb-2"
                style={{ minHeight: 48 }}
                accessibilityRole="button"
              >
                <MaterialIcons name={t.icone} size={20} color={cores.destaque} style={{ marginRight: 12 }} />
                <Text className="flex-1 text-sm text-gray-800">{t.pergunta}</Text>
                <MaterialIcons name="chevron-right" size={20} color={cores.texto4} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setFolhaAberta(true)}
              className="flex-row items-center bg-white border-2 border-primary rounded-xl px-4 mb-2"
              style={{ minHeight: 48 }}
              accessibilityRole="button"
            >
              <MaterialIcons name="support-agent" size={20} color={cores.destaque} style={{ marginRight: 12 }} />
              <Text className="flex-1 text-sm font-bold text-primary">Quero falar com um atendente</Text>
              <MaterialIcons name="chevron-right" size={20} color={cores.destaque} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Campo de mensagem */}
      <View
        className="flex-row items-center bg-white border-t border-border px-3 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        <TextInput
          className="flex-1 bg-input-bg border border-border rounded-xl px-4 h-12 text-base text-gray-800"
          placeholder="Escreva sua dúvida..."
          placeholderTextColor={cores.placeholder}
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={enviarTexto}
          returnKeyType="send"
          maxLength={500}
          accessibilityLabel="Escreva sua dúvida"
        />
        <TouchableOpacity
          onPress={enviarTexto}
          disabled={!texto.trim() || pensando}
          className={`w-12 h-12 rounded-xl bg-primary items-center justify-center ml-2 ${
            !texto.trim() || pensando ? 'opacity-50' : ''
          }`}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensagem"
          accessibilityState={{ disabled: !texto.trim() || pensando }}
        >
          <MaterialIcons name="send" size={20} color={cores.sobrePrimaria} />
        </TouchableOpacity>
      </View>

      <FolhaAtendente
        visivel={folhaAberta}
        onFechar={() => setFolhaAberta(false)}
        atendimentos={atendimentos}
        sugerido={atendimentoComPendencia ?? atendimentos?.[0] ?? null}
        nomePaciente={usuario?.nome ?? ''}
        assunto={assuntoAtual}
        conversa={resumoConversa}
        onResultado={aoEnviarPedido}
      />
    </KeyboardAvoidingView>
  );
}

// ------------------------------------------------------------------
// Balão de mensagem
// ------------------------------------------------------------------
function Balao({
  m,
  avaliacao,
  onAvaliar,
  onAcao,
}: {
  m: Mensagem;
  avaliacao?: 'sim' | 'nao';
  onAvaliar: (v: 'sim' | 'nao') => void;
  onAcao: (a: Acao) => void;
}) {
  const cores = useCores();
  const doPaciente = m.autor === 'paciente';

  if (doPaciente) {
    return (
      <View className="self-end bg-primary rounded-2xl rounded-br-md px-4 py-3 mb-3" style={{ maxWidth: '82%' }}>
        <Text className="text-white text-sm leading-5">{m.texto}</Text>
      </View>
    );
  }

  const t = m.topico;
  return (
    <View className="self-start mb-3" style={{ maxWidth: '90%' }}>
      <View className="bg-white border border-border rounded-2xl rounded-bl-md px-4 py-3">
        {t ? (
          <>
            <Text className="text-sm text-gray-800 leading-5">{t.introducao}</Text>
            {t.passos?.map((p, i) => (
              <View key={i} className="flex-row mt-2">
                <View className="w-6 h-6 rounded-full bg-primary items-center justify-center mr-2">
                  <Text className="text-white text-xs font-bold">{i + 1}</Text>
                </View>
                <Text className="flex-1 text-sm text-gray-800 leading-5">{p}</Text>
              </View>
            ))}
            {t.observacao ? <Text className="text-sm text-gray-600 leading-5 mt-2">{t.observacao}</Text> : null}
          </>
        ) : (
          <Text className="text-sm text-gray-800 leading-5">{m.texto}</Text>
        )}

        {m.acoes?.map((a, i) => (
          <BotaoAcao key={i} acao={a} onPress={() => onAcao(a)} />
        ))}

        {t && (
          <TouchableOpacity
            onPress={() => falar(m.texto)}
            className="h-11 border-2 border-primary rounded-xl flex-row items-center justify-center mt-3"
            accessibilityRole="button"
            lerAoTocar={false}
          >
            <MaterialIcons name="volume-up" size={18} color={cores.destaque} style={{ marginRight: 6 }} />
            <Text className="text-primary text-sm font-semibold">Ouvir esta resposta</Text>
          </TouchableOpacity>
        )}
      </View>

      {m.avaliar && !avaliacao && (
        <View className="flex-row items-center flex-wrap mt-2">
          <Text className="text-sm font-semibold text-gray-700 mr-2">Isso ajudou?</Text>
          <TouchableOpacity
            onPress={() => onAvaliar('sim')}
            className="flex-row items-center h-10 px-4 rounded-full border border-border bg-white mr-2"
            accessibilityRole="button"
          >
            <MaterialIcons name="check" size={16} color={cores.sucesso} style={{ marginRight: 4 }} />
            <Text className="text-sm text-gray-800">Sim</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onAvaliar('nao')}
            className="flex-row items-center h-10 px-4 rounded-full border border-border bg-white"
            accessibilityRole="button"
          >
            <MaterialIcons name="close" size={16} color={cores.erro} style={{ marginRight: 4 }} />
            <Text className="text-sm text-gray-800">Não</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function BotaoAcao({ acao, onPress }: { acao: Acao; onPress: () => void }) {
  const cores = useCores();
  if (acao.tipo === 'responder') {
    const prot = formatProtocolo(acao.atendimento.id_atendimento, acao.atendimento.dt_cadastro);
    return (
      <TouchableOpacity
        onPress={onPress}
        className="h-12 bg-green-500 rounded-xl flex-row items-center justify-center mt-3"
        accessibilityRole="button"
        accessibilityLabel={`Responder formulários do atendimento ${prot}`}
      >
        <MaterialIcons name="edit" size={16} color={cores.sobrePrimaria} style={{ marginRight: 6 }} />
        <Text className="text-white text-sm font-semibold">Responder {prot}</Text>
      </TouchableOpacity>
    );
  }
  if (acao.tipo === 'ligar') {
    return (
      <TouchableOpacity
        onPress={onPress}
        className="h-12 border-2 border-primary bg-white rounded-xl flex-row items-center justify-center mt-3"
        accessibilityRole="button"
        accessibilityLabel={`Ligar para ${acao.unidade}: ${acao.telefone}`}
      >
        <MaterialIcons name="call" size={18} color={cores.destaque} style={{ marginRight: 6 }} />
        <Text className="text-primary text-sm font-semibold">Ligar para a unidade</Text>
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      className="h-12 bg-primary rounded-xl flex-row items-center justify-center mt-3"
      accessibilityRole="button"
    >
      <MaterialIcons name="support-agent" size={18} color={cores.sobrePrimaria} style={{ marginRight: 6 }} />
      <Text className="text-white text-sm font-semibold">Falar com um atendente</Text>
    </TouchableOpacity>
  );
}

// ------------------------------------------------------------------
// Folha "Falar com um atendente"
// ------------------------------------------------------------------
function FolhaAtendente({
  visivel,
  onFechar,
  atendimentos,
  sugerido,
  nomePaciente,
  assunto,
  conversa,
  onResultado,
}: {
  visivel: boolean;
  onFechar: () => void;
  atendimentos: Atendimento[] | null;
  sugerido: Atendimento | null;
  nomePaciente: string;
  assunto: string;
  conversa: () => MensagemConversa[];
  onResultado: (r: {
    enviado: boolean;
    unidade: { nome: string; telefone: string | null } | null;
    erro?: string;
  }) => void;
}) {
  const cores = useCores();
  const insets = useSafeAreaInsets();
  const semMovimento = useMovimentoReduzido();
  const [idAtendimento, setIdAtendimento] = useState<number | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  // ao abrir, sugere o atendimento com pendência (ou o mais recente)
  useEffect(() => {
    if (visivel) setIdAtendimento((atual) => atual ?? sugerido?.id_atendimento ?? null);
  }, [visivel, sugerido]);

  const enviar = async () => {
    if (!idAtendimento || enviando) return;
    setEnviando(true);
    try {
      const r = await assistenteService.pedirAtendente({
        id_atendimento: idAtendimento,
        assunto,
        mensagem: mensagem.trim() || undefined,
        conversa: conversa(),
      });
      setMensagem('');
      onResultado(r);
    } catch (e) {
      onResultado({
        enviado: false,
        unidade: null,
        erro: mensagemErroApi(e, 'Não consegui enviar o pedido agora. Tente de novo em alguns minutos.'),
      });
    } finally {
      setEnviando(false);
    }
  };

  const opcoes = (atendimentos ?? []).map((a) => ({
    value: a.id_atendimento,
    label: `${formatProtocolo(a.id_atendimento, a.dt_cadastro)} · ${a.descricao ?? 'Atendimento'}`,
  }));

  return (
    <Modal visible={visivel} transparent animationType={semMovimento ? 'none' : 'slide'} onRequestClose={onFechar}>
      <CamadaTema>
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View className="flex-1 justify-end bg-black/40">
            <View
              className="bg-white rounded-t-3xl px-5 pt-5"
              style={{ maxHeight: '92%', paddingBottom: insets.bottom + 16 }}
            >
              <View className="flex-row items-start mb-4">
                <View className="w-12 h-12 rounded-xl bg-primary/10 items-center justify-center mr-3">
                  <MaterialIcons name="support-agent" size={26} color={cores.destaque} />
                </View>
                <View className="flex-1">
                  <Text className="text-primary font-bold text-lg" accessibilityRole="header">
                    Falar com um atendente
                  </Text>
                  <Text className="text-sm text-gray-600 leading-5 mt-1">
                    Vamos avisar a equipe da sua unidade (recepção ou profissional). Ela recebe o resumo desta conversa,
                    então você não precisa repetir nada.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onFechar}
                  className="p-1"
                  accessibilityRole="button"
                  accessibilityLabel="Fechar"
                >
                  <MaterialIcons name="close" size={22} color={cores.texto5} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {atendimentos === null ? (
                  <ActivityIndicator color={cores.destaque} style={{ marginVertical: 24 }} />
                ) : opcoes.length === 0 ? (
                  <View className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
                    <Text className="text-orange-700 text-sm leading-5">
                      Você ainda não tem um atendimento no app, então não sabemos qual unidade chamar. Procure a unidade
                      que te atende ou ligue para ela.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text className="text-xs font-semibold text-gray-500 uppercase mb-2" accessibilityRole="header">
                      Sobre qual atendimento?
                    </Text>
                    <RadioList options={opcoes} value={idAtendimento ?? -1} onChange={setIdAtendimento} />

                    <View className="bg-gray-50 border border-border rounded-2xl p-4 mt-2 mb-4">
                      <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">
                        O que o atendente vai ver
                      </Text>
                      <Linha rotulo="Paciente" valor={nomePaciente} />
                      <Linha rotulo="Assunto" valor={assunto} />
                      <Linha rotulo="Conversa" valor="As últimas mensagens com o assistente" />
                    </View>

                    <Text className="text-sm font-medium text-gray-700 mb-1">
                      Quer contar mais alguma coisa? (opcional)
                    </Text>
                    <TextInput
                      className="bg-input-bg border border-border rounded-xl px-4 py-3 text-base text-gray-800 mb-4"
                      placeholder="Ex.: não entendi a pergunta 3"
                      placeholderTextColor={cores.placeholder}
                      value={mensagem}
                      onChangeText={setMensagem}
                      multiline
                      maxLength={500}
                      style={{ minHeight: 72, textAlignVertical: 'top' }}
                      accessibilityLabel="Mensagem para o atendente (opcional)"
                    />

                    <View className="flex-row items-start bg-info-bg border border-info-border rounded-xl p-3 mb-4">
                      <MaterialIcons
                        name="mail-outline"
                        size={18}
                        color={cores.infoTexto}
                        style={{ marginRight: 8, marginTop: 1 }}
                      />
                      <Text className="flex-1 text-info-text text-xs leading-5">
                        O pedido vai por e-mail para a unidade do atendimento e aparece no painel do profissional. A
                        equipe responde pelo seu e-mail ou celular cadastrados.
                      </Text>
                    </View>
                  </>
                )}
              </ScrollView>

              {opcoes.length > 0 && (
                <TouchableOpacity
                  onPress={enviar}
                  disabled={!idAtendimento || enviando}
                  className={`h-12 bg-primary rounded-xl items-center justify-center ${
                    !idAtendimento || enviando ? 'opacity-50' : ''
                  }`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !idAtendimento || enviando, busy: enviando }}
                >
                  {enviando ? (
                    <ActivityIndicator color={cores.sobrePrimaria} />
                  ) : (
                    <Text className="text-white font-semibold text-base">Chamar atendente</Text>
                  )}
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={onFechar}
                className="h-12 border-2 border-primary bg-white rounded-xl items-center justify-center mt-2"
                accessibilityRole="button"
              >
                <Text className="text-primary font-semibold text-base">Continuar com o assistente</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </CamadaTema>
    </Modal>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View className="flex-row justify-between mb-1">
      <Text className="text-sm text-gray-600 mr-3">{rotulo}</Text>
      <Text className="flex-1 text-sm text-gray-800 font-semibold text-right" numberOfLines={2}>
        {valor}
      </Text>
    </View>
  );
}
