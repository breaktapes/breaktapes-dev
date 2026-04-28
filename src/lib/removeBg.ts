/**
 * removeBg.ts — browser-side background removal for medal photos
 *
 * Uses @imgly/background-removal (ONNX WASM, runs entirely in-browser).
 * First call downloads ~50 MB of model weights from jsDelivr CDN; browser
 * caches them permanently. Subsequent calls are near-instant after warm-up.
 *
 * rmbg CLI is the admin tool for community medals (upload-medals.sh).
 * This module handles user-uploaded medal photos in the V2 web app.
 */

import { removeBackground, type Config } from '@imgly/background-removal'

// Config: use CDN assets (avoids bundling the 50 MB model into dist)
const RMBG_CONFIG: Config = {
  publicPath: 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/dist/',
  debug: false,
  model: 'isnet_quint8',
}

let _warmingUp = false
let _warmedUp  = false

/** Pre-warm the model after first user interaction (speeds up first upload) */
export function warmupBgRemoval() {
  if (_warmingUp || _warmedUp) return
  _warmingUp = true
  // Trigger a tiny dummy removal to load the model into memory
  const canvas = document.createElement('canvas')
  canvas.width = 4; canvas.height = 4
  canvas.toBlob(blob => {
    if (!blob) return
    removeBackground(blob, RMBG_CONFIG)
      .then(() => { _warmedUp = true })
      .catch(() => {}) // ignore — warmup errors are non-fatal
      .finally(() => { _warmingUp = false })
  }, 'image/png')
}

/**
 * Remove background from a File (any image format).
 * Returns a data URL (PNG) with transparent background.
 * Throws if removal fails — caller should fall back to original.
 */
export async function removeMedalBackground(file: File): Promise<string> {
  const resultBlob = await removeBackground(file, RMBG_CONFIG)
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(resultBlob)
  })
}
