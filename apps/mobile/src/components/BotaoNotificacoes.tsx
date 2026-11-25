import React from 'react';
import { View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Text, TouchableOpacity } from '../acessibilidade/Leitura';
import { useCores } from '../acessibilidade/useTema';
import { useNotificacoes } from '../context/NotificacoesContext';
import { navigate } from '../navigation/navigationRef';

export const rotuloNaoLidas = (n: number) =>
  n === 0 ? 'nenhuma nova' : n === 1 ? '1 notificação nova' : `${n} notificações novas`;

/** Número vermelho de não lidas (sino do cabeçalho e item do menu). */
export function ContagemNaoLidas({ n, contorno }: { n: number; contorno?: boolean }) {
  if (n <= 0) return null;
  return (
    <View
      className={`min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 items-center justify-center ${contorno ? 'border-2 border-cabecalho' : ''}`}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text className="text-white text-[11px] font-bold">{n > 99 ? '99+' : n}</Text>
    </View>
  );
}

/** Sino do cabeçalho (tela inicial): abre as notificações. */
export function BotaoNotificacoes() {
  const cores = useCores();
  const { naoLidas } = useNotificacoes();
  const rotulo = `Notificações: ${rotuloNaoLidas(naoLidas)}`;
  return (
    <TouchableOpacity
      onPress={() => navigate('Notificacoes')}
      className="w-9 h-9 rounded-xl bg-sobre-primaria/15 items-center justify-center"
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      hitSlop={6}
    >
      <MaterialIcons name={naoLidas > 0 ? 'notifications-active' : 'notifications-none'} size={22} color={cores.sobrePrimaria} />
      <View style={{ position: 'absolute', top: -6, right: -8 }} pointerEvents="none">
        <ContagemNaoLidas n={naoLidas} contorno />
      </View>
    </TouchableOpacity>
  );
}
