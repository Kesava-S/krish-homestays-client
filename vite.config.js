import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',   // ← this must match distDir in vercel.json
    emptyOutDir: true
  }
})