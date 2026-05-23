/**
 * Token enforcement: fontSize values in the standard type scale must use
 * CSS custom properties (var(--text-*)), not raw px literals.
 *
 * Scale sizes that must be tokenized: 11px 13px 14px 16px 18px 20px 24px 32px 48px
 * Allowed non-scale sizes: 8px 9px 10px 12px 15px 17px 22px 26px 28px 36px 52px 56px 64px 68px
 * Canvas ctx.font strings in RaceShareCard.tsx are exempt (not React inline styles).
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const SCALE_SIZES = ['11px', '13px', '14px', '16px', '18px', '20px', '24px', '32px', '48px']

function getAllTsxFiles(dir: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
      results.push(...getAllTsxFiles(full))
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      results.push(full)
    }
  }
  return results
}

describe('CSS token enforcement — fontSize', () => {
  const srcDir = join(__dirname, '../../..')
  const files = getAllTsxFiles(join(srcDir, 'src'))

  for (const size of SCALE_SIZES) {
    it(`no hardcoded fontSize: '${size}' in src/ — must use var(--text-*)`, () => {
      const violations: string[] = []
      const pattern = new RegExp(`fontSize:\\s*'${size}'`, 'g')

      for (const file of files) {
        const content = readFileSync(file, 'utf-8')
        const matches = content.match(pattern)
        if (matches) {
          const rel = file.replace(srcDir + '/', '')
          violations.push(`${rel}: ${matches.length} instance(s)`)
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `Hardcoded fontSize: '${size}' found (use var(--text-*) instead):\n${violations.join('\n')}`
        )
      }
    })
  }
})
