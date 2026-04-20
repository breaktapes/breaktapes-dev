interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  className?: string
}

/**
 * Shimmer skeleton block — used in all loading states across the app.
 * Width/height match the rendered content shape (no spinners inside data components).
 */
export function Skeleton({ width = '100%', height = 20, borderRadius = 6, className }: SkeletonProps) {
  return (
    <div
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: 'var(--surface2)',
        backgroundImage: 'linear-gradient(90deg, var(--surface2) 0%, var(--surface3) 50%, var(--surface2) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
        flexShrink: 0,
      }}
    />
  )
}

export function SkeletonText({ lines = 3, gap = 8 }: { lines?: number; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={14} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  )
}
