import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Image,
  Platform,
  ScrollView,
} from 'react-native';
import { Text, TouchableOpacity } from '../acessibilidade/Leitura';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDrawer } from '../context/DrawerContext';
import { useAuth } from '../context/AuthContext';
import { useProfilePhoto } from '../context/ProfilePhotoContext';
import { navigate } from '../navigation/navigationRef';
import { useNotificacoes } from '../context/NotificacoesContext';
import { ContagemNaoLidas, rotuloNaoLidas } from './BotaoNotificacoes';
import { useCores, useMovimentoReduzido } from '../acessibilidade/useTema';

type IconName = keyof typeof MaterialIcons.glyphMap;

interface MenuItem {
  label: string;
  icon: IconName;
  route: string;
}

const MENU: MenuItem[] = [
  { label: 'Meus Atendimentos', icon: 'event-note', route: 'MeusAtendimentos' },
  { label: 'Notificações', icon: 'notifications', route: 'Notificacoes' },
  { label: 'Meu Perfil', icon: 'person', route: 'Perfil' },
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const PANEL_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 320);
const useNative = Platform.OS !== 'web';

function iniciais(nome?: string) {
  if (!nome) return '?';
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

export function AppDrawer() {
  const insets = useSafeAreaInsets();
  const { isOpen, closeDrawer } = useDrawer();
  const { usuario, logout } = useAuth();
  const { foto } = useProfilePhoto();
  const { naoLidas } = useNotificacoes();

  const cores = useCores();
  const semMovimento = useMovimentoReduzido();
  // "Reduzir movimento": abre e fecha sem deslizar
  const dAbrir = semMovimento ? 0 : 260;
  const dFechar = semMovimento ? 0 : 220;
  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: dAbrir, useNativeDriver: useNative }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: dAbrir, useNativeDriver: useNative }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -PANEL_WIDTH, duration: dFechar, useNativeDriver: useNative }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: dFechar, useNativeDriver: useNative }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [isOpen]);

  if (!mounted) return null;

  const irPara = (route: string) => {
    closeDrawer();
    // pequena espera para a animação de fechar não competir com a transição de tela
    setTimeout(() => navigate(route), semMovimento ? 0 : 180);
  };

  const handleLogout = () => {
    closeDrawer();
    setTimeout(() => logout(), semMovimento ? 0 : 180);
  };

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={closeDrawer} accessibilityLabel="Fechar menu">
        <Animated.View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            opacity: overlayOpacity,
          }}
        />
      </TouchableWithoutFeedback>

      {/* Painel */}
      <Animated.View
        style={{
          width: PANEL_WIDTH,
          height: '100%',
          backgroundColor: cores.superficie,
          transform: [{ translateX }],
        }}
        accessibilityViewIsModal
      >
        {/* Cabeçalho do perfil */}
        <View className="bg-cabecalho px-5" style={{ paddingTop: Math.max(insets.top, 16), paddingBottom: 24 }}>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-white/80 text-xs font-semibold uppercase tracking-wider">
              Paciente
            </Text>
            <TouchableOpacity
              onPress={closeDrawer}
              className="w-8 h-8 items-center justify-center"
              accessibilityRole="button"
              accessibilityLabel="Fechar menu"
            >
              <MaterialIcons name="close" size={22} color={cores.sobrePrimaria} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => irPara('Perfil')}
            className="flex-row items-center"
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Meu perfil: ${usuario?.nome ?? ''}`}
          >
            <View className="w-14 h-14 rounded-full bg-sobre-primaria/20 items-center justify-center overflow-hidden mr-3">
              {foto ? (
                <Image source={{ uri: foto }} style={{ width: 56, height: 56 }} resizeMode="cover" />
              ) : (
                <Text className="text-white text-lg font-bold">{iniciais(usuario?.nome)}</Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-white text-base font-bold" numberOfLines={1}>
                {usuario?.nome}
              </Text>
              <Text className="text-white/60 text-xs" numberOfLines={1}>
                {usuario?.email}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Itens de menu */}
        <ScrollView className="flex-1" contentContainerStyle={{ paddingVertical: 12 }}>
          {MENU.map((item) => (
            <TouchableOpacity
              key={item.route}
              onPress={() => irPara(item.route)}
              className="flex-row items-center px-5 py-4"
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={item.route === 'Notificacoes' ? `Notificações: ${rotuloNaoLidas(naoLidas)}` : item.label}
            >
              <MaterialIcons name={item.icon} size={22} color={cores.destaque} style={{ marginRight: 16 }} />
              <Text className="flex-1 text-gray-800 text-sm font-medium">{item.label}</Text>
              {item.route === 'Notificacoes' && <ContagemNaoLidas n={naoLidas} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Rodapé — Sair. O padding inferior respeita a barra de navegação do
            Android (edge-to-edge), senão o botão fica atrás dela. */}
        <View
          className="border-t border-border px-5 pt-4"
          style={{ paddingBottom: insets.bottom + 16 }}
        >
          <TouchableOpacity
            onPress={handleLogout}
            className="flex-row items-center"
            activeOpacity={0.6}
            accessibilityRole="button"
          >
            <MaterialIcons name="logout" size={22} color={cores.erro} style={{ marginRight: 16 }} />
            <Text className="text-red-500 text-sm font-medium">Sair</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}
