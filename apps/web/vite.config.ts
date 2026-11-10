import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Painel web do profissional. A API fica em VITE_API_URL (ver .env.example).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
