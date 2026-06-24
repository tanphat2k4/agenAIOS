import { type CSSProperties } from 'react'

interface AvatarProps {
  initial: string
  color?: string
  size?: number
  /** border radius; default round (99) */
  radius?: number | string
  fg?: string
  fontSize?: number
  style?: CSSProperties
  onClick?: (e: React.MouseEvent) => void
  title?: string
}

/** Initial-in-a-tile avatar — the workspace's signature element. */
export function Avatar({ initial, color = 'var(--jade-soft)', size = 30, radius = 99, fg = '#fff', fontSize, style, onClick, title }: AvatarProps) {
  return (
    <div
      title={title}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: color,
        color: fg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: fontSize ?? Math.round(size * 0.45),
        flex: 'none',
        ...style,
      }}
    >
      {initial}
    </div>
  )
}
