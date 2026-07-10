import { type CSSProperties, type ElementType, type ReactNode, useState } from 'react'

type HoverProps = {
  as?: ElementType
  style?: CSSProperties
  hover?: CSSProperties
  children?: ReactNode
  className?: string
} & Record<string, unknown>

/**
 * Faithful port of the prototype's `style-hover` attribute: applies an extra
 * style object while the pointer is over the element.
 */
export function Hover({ as, style, hover, children, ...rest }: HoverProps) {
  const Tag = (as || 'div') as ElementType
  const [h, setH] = useState(false)
  // On pointer-leave, blank out hover-only keys (keys not already in `style`) so
  // React CLEARS them rather than leaving a stale value. Without this, a hover
  // `borderColor` on top of a base `border` shorthand leaves a sticky (dark)
  // border after you mouse away — React can't cleanly drop the longhand while the
  // shorthand stays. Blanking to '' forces the revert. Applies app-wide.
  let merged: CSSProperties | undefined = style
  if (hover) {
    if (h) {
      merged = { ...style, ...hover }
    } else {
      const cleared: Record<string, string> = {}
      for (const k of Object.keys(hover)) {
        if (!style || !(k in style)) cleared[k] = ''
      }
      merged = { ...style, ...cleared } as CSSProperties
    }
  }
  return (
    <Tag
      {...rest}
      style={merged}
      onMouseEnter={(e: React.MouseEvent) => {
        setH(true)
        ;(rest.onMouseEnter as ((e: React.MouseEvent) => void) | undefined)?.(e)
      }}
      onMouseLeave={(e: React.MouseEvent) => {
        setH(false)
        ;(rest.onMouseLeave as ((e: React.MouseEvent) => void) | undefined)?.(e)
      }}
    >
      {children}
    </Tag>
  )
}
