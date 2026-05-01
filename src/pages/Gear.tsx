import { useState, useMemo, useCallback } from 'react'
import { useAuthStore } from '@/stores/useAuthStore'
import { useRaceStore } from '@/stores/useRaceStore'
import { fmtDateDDMM } from '@/lib/utils'

// ─── Custom gear local storage helpers ────────────────────────────────────────

interface CustomGearItem {
  id: string
  name: string
  brand: string
  category: string
  notes: string
  createdAt: number
}

function loadSavedIds(): string[] {
  try { return JSON.parse(localStorage.getItem('fl2_saved_gear') ?? '[]') } catch { return [] }
}
function saveSavedIds(ids: string[]) {
  localStorage.setItem('fl2_saved_gear', JSON.stringify(ids))
}
function loadCustomGear(): CustomGearItem[] {
  try { return JSON.parse(localStorage.getItem('fl2_custom_gear') ?? '[]') } catch { return [] }
}
function saveCustomGear(items: CustomGearItem[]) {
  localStorage.setItem('fl2_custom_gear', JSON.stringify(items))
}

// ─── Gear Lists ──────────────────────────────────────────────────────────────

interface GearList {
  id: string
  name: string
  kind: string      // e.g. 'Race Day Kit', 'Training Kit', 'Travel Kit'
  itemIds: string[] // ordered product IDs (catalog or custom)
  createdAt: number
}

function loadGearLists(): GearList[] {
  try { return JSON.parse(localStorage.getItem('fl2_gear_lists') ?? '[]') } catch { return [] }
}
function saveGearLists(lists: GearList[]) { localStorage.setItem('fl2_gear_lists', JSON.stringify(lists)) }

function useGearLists() {
  const [lists, setLists] = useState<GearList[]>(loadGearLists)

  const addList = useCallback((name: string, kind: string) => {
    const item: GearList = { id: `gl-${Date.now()}`, name, kind, itemIds: [], createdAt: Date.now() }
    setLists(prev => { const next = [item, ...prev]; saveGearLists(next); return next })
    return item
  }, [])

  const updateList = useCallback((id: string, patch: Partial<GearList>) => {
    setLists(prev => { const next = prev.map(l => l.id === id ? { ...l, ...patch } : l); saveGearLists(next); return next })
  }, [])

  const deleteList = useCallback((id: string) => {
    setLists(prev => { const next = prev.filter(l => l.id !== id); saveGearLists(next); return next })
  }, [])

  const addItemToList = useCallback((listId: string, productId: string) => {
    setLists(prev => {
      const next = prev.map(l => l.id === listId && !l.itemIds.includes(productId)
        ? { ...l, itemIds: [...l.itemIds, productId] } : l)
      saveGearLists(next); return next
    })
  }, [])

  const removeItemFromList = useCallback((listId: string, productId: string) => {
    setLists(prev => {
      const next = prev.map(l => l.id === listId ? { ...l, itemIds: l.itemIds.filter(x => x !== productId) } : l)
      saveGearLists(next); return next
    })
  }, [])

  const moveItem = useCallback((listId: string, productId: string, dir: -1 | 1) => {
    setLists(prev => {
      const next = prev.map(l => {
        if (l.id !== listId) return l
        const idx  = l.itemIds.indexOf(productId)
        const swap = idx + dir
        if (idx < 0 || swap < 0 || swap >= l.itemIds.length) return l
        const ids = [...l.itemIds]
        ;[ids[idx], ids[swap]] = [ids[swap], ids[idx]]
        return { ...l, itemIds: ids }
      })
      saveGearLists(next); return next
    })
  }, [])

  return { lists, addList, updateList, deleteList, addItemToList, removeItemFromList, moveItem }
}

// ─── Gear Stacks ─────────────────────────────────────────────────────────────

interface GearStack {
  id: string
  name: string
  raceId?: string   // optional linked race
  template?: string // template used to create (e.g. 'Marathon Kit')
  itemIds: string[]
  createdAt: number
}

const STACK_TEMPLATES: { label: string; items: string[] }[] = [
  { label: 'Marathon Kit',    items: ['g1', 'g6', 'g19', 'g20', 'g22', 'g23'] },
  { label: 'Triathlon Kit',   items: ['g9', 'g10', 'g11', 'g13', 'g21'] },
  { label: 'Cycling Kit',     items: ['g14', 'g15', 'g16'] },
  { label: 'HYROX Kit',       items: ['g24', 'g25', 'g22'] },
  { label: 'Recovery Day',    items: ['g22', 'g23', 'g21'] },
]

function loadGearStacks(): GearStack[] {
  try { return JSON.parse(localStorage.getItem('fl2_stacks') ?? '[]') } catch { return [] }
}
function saveGearStacks(stacks: GearStack[]) { localStorage.setItem('fl2_stacks', JSON.stringify(stacks)) }

