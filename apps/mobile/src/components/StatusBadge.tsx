import React, { useRef, useState } from 'react';
import { View, Pressable, Modal, Animated, Dimensions, Platform } from 'react-native';
import { AreaTocavel, Text } from '../acessibilidade/Leitura';
import { lerSeAtivo } from '../acessibilidade/fala';
import { usePrefsA11y } from '../acessibilidade/preferencias';
import { useCores, useMovimentoReduzido, useTema } from '../acessibilidade/useTema';
import { corEmCinza } from '../acessibilidade/tema';
import { CamadaTema } from '../acessibilidade/CamadaTema';

// Cada status tem cor própria (fundo + texto do badge), em versão clara e
// escura; no alto contraste, todos ficam preto com amarelo.
type Cor = 'azul' | 'ambar' | 'laranja' | 'roxo' | 'verde' | 'marinho' | 'cinza';

const CORES_STATUS: Record<Cor, { claro: [string, string]; escuro: [string, string] }> = {
  azul: { claro: ['#EFF6FF', '#1D4ED8'], escuro: ['#172B4D', '#84B3FF'] },
  ambar: { claro: ['#FFFBEB', '#B45309'], escuro: ['#33280C', '#FFD27A'] },
  laranja: { claro: ['#FFF7ED', '#C2410C'], escuro: ['#3A2410', '#FDBA74'] },
  roxo: { claro: ['#FAF5FF', '#7C3AED'], escuro: ['#2A1F47', '#C4B5FD'] },
  verde: { claro: ['#F0FDF4', '#15803D'], escuro: ['#10301F', '#74D396'] },
  marinho: { claro: ['#0D2347', '#FFFFFF'], escuro: ['#D8E2F3', '#0B1424'] },
  cinza: { claro: ['#F3F4F6', '#6B7280'], escuro: ['#1B2B47', '#9CABC4'] },
};

interface StyleDef {
  cor: Cor;
  label: string;
}

const ATENDIMENTO: Record<string, StyleDef> = {
  '1': { cor: 'azul', label: 'Criado' },
  '2': { cor: 'ambar', label: 'Iniciado' },
  '3': { cor: 'laranja', label: 'Respondido' },
  '4': { cor: 'roxo', label: 'Em avaliação' },
  '5': { cor: 'verde', label: 'Avaliado' },
  '6': { cor: 'marinho', label: 'Encerrado' },
  '7': { cor: 'cinza', label: 'Inativo' },
};

const FORMULARIO: Record<string, StyleDef> = {
  '1': { cor: 'ambar', label: 'Pendente' },
  '2': { cor: 'verde', label: 'Respondido' },
  '3': { cor: 'roxo', label: 'Em avaliação' },
  '4': { cor: 'azul', label: 'Avaliado' },
};

// Explica em que momento cada status é atingido (exibido no tooltip).
const TOOLTIP_ATENDIMENTO: Record<string, string> = {
  '1': 'O atendimento foi criado pelo profissional e aguarda o paciente iniciar os formulários.',
  '2': 'O paciente iniciou o preenchimento de pelo menos um formulário.',
  '3': 'O paciente concluiu e enviou todos os formulários atribuídos.',
  '4': 'O profissional iniciou a avaliação dos formulários respondidos.',
  '5': 'Todos os formulários do atendimento foram avaliados pelo profissional.',
  '6': 'O atendimento foi encerrado pelo profissional após a avaliação.',
  '7': 'O atendimento foi inativado (criado indevidamente).',
};

const TOOLTIP_FORMULARIO: Record<string, string> = {
  '1': 'O formulário ainda não foi respondido por completo pelo paciente.',
  '2': 'O formulário foi respondido e enviado pelo paciente.',
  '3': 'O profissional iniciou a análise das respostas deste formulário.',
  '4': 'O profissional finalizou a avaliação e registrou a observação. Não permite nova avaliação.',
};

