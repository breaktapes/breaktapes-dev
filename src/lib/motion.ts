// Shared Framer Motion transition presets
// Import from here — never use Framer's default springs

export const transitions = {
  page:      { duration: 0.15, ease: 'easeOut' },
  sheet:     { type: 'spring' as const, stiffness: 300, damping: 35 },
  modal:     { duration: 0.25, ease: [0.16, 1, 0.3, 1] as const },
  accordion: { duration: 0.2, ease: 'easeInOut' },
  hover:     { duration: 0.1 },
} as const
