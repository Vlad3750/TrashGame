import { defineConfig } from 'vite'

// Plain Vite — Excalibur manages its own canvas/game loop, no framework plugin needed.
export default defineConfig({
  server: {
    host: true,
    open: false,
  },
})