interface Props {
  status: number;
  variant?: 'atendimento' | 'formulario';
  /** Ao tocar no badge, exibe um balão explicando quando o status é atingido. */
  tooltip?: boolean;
}

const useNative = Platform.OS !== 'web';
const TOOLTIP_WIDTH = 240;

export function StatusBadge({ status, variant = 'atendimento', tooltip = false }: Props) {
  const map = variant === 'formulario' ? FORMULARIO : ATENDIMENTO;
  const tips = variant === 'formulario' ? TOOLTIP_FORMULARIO : TOOLTIP_ATENDIMENTO;
  const st = map[String(status)] ?? { cor: 'cinza' as Cor, label: String(status) };
  const tipText = tips[String(status)];
  const { escuro } = useTema();
  const prefs = usePrefsA11y();
  const cores = useCores();
  const semMovimento = useMovimentoReduzido();
  const [bg, fg] = prefs.contraste
    ? ['#000000', '#FFEB3B']
    : CORES_STATUS[st.cor][escuro ? 'escuro' : 'claro'].map((c) => (prefs.pretoBranco ? corEmCinza(c) : c));
  const s = { bg, text: fg, label: st.label };

  const badgeRef = useRef<View>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fecharTooltip = () => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(anim, { toValue: 0, duration: semMovimento ? 0 : 150, useNativeDriver: useNative }).start(
      ({ finished }) => {
        if (finished) setTipPos(null);
      },
    );
  };

  const abrirTooltip = () => {
    if (!tipText) return;
    badgeRef.current?.measureInWindow((x, y, w, h) => {
      const screenW = Dimensions.get('window').width;
      // Alinha o balão à direita do badge, sem sair da tela.
      const left = Math.min(Math.max(x + w - TOOLTIP_WIDTH, 8), screenW - TOOLTIP_WIDTH - 8);
      setTipPos({ top: y + h + 8, left });
      lerSeAtivo(`${s.label}. ${tipText}`);
      if (semMovimento) anim.setValue(1);
      else {
        anim.setValue(0);
        Animated.spring(anim, { toValue: 1, useNativeDriver: useNative, friction: 7, tension: 120 }).start();
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(fecharTooltip, 4000);
    });
  };

  const badge = (
    <View
      ref={badgeRef}
      style={{
        backgroundColor: s.bg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: s.text,
      }}
    >
      <Text className="text-xs font-semibold" style={{ color: s.text }}>
        {s.label}
      </Text>
    </View>
  );

  if (!tooltip) return badge;

  return (
    <>
      <Pressable
        onPress={abrirTooltip}
        accessibilityRole="button"
        accessibilityLabel={`Situação: ${s.label}`}
        accessibilityHint="Toque para saber o que significa"
      >
        <AreaTocavel>{badge}</AreaTocavel>
      </Pressable>

      <Modal visible={!!tipPos} transparent animationType="none" onRequestClose={fecharTooltip}>
        <CamadaTema>
          <Pressable style={{ flex: 1 }} onPress={fecharTooltip}>
            {tipPos && (
              <Animated.View
                style={{
                  position: 'absolute',
                  top: tipPos.top,
                  left: tipPos.left,
                  width: TOOLTIP_WIDTH,
                  backgroundColor: cores.primaria,
                  borderWidth: prefs.contraste ? 2 : 0,
                  borderColor: cores.sobrePrimaria,
                  borderRadius: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  opacity: anim,
                  transform: [
                    {
                      translateY: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-6, 0],
                      }),
                    },
                    {
                      scale: anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.92, 1],
                      }),
                    },
                  ],
                  shadowColor: '#000',
                  shadowOpacity: 0.25,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                }}
              >
                <Text className="text-white text-xs font-bold mb-1">{s.label}</Text>
                <Text className="text-white text-xs leading-5">{tipText}</Text>
              </Animated.View>
            )}
          </Pressable>
        </CamadaTema>
      </Modal>
    </>
  );
}
