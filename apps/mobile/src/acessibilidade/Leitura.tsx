import React, { createContext, forwardRef, useContext, type ReactNode } from 'react';
import {
  Text as RNText,
  TouchableOpacity as RNTouchableOpacity,
  type TextProps,
  type TouchableOpacityProps,
  type View,
} from 'react-native';
import { lerSeAtivo } from './fala';
import { usePrefsA11y } from './preferencias';

/**
 * Leitura ao tocar (RF05), no lugar do "ler ao clicar" do painel web.
 *
 * Os componentes daqui têm o mesmo nome dos do React Native e são usados no
 * lugar deles (só muda o import):
 *  - `TouchableOpacity`: com a leitura ligada, lê o rótulo do botão
 *    (accessibilityLabel ou o texto de dentro) e faz a ação normalmente;
 *  - `Text`: com a leitura ligada, tocar no texto lê o texto. Dentro de um
 *    botão, não intercepta o toque (quem lê e age é o botão).
 */

/** Dentro de algo tocável (botão, ou texto que já lê): o Text de dentro não intercepta o toque. */
const DentroDeToque = createContext(false);

/** Junta o texto de um conteúdo React (strings, números e o texto dos filhos). */
export function textoDe(no: ReactNode): string {
  if (no === null || no === undefined || typeof no === 'boolean') return '';
  if (typeof no === 'string' || typeof no === 'number') return String(no);
  if (Array.isArray(no)) return no.map(textoDe).filter(Boolean).join(' ');
  if (React.isValidElement<{ children?: ReactNode; accessibilityLabel?: string }>(no)) {
    if (no.props.accessibilityLabel) return no.props.accessibilityLabel;
    return textoDe(no.props.children);
  }
  return '';
}

/**
 * Para tocáveis que não são o TouchableOpacity daqui (ex.: Pressable): o Text
 * de dentro não intercepta o toque, e quem age é o tocável.
 */
export function AreaTocavel({ children }: { children: ReactNode }) {
  return <DentroDeToque.Provider value>{children}</DentroDeToque.Provider>;
}

export const Text = forwardRef<RNText, TextProps>(function Text(props, ref) {
  const { leitura } = usePrefsA11y();
  const dentro = useContext(DentroDeToque);
  const lerAqui = leitura && !dentro && !props.onPress;
  return (
    <DentroDeToque.Provider value={dentro || lerAqui}>
      <RNText
        ref={ref}
        {...props}
        onPress={lerAqui ? () => lerSeAtivo(props.accessibilityLabel ?? textoDe(props.children)) : props.onPress}
      />
    </DentroDeToque.Provider>
  );
});

interface PropsTocavel extends TouchableOpacityProps {
  /** O que ler ao tocar (padrão: accessibilityLabel ou o texto de dentro). */
  textoFala?: string;
  /** false: não lê (ex.: fundo que só segura o toque). */
  lerAoTocar?: boolean;
}

export const TouchableOpacity = forwardRef<View, PropsTocavel>(function TouchableOpacity(
  { textoFala, lerAoTocar = true, onPress, ...props },
  ref,
) {
  const aoTocar: TouchableOpacityProps['onPress'] =
    onPress && lerAoTocar
      ? (e) => {
          lerSeAtivo(textoFala ?? props.accessibilityLabel ?? textoDe(props.children));
          onPress(e);
        }
      : onPress;
  return (
    <DentroDeToque.Provider value>
      <RNTouchableOpacity ref={ref} {...props} onPress={aoTocar} />
    </DentroDeToque.Provider>
  );
});
