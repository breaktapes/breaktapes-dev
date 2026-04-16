/**
 * AgeGradeChart — Recharts ScatterChart showing age-grade trajectory over time.
 * Used in the Dashboard and Profile pages.
 */
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { getChartTheme } from '@/lib/charts'
import type { Race } from '@/types'

interface AgeGradePoint {
  date: number   // epoch ms
  pct: number    // age-grade percentage 0-100
  name: string
}

interface AgeGradeChartProps {
  races: Race[]
  height?: number
}

function toAgeGradePoints(races: Race[]): AgeGradePoint[] {
  return races
    .filter(r => r.date && r.time)
    .map(r => ({
      date: new Date(r.date + 'T00:00:00').getTime(),
      pct: 60 + Math.random() * 20, // placeholder — real computation in lib/analytics.ts Phase 7+
      name: r.name,
    }))
    .sort((a, b) => a.date - b.date)
}

function fmtYear(epoch: number): string {
  return new Date(epoch).getFullYear().toString()
}

export function AgeGradeChart({ races, height = 160 }: AgeGradeChartProps) {
  const theme = getChartTheme()
  const data = toAgeGradePoints(races)

  if (data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: '12px' }}>
        Log races with times to see age-grade trajectory
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart>
        <CartesianGrid {...theme.cartesianGrid} />
        <XAxis
          dataKey="date"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={fmtYear}
          {...theme.xAxis}
        />
        <YAxis
          dataKey="pct"
          domain={[40, 100]}
          tickFormatter={v => `${v}%`}
          {...theme.yAxis}
        />
        <Tooltip
          {...theme.tooltip}
          formatter={(v) => {
            const n = typeof v === 'number' ? v : Number(v)
            return [`${n.toFixed(1)}%`, 'Age Grade']
          }}
          labelFormatter={(l) => {
            const epoch = typeof l === 'number' ? l : Number(l)
            return new Date(epoch).toLocaleDateString('en', { month: 'short', year: 'numeric' })
          }}
        />
        <Scatter
          data={data}
          fill="var(--orange)"
          opacity={0.8}
        />
      </ScatterChart>
    </ResponsiveContainer>
  )
}
