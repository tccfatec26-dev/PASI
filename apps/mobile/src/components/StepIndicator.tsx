import React from 'react';
import { View } from 'react-native';
import { Text } from '../acessibilidade/Leitura';
import { useCores } from '../acessibilidade/useTema';
import { MaterialIcons } from '@expo/vector-icons';

interface Props {
  steps: string[];
  current: number;
}

export function StepIndicator({ steps, current }: Props) {
  const cores = useCores();
  return (
    <View
      className="flex-row items-start justify-center px-4 py-4"
      accessible
      accessibilityLabel={`Etapa ${current} de ${steps.length}: ${steps[current - 1] ?? ''}`}
    >
      {steps.map((label, index) => {
        const stepNum = index + 1;
        const isCompleted = stepNum < current;
        const isActive = stepNum === current;

        return (
          <React.Fragment key={index}>
            <View className="items-center">
              <View
                className={`w-8 h-8 rounded-full items-center justify-center ${
                  isCompleted || isActive
                    ? 'bg-primary'
                    : 'bg-white border-2 border-border'
                }`}
              >
                {isCompleted ? (
                  <MaterialIcons name="check" size={14} color={cores.sobrePrimaria} />
                ) : (
                  <Text
                    className={`text-sm font-semibold ${
                      isActive ? 'text-white' : 'text-muted'
                    }`}
                  >
                    {stepNum}
                  </Text>
                )}
              </View>
              <Text
                className={`text-xs mt-1 ${
                  isActive ? 'text-primary font-semibold' : 'text-muted'
                }`}
              >
                {label}
              </Text>
            </View>

            {index < steps.length - 1 && (
              <View
                className={`flex-1 h-0.5 mt-4 mx-1 ${
                  isCompleted ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}
