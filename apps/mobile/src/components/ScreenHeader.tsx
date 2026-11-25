import React, { ReactNode } from 'react';
import { View } from 'react-native';
import { Text, TouchableOpacity } from '../acessibilidade/Leitura';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { BotaoAcessibilidade } from '../acessibilidade/MenuAcessibilidade';
import { useCores } from '../acessibilidade/useTema';

interface Props {
  title?: string;
  subtitle?: string;
  /** Exibe a seta de voltar. */
  onBack?: () => void;
  /** Exibe o botão de menu (telas iniciais). Ignorado se `onBack` for informado. */
  onMenu?: () => void;
  /** Conteúdo à direita do título (ex.: badge de status). */
  right?: ReactNode;
  /** Conteúdo abaixo do título (ex.: busca, barra de progresso, logo). */
  children?: ReactNode;
  /**
   * `default`: título em linha com o botão (padrão das telas).
   * `large`: seta acima e conteúdo centralizado (tela com logo, como a de
   * recuperar senha).
   */
  variant?: 'default' | 'large';
}

/**
 * Cabeçalho padrão das telas, já respeitando a área segura do topo. Sempre
 * tem, à direita, o botão do menu de acessibilidade (RF04: visível em todas as
 * telas).
 */
export function ScreenHeader({ title, subtitle, onBack, onMenu, right, children, variant = 'default' }: Props) {
  const insets = useSafeAreaInsets();
  const cores = useCores();

  if (variant === 'large') {
    return (
      <View className="bg-cabecalho px-6 pb-4" style={{ paddingTop: Math.max(insets.top + 16, 56) }}>
        <View className="flex-row items-center justify-between mb-3">
          {onBack ? (
            <TouchableOpacity onPress={onBack} className="self-start p-1" accessibilityRole="button" accessibilityLabel="Voltar">
              <MaterialIcons name="arrow-back" size={24} color={cores.sobrePrimaria} />
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <BotaoAcessibilidade />
        </View>
        {title ? (
          <Text className="text-white text-xl font-bold" accessibilityRole="header">
            {title}
          </Text>
        ) : null}
        {subtitle ? <Text className="text-white/70 text-sm">{subtitle}</Text> : null}
        {children}
      </View>
    );
  }

  const acao = onBack
    ? { icon: 'arrow-back' as const, onPress: onBack, label: 'Voltar' }
    : onMenu
      ? { icon: 'menu' as const, onPress: onMenu, label: 'Abrir menu' }
      : null;

  return (
    <View className="bg-cabecalho px-5 pb-4" style={{ paddingTop: Math.max(insets.top, 16) }}>
      <View className="flex-row items-center gap-3">
        {acao && (
          <TouchableOpacity
            onPress={acao.onPress}
            className="w-9 h-9 rounded-xl bg-sobre-primaria/15 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={acao.label}
          >
            <MaterialIcons name={acao.icon} size={22} color={cores.sobrePrimaria} />
          </TouchableOpacity>
        )}
        <View className="flex-1">
          {title ? (
            <Text className="text-white text-lg font-bold" numberOfLines={2} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text className="text-white/70 text-xs" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
        <BotaoAcessibilidade />
      </View>
      {children ? <View className="mt-3">{children}</View> : null}
    </View>
  );
}
