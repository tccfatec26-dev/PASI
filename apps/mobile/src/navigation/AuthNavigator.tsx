import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthStackParamList } from './types';
import { useMovimentoReduzido } from '../acessibilidade/useTema';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { CadastroPacienteScreen } from '../screens/CadastroPacienteScreen';
import { EsqueceuSenhaScreen } from '../screens/EsqueceuSenhaScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  // "Reduzir movimento": troca de tela sem deslizar
  const semMovimento = useMovimentoReduzido();
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: semMovimento ? 'none' : 'default' }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="CadastroPaciente" component={CadastroPacienteScreen} />
      <Stack.Screen name="EsqueceuSenha" component={EsqueceuSenhaScreen} />
    </Stack.Navigator>
  );
}
