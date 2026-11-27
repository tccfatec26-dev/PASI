import React, { useEffect, useRef, useState } from 'react';
import { View, ScrollView, TextInput, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, TouchableOpacity } from '../acessibilidade/Leitura';
import { falar, lerAviso } from '../acessibilidade/fala';
import { useCores } from '../acessibilidade/useTema';
import { ScreenHeader } from '../components/ScreenHeader';
import { useAuth } from '../context/AuthContext';
import { PacienteNavProp } from '../navigation/types';
import { acordarApi, novaSessao, perguntar } from '../services/assistente';
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

/**
 * Assistente digital do PASI no app: a mesma conversa da landing page
 * (landing-page/src/components/Assistente/Assistente.tsx), com a mesma API
 * (PASIBot), os mesmos botões de triagem, cartões de serviço, busca por CEP e
 * mensagem de risco. No app ela também cumprimenta pelo nome e explica como
 * usar o aplicativo. Todas as cores vêm do tema (claro, escuro, alto contraste).
 */

type Mensagem =
  | { id: number; autor: 'pessoa'; texto: string }
  | { id: number; autor: 'assistente'; texto: string; opcoes?: Opcao[]; mapa?: string; fontes?: string[] }
  | { id: number; autor: 'assistente'; servico: TipoServico; opcoes?: Opcao[] };

type NovaMensagem = Mensagem extends infer M ? (M extends Mensagem ? Omit<M, 'id'> : never) : never;

type ModoCep = { servico: TipoServico | null } | null;

const ATRASO_DEMORA_MS = 6000;

const primeiroNome = (nome?: string) => (nome ?? '').trim().split(/\s+/)[0] || '';

/** Texto sem os símbolos de markdown, para a leitura em voz alta. */
const paraFala = (t: string) =>
  t
    .replace(/\*\*?([^*]+)\*\*?/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/https?:\/\/\S+/g, '');

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

export function AssistenteScreen() {
  const cores = useCores();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<PacienteNavProp>();
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

  const sessao = useRef(novaSessao());
  const contextoEnviado = useRef(false);
  const rolagem = useRef<ScrollView>(null);
  const campo = useRef<TextInput>(null);

  useEffect(() => {
    acordarApi();
  }, []);

  const adicionar = (...novas: NovaMensagem[]) => {
    setMensagens((atuais) => [...atuais, ...comId(novas)]);
    // TalkBack e leitura em voz alta: a última resposta da assistente é anunciada
    const ultimaTexto = [...novas].reverse().find((m) => m.autor === 'assistente' && 'texto' in m);
    if (ultimaTexto && 'texto' in ultimaTexto) lerAviso(paraFala(ultimaTexto.texto));
  };

  const recomecar = () => {
    sessao.current = novaSessao();
    contextoEnviado.current = false;
    setModoCep(null);
    setUltimoServico(null);
    setRascunho('');
    setMensagens(comId(boasVindas(nome)));
  };

  const indicarServico = (servico: TipoServico) => {
    setUltimoServico(servico);
    adicionar(
      { autor: 'assistente', texto: `Pelo que você contou, o lugar indicado é o ${servico}.` },
      { autor: 'assistente', servico, opcoes: opcoesDepoisDoServico(servico) },
    );
  };

  /** Envia a pergunta para a IA. `textoOriginal` é usado na triagem local se a API falhar. */
  const consultarIa = async (
    mensagemApi: string,
    textoOriginal: string,
    extras: { mapa?: string; opcoes?: Opcao[]; servicoCep?: TipoServico | null } = {},
  ) => {
    setPensando(true);
    setDemorando(false);
    const avisoDemora = setTimeout(() => setDemorando(true), ATRASO_DEMORA_MS);
    try {
      const { resposta, fontes } = await perguntar(mensagemApi, sessao.current);
      contextoEnviado.current = true;
      adicionar({ autor: 'assistente', texto: resposta, fontes, mapa: extras.mapa, opcoes: extras.opcoes });
    } catch {
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
        if (servico) indicarServico(servico);
      }
    } finally {
      clearTimeout(avisoDemora);
      setPensando(false);
      setDemorando(false);
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
    adicionar({ autor: 'pessoa', texto: opcao.rotulo });
    const { acao } = opcao;
    switch (acao.tipo) {
      case 'servico':
        indicarServico(acao.servico);
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

    if (modoCep) {
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
      buscarCep(cepNoTexto[0].replace(/\D/g, ''), ultimoServico);
      return;
    }

    adicionar({ autor: 'pessoa', texto });
    if (indicaRisco(texto)) adicionar({ autor: 'assistente', texto: MENSAGEM_RISCO });

    // a primeira pergunta à IA leva o serviço já indicado pelos botões, para ela não perder o contexto
    const mensagemApi =
      ultimoServico && !contextoEnviado.current
        ? `(Contexto: a pessoa já foi orientada a procurar o ${ultimoServico}.) ${texto}`
        : texto;
    void consultarIa(mensagemApi, texto);
  };

  const aoDigitar = (valor: string) => setRascunho(modoCep ? formatarCep(valor) : valor);

  const ultima = mensagens[mensagens.length - 1];

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

      <ScrollView
        ref={rolagem}
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
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

      <View
        className="bg-white border-t border-border px-3 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
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
        <Text className="text-xs text-gray-600 leading-4 mt-2">
          Não compartilhe documentos ou dados de saúde aqui. A assistente orienta, mas não substitui o atendimento.
        </Text>
      </View>
    </KeyboardAvoidingView>
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
            <MaterialIcons name="check" size={16} color={cores.sucesso} style={{ marginRight: 6, marginTop: 2 }} />
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
