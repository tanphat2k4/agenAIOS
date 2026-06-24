import { useStore } from '@/store'
import { Hover } from './ui/Hover'

const stop = (e: React.MouseEvent) => e.stopPropagation()

/** Quick profile popover shown when clicking a username/avatar. */
export function PersonCardPopover() {
  const pc = useStore((s) => s.personCard)
  const close = useStore((s) => s.closePersonCard)
  const viewProfile = useStore((s) => s.personViewProfile)
  if (!pc) return null
  const isOwner = pc.isOwner || pc.name === 'Nguyễn Thiện Giang'
  const isAgent = pc.isAgent
  const roleFg = isOwner ? '#28409E' : isAgent ? '#0A7B52' : '#5A6B64'
  const roleBg = isOwner ? '#E8ECFB' : isAgent ? '#E2F3EC' : '#EEF2F0'
  const roleLabel = isOwner ? 'Owner' : isAgent ? 'Agent' : 'Thành viên'
  const handle = isAgent ? '@' + pc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : 'thành viên workspace'

  return (
    <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(20,35,30,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 62, padding: 24 }}>
      <div onClick={stop} style={{ width: 340, maxWidth: '100%', background: 'var(--surface)', borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,.28)', overflow: 'hidden' }}>
        <div style={{ height: 64, background: 'linear-gradient(120deg,#28409E,#3B5BDB 60%,#0E7490)' }} />
        <div style={{ padding: '0 22px 20px', marginTop: -34 }}>
          <div style={{ width: 68, height: 68, borderRadius: 99, background: pc.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 800, border: '4px solid var(--surface)' }}>{pc.initial}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>{pc.name}</span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: roleFg, background: roleBg, padding: '3px 10px', borderRadius: 99 }}>{roleLabel}</span>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--placeholder)', marginTop: 3 }}>{handle}</div>
          {isAgent && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 12, lineHeight: 1.55 }}>🤖 Agent AI trong workspace — thực thi tác vụ và workflow được giao.</div>}
          {isOwner && <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 12, lineHeight: 1.55 }}>👑 Chủ sở hữu workspace — toàn quyền quản lý đội ngũ và thanh toán.</div>}
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            {isOwner && (
              <Hover as="button" onClick={viewProfile} style={{ flex: 1, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: 10, font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }} hover={{ background: 'var(--jade-deep)' }}>Xem trang tài khoản</Hover>
            )}
            <Hover as="button" onClick={close} style={{ flex: 1, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', borderRadius: 99, padding: 10, font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }} hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>💬 Nhắn tin</Hover>
          </div>
        </div>
      </div>
    </div>
  )
}
