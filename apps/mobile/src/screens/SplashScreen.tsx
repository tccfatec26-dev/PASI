import React, { useEffect } from 'react';
import { View, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NavigationProp } from '../navigation/types';

export function SplashScreen() {
  const navigation = useNavigation<NavigationProp>();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('Login');
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View className="flex-1 bg-cabecalho items-center justify-center">
      <View className="items-center flex-1 justify-center">
        <Image
          source={require('../../assets/logo.png')}
          style={{ width: 240, height: 87 }}
          accessibilityLabel="PASI"
          resizeMode="contain"
        />
      </View>
      <View className="flex-row gap-2 mb-12">
        <View className="w-2 h-2 rounded-full bg-sobre-primaria/40" />
        <View className="w-2 h-2 rounded-full bg-sobre-primaria" />
        <View className="w-2 h-2 rounded-full bg-sobre-primaria/40" />
      </View>
    </View>
  );
}
