import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: '/asteroid-field/',
  publicDir: 'assets',
  server: {
    port: 5173,
    open: true
  }
})