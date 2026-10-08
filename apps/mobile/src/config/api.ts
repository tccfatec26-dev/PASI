import axios from 'axios';
import { Platform } from 'react-native';

// API local: o emulador Android enxerga a máquina host em 10.0.2.2.
const DEV_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';

/**
 * URL da API. Em produção (ou para apontar o dev para outra API), defina
 * EXPO_PUBLIC_API_URL no apps/mobile/.env — ver apps/mobile/.env.example.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEV_URL;

if (!__DEV__ && !process.env.EXPO_PUBLIC_API_URL) {
  console.warn('EXPO_PUBLIC_API_URL não definida: o app está usando a API local.');
}

const api = axios.create({ baseURL: API_BASE_URL });

export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
}

export default api;
