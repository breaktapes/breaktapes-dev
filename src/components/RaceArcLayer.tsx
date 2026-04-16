/**
 * RaceArcLayer — deck.gl ArcLayer overlaid on the race map.
 * Lazy-loaded via React.lazy() so deck.gl stays out of the main bundle.
 *
 * Source color: #E84E1B at 0.8 alpha = [232, 78, 27, 204]
 * Target color: #E84E1B at 0.3 alpha = [232, 78, 27, 76]
 */
import { useMemo } from 'react'
import DeckGL from '@deck.gl/react'
import { ArcLayer } from '@deck.gl/layers'
import type { Race } from '@/types'

interface ArcConnection {
  from: [number, number]
  to: [number, number]
}

interface RaceArcLayerProps {
  races: Race[]
  viewState: {
    longitude: number
    latitude: number
    zoom: number
    pitch: number
    bearing: number
  }
}

/**
 * Build arc connections: home base (first race) → each subsequent race.
 * Races without coordinates are skipped.
 */
function buildConnections(races: Race[]): ArcConnection[] {
  const geoRaces = races.filter(r => r.lat != null && r.lng != null)
  if (geoRaces.length < 2) return []

  const origin = geoRaces[0]
  const result: ArcConnection[] = []

  for (let i = 1; i < geoRaces.length; i++) {
    const r = geoRaces[i]
    result.push({
      from: [origin.lng!, origin.lat!],
      to:   [r.lng!, r.lat!],
    })
  }
  return result
}

export default function RaceArcLayer({ races, viewState }: RaceArcLayerProps) {
  const connections = useMemo(() => buildConnections(races), [races])

  const layers = [
    new ArcLayer<ArcConnection>({
      id: 'race-arcs',
      data: connections,
      getSourcePosition: d => d.from,
      getTargetPosition: d => d.to,
      getSourceColor: [232, 78, 27, 204],
      getTargetColor: [232, 78, 27, 76],
      getWidth: 1.5,
      pickable: false,
    }),
  ]

  return (
    <DeckGL
      viewState={viewState}
      layers={layers}
      style={{ position: 'absolute', top: '0', left: '0', right: '0', bottom: '0', pointerEvents: 'none' }}
    />
  )
}
