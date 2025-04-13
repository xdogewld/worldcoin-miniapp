import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    https: false, // pastikan ini false atau hapus property 'https'
    port: 5173,
  },
});
