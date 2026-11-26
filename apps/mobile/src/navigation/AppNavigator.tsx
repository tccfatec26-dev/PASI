import React from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DrawerProvider } from '../context/DrawerContext';
import { ProfilePhotoProvider } from '../context/ProfilePhotoContext';
import { AppDrawer } from '../components/AppDrawer';
import { PacienteStackParamList } from './types';
import { useMovimentoReduzido } from '../acessibilidade/useTema';

import { MeusAtendimentosScreen } from '../screens/paciente/MeusAtendimentosScreen';
import { FormulariosAtendimentoScreen } from '../screens/paciente/FormulariosAtendimentoScreen';
import { ResponderFormularioScreen } from '../screens/paciente/ResponderFormularioScreen';

import { PerfilScreen } from '../screens/PerfilScreen';
import { NotificacoesScreen } from '../screens/NotificacoesScreen';

const PacStack = createNativeStackNavigator<PacienteStackParamList>();

// O aplicativo é só do paciente; o profissional usa o painel web.
export function AppNavigator() {
  // "Reduzir movimento": troca de tela sem deslizar
  const semMovimento = useMovimentoReduzido();
  return (
    <ProfilePhotoProvider>
      <DrawerProvider>
        <View style={{ flex: 1 }}>
          <PacStack.Navigator screenOptions={{ headerShown: false, animation: semMovimento ? 'none' : 'default' }}>
            <PacStack.Screen name="MeusAtendimentos" component={MeusAtendimentosScreen} />
            <PacStack.Screen name="FormulariosAtendimento" component={FormulariosAtendimentoScreen} />
            <PacStack.Screen name="ResponderFormulario" component={ResponderFormularioScreen} />
            <PacStack.Screen name="Perfil" component={PerfilScreen} />
            <PacStack.Screen name="Notificacoes" component={NotificacoesScreen} />
          </PacStack.Navigator>
          <AppDrawer />
        </View>
      </DrawerProvider>
    </ProfilePhotoProvider>
  );
}
