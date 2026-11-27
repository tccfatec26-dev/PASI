import React, { ReactNode, useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleProp, ViewStyle } from 'react-native';

/**
 * Tela que sobe junto com o teclado virtual, para o campo em que a pessoa digita ficar à vista.
 *
 * O app é edge-to-edge no Android (padrão do Expo): a janela NÃO encolhe quando o teclado abre.
 * Antes, as telas usavam `behavior` só no iOS, então no Android o teclado cobria o campo.
 * O guia do Expo (docs.expo.dev/guides/keyboard-handling) recomenda `behavior="padding"` nas
 * duas plataformas, sem `softwareKeyboardLayoutMode: "pan"` no app.json (o app não usa).
 *
 * Use como a raiz da tela, no lugar do KeyboardAvoidingView. O ScreenHeader fica DENTRO dela,
 * por isso não há deslocamento (keyboardVerticalOffset) a compensar.
 */
export function TelaComTeclado({
  children,
  className = 'flex-1',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView className={className} style={style} behavior="padding">
      {children}
    </KeyboardAvoidingView>
  );
}

/** true enquanto o teclado virtual estiver aberto. */
export function useTecladoAberto() {
  const [aberto, setAberto] = useState(false);
  useEffect(() => {
    // no iOS "will" deixa a animação junto com o teclado; o Android só emite os eventos "did"
    const mostrar = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const esconder = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const a = Keyboard.addListener(mostrar, () => setAberto(true));
    const b = Keyboard.addListener(esconder, () => setAberto(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return aberto;
}
