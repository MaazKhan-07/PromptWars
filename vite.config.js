import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('firebase')) return 'firebase';
          if (id.includes('geminiAI')) return 'gemini';
          if (id.includes('googleMaps')) return 'maps';
          if (id.includes('security')) return 'security';
        }
      }
    }
  },
  // Environment variables prefixed with VITE_ are exposed to client
  envPrefix: 'VITE_',
});
