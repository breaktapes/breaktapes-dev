// Shared Recharts theme — MUST be a function, not a const.
// Module-level constants are evaluated once at import time and won't update
// when the user switches themes. Call getChartTheme() inside render.

export function getChartTheme() {
  const cs = getComputedStyle(document.documentElement)
  const muted = cs.getPropertyValue('--muted').trim() || 'rgba(232,224,213,0.38)'
  const surface3 = cs.getPropertyValue('--surface3').trim() || '#1A1A1A'

  return {
    backgroundColor: 'transparent',
    cartesianGrid: { stroke: 'rgba(255,255,255,0.04)', strokeDasharray: '3 3' as const },
    xAxis: {
      stroke: 'transparent',
      tick: { fill: muted, fontSize: 11, fontFamily: 'Barlow' },
    },
    yAxis: {
      stroke: 'transparent',
      tick: { fill: muted, fontSize: 11, fontFamily: 'Barlow' },
    },
    tooltip: {
      contentStyle: {
        background: surface3,
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 8,
        fontFamily: 'Barlow',
      },
    },
  }
}
