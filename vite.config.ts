import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  // Local dev: served at "/". GitHub Pages: served at "/chess-trainer/".
  base: command === 'build' ? '/chess-trainer/' : '/',
  plugins: [react(), tailwindcss()],
  worker: {
    format: 'es',
  },
}))
