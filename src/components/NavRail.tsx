import { useState } from 'react'
import { useStore } from '@/store'
import { Hover } from './ui/Hover'
import { langLabel } from '@/data/langs'
import { useT } from '@/i18n'
import type { ViewName } from '@/types'

interface NavItem { label: string; icon: string; view: ViewName }

const WORKSPACE: NavItem[] = [
  { label: 'Kênh', icon: '#', view: 'channels' },
  { label: 'Kiến thức', icon: '📚', view: 'knowledge' },
  { label: 'Cron', icon: '⏱', view: 'cron' },
  { label: 'Agent Workflow', icon: '🧩', view: 'workflow' },
  { label: 'Chứng khoán', icon: '📈', view: 'trading' },
  { label: 'Âm nhạc', icon: '🎵', view: 'music' },
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
  { label: 'Người dùng & vai trò', icon: '👥', view: 'users' },
]

const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase',
  color: 'rgba(255,255,255,.42)', padding: '16px 8px 8px',
}

function NavSection({ title, items, first, collapsed }: { title: string; items: NavItem[]; first?: boolean; collapsed?: boolean }) {
  const view = useStore((s) => s.view)
  const setView = useStore((s) => s.setView)
  const t = useT()
  return (
    <>
      {collapsed
        ? <div style={{ height: first ? 4 : 14 }} />
        : <div style={{ ...sectionLabel, paddingTop: first ? 0 : 16 }}>{t(title)}</div>}
      {items.map((n) => {
        const active = n.view === view
        return (
          <Hover
            key={n.label}
            onClick={() => setView(n.view)}
            title={collapsed ? t(n.label) : undefined}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              gap: collapsed ? 0 : 11, padding: collapsed ? '10px 0' : '8px 10px', borderRadius: 10,
              cursor: 'pointer', fontSize: 13, fontWeight: 500, marginBottom: 1,
              background: active ? 'rgba(255,255,255,.16)' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,.78)',
            }}
            hover={{ background: 'rgba(255,255,255,.08)' }}
          >
            <span style={{ width: 18, textAlign: 'center', fontSize: 14 }}>{n.icon}</span>
            {!collapsed && <span>{t(n.label)}</span>}
          </Hover>
        )
      })}
    </>
  )
}

export function NavRail() {
  const t = useT()
  const view = useStore((s) => s.view)
  const openNotifs = useStore((s) => s.openNotifs)
  const openLanguage = useStore((s) => s.openLanguage)
  const openProfile = useStore((s) => s.openProfile)
  const activeLang = useStore((s) => s.activeLang)
  const profileData = useStore((s) => s.profileData)
  const unread = useStore((s) => s.notifsData.filter((n) => n.unread).length)
  const [collapsed, setCollapsed] = useState(false)

  return (
    <nav className="railscroll" style={{ width: collapsed ? 64 : 236, flex: 'none', background: 'var(--nav-bg)', color: 'rgba(255,255,255,.9)', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'width .18s ease' }}>
      {/* logo — click to collapse / expand the rail */}
      <Hover
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? t('Mở rộng thanh điều hướng') : t('Thu gọn thanh điều hướng')}
        style={{ padding: collapsed ? '18px 0 12px' : '18px 16px 12px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10, cursor: 'pointer' }}
        hover={{ background: 'rgba(255,255,255,.06)' }}
      >
        <div style={{ width: 32, height: 32, flex: 'none', borderRadius: 10, background: 'linear-gradient(150deg,rgba(255,255,255,.26),rgba(255,255,255,.12))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path d="M12 12 L12 5 M12 12 L6 17 M12 12 L18 17" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="12" cy="12" r="2.7" fill="#fff" />
            <circle cx="12" cy="5" r="1.9" fill="#fff" />
            <circle cx="6" cy="17" r="1.9" fill="#fff" />
            <circle cx="18" cy="17" r="1.9" fill="#fff" />
          </svg>
        </div>
        {!collapsed && <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: '-.3px', color: '#fff' }}>AgentAIOS</div>}
      </Hover>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: collapsed ? '14px 6px 8px' : '14px 10px 8px' }}>
        <NavSection title="Workspace" items={WORKSPACE} first collapsed={collapsed} />
        <NavSection title="Lead" items={LEAD} collapsed={collapsed} />
        <NavSection title="Owner" items={OWNER} collapsed={collapsed} />
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', padding: collapsed ? '8px 6px' : '8px 10px' }}>
        <Hover
          onClick={openNotifs}
          title={collapsed ? t('Thông báo') : undefined}
          style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '9px 0' : '8px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, position: 'relative', background: view === 'notifs' ? 'rgba(255,255,255,.16)' : 'transparent', color: view === 'notifs' ? '#fff' : 'rgba(255,255,255,.9)' }}
          hover={{ background: 'rgba(255,255,255,.08)' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 11 }}><span style={{ width: 18, textAlign: 'center' }}>🔔</span>{!collapsed && t('Thông báo')}</span>
          {unread > 0 && (collapsed
            ? <span style={{ position: 'absolute', top: 6, right: 14, width: 7, height: 7, borderRadius: 99, background: 'var(--danger)' }} />
            : <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--danger)', color: '#fff', padding: '2px 6px', borderRadius: 99 }}>{unread}</span>)}
        </Hover>
        <Hover
          onClick={openLanguage}
          title={collapsed ? langLabel(activeLang) : undefined}
          style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', padding: collapsed ? '9px 0' : '8px 10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, background: view === 'language' ? 'rgba(255,255,255,.16)' : 'transparent', color: view === 'language' ? '#fff' : 'rgba(255,255,255,.9)' }}
          hover={{ background: 'rgba(255,255,255,.08)' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 11 }}><span style={{ width: 18, textAlign: 'center' }}>🌐</span>{!collapsed && langLabel(activeLang)}</span>
          {!collapsed && <span style={{ opacity: 0.6 }}>⌄</span>}
        </Hover>
        <Hover
          onClick={openProfile}
          title={collapsed ? profileData.name : undefined}
          style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10, padding: collapsed ? '9px 0' : '9px 10px', marginTop: 2, borderTop: '1px solid rgba(255,255,255,.08)', borderRadius: 10, cursor: 'pointer' }}
          hover={{ background: 'rgba(255,255,255,.08)' }}
        >
          <div style={{ width: 30, height: 30, borderRadius: 99, background: '#A9B9F2', color: 'var(--jade-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flex: 'none' }}>{profileData.name[0]}</div>
          {!collapsed && (
            <>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profileData.name}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.5)' }}>{t('Owner')}</div>
              </div>
              <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 16 }}>›</span>
            </>
          )}
        </Hover>
      </div>
    </nav>
  )
}
