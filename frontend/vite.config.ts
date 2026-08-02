import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // По умолчанию Vite на этой машине слушал только ::1; браузер к 127.0.0.1:5173
    // получает ~2s timeout на каждый новый TCP (IPv4-first / Happy Eyeballs).
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        // Явный IPv4 к Spring (слушает :: / dual-stack).
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
});
