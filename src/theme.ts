// Theming — ported from the prototype's applyTheme(). Driven by the Tweaks props.
export type AccentName = 'Indigo' | 'Ngọc bích' | 'Tím' | 'Hồng' | 'Hổ phách'
export type ThemeName = 'Sáng' | 'Tối'
export type NavTone = 'Theo nhấn' | 'Than chì' | 'Mực'

export interface ThemeProps {
  accent: AccentName
  theme: ThemeName
  navTone: NavTone
}

export const defaultTheme: ThemeProps = { accent: 'Indigo', theme: 'Sáng', navTone: 'Theo nhấn' }

const accents: Record<AccentName, [string, string, string]> = {
  Indigo: ['#3B5BDB', '#28409E', '#E8ECFB'],
  'Ngọc bích': ['#0E7A5F', '#0A5C48', '#E3F2EC'],
  Tím: ['#7C3AED', '#5B21B6', '#F1E9FD'],
  Hồng: ['#E11D6B', '#A8104A', '#FCE7F0'],
  'Hổ phách': ['#D97706', '#92520A', '#FBF1DE'],
}

const navTones: Record<NavTone, string | null> = {
  'Theo nhấn': null, // use accent deep
  'Than chì': '#1B2329',
  Mực: '#0E1518',
}

export function applyTheme(props: ThemeProps) {
  const root = document.documentElement
  if (!root) return
  const a = accents[props.accent] || accents.Indigo
  root.style.setProperty('--jade', a[0])
  root.style.setProperty('--jade-deep', a[1])
  root.style.setProperty('--jade-soft', a[2])

  const dark = props.theme === 'Tối'
  const L = { bg: '#F7F9F7', surface: '#FFFFFF', ink: '#16201C', ink2: '#5A6B64', ph: '#9AA8A1', line: '#E4EAE6' }
  const D = { bg: '#11181C', surface: '#1A2227', ink: '#ECF1EF', ink2: '#9BAAA4', ph: '#6B7B75', line: '#2A363B' }
  const t = dark ? D : L
  root.style.setProperty('--bg', t.bg)
  root.style.setProperty('--surface', t.surface)
  root.style.setProperty('--ink', t.ink)
  root.style.setProperty('--ink-2', t.ink2)
  root.style.setProperty('--placeholder', t.ph)
  root.style.setProperty('--line', t.line)

  root.style.setProperty('--nav-bg', navTones[props.navTone] || a[1])
}
