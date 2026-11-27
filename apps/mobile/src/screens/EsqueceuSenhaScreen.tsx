import React, { useState } from 'react';
import { View, Image, ScrollView } from 'react-native';
import { Text } from '../acessibilidade/Leitura';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '../navigation/types';
import { MaterialIcons } from '@expo/vector-icons';
import { ScreenHeader } from '../components/ScreenHeader';
import { InputField } from '../components/InputField';
import { PrimaryButton } from '../components/PrimaryButton';
import { authService } from '../services/auth';
import { useFeedback } from '../context/FeedbackContext';
import { isEmailValido } from '../utils/validation';
import { useCores } from '../acessibilidade/useTema';
import { TelaComTeclado } from '../components/TelaComTeclado';

export function EsqueceuSenhaScreen() {
  const cores = useCores();
  const navigation = useNavigation<NavigationProp>();
  const { toast } = useFeedback();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEnviar = async () => {
    if (!isEmailValido(email)) {
      setError('Informe um e-mail válido (ex.: nome@dominio.com)');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authService.esqueceuSenha(email.trim().toLowerCase());
      toast('Se o e-mail estiver cadastrado, você receberá as instruções em breve.', 'success');
      navigation.goBack();
    } catch {
      toast('Não foi possível processar a solicitação. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TelaComTeclado className="flex-1">
      <ScrollView className="flex-1 bg-white" keyboardShouldPersistTaps="handled">
        <ScreenHeader variant="large" onBack={() => navigation.goBack()}>
          <View className="items-center pb-4">
            <Image
              source={require('../../assets/logo.png')}
              style={{ width: 180, height: 65 }}
              resizeMode="contain"
              accessibilityLabel="PASI"
            />
          </View>
        </ScreenHeader>

        {/* Body */}
        <View className="px-6 pt-8 pb-10">
          <Text className="text-2xl font-bold text-primary mb-3">Esqueceu sua senha?</Text>
          <Text className="text-primary text-sm leading-5 mb-8">
            Não se preocupe. Digite seu e-mail abaixo e enviaremos instruções para redefinir sua
            senha.
          </Text>

          <InputField
            label="E-mail"
            placeholder="Digite seu e-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={error}
            leftIcon={<MaterialIcons name="email" size={18} color={cores.placeholder} />}
          />

          <PrimaryButton
            label="Enviar link de recuperação"
            onPress={handleEnviar}
            loading={loading}
          />

          <View className="mt-3">
            <PrimaryButton label="Voltar" onPress={() => navigation.goBack()} variant="outlined" />
          </View>
        </View>
      </ScrollView>
    </TelaComTeclado>
  );
}
