/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Plaid's sandbox is demo-only and off unless the deployment opts in; the
    // same variable gates /api/plaid-sandbox on the server.
    __PLAID_SANDBOX__: JSON.stringify(process.env.ENABLE_PLAID_SANDBOX === 'true'),
  },
  test: {
    // Node by default: the logic suites (valuation, ranking, freshness) are
    // the bulk of the tests and have no use for a DOM, so they stay fast.
    // Component tests opt in per file with `// @vitest-environment jsdom`.
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
