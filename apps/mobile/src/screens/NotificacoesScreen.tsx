import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text, TouchableOpacity } from '../acessibilidade/Leitura';
import { useCores } from '../acessibilidade/useTema';
import { ScreenHeader } from '../components/ScreenHeader';
import { rotuloNaoLidas } from '../components/BotaoNotificacoes';
import { useNotificacoes } from '../context/NotificacoesContext';
import { useFeedback } from '../context/FeedbackContext';
import { notificacoesService, Notificacao, TipoNotificacao } from '../services/notificacoes';
import { PacienteNavProp } from '../navigation/types';
import { mensagemErroApi } from '../utils/errors';

const POR_PAGINA = 20;

/** "agora", "há 5 min", "há 3 h", "ontem" ou a data. */
function quando(dt: string) {
  const d = new Date(dt);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (min < 24 * 60) return `há ${Math.floor(min / 60)} h`;
  if (min < 48 * 60) return 'ontem';
  return d.toLocaleDateString('pt-BR');
}

/** Notificações do paciente: novos atendimentos e formulários para responder. */
export function NotificacoesScreen() {
  const cores = useCores();
  const navigation = useNavigation<PacienteNavProp>();
  const { naoLidas, versao, marcarLida, marcarTodas, atualizar } = useNotificacoes();
  const { toast } = useFeedback();
  const [itens, setItens] = useState<Notificacao[]>([]);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [puxando, setPuxando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const primeira = useRef(true);

  const carregar = useCallback(async (p: number) => {
    setErro(null);
    try {
      const r = await notificacoesService.listar({ page: p, limit: POR_PAGINA });
      setItens((atual) => (p === 1 ? r.data : [...atual, ...r.data.filter((n) => !atual.some((a) => a.id_notificacao === n.id_notificacao))]));
      setPagina(p);
      setTotalPaginas(Math.max(1, r.totalPages));
    } catch (e) {
      setErro(mensagemErroApi(e, 'Não foi possível carregar as notificações.'));
    } finally {
      setCarregando(false);
      setPuxando(false);
    }
  }, []);

  // ao abrir a tela e ao voltar para ela
  useFocusEffect(
    useCallback(() => {
      void carregar(1);
    }, [carregar]),
  );
  // chegou notificação nova ou alguma foi lida: atualiza
  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }
    void carregar(1);
  }, [versao, carregar]);

  const abrir = async (n: Notificacao) => {
    if (!n.lida) {
      setItens((l) => l.map((x) => (x.id_notificacao === n.id_notificacao ? { ...x, lida: true } : x)));
      marcarLida(n.id_notificacao).catch(() => null);
    }
    if (n.id_atendimento) {
      navigation.navigate('FormulariosAtendimento', { idAtendimento: n.id_atendimento, descricao: 'Atendimento' });
    }
  };

  const lerTodas = async () => {
    try {
      await marcarTodas();
      setItens((l) => l.map((x) => ({ ...x, lida: true })));
      toast('Todas as notificações foram marcadas como lidas.', 'success');
    } catch (e) {
      toast(mensagemErroApi(e, 'Não foi possível marcar como lidas.'), 'error');
    }
  };

  const renderItem = ({ item: n }: { item: Notificacao }) => {
    const icone = n.id_tipo_notificacao === TipoNotificacao.INCLUIDO_ATENDIMENTO ? 'event-note' : 'assignment';
    const rotulo = `${n.lida ? '' : 'Nova. '}${n.titulo}. ${n.mensagem} ${quando(n.dt_cadastro)}.`;
    return (
      <TouchableOpacity
        onPress={() => abrir(n)}
        textoFala={rotulo}
        className={`flex-row rounded-2xl p-4 mb-3 border ${n.lida ? 'bg-white border-border' : 'bg-info-bg border-info-border'}`}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={rotulo}
        accessibilityHint={n.id_atendimento ? 'Abre o atendimento' : undefined}
      >
        <View
          className={`w-11 h-11 rounded-full items-center justify-center mr-3 ${n.lida ? 'bg-gray-100' : 'bg-primary'}`}
        >
          <MaterialIcons name={icone} size={22} color={n.lida ? cores.destaque : cores.sobrePrimaria} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className={`flex-1 text-sm text-primary ${n.lida ? 'font-semibold' : 'font-bold'}`}>{n.titulo}</Text>
            {!n.lida && <View className="w-2.5 h-2.5 rounded-full bg-red-500 ml-2" />}
          </View>
          <Text className="text-gray-700 text-sm mt-1 leading-5">{n.mensagem}</Text>
          <Text className="text-muted text-xs mt-2">{quando(n.dt_cadastro)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader title="Notificações" subtitle={naoLidas === 0 ? 'Nenhuma notificação nova' : `Você tem ${rotuloNaoLidas(naoLidas)}`} onBack={() => navigation.goBack()} />

      {carregando && itens.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={cores.destaque} accessibilityLabel="Carregando" />
        </View>
      ) : (
        <FlatList
          data={itens}
          keyExtractor={(n) => String(n.id_notificacao)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 40, flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={puxando}
              onRefresh={() => {
                setPuxando(true);
                void atualizar();
                void carregar(1);
              }}
              colors={[cores.acao]}
              tintColor={cores.destaque}
            />
          }
          ListHeaderComponent={
            <>
              {erro ? (
                <Text className="text-red-500 text-sm mb-3" accessibilityRole="alert">
                  {erro}
                </Text>
              ) : null}
              {naoLidas > 0 ? (
                <TouchableOpacity
                  onPress={lerTodas}
                  className="flex-row items-center justify-center gap-1.5 border border-primary rounded-xl py-3 mb-4"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="done-all" size={18} color={cores.destaque} />
                  <Text className="text-primary text-sm font-semibold">Marcar todas como lidas</Text>
                </TouchableOpacity>
              ) : null}
            </>
          }
          ListEmptyComponent={
            erro ? null : (
              <View className="flex-1 items-center justify-center py-16">
                <View className="w-16 h-16 rounded-2xl bg-gray-100 items-center justify-center mb-3">
                  <MaterialIcons name="notifications-none" size={32} color={cores.destaque} />
                </View>
                <Text className="text-gray-700 text-base font-semibold">Nenhuma notificação</Text>
                <Text className="text-muted text-sm text-center mt-1 px-6">
                  Quando você for incluído em um atendimento, o aviso aparece aqui.
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            pagina < totalPaginas ? (
              <TouchableOpacity
                onPress={() => carregar(pagina + 1)}
                className="border border-border rounded-xl py-3 items-center"
                accessibilityRole="button"
              >
                <Text className="text-gray-600 text-sm">Ver mais notificações</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}
