import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const apiProxyTarget =
    String(env.VITE_API_PROXY_TARGET || '').trim() || 'http://127.0.0.1:8787'

  return {
    plugins: [react()],
    root: resolve(__dirname, 'src/renderer'),
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true
        }
      }
    },
    preview: {
      host: '0.0.0.0',
      port: 4173
    },
    build: {
      outDir: resolve(__dirname, 'dist/client'),
      emptyOutDir: true
    }
  }
})
