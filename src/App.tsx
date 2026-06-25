import { useEffect, useState } from 'react'
import { useStore } from './store'
import { applyTheme, defaultTheme, type ThemeProps } from './theme'
import { NavRail } from './components/NavRail'
import { Toast } from './components/ui/Toast'
import { PersonCardPopover } from './components/PersonCardPopover'
import { ViewRouter } from './screens/ViewRouter'
import { Auth } from './screens/Auth'
import { getToken } from './api/client'

export function App() {
  const [theme] = useState<ThemeProps>(defaultTheme)
  useEffect(() => { applyTheme(theme) }, [theme])
  const authed = useStore((s) => s.authed)
  const personCard = useStore((s) => s.personCard)
  const bootAuth = useStore((s) => s.bootAuth)
  const [booting, setBooting] = useState(() => !!getToken())
  useEffect(() => { bootAuth().finally(() => setBooting(false)) }, [bootAuth])
  useEffect(() => {
    const onUnauth = () => {
      const st = useStore.getState()
      if (st.authed) { useStore.setState({ authed: false }); st.fireToast('Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại') }
    }
    window.addEventListener('agentaios:unauthorized', onUnauth)
    return () => window.removeEventListener('agentaios:unauthorized', onUnauth)
  }, [])

  if (booting) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--placeholder)', fontSize: 14 }}>
        Đang tải workspace…
      </div>
    )
  }
  if (!authed) return <Auth />

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden', background: 'var(--bg)', fontSize: 14 }}>
      <NavRail />
      <ViewRouter />
      {personCard && <PersonCardPopover />}
      <Toast />
    </div>
  )
}