function useGearStacks() {
  const [stacks, setStacks] = useState<GearStack[]>(loadGearStacks)

  const addStack = useCallback((name: string, raceId?: string, template?: string, seedItemIds?: string[]) => {
    const item: GearStack = { id: `gs-${Date.now()}`, name, raceId, template, itemIds: seedItemIds ?? [], createdAt: Date.now() }
    setStacks(prev => { const next = [item, ...prev]; saveGearStacks(next); return next })
    return item
  }, [])

  const deleteStack = useCallback((id: string) => {
    setStacks(prev => { const next = prev.filter(s => s.id !== id); saveGearStacks(next); return next })
  }, [])

  const toggleStackItem = useCallback((stackId: string, productId: string) => {
    setStacks(prev => {
      const next = prev.map(s => {
        if (s.id !== stackId) return s
        const ids = s.itemIds.includes(productId) ? s.itemIds.filter(x => x !== productId) : [...s.itemIds, productId]
        return { ...s, itemIds: ids }
      })
      saveGearStacks(next); return next
    })
  }, [])

  return { stacks, addStack, deleteStack, toggleStackItem }
}

function useSavedGear() {
  const [savedIds, setSavedIds]     = useState<string[]>(loadSavedIds)
  const [customGear, setCustomGear] = useState<CustomGearItem[]>(loadCustomGear)

  const toggleSave = useCallback((id: string) => {
    setSavedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      saveSavedIds(next)
      return next
    })
  }, [])

  const addCustom = useCallback((item: Omit<CustomGearItem, 'id' | 'createdAt'>) => {
    const newItem: CustomGearItem = {
      ...item,
      id: `c-${Date.now()}`,
      createdAt: Date.now(),
    }
    setCustomGear(prev => {
      const next = [newItem, ...prev]
      saveCustomGear(next)
      return next
    })
    return newItem
  }, [])

  const updateCustom = useCallback((id: string, item: Omit<CustomGearItem, 'id' | 'createdAt'>) => {
    setCustomGear(prev => {
      const next = prev.map(x => x.id === id ? { ...x, ...item } : x)
      saveCustomGear(next)
      return next
    })
  }, [])

  const deleteCustom = useCallback((id: string) => {
    setCustomGear(prev => {
      const next = prev.filter(x => x.id !== id)
      saveCustomGear(next)
      return next
    })
    // Also remove from saved
    setSavedIds(prev => {
      const next = prev.filter(x => x !== id)
      saveSavedIds(next)
      return next
    })
  }, [])

  return { savedIds, customGear, toggleSave, addCustom, updateCustom, deleteCustom }
}

// ─── Static gear catalog ─────────────────────────────────────────────────────
interface GearItem {
  id: string
  name: string
  brand: string
  category: string   // used for category filter chips
  sport: string      // 'Running' | 'Triathlon' | 'Cycling' | 'Swimming' | 'All Sports'
  image: string      // stable public image URL
  tags: string[]
}

