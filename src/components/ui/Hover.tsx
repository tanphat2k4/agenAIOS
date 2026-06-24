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
  return (
    <Tag
      {...rest}
      style={{ ...style, ...(h && hover ? hover : null) }}
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
