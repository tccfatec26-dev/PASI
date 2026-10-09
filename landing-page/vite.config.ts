import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/-Landing_Page_PASI/',
  server: {
    host: '0.0.0.0',
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
