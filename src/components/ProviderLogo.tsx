// Full-color brand marks for wearable providers, rendered as inline SVG.
// Simplified, recognizable glyphs in each brand's official color — sized to the
// Activities provider cards. No external requests; crisp at any size.

import type { OWProvider } from '@/lib/openWearables'

interface ProviderLogoProps {
  provider: OWProvider
  size?: number
}

export function ProviderLogo({ provider, size = 26 }: ProviderLogoProps) {
  const common = { width: size, height: size, viewBox: '0 0 32 32', xmlns: 'http://www.w3.org/2000/svg' as const }

  switch (provider) {
    // WHOOP — red rounded tile with the sensor "donut" ring
    case 'whoop':
      return (
        <svg {...common} aria-label="WHOOP">
          <rect width="32" height="32" rx="7" fill="#FF0026" />
          <circle cx="16" cy="16" r="7.5" fill="none" stroke="#fff" strokeWidth="2.4" />
          <circle cx="16" cy="16" r="2.4" fill="#fff" />
        </svg>
      )

    // Strava — orange tile with the chevron/mountain mark
    case 'strava':
      return (
        <svg {...common} aria-label="Strava">
          <rect width="32" height="32" rx="7" fill="#FC4C02" />
          <path d="M16 6 L22 18 L18.4 18 L16 13.2 L13.6 18 L10 18 Z" fill="#fff" />
          <path d="M18.4 18 L20.2 21.6 L22 18 L24.6 18 L20.2 26.5 L15.8 18 Z" fill="#fff" fillOpacity="0.78" />
        </svg>
      )

    // Garmin — blue tile with the upward delta/triangle mark
    case 'garmin':
      return (
        <svg {...common} aria-label="Garmin">
          <rect width="32" height="32" rx="7" fill="#0072C6" />
          <path d="M16 7 L25 25 L16 20.5 L7 25 Z" fill="#fff" />
        </svg>
      )

    // Polar — red tile with the open circle mark
    case 'polar':
      return (
        <svg {...common} aria-label="Polar">
          <rect width="32" height="32" rx="7" fill="#D6001C" />
          <path d="M16 7 a9 9 0 1 0 0.01 0 Z" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M16 7 a9 9 0 0 1 7 3.6" fill="none" stroke="#D6001C" strokeWidth="2.6" />
          <circle cx="22" cy="11" r="2.6" fill="#fff" />
        </svg>
      )

    // Suunto — black tile with the stylized peak mark
    case 'suunto':
      return (
        <svg {...common} aria-label="Suunto">
          <rect width="32" height="32" rx="7" fill="#111316" />
          <path d="M7 23 L14 11 L18 18 L21 13 L25 23 Z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
        </svg>
      )

    // Ultrahuman — dark tile with the ring mark
    case 'ultrahuman':
      return (
        <svg {...common} aria-label="Ultrahuman">
          <rect width="32" height="32" rx="7" fill="#1C1B1F" />
          <circle cx="16" cy="16" r="8" fill="none" stroke="#C9A227" strokeWidth="3" />
          <circle cx="16" cy="16" r="3.4" fill="none" stroke="#C9A227" strokeWidth="1.6" />
        </svg>
      )

    default:
      return (
        <svg {...common} aria-label={provider}>
          <rect width="32" height="32" rx="7" fill="var(--surface3)" />
        </svg>
      )
  }
}
