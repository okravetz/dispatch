import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __SB_URL__: JSON.stringify(process.env.VITE_SUPABASE_URL),
    __SB_KEY__: JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY),
  },
})
