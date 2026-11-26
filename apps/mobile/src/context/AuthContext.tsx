import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAuthToken } from '../config/api';
import { TipoUsuario } from '../constants/dominio';
import { removerPush } from '../services/push';

export interface AuthUser {
  id_usuario: number;
  nome: string;
  email: string;
  tipo: number; // id_tipo_usuario — no app é sempre 2 (paciente)
}

interface AuthContextType {
  token: string | null;
  usuario: AuthUser | null;
  isLoading: boolean;
  login: (token: string, usuario: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUsuario: (partial: Partial<AuthUser>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.multiGet(['@pasi:token', '@pasi:usuario']).then(
      ([tokenEntry, usuarioEntry]) => {
        const saved = tokenEntry[1];
        const savedUser = usuarioEntry[1];
        const user = savedUser ? (JSON.parse(savedUser) as AuthUser) : null;
        if (saved && user?.tipo === TipoUsuario.PACIENTE) {
          setToken(saved);
          setUsuario(user);
          setAuthToken(saved);
        } else if (saved || savedUser) {
          // Sessão de profissional salva por versões antigas do app: o
          // acesso dele agora é só pelo painel web.
          AsyncStorage.multiRemove(['@pasi:token', '@pasi:usuario']).catch(() => null);
        }
        setIsLoading(false);
      },
    );
  }, []);

  const login = async (newToken: string, newUsuario: AuthUser) => {
    await AsyncStorage.multiSet([
      ['@pasi:token', newToken],
      ['@pasi:usuario', JSON.stringify(newUsuario)],
    ]);
    setAuthToken(newToken);
    setToken(newToken);
    setUsuario(newUsuario);
  };

  const logout = async () => {
    // antes de apagar o login: o aparelho deixa de receber o push desta conta
    removerPush();
    await AsyncStorage.multiRemove(['@pasi:token', '@pasi:usuario']);
    setAuthToken(null);
    setToken(null);
    setUsuario(null);
  };

  const updateUsuario = async (partial: Partial<AuthUser>) => {
    setUsuario((prev) => {
      if (!prev) return prev;
      const merged = { ...prev, ...partial };
      AsyncStorage.setItem('@pasi:usuario', JSON.stringify(merged)).catch(() => null);
      return merged;
    });
  };

  return (
    <AuthContext.Provider value={{ token, usuario, isLoading, login, logout, updateUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
