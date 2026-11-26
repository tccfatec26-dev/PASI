import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../config/api';

/**
 * Notificações push (expo-notifications, SDK 56).
 *
 * Ao entrar, o app pede a permissão de notificação, cria o canal do Android e
 * registra o token do aparelho na API (PUT /notificacoes/dispositivos). Quando
 * a API grava uma notificação do sino, ela manda o mesmo aviso por push: chega
 * na barra do celular mesmo com o app fechado. Ao sair da conta, o aparelho é
 * removido (DELETE /notificacoes/dispositivos) e para de receber os avisos.
 *
 * Push não funciona no Expo Go (Android, desde o SDK 53): só no APK.
 */

/** Canal do Android. Tem de ser o mesmo id que a API manda (CANAL_ANDROID no PushService). */
export const CANAL = 'notificacoes';
const CHAVE_TOKEN = '@pasi:push-token';

/** Dados que a API manda junto com o push (para abrir a tela certa ao tocar). */
export interface DadosPush {
  id_notificacao?: number;
  id_tipo_notificacao?: number;
  id_atendimento?: number | null;
  id_formulario?: number | null;
}

// Com o app aberto, o aviso aparece no topo da tela e na lista de
// notificações do Android, como com o app fechado.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** token deste aparelho já registrado nesta abertura do app */
let tokenRegistrado: string | null = null;

async function criarCanal() {
  if (Platform.OS !== 'android') return;
  // precisa existir antes de pedir o token (e antes de o Android 13+ mostrar o pedido de permissão)
  await Notifications.setNotificationChannelAsync(CANAL, {
    name: 'Notificações',
    description: 'Atendimentos e formulários',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0D2347',
  });
}

/**
 * Pede a permissão e registra este aparelho para o usuário logado. Sem
 * permissão, sem internet ou no Expo Go, segue sem push (o sino continua).
 */
export async function registrarPush(): Promise<void> {
  try {
    await criarCanal();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
    if (status !== 'granted') return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.put('/notificacoes/dispositivos', { token, plataforma: Platform.OS === 'ios' ? 'ios' : 'android' });
    tokenRegistrado = token;
    await AsyncStorage.setItem(CHAVE_TOKEN, token);
  } catch {
    /* sem push neste aparelho: o sino e a lista continuam funcionando */
  }
}

/**
 * Saiu da conta: o aparelho para de receber os avisos dela. Chame ANTES de
 * apagar o login: o cabeçalho de autorização é guardado na hora da chamada.
 * Não espera a resposta (sair não pode travar sem internet).
 */
export function removerPush(): void {
  const autorizacao = api.defaults.headers.common['Authorization'];
  const naMemoria = tokenRegistrado;
  tokenRegistrado = null;
  void (async () => {
    try {
      const token = naMemoria ?? (await AsyncStorage.getItem(CHAVE_TOKEN));
      await AsyncStorage.removeItem(CHAVE_TOKEN);
      if (!token || !autorizacao) return;
      await api.delete('/notificacoes/dispositivos', {
        data: { token },
        headers: { Authorization: String(autorizacao) },
      });
    } catch {
      /* sem internet: a API remove o token quando o Expo disser que não vale mais */
    }
  })();
}

/** Lê os dados do push (vêm como Record<string, unknown>). */
export function dadosDoPush(n: Notifications.Notification): DadosPush {
  const d = (n.request.content.data ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : null);
  return {
    id_notificacao: num(d.id_notificacao) ?? undefined,
    id_tipo_notificacao: num(d.id_tipo_notificacao) ?? undefined,
    id_atendimento: num(d.id_atendimento),
    id_formulario: num(d.id_formulario),
  };
}
