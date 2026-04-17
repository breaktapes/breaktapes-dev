/**
 * Sparkline — minimal Recharts LineChart for trend visualization.
 * No axes, no grid, no tooltip. Just the line.
 * Color reads from CSS custom property at render time (theme-aware).
 */
import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
}

export function Sparkline({ values, width, height = 40, color }: SparklineProps) {
  const lineColor = color || (
    typeof document !== 'undefined'
      ? (getComputedStyle(document.documentElement).getPropertyValue('--orange').trim() || '#E84E1B')
      : '#E84E1B'
  )
  const data = values.map((v, i) => ({ i, v }))

  return (
    <ResponsiveContainer width={width ?? '100%'} height={height}>
      <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
        <Line
          type="monotone"
          dataKey="v"
          stroke={lineColor}
          strokeWidth={1.8}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
