import React, { useMemo, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { vars } from 'nativewind';
import { usePrefsA11y } from './preferencias';
import { variaveisDe } from './tema';
import { useTema } from './useTema';

/**
 * Aplica as variáveis de cor do tema atual (e o filtro do "preto e branco")
 * no conteúdo. O App usa no topo da árvore; cada <Modal> usa de novo na raiz
 * dele, porque a janela abre em outra camada, fora da raiz do App (no web, um
 * portal no fim do <body>), e não herdaria as variáveis.
 */
export function CamadaTema({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { cores } = useTema();
  const { pretoBranco } = usePrefsA11y();
  const variaveis = useMemo(() => vars(variaveisDe(cores)), [cores]);
  return <View style={[{ flex: 1 }, variaveis, pretoBranco ? { filter: [{ grayscale: 1 }] } : null, style]}>{children}</View>;
}
