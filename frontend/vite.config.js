import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // "/" for local work; the production build sets VITE_BASE_PATH=/ask_inglis_professor/
  base: process.env.VITE_BASE_PATH || '/',
})
