import { useState } from 'react'
import {
  DEMO_PERSONAS, DEMO_PERSONA_LIST, MEDAL_COLORS,
  type DemoPersona, type DemoPersonaId, type DemoRace,
} from '@/lib/demoData'
import { WORLD_MAP_PATH, projectLngLat } from '@/lib/worldMap'

/* =====================================================================
   /demo — self-contained interactive demo for the landing sandbox.
   No auth, no real stores, no persistence. Purely illustrative.
   ===================================================================== */

type Tab = 'dashboard' | 'races' | 'profile'

const card: React.CSSProperties = {
  background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
}
const fmtDate = (d: string) => { const [y, m, day] = d.split('-'); return `${day}-${m}-${y}` }

/* ---------- Dashboard ---------- */
function DemoDashboard({ p }: { p: DemoPersona }) {
  const max = Math.max(...p.momentum)
  const pts = p.momentum.map((v, i) => `${(i / (p.momentum.length - 1)) * 240},${44 - (v / max) * 38}`).join(' ')
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <div style={{ ...card, padding: 'var(--sp-4)', background: 'linear-gradient(135deg, rgba(var(--orange-ch),0.16), var(--surface2))', borderColor: 'rgba(var(--orange-ch),0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--orange)' }} />
          <span style={{ fontFamily: 'var(--body)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--orange)' }}>Next Race · {p.next.days} days</span>
        </div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 26, textTransform: 'uppercase', color: 'var(--white)', lineHeight: 1 }}>{p.next.race}</div>
        <div style={{ fontFamily: 'var(--body)', fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{p.next.goal}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-2)' }}>
        {[[String(p.stats.races), 'RACES'], [p.stats.topPb[0], p.stats.topPb[1]], [String(p.stats.medals), 'MEDALS'], [String(p.stats.countries), 'COUNTRIES']].map(([v, l]) => (
          <div key={l} style={{ ...card, padding: 'var(--sp-3)' }}>
            <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 24, color: 'var(--white)' }}>{v}</div>
            <div style={{ fontFamily: 'var(--body)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{ ...card, padding: 'var(--sp-3)' }}>
        <div style={{ fontFamily: 'var(--body)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>Momentum · trending up</div>
        <svg viewBox="0 0 240 48" width="100%" height="40" preserveAspectRatio="none">
          <polyline points={pts} fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {p.prs.slice(0, 3).map(pr => (
          <div key={pr.label} style={{ ...card, padding: '10px var(--sp-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: '3px solid var(--orange)' }}>
            <span style={{ fontFamily: 'var(--body)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--muted)' }}>{pr.label} · PB</span>
            <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 18, color: 'var(--white)' }}>{pr.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Races (world map + list) ---------- */
function DemoRaces({ p }: { p: DemoPersona }) {
  const [selected, setSelected] = useState<string | null>(null)
  const cities = [...p.races].sort((a, b) => a.lng - b.lng)
  const pts = cities.map(r => ({ name: r.name, city: r.city, p: projectLngLat(r.lng, r.lat) }))
  const arcs: string[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i].p, [x2, y2] = pts[i + 1].p
    const d = Math.hypot(x2 - x1, y2 - y1)
    arcs.push(`M${x1} ${y1} Q${(x1 + x2) / 2} ${(y1 + y2) / 2 - d * 0.22} ${x2} ${y2}`)
  }
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <div style={{ ...card, padding: 'var(--sp-3)', aspectRatio: '1000 / 360', background: 'radial-gradient(ellipse at 50% 45%, var(--surface3), var(--surface))', overflow: 'hidden' }}>
        <svg viewBox="0 40 1000 380" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <path d={WORLD_MAP_PATH} fill="rgba(232,224,213,0.10)" stroke="rgba(232,224,213,0.28)" strokeWidth="0.9" strokeLinejoin="round" />
          {arcs.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--orange)" strokeWidth="3" strokeLinecap="round" opacity="0.9" />)}
          {pts.map(c => {
            const [x, y] = c.p
            const on = selected === c.name
            return (
              <g key={c.name}>
                <circle cx={x} cy={y} r={on ? 20 : 14} fill="none" stroke="rgba(var(--orange-ch),0.4)" strokeWidth="2" />
                <circle cx={x} cy={y} r="8" fill={on ? 'var(--green)' : 'var(--orange)'} stroke="#000" strokeWidth="1.5" />
                <text x={x + 18} y={y + 6} fill="var(--white)" fontSize="19" fontFamily="var(--headline)" fontWeight="800" stroke="#000" strokeWidth="0.5" paintOrder="stroke">{c.city}</text>
              </g>
            )
          })}
        </svg>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {p.races.map((r: DemoRace) => {
          const on = selected === r.name
          return (
            <button key={r.name + r.date} onClick={() => setSelected(on ? null : r.name)}
              style={{ ...card, padding: '10px var(--sp-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                textAlign: 'left', cursor: 'pointer', borderColor: on ? 'rgba(var(--green-ch),0.5)' : 'var(--border)',
                borderLeft: r.pb ? '3px solid var(--orange)' : '1px solid var(--border)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 700, fontSize: 13, color: 'var(--white)', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontFamily: 'var(--body)', fontSize: 10, color: 'var(--muted)' }}>{r.city} · {fmtDate(r.date)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 8 }}>
                <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 15, color: 'var(--orange)' }}>{r.time}{r.pb && <span style={{ color: 'var(--green)', fontSize: 11 }}> ★</span>}</div>
                <div style={{ fontFamily: 'var(--body)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>{r.dist}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---------- Profile (medals + PRs) ---------- */
function DemoProfile({ p }: { p: DemoPersona }) {
  return (
    <div style={{ display: 'grid', gap: 'var(--sp-3)' }}>
      <div style={{ ...card, padding: 'var(--sp-4)', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', margin: '0 auto 10px', background: 'var(--grad-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 22, color: '#000' }}>
          {p.name.split(' ').map(w => w[0]).join('')}
        </div>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 22, textTransform: 'uppercase', color: 'var(--white)' }}>{p.name}</div>
        <div style={{ fontFamily: 'var(--body)', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.tagline}</div>
      </div>
      <div style={{ ...card, padding: 'var(--sp-4)' }}>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--orange)', marginBottom: 'var(--sp-3)' }}>Medal Wall</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--sp-2)' }}>
          {p.medals.map((m, i) => {
            const [a, b] = MEDAL_COLORS[m]
            return <div key={i} style={{ aspectRatio: '1', borderRadius: '50%', background: `radial-gradient(circle at 35% 30%, ${a}, ${b})`, boxShadow: `0 0 10px ${a}44, inset 0 -2px 5px rgba(0,0,0,0.35)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--headline)', fontWeight: 900, fontSize: 11, color: 'rgba(0,0,0,0.45)' }}>★</div>
          })}
        </div>
      </div>
      <div style={{ ...card, padding: 'var(--sp-4)' }}>
        <div style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--orange)', marginBottom: 'var(--sp-3)' }}>Personal Bests</div>
        <div style={{ display: 'grid', gap: 6 }}>
          {p.prs.map(pr => (
            <div key={pr.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'var(--body)', fontSize: 12, color: 'var(--muted)' }}>{pr.label}</span>
              <span style={{ fontFamily: 'var(--headline)', fontWeight: 800, fontSize: 16, color: 'var(--white)' }}>{pr.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home', icon: '◇' },
  { id: 'races', label: 'Races', icon: '◎' },
  { id: 'profile', label: 'You', icon: '◉' },
]

export default function Demo() {
  const [pid, setPid] = useState<DemoPersonaId>('marathoner')
  const [tab, setTab] = useState<Tab>('dashboard')
  const p = DEMO_PERSONAS[pid]
  return (
    <div className="demo-root">
      <header className="demo-top">
        <div className="demo-brand">BREAK<span style={{ color: 'var(--orange)' }}>/</span>TAPES <span className="demo-badge">DEMO</span></div>
        <div className="demo-personas">
          {DEMO_PERSONA_LIST.map(per => (
            <button key={per.id} className={`demo-persona${pid === per.id ? ' on' : ''}`} onClick={() => setPid(per.id)}>{per.label}</button>
          ))}
        </div>
      </header>
      <main className="demo-body">
        {tab === 'dashboard' && <DemoDashboard p={p} />}
        {tab === 'races' && <DemoRaces p={p} />}
        {tab === 'profile' && <DemoProfile p={p} />}
      </main>
      <nav className="demo-nav">
        {TABS.map(t => (
          <button key={t.id} className={`demo-nav-btn${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            <span className="demo-nav-icon">{t.icon}</span>{t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
