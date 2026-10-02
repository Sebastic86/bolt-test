/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // `vite --mode mock` (npm run dev:mock): swap supabase-js for an in-browser
  // fake with seeded data and auto sign-in — see src/mock/supabase-js.ts.
  const mock = mode === 'mock'

  return {
    plugins: [react(), tailwindcss()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    resolve: mock
      ? { alias: [{ find: /^@supabase\/supabase-js$/, replacement: '/src/mock/supabase-js.ts' }] }
      : undefined,
    define: mock
      ? {
          'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://mock.local'),
          'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('mock-anon-key'),
        }
      : undefined,
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      exclude: ['e2e/**', 'node_modules/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
      },
    },
  }
})
