import React, { ReactNode } from 'react';
import { View, Modal, ScrollView } from 'react-native';
import { Text, TouchableOpacity } from '../acessibilidade/Leitura';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DateField } from './DateField';
import { useCores, useMovimentoReduzido } from '../acessibilidade/useTema';
import { CamadaTema } from '../acessibilidade/CamadaTema';

interface Props {
  visible: boolean;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  title?: string;
  /** Seções de filtro (use FilterSection). */
  children: ReactNode;
}

/** Bottom sheet padrão de filtros e ordenação das listagens. */
export function FiltrosModal({
  visible,
  onClose,
  onClear,
  onApply,
  title = 'Filtros e Ordenação',
  children,
}: Props) {
  const cores = useCores();
  const semMovimento = useMovimentoReduzido();
  // a janela ocupa a tela toda (edge-to-edge): os botões sobem acima da
  // barra de navegação do Android, como no menu de acessibilidade
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={semMovimento ? 'none' : 'slide'} onRequestClose={onClose}>
      <CamadaTema>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl px-5 pt-5" style={{ maxHeight: '90%', paddingBottom: insets.bottom + 16 }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-primary font-bold text-base" accessibilityRole="header">
                {title}
              </Text>
              <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar">
                <MaterialIcons name="close" size={22} color={cores.texto5} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>

            <View className="flex-row gap-3 mt-4">
              <TouchableOpacity
                onPress={onClear}
                className="flex-1 h-12 border border-border rounded-2xl items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Limpar os filtros"
              >
                <Text className="text-gray-600 font-medium">Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onApply}
                className="flex-1 h-12 bg-primary rounded-2xl items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel="Aplicar os filtros"
              >
                <Text className="text-white font-semibold">Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </CamadaTema>
    </Modal>
  );
}

/** Bloco de filtro com título em caixa alta. */
export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold text-gray-500 uppercase mb-2" accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Par de datas "De / Até" (formato dd/mm/aaaa). */
export function FilterDateRange({
  inicio,
  fim,
  onChangeInicio,
  onChangeFim,
}: {
  inicio: string;
  fim: string;
  onChangeInicio: (valor: string) => void;
  onChangeFim: (valor: string) => void;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="flex-1">
        <DateField label="De" value={inicio} onChange={onChangeInicio} />
      </View>
      <View className="flex-1">
        <DateField label="Até" value={fim} onChange={onChangeFim} />
      </View>
    </View>
  );
}
