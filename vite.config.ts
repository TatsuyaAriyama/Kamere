import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// GitHub Pages（プロジェクトサイト）では /Kamere/ 配下に配信されるため、
// VITE_BASE でベースパスを差し込む。iOS(Capacitor) はルート配信なので既定は '/'。
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
})
