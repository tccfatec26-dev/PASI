import React, { useEffect, useState } from 'react';
import { View, TextInput, TextInputProps } from 'react-native';
import { Text, TouchableOpacity } from '../acessibilidade/Leitura';
import { lerAviso, lerSeAtivo } from '../acessibilidade/fala';
import { useCores } from '../acessibilidade/useTema';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  secureToggle?: boolean;
  leftIcon?: React.ReactNode;
  disabled?: boolean;
  /** Exibe contador de caracteres (exige maxLength). */
  counter?: boolean;
}

export function InputField({
  label,
  error,
  secureToggle,
  secureTextEntry,
  leftIcon,
  disabled,
  editable,
  counter,
  maxLength,
  value,
  onFocus,
  ...rest
}: Props) {
  const cores = useCores();
  const [hidden, setHidden] = useState(secureTextEntry ?? false);
  const isEditable = disabled ? false : editable;
  const mostraContador = counter && maxLength !== undefined && !disabled;
  const multiline = !!rest.multiline;
  const senha = !!(secureToggle || secureTextEntry);
  // rótulo sem o "*" de obrigatório, para a leitura
  const nome = label.replace(/\s*\*\s*$/, '');

  // RF06: o erro que aparece é anunciado (leitor de tela e leitura em voz alta)
  useEffect(() => {
    if (error) lerAviso(`${nome}: ${error}`);
  }, [error]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      <View
        className={`flex-row border rounded-xl px-4 ${multiline ? 'items-start py-3' : 'items-center h-12'} ${
          error ? 'border-red-400' : 'border-border'
        } ${disabled ? 'bg-gray-100' : 'bg-input-bg'}`}
      >
        {leftIcon && <View className="mr-2">{leftIcon}</View>}
        <TextInput
          className={`flex-1 text-sm ${disabled ? 'text-gray-400' : 'text-gray-800'}`}
          placeholderTextColor={cores.placeholder}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          editable={isEditable}
          maxLength={maxLength}
          value={value}
          textAlignVertical={multiline ? 'top' : undefined}
          style={multiline ? { minHeight: 72 } : undefined}
          // RF06: o campo é identificado pelo rótulo e o erro vai junto, em texto
          accessibilityLabel={nome}
          accessibilityHint={error ? `Erro: ${error}` : undefined}
          accessibilityState={{ disabled: !!disabled }}
          onFocus={(e) => {
            // a senha nunca é lida em voz alta
            const conteudo = senha ? (value ? 'senha preenchida' : rest.placeholder) : value || rest.placeholder;
            lerSeAtivo([nome, conteudo, error && `Erro: ${error}`].filter(Boolean).join('. '));
            onFocus?.(e);
          }}
          {...rest}
        />
        {secureToggle && (
          <TouchableOpacity
            onPress={() => setHidden((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar senha' : 'Ocultar senha'}
            hitSlop={8}
          >
            <Text className="text-muted text-xs">{hidden ? 'Mostrar' : 'Ocultar'}</Text>
          </TouchableOpacity>
        )}
      </View>
      {error || mostraContador ? (
        <View className="flex-row justify-between mt-1">
          {error ? (
            <Text className="text-red-500 text-xs flex-1" accessibilityRole="alert" accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : (
            <View className="flex-1" />
          )}
          {mostraContador ? (
            <Text className="text-muted text-xs ml-2" accessibilityLabel={`${String(value ?? '').length} de ${maxLength} caracteres`}>
              {String(value ?? '').length}/{maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
