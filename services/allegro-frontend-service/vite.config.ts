import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: parseInt(process.env.ALLEGRO_FRONTEND_SERVICE_PORT || '', 10) || (() => {
      throw new Error('ALLEGRO_FRONTEND_SERVICE_PORT must be set in .env file');
    })(),
    host: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})

