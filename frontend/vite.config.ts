import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

const API_PORT = process.env.API_PORT || '8787'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  server: {
    port: parseInt(process.env.PORT || '5173'),
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 2
      },
      mangle: true,
      format: {
        comments: false
      }
    }
  }
})
