import { useEffect, useState } from 'react'
import { useStore } from './store'
import { applyTheme, defaultTheme, type ThemeProps } from './theme'
import { NavRail } from './components/NavRail'
import { Tweaks } from './components/Tweaks'
import { Toast } from './components/ui/Toast'
import { PersonCardPopover } from './components/PersonCardPopover'
import { ViewRouter } from './screens/ViewRouter'
import { Auth } from './screens/Auth'

export function App() {
  const [theme, setTheme] = useState<ThemeProps>(defaultTheme)
  useEffect(() => { applyTheme(theme) }, [theme])
  const authed = useStore((s) => s.authed)
  const personCard = useStore((s) => s.personCard)

  if (!authed) return <Auth />

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: 'var(--bg)', fontSize: 14 }}>
      <NavRail />
      <ViewRouter />
      {personCard && <PersonCardPopover />}
      <Toast />
      <Tweaks value={theme} onChange={setTheme} />
    </div>
  )
}
