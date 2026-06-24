import { type CSSProperties, type ReactNode } from 'react'
import { Hover } from './Hover'

/** Full-width screen frame: bg column with sticky header + scrolling body. */
export function Screen({ children }: { children: ReactNode }) {
  return <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>{children}</div>
}

export function PageHeader({
  breadcrumb,
  title,
  count,
  actions,
}: {
  breadcrumb: string
  title: ReactNode
  count?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header
      style={{
        flex: 'none',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--line)',
        padding: '16px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>{breadcrumb}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>{title}</span>
          {count != null && <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{count}</span>}
        </div>
      </div>
      {actions && <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>{actions}</div>}
    </header>
  )
}

export function ScreenBody({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px', ...style }}>{children}</div>
}

/** Primary pill button. */
export function PrimaryBtn({ children, onClick, style }: { children: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  return (
    <Hover
      as="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        border: 'none',
        background: 'var(--jade)',
        color: '#fff',
        borderRadius: 99,
        padding: '10px 18px',
        font: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        boxShadow: '0 6px 16px rgba(10,92,72,.2)',
        ...style,
      }}
      hover={{ background: 'var(--jade-deep)' }}
    >
      {children}
    </Hover>
  )
}

/** Secondary / ghost pill button. */
export function GhostBtn({ children, onClick, style }: { children: ReactNode; onClick?: () => void; style?: CSSProperties }) {
  return (
    <Hover
      as="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        border: '1px solid var(--line)',
        background: 'var(--surface)',
        color: 'var(--ink-2)',
        borderRadius: 99,
        padding: '9px 16px',
        font: 'inherit',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        ...style,
      }}
      hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}
    >
      {children}
    </Hover>
  )
}

export interface StatDef {
  icon: string
  label: string
  value: ReactNode
  sub?: ReactNode
}

export function StatCards({ stats, cols = 4 }: { stats: StatDef[]; cols?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols},1fr)`, gap: 16, marginBottom: 20 }}>
      {stats.map((st, i) => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>{st.icon}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 4 }}>{st.label}</div>
            <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-.6px', lineHeight: 1, color: 'var(--ink)' }}>{st.value}</div>
            {st.sub != null && <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4 }}>{st.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

export interface ChipDef {
  key: string
  label: string
  count?: ReactNode
}

/** Filter chip row (e.g. All / Online / Busy …). */
export function FilterChips({ chips, active, onSelect }: { chips: ChipDef[]; active: string; onSelect: (k: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {chips.map((f) => {
        const on = f.key === active
        return (
          <Hover
            as="button"
            key={f.key}
            onClick={() => onSelect(f.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              border: `1px solid ${on ? 'var(--jade)' : 'var(--line)'}`,
              background: on ? 'var(--jade-soft)' : 'var(--surface)',
              borderRadius: 99,
              padding: '7px 15px',
              font: 'inherit',
              fontSize: 12.5,
              fontWeight: 600,
              color: on ? 'var(--jade-deep)' : 'var(--ink-2)',
              cursor: 'pointer',
            }}
            hover={{ borderColor: 'var(--jade)' }}
          >
            {f.label}
            {f.count != null && <span style={{ color: 'var(--placeholder)', fontWeight: 700 }}>{f.count}</span>}
          </Hover>
        )
      })}
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder, width = 260 }: { value: string; onChange: (v: string) => void; placeholder: string; width?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 11, padding: '9px 14px', width, flex: 'none' }}>
      <span style={{ color: 'var(--placeholder)', fontSize: 14 }}>🔍</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, background: 'transparent', color: 'var(--ink)' }}
      />
    </div>
  )
}

export function Badge({ children, fg, bg, style }: { children: ReactNode; fg: string; bg: string; style?: CSSProperties }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, color: fg, background: bg, padding: '2px 9px', borderRadius: 99, ...style }}>{children}</span>
  )
}
