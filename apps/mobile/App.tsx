import './global.css';
import React, { useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator, StatusBar } from 'react-native';
import { vars } from 'nativewind';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { FeedbackProvider } from './src/context/FeedbackContext';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { AppNavigator } from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { carregarPrefs, usePrefsA11y } from './src/acessibilidade/preferencias';
import { useTema } from './src/acessibilidade/useTema';
import { variaveisDe } from './src/acessibilidade/tema';
import { MenuAcessibilidade } from './src/acessibilidade/MenuAcessibilidade';

function RootNavigator() {
  const { token, isLoading } = useAuth();
  const { cores } = useTema();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: cores.primaria }}>
        <ActivityIndicator color={cores.sobrePrimaria} size="large" accessibilityLabel="Carregando" />
      </View>
    );
  }

  return token ? <AppNavigator /> : <AuthNavigator />;
}

/**
 * Aplica o tema e as preferências de acessibilidade no topo da árvore:
 * - as variáveis de cor (vars) valem para todas as telas e janelas;
 * - "preto e branco" também passa um filtro de cinza por cima de tudo
 *   (fotos e logo inclusive; no Android 12 ou mais novo);
 * - a navegação recebe as cores do tema (fundo entre uma tela e outra).
 */
function Temado({ children }: { children: React.ReactNode }) {
  const { cores } = useTema();
  const { pretoBranco } = usePrefsA11y();
  const estilo = useMemo(() => vars(variaveisDe(cores)), [cores]);
  return (
    <View style={[{ flex: 1, backgroundColor: cores.superficie }, estilo, pretoBranco ? { filter: [{ grayscale: 1 }] } : null]}>
      {/* o cabeçalho é escuro em todos os temas: ícones claros na barra de status */}
      <StatusBar barStyle="light-content" />
      {children}
      <MenuAcessibilidade />
    </View>
  );
}

function Navegacao({ children }: { children: React.ReactNode }) {
  const { cores, escuro } = useTema();
  const temaNavegacao: Theme = useMemo(() => {
    const base = escuro ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: cores.acao, background: cores.superficie, card: cores.primaria, text: cores.texto, border: cores.borda },
    };
  }, [cores, escuro]);

  return (
    <NavigationContainer ref={navigationRef} theme={temaNavegacao}>
      {children}
    </NavigationContainer>
  );
}

export default function App() {
  // espera as preferências salvas (tema, tamanho do texto...) para não piscar o tema errado
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    carregarPrefs().finally(() => setPronto(true));
  }, []);
  if (!pronto) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Temado>
          <FeedbackProvider>
            <Navegacao>
              <RootNavigator />
            </Navegacao>
          </FeedbackProvider>
        </Temado>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
