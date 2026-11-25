import React from 'react';
import { ActivityIndicator } from 'react-native';
import { Text, TouchableOpacity } from '../acessibilidade/Leitura';
import { useCores } from '../acessibilidade/useTema';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'filled' | 'outlined';
  loading?: boolean;
  disabled?: boolean;
}

export function PrimaryButton({ label, onPress, variant = 'filled', loading = false, disabled = false }: Props) {
  const cores = useCores();
  const isFilled = variant === 'filled';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      // no tema claro a borda do botão cheio tem a cor do fundo; no escuro e no
      // alto contraste ela contorna o botão
      className={`h-12 rounded-xl items-center justify-center mt-2 border-2 border-primary ${
        isFilled ? 'bg-primary' : 'bg-white'
      } ${disabled || loading ? 'opacity-50' : ''}`}
    >
      {loading ? (
        <ActivityIndicator color={isFilled ? cores.sobrePrimaria : cores.destaque} />
      ) : (
        <Text className={`font-semibold text-base ${isFilled ? 'text-white' : 'text-primary'}`}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
