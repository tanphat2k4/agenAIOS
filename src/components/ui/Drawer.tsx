import { type ReactNode } from 'react'

const stop = (e: React.MouseEvent) => e.stopPropagation()

/** Right-side slide-in drawer — ported from the prototype's drawer pattern. */
export function Drawer({ onClose, children, width = 430 }: { onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(22,32,28,.4)',
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
        zIndex: 45,
        animation: 'fadeIn .15s ease',
      }}
    >
      <div
        onClick={stop}
        style={{
          width,
          maxWidth: '94vw',
          height: '100vh',
          background: 'var(--surface)',
          boxShadow: '-12px 0 40px rgba(22,32,28,.18)',
          animation: 'pop .25s ease both',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </div>
    </div>
  )
}
