import React, { createContext, useContext, useRef, useState } from 'react';
import { View, Modal, Animated, Platform } from 'react-native';
import { Text, TouchableOpacity } from '../acessibilidade/Leitura';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lerAviso } from '../acessibilidade/fala';
import { usePrefsA11y } from '../acessibilidade/preferencias';
import { useCores, useMovimentoReduzido } from '../acessibilidade/useTema';
import type { NomeCor } from '../acessibilidade/tema';
import { CamadaTema } from '../acessibilidade/CamadaTema';

type ToastType = 'success' | 'error' | 'info';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface FeedbackContextType {
  toast: (message: string, type?: ToastType) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextType | null>(null);

const useNative = Platform.OS !== 'web';

// fundo de cada tipo de aviso (cor do tema; o texto é sempre "sobre-primária")
const TOAST_STYLE: Record<ToastType, { bg: NomeCor; icon: keyof typeof MaterialIcons.glyphMap }> = {
  success: { bg: 'sucesso', icon: 'check-circle' },
  error: { bg: 'erroForte', icon: 'error' },
  info: { bg: 'primaria', icon: 'info' },
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const cores = useCores();
  const { contraste } = usePrefsA11y();
  const semMovimento = useMovimentoReduzido();
  const dAnim = semMovimento ? 0 : 200;

  // ---- Toast (exibido na parte inferior, acima dos botões de navegação) ----
  const [toastState, setToastState] = useState<{ message: string; type: ToastType } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: dAnim, useNativeDriver: useNative }),
      Animated.timing(translateY, { toValue: 24, duration: dAnim, useNativeDriver: useNative }),
    ]).start(({ finished }) => {
      if (finished) setToastState(null);
    });
  };

  const toast = (message: string, type: ToastType = 'success') => {
    if (timer.current) clearTimeout(timer.current);
    setToastState({ message, type });
    // RF05/RF06: o aviso vai para o leitor de tela e, com a leitura ligada, é falado
    lerAviso(type === 'error' ? `Erro. ${message}` : message);
    opacity.setValue(0);
    translateY.setValue(semMovimento ? 0 : 24);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: dAnim, useNativeDriver: useNative }),
      Animated.timing(translateY, { toValue: 0, duration: dAnim, useNativeDriver: useNative }),
    ]).start();
    // 4 s na tela: tempo para ler (e ouvir) o aviso
    timer.current = setTimeout(hideToast, 4000);
  };

  // ---- Confirm ----
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = (options: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      setConfirmState({ options, resolve });
      lerAviso([options.title, options.message].filter(Boolean).join('. '));
    });

  const responder = (resultado: boolean) => {
    confirmState?.resolve(resultado);
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast host */}
      {toastState && (
        <Animated.View
          pointerEvents="box-none"
          accessibilityLiveRegion="polite"
          accessibilityRole={toastState.type === 'error' ? 'alert' : 'text'}
          style={{
            position: 'absolute',
            // Acima da barra fixa de botões de navegação (FormFooter).
            bottom: Math.max(insets.bottom, 12) + 76,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            alignItems: 'center',
            zIndex: 1000,
            opacity,
            transform: [{ translateY }],
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: cores[TOAST_STYLE[toastState.type].bg],
              // no alto contraste o fundo é preto: o contorno separa o aviso da tela
              borderWidth: contraste ? 2 : 0,
              borderColor: cores.sobrePrimaria,
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 14,
              maxWidth: 480,
              width: '100%',
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 4,
            }}
          >
            <MaterialIcons
              name={TOAST_STYLE[toastState.type].icon}
              size={20}
              color={cores.sobrePrimaria}
              style={{ marginRight: 10 }}
            />
            <Text className="text-white text-sm font-medium flex-1">{toastState.message}</Text>
          </View>
        </Animated.View>
      )}

      {/* Confirm host */}
      <Modal
        visible={!!confirmState}
        transparent
        animationType={semMovimento ? 'none' : 'fade'}
        onRequestClose={() => responder(false)}
      >
        <CamadaTema>
          <View className="flex-1 items-center justify-center bg-black/50 px-8">
            <View className="bg-white rounded-2xl p-5 w-full border border-border" style={{ maxWidth: 380 }} accessibilityViewIsModal>
              <Text className="text-primary font-bold text-base mb-2" accessibilityRole="header">
                {confirmState?.options.title}
              </Text>
              {confirmState?.options.message ? (
                <Text className="text-gray-600 text-sm mb-5 leading-5">
                  {confirmState.options.message}
                </Text>
              ) : (
                <View className="mb-3" />
              )}
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => responder(false)}
                  className="flex-1 h-11 border border-border rounded-xl items-center justify-center"
                  accessibilityRole="button"
                >
                  <Text className="text-gray-600 font-medium">
                    {confirmState?.options.cancelLabel ?? 'Cancelar'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => responder(true)}
                  accessibilityRole="button"
                  className={`flex-1 h-11 rounded-xl items-center justify-center border-2 ${
                    confirmState?.options.destructive ? 'bg-red-600 border-red-400' : 'bg-primary border-primary'
                  }`}
                >
                  <Text className="text-white font-semibold">
                    {confirmState?.options.confirmLabel ?? 'Confirmar'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </CamadaTema>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback deve ser usado dentro de FeedbackProvider');
  return ctx;
}
