/**
 * Widget content guardrail.
 *
 * Every enabled default widget in DASH_WIDGETS must have an authored entry in
 * WIDGET_CONTENT — otherwise data-driven users tapping a widget will see the
 * generic "coming soon" fallback.
 */

const PATH_CONTENT = require.resolve('../src/lib/widgetContent.ts')
const PATH_STORE   = require.resolve('../src/stores/useDashStore.ts')
const fs = require('fs')

const contentSource = fs.readFileSync(PATH_CONTENT, 'utf8')
const storeSource   = fs.readFileSync(PATH_STORE, 'utf8')

function extractWidgetIds(src) {
  const ids = []
  const re = /\{\s*id:\s*['"]([a-z0-9-]+)['"]/g
  let m
  while ((m = re.exec(src)) !== null) ids.push(m[1])
  return ids
}

function extractEnabledWidgetRows(src) {
  const rows = []
  const re = /\{\s*id:\s*['"]([a-z0-9-]+)['"][^}]*enabled:\s*(true|false)/g
  let m
  while ((m = re.exec(src)) !== null) rows.push({ id: m[1], enabled: m[2] === 'true' })
  return rows
}

function extractContentKeys(src) {
  const keys = new Set()
  // WIDGET_CONTENT: Record<...> = { 'id': { ... }, 'id2': { ... } }
  // match the top-level keys. They appear as `'xxx-yyy':` lines.
  const re = /^\s+'([a-z0-9-]+)':\s*\{/gm
  let m
  while ((m = re.exec(src)) !== null) keys.add(m[1])
  return keys
}

describe('widget-content guardrail', () => {
  const rows = extractEnabledWidgetRows(storeSource)
  const contentKeys = extractContentKeys(contentSource)
  const enabledIds = rows.filter(r => r.enabled).map(r => r.id)

  test('parsed the store and content files', () => {
    expect(rows.length).toBeGreaterThan(20)
    expect(contentKeys.size).toBeGreaterThan(20)
  })

  test.each(enabledIds)('enabled widget %s has an authored WIDGET_CONTENT entry', (id) => {
    expect(contentKeys.has(id)).toBe(true)
  })

  test('no orphan content entries (every content id maps to a real widget)', () => {
    const allIds = new Set(extractWidgetIds(storeSource))
    for (const k of contentKeys) {
      expect(allIds.has(k)).toBe(true)
    }
  })
})
