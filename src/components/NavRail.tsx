import { useStore } from '@/store'
import { Hover } from './ui/Hover'
import { langLabel } from '@/data/langs'
import type { ViewName } from '@/types'

interface NavItem { label: string; icon: string; view: ViewName }

const WORKSPACE: NavItem[] = [
  { label: 'Kênh', icon: '#', view: 'channels' },
  { label: 'Kiến thức', icon: '📚', view: 'knowledge' },
  { label: 'Cron', icon: '⏱', view: 'cron' },
  { label: 'Agent Workflow', icon: '🧩', view: 'workflow' },
]
const LEAD: NavItem[] = [
  { label: 'Tổng quan', icon: '▦', view: 'overview' },
  { label: 'Phòng', icon: '🏠', view: 'rooms' },
  { label: 'Agents', icon: '🤖', view: 'agents' },
  { label: 'MCP', icon: '🔌', view: 'mcp' },
]
const OWNER: NavItem[] = [
  { label: 'Tác vụ', icon: '🗂', view: 'tasks' },
  { label: 'Thiết bị', icon: '🖥', view: 'devices' },
  { label: 'Phiên & nhật ký', icon: '📜', view: 'logs' },
  { label: 'Phân quyền', icon: '🛡', view: 'perms' },
  { label: 'Sử dụng', icon: '💳', view: 'billing' },
  { label: 'Người dùng & vai trò', icon: '👥', view: 'users' },
]

const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase',
  color: 'rgba(255,255,255,.42)', padding: '16px 8px 8px',
}

function NavSection({ title, items, first }: { title: string; items: NavItem[]; first?: boolean }) {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  return (
    <>
      <div style={{ ...sectionLabel, paddingTop: first ? 0 : 16 }}>{title}</div>
      {items.map((n) => {
        const active = n.view === view
        return (
          <Hover
            key={n.label}
            onClick={() => setView(n.view)}
            style={{
              display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px', borderRadius: 10,
              cursor: 'pointer', fontSize: 13, fontWeight: 500, marginBottom: 1,
              background: active ? 'rgba(255,255,255,.16)' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,.78)',
            }}
            hover={{ background: 'rgba(255,255,255,.08)' }}
          >
            <span style={{ width: 18, textAlign: 'center', fontSize: 14 }}>{n.icon}</span>
            <span>{n.label}</span>
          </Hover>
        )
      })}
    </>
  )
}

export function NavRail() {
  const view = useStore((s) => s.view)
  const openNotifs = useStore((s) => s.openNotifs)
  const openLanguage = useStore((s) => s.openLanguage)
  const openProfile = useStore((s) => s.openProfile)
  const activeLang = useStore((s) => s.activeLang)
  const profileData = useStore((s) => s.profileData)
  const unread = useStore((s) => s.notifsData.filter((n) => n.unread).length)

  return (
    <nav className="railscroll" style={{ width: 236, flex: 'none', background: 'var(--nav-bg)', color: 'rgba(255,255,255,.9)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '18px 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(150deg,rgba(255,255,255,.26),rgba(255,255,255,.12))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path d="M12 12 L12 5 M12 12 L6 17 M12 12 L18 17" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="12" r="2.7" fill="#fff" />
            <circle cx="12" cy="5" r="1.9" fill="#fff" />
            <circle cx="6" cy="17" r="1.9" fill="#fff" />
            <circle cx="18" cy="17" r="1.9" fill="#fff" />
          </svg>
        </div>
        <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-.3px', color: '#fff' }}>AgentAIOS</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 10px 8px' }}>
        <NavSection title="Workspace" items={WORKSPACE} first />
        <NavSection title="Lead" items={LEAD} />
        <NavSection title="Owner" items={OWNER} />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', padding: '8px 10px' }}>
        <Hover
          onClick={openNotifs}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, background: view === 'notifs' ? 'rgba(255,255,255,.16)' : 'transparent', color: view === 'notifs' ? '#fff' : 'rgba(255,255,255,.9)' }}
          hover={{ background: 'rgba(255,255,255,.08)' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}><span style={{ width: 18, textAlign: 'center' }}>🔔</span>Thông báo</span>
          {unread > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--danger)', color: '#fff', padding: '2px 6px', borderRadius: 99 }}>{unread}</span>}
        </Hover>
        <Hover
          onClick={openLanguage}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, background: view === 'language' ? 'rgba(255,255,255,.16)' : 'transparent', color: view === 'language' ? '#fff' : 'rgba(255,255,255,.9)' }}
          hover={{ background: 'rgba(255,255,255,.08)' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 11 }}><span style={{ width: 18, textAlign: 'center' }}>🌐</span>{langLabel(activeLang)}</span>
          <span style={{ opacity: 0.6 }}>⌄</span>
        </Hover>
        <Hover
          onClick={openProfile}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', marginTop: 2, borderTop: '1px solid rgba(255,255,255,.08)', borderRadius: 10, cursor: 'pointer' }}
          hover={{ background: 'rgba(255,255,255,.08)' }}
        >
          <div style={{ width: 30, height: 30, borderRadius: 99, background: '#A9B9F2', color: 'var(--jade-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flex: 'none' }}>{profileData.name[0]}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profileData.name}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.5)' }}>Owner</div>
          </div>
          <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 16 }}>›</span>
        </Hover>
      </div>
    </nav>
  )
}
