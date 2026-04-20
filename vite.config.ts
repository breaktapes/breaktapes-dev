import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    // @imgly/background-removal uses a conditional dynamic import for WebGPU
    // that Vite's import-analysis can't resolve. Stub it out so the WASM path is used.
    {
      name: 'stub-onnxruntime-webgpu',
      resolveId(id: string) {
        if (id === 'onnxruntime-web/webgpu') return '\0onnxruntime-webgpu-stub'
      },
      load(id: string) {
        if (id === '\0onnxruntime-webgpu-stub') return 'export default null'
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['onnxruntime-web/webgpu'],
      output: {
        // Vendor chunks — split large deps so the app chunk stays small.
        // MapLibre + deck.gl together are ~1MB; splitting them means repeat
        // visitors can serve them from cache even after app code updates.
        manualChunks: (id: string) => {
          if (id.includes('node_modules')) {
            // Map / geo — largest deps
            if (id.includes('maplibre-gl') || id.includes('@mapbox') || id.includes('deck.gl') || id.includes('@deck.gl')) {
              return 'vendor-map'
            }
            // React core — almost never changes
            if (id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react'
            }
            // Charts + animation
            if (id.includes('recharts') || id.includes('framer-motion') || id.includes('d3-')) {
              return 'vendor-charts'
            }
            // Everything else from node_modules → vendor-misc
            return 'vendor-misc'
          }
          // App code — no manualChunks key means Rollup decides (per-page lazy chunks)
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@imgly/background-removal'],
  },
  server: {
    port: 5173,
  },
})
