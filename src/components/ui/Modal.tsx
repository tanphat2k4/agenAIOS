import { type CSSProperties, type ReactNode } from 'react'

interface ModalProps {
  onClose: () => void
  children: ReactNode
  /** card width, default 440 */
  width?: number
  /** vertical alignment: center (default) or top */
  align?: 'center' | 'top'
  /** padding inside card, default 26 */
  padding?: number | string
  radius?: number
  cardStyle?: CSSProperties
  /** when true the card manages its own scroll/flex (no padding) */
  bare?: boolean
}

const stop = (e: React.MouseEvent) => e.stopPropagation()

export function Modal({ onClose, children, width = 440, align = 'center', padding = 26, radius = 24, cardStyle, bare }: ModalProps) {
  const backdrop: CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(22,32,28,.4)',
    display: 'flex',
    alignItems: align === 'top' ? 'flex-start' : 'center',
    justifyContent: 'center',
    paddingTop: align === 'top' ? '11vh' : undefined,
    zIndex: 50,
    animation: 'fadeIn .15s ease',
  }
  const card: CSSProperties = {
    width,
    maxWidth: '92vw',
    background: 'var(--surface)',
    borderRadius: radius,
    padding: bare ? 0 : padding,
    boxShadow: '0 24px 60px rgba(22,32,28,.22)',
    animation: 'pop .2s ease both',
    ...cardStyle,
  }
  return (
    <div onClick={onClose} style={backdrop}>
      <div onClick={stop} style={card}>
        {children}
      </div>
    </div>
  )
}

/** Modal header row: title + close button (matches prototype). */
export function ModalHead({ title, onClose, sub }: { title: ReactNode; onClose: () => void; sub?: ReactNode }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: sub ? 6 : 0 }}>
        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>{title}</div>
        <button
          onClick={onClose}
          style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }}
        >
          ✕
        </button>
      </div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 20, lineHeight: 1.5 }}>{sub}</div>}
    </>
  )
}
