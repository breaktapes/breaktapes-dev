import { defineConfig, defineProject } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const alias = { '@': resolve(__dirname, 'src') }

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      defineProject({
        plugins: [react()],
        resolve: { alias },
        test: {
          name: 'react',
          environment: 'jsdom',
          globals: true,
          setupFiles: [resolve(__dirname, 'src/test-setup.ts')],
          include: ['src/**/*.test.{ts,tsx}'],
        },
      }),
      defineProject({
        test: {
          name: 'legacy',
          environment: 'jsdom',
          globals: true,
          setupFiles: [
            resolve(__dirname, 'tests/vitest-jest-shim.js'),
            resolve(__dirname, 'tests/jest.setup.js'),
          ],
          include: ['tests/**/*.test.js'],
        },
      }),
    ],
  },
})
