import { useState } from 'react'
import { type AccentName, type ThemeName, type NavTone, type ThemeProps } from '@/theme'
import { Hover } from './ui/Hover'

const accents: AccentName[] = ['Indigo', 'Ngọc bích', 'Tím', 'Hồng', 'Hổ phách']
const themes: ThemeName[] = ['Sáng', 'Tối']
const navTones: NavTone[] = ['Theo nhấn', 'Than chì', 'Mực']

const swatch: Record<AccentName, string> = {
  Indigo: '#3B5BDB', 'Ngọc bích': '#0E7A5F', Tím: '#7C3AED', Hồng: '#E11D6B', 'Hổ phách': '#D97706',
}

function Row<T extends string>({ label, options, value, onChange, dot }: { label: string; options: T[]; value: T; onChange: (v: T) => void; dot?: Record<string, string> }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => {
          const on = o === value
          return (
            <button
              key={o}
              onClick={() => onChange(o)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${on ? 'var(--jade)' : 'var(--line)'}`,
                background: on ? 'var(--jade-soft)' : 'var(--surface)', color: on ? 'var(--jade-deep)' : 'var(--ink-2)',
                borderRadius: 99, padding: '5px 11px', font: 'inherit', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {dot && dot[o] && <span style={{ width: 10, height: 10, borderRadius: 99, background: dot[o], display: 'inline-block' }} />}
              {o}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Tweaks({ value, onChange }: { value: ThemeProps; onChange: (p: ThemeProps) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'fixed', right: 18, bottom: 18, zIndex: 200 }}>
      {open && (
        <div style={{ width: 250, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 16, boxShadow: '0 18px 50px rgba(22,32,28,.2)', marginBottom: 10, animation: 'pop .18s ease both' }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: 'var(--ink)' }}>Tweaks</div>
          <Row label="Màu nhấn" options={accents} value={value.accent} onChange={(accent) => onChange({ ...value, accent })} dot={swatch} />
          <Row label="Giao diện" options={themes} value={value.theme} onChange={(theme) => onChange({ ...value, theme })} />
          <Row label="Tông thanh nav" options={navTones} value={value.navTone} onChange={(navTone) => onChange({ ...value, navTone })} />
        </div>
      )}
      <Hover
        as="button"
        onClick={() => setOpen((o) => !o)}
        style={{ width: 46, height: 46, borderRadius: 99, border: 'none', background: 'var(--jade)', color: '#fff', fontSize: 20, cursor: 'pointer', boxShadow: '0 8px 22px rgba(10,92,72,.3)', marginLeft: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        hover={{ background: 'var(--jade-deep)' }}
        title="Tweaks"
      >
        🎨
      </Hover>
    </div>
  )
}