const GEAR_CATALOG: GearItem[] = [
  // Running — Shoes
  { id: 'g1',  name: 'Alphafly 3',         brand: 'Nike',       category: 'Running', sport: 'Running',   image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop', tags: ['marathon', 'carbon plate', 'race day'] },
  { id: 'g2',  name: 'Vaporfly 3',          brand: 'Nike',       category: 'Running', sport: 'Running',   image: 'https://images.unsplash.com/photo-1556906781-9a412961a28c?w=400&h=400&fit=crop', tags: ['marathon', 'carbon plate', 'race day'] },
  { id: 'g3',  name: 'Adizero Adios Pro 3', brand: 'Adidas',     category: 'Running', sport: 'Running',   image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=400&fit=crop', tags: ['marathon', 'carbon plate', 'fast'] },
  { id: 'g4',  name: 'SuperBlast 2',        brand: 'ASICS',      category: 'Running', sport: 'Running',   image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop', tags: ['training', 'cushion', 'daily'] },
  { id: 'g5',  name: 'Cloudboom Strike LS', brand: 'On Running', category: 'Running', sport: 'Running',   image: 'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&h=400&fit=crop', tags: ['race day', 'lace-free'] },
  // Running — GPS Watch
  { id: 'g6',  name: 'Forerunner 965',      brand: 'Garmin',     category: 'Running', sport: 'Running',   image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop', tags: ['GPS', 'training', 'metrics'] },
  { id: 'g7',  name: 'Epix Pro Gen 2',      brand: 'Garmin',     category: 'Running', sport: 'Running',   image: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&h=400&fit=crop', tags: ['GPS', 'premium', 'AMOLED'] },
  { id: 'g8',  name: 'Stryd Foot Pod',      brand: 'Stryd',      category: 'Running', sport: 'Running',   image: 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400&h=400&fit=crop', tags: ['power meter', 'run metrics'] },
  // Triathlon
  { id: 'g9',  name: 'Blueseventy Thermal', brand: 'BlueSeventy',category: 'Tri',     sport: 'Triathlon', image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&h=400&fit=crop', tags: ['wetsuit', 'swim', 'open water'] },
  { id: 'g10', name: 'TT9 Tri Suit',        brand: '2XU',        category: 'Tri',     sport: 'Triathlon', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop', tags: ['tri suit', 'race day', 'aero'] },
  { id: 'g11', name: 'Multisport Pro',       brand: 'Garmin',     category: 'Tri',     sport: 'Triathlon', image: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=400&h=400&fit=crop', tags: ['GPS', 'triathlon', 'multisport'] },
  { id: 'g12', name: 'Tri Transition Bag',   brand: 'ROKA',       category: 'Tri',     sport: 'Triathlon', image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop', tags: ['transition', 'bag', 'gear'] },
  { id: 'g13', name: 'Kona Pro 2 Helmet',    brand: 'Giro',       category: 'Tri',     sport: 'Triathlon', image: 'https://images.unsplash.com/photo-1558981033-0f0309284409?w=400&h=400&fit=crop', tags: ['aero helmet', 'cycling', 'aero'] },
  // Cycling
  { id: 'g14', name: 'Edge 1050',            brand: 'Garmin',     category: 'Cycling', sport: 'Cycling',   image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400&h=400&fit=crop', tags: ['cycling computer', 'GPS', 'navigation'] },
  { id: 'g15', name: 'Assioma Duo Pedals',   brand: 'Favero',     category: 'Cycling', sport: 'Cycling',   image: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400&h=400&fit=crop', tags: ['power meter', 'pedals', 'dual-sided'] },
  { id: 'g16', name: 'Bib Shorts Pro',       brand: 'Rapha',      category: 'Cycling', sport: 'Cycling',   image: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&h=400&fit=crop', tags: ['apparel', 'comfort', 'chamois'] },
  // Swimming
  { id: 'g17', name: 'Finis Tempo Trainer',  brand: 'FINIS',      category: 'Swim',    sport: 'Swimming',  image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400&h=400&fit=crop', tags: ['swim', 'tempo', 'training'] },
  { id: 'g18', name: 'Swim Skin Pro',        brand: 'BlueSeventy',category: 'Swim',    sport: 'Swimming',  image: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&h=400&fit=crop', tags: ['swim skin', 'open water', 'fast'] },
  // Nutrition
  { id: 'g19', name: 'SIS Go Isotonic Gels', brand: 'SIS',        category: 'Running', sport: 'All Sports',image: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=400&h=400&fit=crop', tags: ['nutrition', 'gels', 'race day', 'energy'] },
  { id: 'g20', name: 'Maurten Gel 100',      brand: 'Maurten',    category: 'Running', sport: 'All Sports',image: 'https://images.unsplash.com/photo-1559181567-c3190ca9d213?w=400&h=400&fit=crop', tags: ['nutrition', 'gels', 'marathon', 'hydrogel'] },
  { id: 'g21', name: 'Precision Hydration', brand: 'PH',          category: 'Running', sport: 'All Sports',image: 'https://images.unsplash.com/photo-1606143604453-2c3f9e4c4e27?w=400&h=400&fit=crop', tags: ['hydration', 'electrolytes', 'sodium'] },
  // Recovery
  { id: 'g22', name: 'Normatec 3 Legs',      brand: 'Hyperice',   category: 'Running', sport: 'All Sports',image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=400&fit=crop', tags: ['recovery', 'compression', 'normatec'] },
  { id: 'g23', name: 'Calf Sleeves R2',      brand: '2XU',        category: 'Running', sport: 'Running',   image: 'https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=400&h=400&fit=crop', tags: ['compression', 'calves', 'recovery'] },
  // HYROX
  { id: 'g24', name: 'Metcon 9',             brand: 'Nike',       category: 'Running', sport: 'HYROX',     image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=400&fit=crop', tags: ['hyrox', 'training shoe', 'functional'] },
  { id: 'g25', name: 'Speed Rope',           brand: 'RPM',        category: 'Running', sport: 'HYROX',     image: 'https://images.unsplash.com/photo-1598971861713-54ad16a7e72e?w=400&h=400&fit=crop', tags: ['hyrox', 'skipping', 'cardio'] },
]

const btnMain: React.CSSProperties = {
  background: 'var(--orange)',
  color: 'var(--black)',
  border: 'none',
  borderRadius: '4px',
  padding: '0.8rem 1.25rem',
  fontFamily: 'var(--headline)',
  fontWeight: 900,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontSize: '13px',
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--white)',
  border: '1px solid var(--border2)',
  borderRadius: '4px',
  padding: '0.8rem 1.25rem',
  fontFamily: 'var(--headline)',
  fontWeight: 900,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontSize: '13px',
}

const card: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  padding: '1rem',
}

type Tab = 'discover' | 'library' | 'lists' | 'stacks'

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: 'discover', label: 'Discover' },
  { id: 'library',  label: 'Library' },
  { id: 'lists',    label: 'Lists' },
  { id: 'stacks',   label: 'Stacks' },
]

const CATEGORIES = ['All', 'Running', 'Tri', 'Cycling', 'Swim']
const SPORTS     = ['All Sports', 'Running', 'Triathlon', 'Cycling', 'Swimming', 'HYROX']

function EmptyState({ title, body, cta, onCta }: {
  title: string
  body: string
  cta?: string
  onCta?: () => void
}) {
  return (
    <div style={{
      ...card,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: '0.75rem',
      padding: '2.5rem 1.5rem',
    }}>
      <p style={{
        margin: 0,
        fontFamily: 'var(--headline)',
        fontWeight: 900,
        fontSize: '15px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: 'var(--white)',
      }}>
        {title}
      </p>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)', maxWidth: '280px', lineHeight: 1.5 }}>
        {body}
      </p>
      {cta && (
        <button style={btnMain} onClick={onCta}>
          {cta}
        </button>
      )}
    </div>
  )
}

function AuthGate() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: '1rem',
      padding: '4rem 1.5rem',
    }}>
      <span style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '11px', letterSpacing: '0.08em', color: 'var(--muted)', opacity: 0.6 }}>GEAR</span>
      <p style={{
        margin: 0,
        fontFamily: 'var(--headline)',
        fontWeight: 900,
        fontSize: '18px',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: 'var(--white)',
      }}>
        Sign in to build your Gear Bag
      </p>
      <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)', maxWidth: '280px', lineHeight: 1.5 }}>
        Save gear, create race day kits, and track what works best for you.
      </p>
    </div>
  )
}

export function Gear() {
  const authUser = useAuthStore(s => s.authUser)
  const allRaces = useRaceStore(s => s.upcomingRaces)
  const [activeTab, setActiveTab]     = useState<Tab>('discover')
  const [searchQuery, setSearchQuery] = useState('')
  const [category, setCategory]       = useState('All')
  const [sport, setSport]             = useState('All Sports')

  // ── Saved gear + custom products ──────────────────────────────────────────
  const { savedIds, customGear, toggleSave, addCustom, updateCustom, deleteCustom } = useSavedGear()
  const [customModal, setCustomModal] = useState<{ mode: 'add' } | { mode: 'edit'; item: CustomGearItem } | null>(null)
  const [customForm, setCustomForm]   = useState({ name: '', brand: '', category: 'Running', notes: '' })

  // ── Gear Lists ─────────────────────────────────────────────────────────────
  const { lists, addList, deleteList, addItemToList, removeItemFromList, moveItem } = useGearLists()
  const [listModal, setListModal] = useState<'new' | { listId: string; mode: 'items' } | null>(null)
  const [listForm, setListForm]   = useState({ name: '', kind: 'Race Day Kit' })
  const LIST_KINDS = ['Race Day Kit', 'Training Kit', 'Travel Kit', 'Nutrition Pack', 'Recovery Kit']

  // ── Gear Stacks ────────────────────────────────────────────────────────────
  const { stacks, addStack, deleteStack, toggleStackItem } = useGearStacks()
  const [stackModal, setStackModal] = useState<'new' | { stackId: string; mode: 'items' } | null>(null)
  const [stackForm, setStackForm]   = useState({ name: '', raceId: '', template: '' })

  // ── All library products (catalog + custom) ────────────────────────────────
  const allLibraryProducts = useMemo(() => [
    ...customGear.map(g => ({ id: g.id, name: g.name, brand: g.brand, label: `${g.brand} · ${g.name}` })),
    ...GEAR_CATALOG.filter(g => savedIds.includes(g.id)).map(g => ({ id: g.id, name: g.name, brand: g.brand, label: `${g.brand} · ${g.name}` })),
  ], [customGear, savedIds])

  const openAddCustom = () => {
    setCustomForm({ name: '', brand: '', category: 'Running', notes: '' })
    setCustomModal({ mode: 'add' })
  }

  const openEditCustom = (item: CustomGearItem) => {
    setCustomForm({ name: item.name, brand: item.brand, category: item.category, notes: item.notes })
    setCustomModal({ mode: 'edit', item })
  }

  const saveCustomModal = () => {
    if (!customForm.name.trim() || !customForm.brand.trim()) return
    if (customModal?.mode === 'edit') {
      updateCustom(customModal.item.id, customForm)
    } else {
      addCustom(customForm)
    }
    setCustomModal(null)
  }

  const filteredGear = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return GEAR_CATALOG.filter(item => {
      const matchesCat   = category === 'All' || item.category === category
      const matchesSport = sport === 'All Sports' || item.sport === sport || item.sport === 'All Sports'
      const matchesQuery = !q || [item.name, item.brand, ...item.tags].some(t => t.toLowerCase().includes(q))
      return matchesCat && matchesSport && matchesQuery
    })
  }, [searchQuery, category, sport])

  const tabStyle = (id: Tab): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    borderBottom: activeTab === id ? '2px solid var(--orange)' : '2px solid transparent',
    color: activeTab === id ? 'var(--white)' : 'var(--muted)',
    fontFamily: 'var(--headline)',
    fontWeight: 900,
    fontSize: 'var(--text-sm)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '0.6rem 0.75rem',
    cursor: 'pointer',
    transition: 'color 0.15s',
    whiteSpace: 'nowrap',
  })

  const selectStyle: React.CSSProperties = {
    background: 'var(--surface3)',
    border: '1px solid var(--border2)',
    borderRadius: '4px',
    color: 'var(--white)',
    fontSize: 'var(--text-xs)',
    padding: '0.4rem 0.6rem',
    fontFamily: 'var(--body)',
    flex: 1,
  }

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Page heading */}
      <h1 style={{
        fontFamily: 'var(--headline)',
        fontSize: '22px',
        fontWeight: 900,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: 'var(--white)',
        margin: 0,
      }}>
        Gear
      </h1>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        overflowX: 'auto',
        gap: '0.25rem',
      }}>
        {TAB_LABELS.map(t => (
          <button key={t.id} style={tabStyle(t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Auth gate — all tabs */}
      {!authUser ? (
        <AuthGate />
      ) : (
        <>
          {/* ── Discover tab ── */}
          {activeTab === 'discover' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Search row */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Search gear..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    background: 'var(--surface2)',
                    border: '1px solid var(--border2)',
                    borderRadius: '4px',
                    color: 'var(--white)',
                    fontSize: 'var(--text-sm)',
                    padding: '0.6rem 0.75rem',
                    fontFamily: 'var(--body)',
                  }}
                />
                <button
                  style={{ ...btnMain, padding: '0.6rem 1rem' }}
                  onClick={() => setSearchQuery(searchQuery)}
                  aria-label="Search gear"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/><path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>

              {/* Filter row */}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={selectStyle}
                >
                  {CATEGORIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={sport}
                  onChange={e => setSport(e.target.value)}
                  style={selectStyle}
                >
                  {SPORTS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Product grid */}
              {filteredGear.length === 0 ? (
                <EmptyState
                  title="No gear found"
                  body="Try a different search term or filter."
                />
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.75rem',
                }}>
                  {filteredGear.map(item => (
                    <div key={item.id} style={{
                      ...card,
                      padding: 0,
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                    }}>
                      <img
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          objectFit: 'cover',
                          background: 'var(--surface3)',
                        }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                      <div style={{ padding: '0.6rem 0.75rem 0.75rem' }}>
                        <p style={{
                          margin: 0,
                          fontFamily: 'var(--headline)',
                          fontWeight: 900,
                          fontSize: '12px',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'var(--orange)',
                        }}>
                          {item.brand}
                        </p>
                        <p style={{
                          margin: '2px 0 0',
                          fontSize: 'var(--text-sm)',
                          fontWeight: 600,
                          color: 'var(--white)',
                          lineHeight: 1.3,
                        }}>
                          {item.name}
                        </p>
                        <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {item.tags.slice(0, 2).map(tag => (
                            <span key={tag} style={{
                              fontSize: '9px',
                              fontFamily: 'var(--headline)',
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              background: 'var(--surface3)',
                              border: '1px solid var(--border)',
                              color: 'var(--muted)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}>
                              {tag}
                            </span>
                          ))}
                          <button
                            onClick={e => { e.stopPropagation(); toggleSave(item.id) }}
                            title={savedIds.includes(item.id) ? 'Remove from library' : 'Save to library'}
                            style={{
                              marginLeft: 'auto',
                              background: savedIds.includes(item.id) ? 'rgba(var(--orange-ch),0.15)' : 'var(--surface3)',
                              border: `1px solid ${savedIds.includes(item.id) ? 'rgba(var(--orange-ch),0.4)' : 'var(--border)'}`,
                              color: savedIds.includes(item.id) ? 'var(--orange)' : 'var(--muted)',
                              borderRadius: '4px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              fontFamily: 'var(--headline)',
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {savedIds.includes(item.id) ? '✓ Saved' : '+ Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Library tab ── */}
          {activeTab === 'library' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '15px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)' }}>
                  Your Gear Library
                </p>
                <button style={{ ...btnGhost, padding: '0.5rem 0.9rem', fontSize: 'var(--text-xs)' }} onClick={openAddCustom}>
                  + Custom Product
                </button>
              </div>

              {/* Custom product modal */}
              {customModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 900, display: 'flex', alignItems: 'flex-end' }} onClick={() => setCustomModal(null)}>
                  <div style={{ width: '100%', background: 'var(--surface2)', borderRadius: '16px 16px 0 0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '18px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>
                      {customModal.mode === 'edit' ? 'Edit Product' : 'Custom Product'}
                    </div>
                    {(['brand', 'name'] as const).map(field => (
                      <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{field}</label>
                        <input
                          type="text"
                          value={customForm[field]}
                          onChange={e => setCustomForm(f => ({ ...f, [field]: e.target.value }))}
                          placeholder={field === 'brand' ? 'Brand name' : 'Product name'}
                          style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '10px 12px', color: 'var(--white)', fontFamily: 'var(--body)', fontSize: '14px' }}
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Category</label>
                      <select value={customForm.category} onChange={e => setCustomForm(f => ({ ...f, category: e.target.value }))} style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '10px 12px', color: 'var(--white)', fontFamily: 'var(--body)', fontSize: '14px' }}>
                        {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Notes</label>
                      <input type="text" value={customForm.notes} onChange={e => setCustomForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '10px 12px', color: 'var(--white)', fontFamily: 'var(--body)', fontSize: '14px' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={saveCustomModal}
                        disabled={!customForm.name.trim() || !customForm.brand.trim()}
                        style={{ ...btnMain, flex: 1, opacity: (!customForm.name.trim() || !customForm.brand.trim()) ? 0.5 : 1 }}
                      >
                        {customModal.mode === 'edit' ? 'Save Changes' : 'Add Product'}
                      </button>
                      <button onClick={() => setCustomModal(null)} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Saved catalog items + custom items */}
              {savedIds.length === 0 && customGear.length === 0 ? (
                <EmptyState
                  title="No gear saved yet"
                  body="Tap + Save on any item in Discover, or add a custom product you own."
                  cta="Discover Gear"
                  onCta={() => setActiveTab('discover')}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Custom items first */}
                  {customGear.map(item => (
                    <div key={item.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--surface3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontFamily: 'var(--headline)', fontWeight: 800, letterSpacing: '0.04em', color: 'var(--muted)', flexShrink: 0 }}>GEAR</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--orange)' }}>{item.brand}</div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--white)', fontWeight: 600 }}>{item.name}</div>
                        {item.notes && <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{item.notes}</div>}
                        <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted2)', marginTop: '2px' }}>Custom · {item.category}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <button onClick={() => openEditCustom(item)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--muted)', fontSize: '11px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--headline)', fontWeight: 700 }}>Edit</button>
                        <button onClick={() => deleteCustom(item.id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--muted2)', fontSize: '11px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--headline)', fontWeight: 700 }}>✕</button>
                      </div>
                    </div>
                  ))}
                  {/* Saved catalog items */}
                  {GEAR_CATALOG.filter(g => savedIds.includes(g.id)).map(item => (
                    <div key={item.id} style={{ ...card, display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src={item.image} alt={item.name} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--orange)' }}>{item.brand}</div>
                        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--white)', fontWeight: 600 }}>{item.name}</div>
                        <div style={{ fontSize: '10px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted2)', marginTop: '2px' }}>{item.category} · {item.sport}</div>
                      </div>
                      <button onClick={() => toggleSave(item.id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--muted2)', fontSize: '11px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--headline)', fontWeight: 700, flexShrink: 0 }}>✕ Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Lists tab ── */}
          {activeTab === 'lists' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '15px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)' }}>
                  Your Gear Lists
                </p>
                <button style={{ ...btnGhost, padding: '0.5rem 0.9rem', fontSize: 'var(--text-xs)' }} onClick={() => { setListForm({ name: '', kind: 'Race Day Kit' }); setListModal('new') }}>
                  + New List
                </button>
              </div>

              {/* New list modal */}
              {listModal === 'new' && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 900, display: 'flex', alignItems: 'flex-end' }} onClick={() => setListModal(null)}>
                  <div style={{ width: '100%', background: 'var(--surface2)', borderRadius: '16px 16px 0 0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '18px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>New Gear List</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>List Name</label>
                      <input type="text" value={listForm.name} onChange={e => setListForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Valencia Marathon kit" style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '10px 12px', color: 'var(--white)', fontFamily: 'var(--body)', fontSize: '14px' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Type</label>
                      <select value={listForm.kind} onChange={e => setListForm(f => ({ ...f, kind: e.target.value }))} style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '10px 12px', color: 'var(--white)', fontFamily: 'var(--body)', fontSize: '14px' }}>
                        {LIST_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => { if (!listForm.name.trim()) return; addList(listForm.name.trim(), listForm.kind); setListModal(null) }} disabled={!listForm.name.trim()} style={{ ...btnMain, flex: 1, opacity: !listForm.name.trim() ? 0.5 : 1 }}>Create List</button>
                      <button onClick={() => setListModal(null)} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add items to list modal */}
              {listModal !== null && listModal !== 'new' && listModal.mode === 'items' && (() => {
                const list = lists.find(l => l.id === listModal.listId)
                if (!list) return null
                return (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 900, display: 'flex', alignItems: 'flex-end' }} onClick={() => setListModal(null)}>
                    <div style={{ width: '100%', maxHeight: '70vh', background: 'var(--surface2)', borderRadius: '16px 16px 0 0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                      <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>Add to "{list.name}"</div>
                      {allLibraryProducts.length === 0 ? (
                        <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Save gear in your Library first, then add it to lists.</p>
                      ) : allLibraryProducts.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ flex: 1, fontSize: '13px', color: 'var(--white)' }}>{p.label}</span>
                          <button
                            onClick={() => list.itemIds.includes(p.id) ? removeItemFromList(list.id, p.id) : addItemToList(list.id, p.id)}
                            style={{ ...list.itemIds.includes(p.id) ? btnMain : btnGhost, padding: '4px 12px', fontSize: '11px' }}
                          >
                            {list.itemIds.includes(p.id) ? '✓ Added' : '+ Add'}
                          </button>
                        </div>
                      ))}
                      <button onClick={() => setListModal(null)} style={{ ...btnMain, width: '100%', marginTop: '4px' }}>Done</button>
                    </div>
                  </div>
                )
              })()}

              {lists.length === 0 ? (
                <EmptyState title="No lists yet" body="Create a list to organize your race day kit — shoes, nutrition, gear by distance." cta="Create a List" onCta={() => { setListForm({ name: '', kind: 'Race Day Kit' }); setListModal('new') }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {lists.map(list => (
                    <div key={list.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)' }}>{list.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>{list.kind} · {list.itemIds.length} item{list.itemIds.length !== 1 ? 's' : ''}</div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button onClick={() => setListModal({ listId: list.id, mode: 'items' })} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--orange)', fontSize: '11px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--headline)', fontWeight: 700 }}>+ Items</button>
                          <button onClick={() => deleteList(list.id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--muted2)', fontSize: '11px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--headline)', fontWeight: 700 }}>✕</button>
                        </div>
                      </div>
                      {list.itemIds.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {list.itemIds.map((pid, idx) => {
                            const custom  = customGear.find(g => g.id === pid)
                            const catalog = GEAR_CATALOG.find(g => g.id === pid)
                            const label   = custom ? `${custom.brand} · ${custom.name}` : catalog ? `${catalog.brand} · ${catalog.name}` : pid
                            return (
                              <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'var(--surface3)', borderRadius: '6px' }}>
                                <span style={{ flex: 1, fontSize: '12px', color: 'var(--white)' }}>{label}</span>
                                <button onClick={() => moveItem(list.id, pid, -1)} disabled={idx === 0} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '12px', padding: '0 2px', opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                                <button onClick={() => moveItem(list.id, pid, 1)} disabled={idx === list.itemIds.length - 1} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '12px', padding: '0 2px', opacity: idx === list.itemIds.length - 1 ? 0.3 : 1 }}>↓</button>
                                <button onClick={() => removeItemFromList(list.id, pid)} style={{ background: 'none', border: 'none', color: 'var(--muted2)', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}>✕</button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Stacks tab ── */}
          {activeTab === 'stacks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '15px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)' }}>
                  Your Race Stacks
                </p>
                <button style={{ ...btnGhost, padding: '0.5rem 0.9rem', fontSize: 'var(--text-xs)' }} onClick={() => { setStackForm({ name: '', raceId: '', template: '' }); setStackModal('new') }}>
                  + New Stack
                </button>
              </div>

              {/* Templates row */}
              <div>
                <p style={{ margin: '0 0 8px', fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Templates</p>
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {STACK_TEMPLATES.map(t => (
                    <button key={t.label} onClick={() => { addStack(t.label, undefined, t.label, t.items) }} style={{ ...btnGhost, padding: '5px 12px', fontSize: '11px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* New stack modal */}
              {stackModal === 'new' && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 900, display: 'flex', alignItems: 'flex-end' }} onClick={() => setStackModal(null)}>
                  <div style={{ width: '100%', background: 'var(--surface2)', borderRadius: '16px 16px 0 0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '18px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>New Race Stack</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Stack Name</label>
                      <input type="text" value={stackForm.name} onChange={e => setStackForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Berlin Marathon 2026" style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '10px 12px', color: 'var(--white)', fontFamily: 'var(--body)', fontSize: '14px' }} />
                    </div>
                    {allRaces.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontFamily: 'var(--headline)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>Link to Race (optional)</label>
                        <select value={stackForm.raceId} onChange={e => setStackForm(f => ({ ...f, raceId: e.target.value }))} style={{ background: 'var(--surface3)', border: '1px solid var(--border2)', borderRadius: '8px', padding: '10px 12px', color: 'var(--white)', fontFamily: 'var(--body)', fontSize: '14px' }}>
                          <option value="">— No race linked —</option>
                          {allRaces.map(r => <option key={r.id} value={r.id}>{r.name ?? r.distance} · {fmtDateDDMM(r.date)}</option>)}
                        </select>
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => { if (!stackForm.name.trim()) return; addStack(stackForm.name.trim(), stackForm.raceId || undefined); setStackModal(null) }} disabled={!stackForm.name.trim()} style={{ ...btnMain, flex: 1, opacity: !stackForm.name.trim() ? 0.5 : 1 }}>Create Stack</button>
                      <button onClick={() => setStackModal(null)} style={{ ...btnGhost, flex: 1 }}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add items to stack modal */}
              {stackModal !== null && stackModal !== 'new' && stackModal.mode === 'items' && (() => {
                const stack = stacks.find(s => s.id === stackModal.stackId)
                if (!stack) return null
                return (
                  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 900, display: 'flex', alignItems: 'flex-end' }} onClick={() => setStackModal(null)}>
                    <div style={{ width: '100%', maxHeight: '70vh', background: 'var(--surface2)', borderRadius: '16px 16px 0 0', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                      <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '16px', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--white)' }}>Edit "{stack.name}"</div>
                      {allLibraryProducts.length === 0 ? (
                        <p style={{ color: 'var(--muted)', fontSize: '13px' }}>Save gear in your Library first.</p>
                      ) : allLibraryProducts.map(p => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ flex: 1, fontSize: '13px', color: 'var(--white)' }}>{p.label}</span>
                          <button onClick={() => toggleStackItem(stack.id, p.id)} style={{ ...stack.itemIds.includes(p.id) ? btnMain : btnGhost, padding: '4px 12px', fontSize: '11px' }}>
                            {stack.itemIds.includes(p.id) ? '✓' : '+ Add'}
                          </button>
                        </div>
                      ))}
                      <button onClick={() => setStackModal(null)} style={{ ...btnMain, width: '100%', marginTop: '4px' }}>Done</button>
                    </div>
                  </div>
                )
              })()}

              {stacks.length === 0 ? (
                <EmptyState title="No stacks yet" body="Pick a template above or create a custom stack for a specific race build." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {stacks.map(stack => {
                    const linkedRace = allRaces.find(r => r.id === stack.raceId)
                    return (
                      <div key={stack.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontFamily: 'var(--headline)', fontWeight: 900, fontSize: '14px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--white)' }}>{stack.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>
                              {linkedRace ? `${linkedRace.name ?? 'Race'} · ${fmtDateDDMM(linkedRace.date)}` : stack.template ? `Template: ${stack.template}` : 'Custom stack'} · {stack.itemIds.length} items
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => setStackModal({ stackId: stack.id, mode: 'items' })} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--orange)', fontSize: '11px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--headline)', fontWeight: 700 }}>Edit</button>
                            <button onClick={() => deleteStack(stack.id)} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--muted2)', fontSize: '11px', padding: '3px 8px', cursor: 'pointer', fontFamily: 'var(--headline)', fontWeight: 700 }}>✕</button>
                          </div>
                        </div>
                        {stack.itemIds.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {stack.itemIds.map(pid => {
                              const custom  = customGear.find(g => g.id === pid)
                              const catalog = GEAR_CATALOG.find(g => g.id === pid)
                              const label   = custom ? custom.name : catalog ? catalog.name : pid
                              return (
                                <span key={pid} style={{ fontSize: '11px', background: 'var(--surface3)', border: '1px solid var(--border)', borderRadius: '100px', padding: '3px 8px', color: 'var(--white)' }}>
                                  {label}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
