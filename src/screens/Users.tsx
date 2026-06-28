import { useStore } from '@/store'
import { useT } from '@/i18n'
import { Hover } from '@/components/ui/Hover'
import type { UserRow, Invite, Signup } from '@/types'

// ---- role & status style maps ----
const uRoleStyle: Record<string, { label: string; fg: string; bg: string }> = {
  owner: { label: 'Owner', fg: '#3B5BDB', bg: '#EEF2FF' },
  lead:  { label: 'Lead',  fg: '#0E7490', bg: '#E0F2F4' },
  staff: { label: 'Staff', fg: '#0A7B52', bg: '#E2F3EC' },
  viewer:{ label: 'Viewer',fg: '#9A6A1B', bg: '#FBF1DE' },
}
const uStatusStyle: Record<string, { label: string; fg: string; bg: string; dot: string }> = {
  active:    { label: 'Hoạt động', fg: '#0A7B52', bg: '#E2F3EC', dot: '#0A7B52' },
  suspended: { label: 'Tạm khóa',  fg: '#C94F3D', bg: '#FBEAE7', dot: '#C94F3D' },
}

// ---- Invite modal ----
function InviteModal() {
  const s = useStore()
  const t = useT()
  const roleBtns = (['lead', 'staff', 'viewer'] as const).map((k) => {
    const sel = s.inviteForm.role === k
    const r = uRoleStyle[k]
    return { key: k, label: r.label, bg: sel ? 'var(--jade)' : 'transparent', fg: sel ? '#fff' : 'var(--ink-2)', border: sel ? 'var(--jade)' : 'var(--line)' }
  })
  return (
    <div onClick={s.closeOverlay} style={{ position: 'fixed', inset: 0, background: 'rgba(20,35,30,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 62, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '100%', background: 'var(--surface)', borderRadius: 22, boxShadow: '0 24px 60px rgba(0,0,0,.28)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--jade-soft)', color: 'var(--jade-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>✉️</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>{t('Mời người dùng')}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{t('Gửi lời mời qua email để tham gia workspace.')}</div>
            </div>
          </div>
          <Hover as="button" onClick={s.closeOverlay} style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }} hover={{ background: 'var(--line)' }}>✕</Hover>
        </div>
        <div style={{ padding: '18px 24px 4px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Email người được mời')}</label>
            <input
              value={s.inviteForm.email}
              onChange={(e) => s.onInviteEmail(e.target.value)}
              placeholder={t('vd. ten@zytech.vn')}
              autoFocus
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 12, fontFamily: 'inherit', fontSize: 14, padding: '12px 14px', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Vai trò khi tham gia')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {roleBtns.map((b) => (
                <Hover as="button" key={b.key} onClick={() => s.setInviteRole(b.key)} style={{ flex: 1, border: `1.5px solid ${b.border}`, background: b.bg, color: b.fg, borderRadius: 99, padding: 10, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} hover={{ borderColor: 'var(--jade)' }}>{b.label}</Hover>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginTop: 9, lineHeight: 1.5 }}>{t('Người được mời sẽ nhận email kèm liên kết tham gia. Bạn có thể đổi vai trò sau khi họ chấp nhận.')}</div>
          </div>
        </div>
        <div style={{ padding: '18px 24px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Hover as="button" onClick={s.closeOverlay} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>{t('Hủy')}</Hover>
          <Hover as="button" onClick={s.submitInvite} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '11px 24px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade-deep)' }}>✉️ {t('Gửi lời mời')}</Hover>
        </div>
      </div>
    </div>
  )
}

// ---- Edit user modal ----
function EditUserModal() {
  const s = useStore()
  const t = useT()
  const eu = s.editUser
  if (!eu) return null
  const roleBtns = (['lead', 'staff', 'viewer'] as const).map((k) => {
    const sel = eu.role === k
    return { key: k, label: uRoleStyle[k].label, bg: sel ? 'var(--jade)' : 'transparent', fg: sel ? '#fff' : 'var(--ink-2)', border: sel ? 'var(--jade)' : 'var(--line)' }
  })
  const statusBtns = (['active', 'suspended'] as const).map((k) => {
    const sel = eu.status === k
    const lbl = k === 'active' ? t('Hoạt động') : t('Tạm khóa')
    return { key: k, label: lbl, bg: sel ? 'var(--jade)' : 'transparent', fg: sel ? '#fff' : 'var(--ink-2)', border: sel ? 'var(--jade)' : 'var(--line)' }
  })
  return (
    <div onClick={s.closeEditUser} style={{ position: 'fixed', inset: 0, background: 'rgba(20,35,30,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 64, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '100%', background: 'var(--surface)', borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,.28)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 46, height: 46, borderRadius: 99, background: eu.color as string, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flex: 'none' }}>{eu.initial as string}</div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.3px' }}>{t('Sửa hồ sơ thành viên')}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{t('Cập nhật thông tin, vai trò và trạng thái.')}</div>
            </div>
          </div>
          <Hover as="button" onClick={s.closeEditUser} style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }} hover={{ background: 'var(--line)' }}>✕</Hover>
        </div>
        <div style={{ padding: '6px 22px 4px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Họ và tên')}</label>
            <input
              value={(eu.name as string) || ''}
              onChange={(e) => s.onEditUserField('name', e.target.value)}
              placeholder={t('Nhập họ tên…')}
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 12, fontFamily: 'inherit', fontSize: 13.5, padding: '11px 13px', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>Email</label>
            <input
              value={(eu.email as string) || ''}
              onChange={(e) => s.onEditUserField('email', e.target.value)}
              placeholder={t('email@công-ty.vn')}
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 12, fontFamily: 'inherit', fontSize: 13.5, padding: '11px 13px', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Vai trò')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {roleBtns.map((b) => (
                <button key={b.key} onClick={() => s.setEditUserRole(b.key)} style={{ flex: 1, border: `1.5px solid ${b.border}`, background: b.bg, color: b.fg, borderRadius: 99, padding: 9, font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{b.label}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Trạng thái')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {statusBtns.map((b) => (
                <button key={b.key} onClick={() => s.setEditUserStatus(b.key)} style={{ flex: 1, border: `1.5px solid ${b.border}`, background: b.bg, color: b.fg, borderRadius: 99, padding: 9, font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{b.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ padding: '18px 22px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Hover as="button" onClick={s.closeEditUser} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>{t('Hủy')}</Hover>
          <Hover as="button" onClick={s.saveEditUser} style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '11px 24px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade-deep)' }}>{t('Lưu thay đổi')}</Hover>
        </div>
      </div>
    </div>
  )
}

// ---- Main screen ----
export function Users() {
  const s = useStore()
  const t = useT()

  const U = s.usersData
  const IV = s.invitesData
  const SG = s.signupsData

  // stat cards
  const usersStats = [
    { icon: '👥', label: t('Tổng người dùng'), value: String(U.length),  sub: IV.length + ' ' + t('lời mời chờ') },
    { icon: '🟢', label: t('Đang hoạt động'),  value: String(U.filter((u: UserRow) => u.status === 'active').length), sub: t('tài khoản active') },
    { icon: '🆕', label: t('Chờ duyệt'),       value: String(SG.length), sub: t('yêu cầu đăng ký mới') },
    { icon: '🛡', label: t('Vai trò'),          value: '4',               sub: 'Owner · Lead · Staff · Viewer' },
  ]

  // tabs
  const tabsDef = [
    { key: 'members', label: t('Thành viên'), count: U.length },
    { key: 'invites', label: t('Lời mời'),    count: IV.length },
    { key: 'signups', label: t('Đăng ký mới'),count: SG.length },
  ]
  const usersTabs = tabsDef.map((t) => {
    const sel = t.key === s.usersTab
    return { ...t, bg: sel ? 'var(--jade-soft)' : 'transparent', fg: sel ? 'var(--jade-deep)' : 'var(--ink-2)', border: sel ? 'var(--jade)' : 'var(--line)', weight: sel ? 700 : 500, countFg: sel ? 'var(--jade-deep)' : 'var(--placeholder)' }
  })

  // role filter chips (members tab)
  const uRoleFilterDefs = [
    { key: 'all',    label: t('Tất cả'), count: U.length },
    { key: 'owner',  label: 'Owner',  count: U.filter((u: UserRow) => u.role === 'owner').length },
    { key: 'lead',   label: 'Lead',   count: U.filter((u: UserRow) => u.role === 'lead').length },
    { key: 'staff',  label: 'Staff',  count: U.filter((u: UserRow) => u.role === 'staff').length },
    { key: 'viewer', label: 'Viewer', count: U.filter((u: UserRow) => u.role === 'viewer').length },
  ]
  const usersRoleFilters = uRoleFilterDefs.map((f) => {
    const sel = f.key === s.usersRole
    return { ...f, bg: sel ? 'var(--jade-soft)' : 'var(--surface)', border: sel ? 'var(--jade)' : 'var(--line)', fg: sel ? 'var(--jade-deep)' : 'var(--ink)' }
  })

  // filtered rows (members tab)
  const uq = s.usersQuery.trim().toLowerCase()
  const usersRows = U
    .filter((u: UserRow) => s.usersRole === 'all' || u.role === s.usersRole)
    .filter((u: UserRow) => !uq || u.name.toLowerCase().includes(uq) || u.email.toLowerCase().includes(uq))
    .map((u: UserRow) => {
      const rs = uRoleStyle[u.role] || uRoleStyle.viewer
      const ss = uStatusStyle[u.status] || uStatusStyle.active
      const open = s.userMenu === u.id
      const isOwner = u.role === 'owner'
      const susp = u.status === 'suspended'
      return {
        ...u,
        roleLabel: rs.label, roleFg: rs.fg, roleBg: rs.bg, isOwner, isNotOwner: !isOwner,
        onCycleRole: () => s.cycleRole(u.id),
        onOpenMenu: () => s.openUserMenu(u.id),
        menuOpen: open,
        menuBorder: open ? 'var(--jade)' : 'var(--line)',
        menuBtnBg: open ? 'var(--jade-soft)' : 'var(--surface)',
        menuBtnFg: open ? 'var(--jade-deep)' : 'var(--ink-2)',
        onEdit: () => s.openEditUser(u.id),
        canSuspend: !isOwner, canRemove: !isOwner,
        statusIcon: susp ? '🔓' : '🔒',
        statusAction: susp ? t('Mở khóa tài khoản') : t('Tạm khóa tài khoản'),
        onToggleStatus: () => s.toggleUserStatus(),
        onRemove: () => s.removeUser(),
        statusLabel: ss.label, statusFg: ss.fg, statusBg: ss.bg, statusDot: ss.dot,
      }
    })

  // invite rows
  const inviteRows = IV.map((iv: Invite) => {
    const rs = uRoleStyle[iv.role] || uRoleStyle.staff
    return { ...iv, roleLabel: rs.label, roleFg: rs.fg, roleBg: rs.bg }
  })

  // signup rows
  const signupRows = SG.map((r: Signup) => {
    const rs = uRoleStyle[r.role] || uRoleStyle.staff
    const open = s.signupMenu === r.id
    return {
      ...r,
      roleLabel: rs.label, roleFg: rs.fg, roleBg: rs.bg,
      menuOpen: open,
      nameColor: open ? 'var(--jade-deep)' : 'var(--ink)',
      onToggleMenu: () => s.openSignupMenu(r.id),
      roleOptions: (['lead', 'staff', 'viewer'] as const).map((k) => {
        const sel = k === r.role
        const os = uRoleStyle[k]
        return { key: k, label: os.label, dot: os.fg, sel, check: sel ? '✓' : '', bg: sel ? 'var(--jade-soft)' : 'transparent', fg: sel ? 'var(--jade-deep)' : 'var(--ink)', onSelect: () => s.setSignupRole(r.id, k) }
      }),
      onApprove: () => s.approveSignup(r.id),
      onReject: () => s.rejectSignup(r.id),
    }
  })

  const usersTabMembers = s.usersTab === 'members'
  const usersTabInvites = s.usersTab === 'invites'
  const usersTabSignups = s.usersTab === 'signups'

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* header */}
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › {t('Người dùng & vai trò')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>{t('Người dùng & vai trò')}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{t('Quản lý thành viên và phân vai trò')}</span>
          </div>
        </div>
        <Hover as="button" onClick={s.openInvite} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }} hover={{ background: 'var(--jade-deep)' }}>✉️ {t('Mời người dùng')}</Hover>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>
        {/* stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 18 }}>
          {usersStats.map((st) => (
            <div key={st.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>{st.icon}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 4 }}>{st.label}</div>
                <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-.6px', lineHeight: 1, color: 'var(--ink)' }}>{st.value}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4 }}>{st.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {usersTabs.map((t) => (
            <Hover as="button" key={t.key} onClick={() => s.setUsersTab(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${t.border}`, background: t.bg, color: t.fg, borderRadius: 99, padding: '9px 18px', font: 'inherit', fontSize: 13, fontWeight: t.weight, cursor: 'pointer' }}
              hover={{ borderColor: 'var(--jade)' }}>
              {t.label}<span style={{ fontSize: 11, fontWeight: 700, color: t.countFg }}>{t.count}</span>
            </Hover>
          ))}
        </div>

        {/* ---- MEMBERS TAB ---- */}
        {usersTabMembers && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {usersRoleFilters.map((f) => (
                  <Hover as="button" key={f.key} onClick={() => s.setUsersRole(f.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${f.border}`, background: f.bg, borderRadius: 99, padding: '7px 15px', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: f.fg, cursor: 'pointer' }}
                    hover={{ borderColor: 'var(--jade)' }}>
                    {f.label}<span style={{ color: 'var(--placeholder)', fontWeight: 700 }}>{f.count}</span>
                  </Hover>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 11, padding: '9px 14px', width: 240, flex: 'none' }}>
                <span style={{ color: 'var(--placeholder)', fontSize: 14 }}>🔍</span>
                <input value={s.usersQuery} onChange={(e) => s.set({ usersQuery: e.target.value })} placeholder={t('Tìm theo tên hoặc email…')} style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, background: 'transparent', color: 'var(--ink)' }} />
              </div>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,1.8fr) 160px 150px 130px 60px', padding: '12px 20px', borderBottom: '1px solid var(--line)', fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--placeholder)' }}>
                <div>{t('Người dùng')}</div><div>{t('Vai trò')}</div><div>{t('Trạng thái')}</div><div>{t('Hoạt động cuối')}</div><div></div>
              </div>
              {usersRows.map((u) => (
                <Hover key={u.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(240px,1.8fr) 160px 150px 130px 60px', alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--line)' }} hover={{ background: 'var(--bg)' }}>
                  {/* user col */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 99, background: u.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flex: 'none' }}>{u.initial}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--placeholder)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.email}</div>
                    </div>
                  </div>
                  {/* role col */}
                  <div>
                    {u.isOwner ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: u.roleFg, background: u.roleBg, padding: '4px 11px', borderRadius: 99 }}>🔒 {u.roleLabel}</span>
                    ) : (
                      <Hover as="button" onClick={u.onCycleRole} title={t('Đổi vai trò')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: u.roleFg, background: u.roleBg, border: 'none', padding: '4px 11px', borderRadius: 99, cursor: 'pointer', fontFamily: 'inherit' }} hover={{}}>
                        {u.roleLabel} <span style={{ opacity: .6 }}>⌄</span>
                      </Hover>
                    )}
                  </div>
                  {/* status col */}
                  <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: u.statusFg, background: u.statusBg, padding: '4px 11px', borderRadius: 99 }}>
                      <span style={{ width: 7, height: 7, borderRadius: 99, background: u.statusDot }}></span>
                      {u.statusLabel}
                    </span>
                  </div>
                  {/* last active col */}
                  <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{u.last}</div>
                  {/* menu col */}
                  <div style={{ textAlign: 'right', position: 'relative' }}>
                    <Hover as="button" onClick={u.onOpenMenu} title={t('Tùy chọn')}
                      style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${u.menuBorder}`, background: u.menuBtnBg, color: u.menuBtnFg, fontSize: 14, cursor: 'pointer' }}
                      hover={{ background: 'var(--jade-soft)', color: 'var(--jade-deep)' }}>⋯</Hover>
                    {u.menuOpen && (
                      <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 8, zIndex: 30, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 12px 32px rgba(15,30,25,.16)', padding: 7, minWidth: 192, textAlign: 'left' }}>
                        <Hover as="button" onClick={u.onEdit} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', borderRadius: 9, padding: '9px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }} hover={{ background: 'var(--jade-soft)', color: 'var(--jade-deep)' }}>
                          <span style={{ fontSize: 14 }}>✏️</span>{t('Sửa hồ sơ')}
                        </Hover>
                        {u.canSuspend && (
                          <Hover as="button" onClick={u.onToggleStatus} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', borderRadius: 9, padding: '9px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }} hover={{ background: 'var(--jade-soft)', color: 'var(--jade-deep)' }}>
                            <span style={{ fontSize: 14 }}>{u.statusIcon}</span>{u.statusAction}
                          </Hover>
                        )}
                        {u.canRemove && (
                          <>
                            <div style={{ height: 1, background: 'var(--line)', margin: '5px 8px' }}></div>
                            <Hover as="button" onClick={u.onRemove} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', borderRadius: 9, padding: '9px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--danger)' }} hover={{ background: '#FBEAE7' }}>
                              <span style={{ fontSize: 14 }}>🗑</span>{t('Xóa khỏi workspace')}
                            </Hover>
                          </>
                        )}
                        {u.isOwner && (
                          <div style={{ padding: '7px 10px', fontSize: 11, color: 'var(--placeholder)', lineHeight: 1.4 }}>{t('Chủ workspace không thể bị khóa hoặc gỡ.')}</div>
                        )}
                      </div>
                    )}
                  </div>
                </Hover>
              ))}
            </div>
          </>
        )}

        {/* ---- INVITES TAB ---- */}
        {usersTabInvites && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18 }}>
            {inviteRows.map((iv) => (
              <Hover key={iv.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 20px', borderBottom: '1px solid var(--line)' }} hover={{ background: 'var(--bg)' }}>
                <div style={{ width: 38, height: 38, borderRadius: 99, background: 'var(--jade-soft)', color: 'var(--jade-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flex: 'none' }}>✉️</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{iv.email}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginTop: 1 }}>{t('Mời bởi')} {iv.by} · {iv.time}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: iv.roleFg, background: iv.roleBg, padding: '4px 11px', borderRadius: 99 }}>{iv.roleLabel}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#9A6A1B', background: '#FBF1DE', padding: '4px 11px', borderRadius: 99 }}>{t('Đang chờ')}</span>
                <Hover as="button" onClick={() => s.resendInvite(iv.id)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: '6px 13px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade)', color: '#fff' }}>{t('Gửi lại')}</Hover>
                <Hover as="button" onClick={() => s.cancelInvite(iv.id)} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ color: 'var(--danger)' }}>{t('Hủy')}</Hover>
              </Hover>
            ))}
            {inviteRows.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--placeholder)', fontSize: 13 }}>{t('Không có lời mời nào đang chờ.')}</div>
            )}
          </div>
        )}

        {/* ---- SIGNUPS TAB ---- */}
        {usersTabSignups && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, fontSize: 12.5, color: 'var(--ink-2)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#9A6A1B', background: '#FBF1DE', padding: '5px 12px', borderRadius: 99 }}>🆕 {t('Chờ bạn duyệt')}</span>
              <span>{t('Người mới yêu cầu tham gia workspace — duyệt để cấp quyền, hoặc từ chối.')}</span>
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18 }}>
              {signupRows.map((r) => (
                <Hover key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 20px', borderBottom: '1px solid var(--line)' }} hover={{ background: 'var(--bg)' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 99, background: r.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flex: 'none' }}>{r.initial}</div>
                  <div style={{ minWidth: 0, flex: 1, position: 'relative' }}>
                    <button onClick={r.onToggleMenu} title={t('Đổi vai trò đề xuất')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', maxWidth: '100%' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: r.nameColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--placeholder)' }}>✎</span>
                    </button>
                    <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginTop: 1 }}>{r.email} · {t('qua')} {r.via} · {r.time}</div>
                    {r.menuOpen && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 8, zIndex: 30, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 12px 32px rgba(15,30,25,.16)', padding: 7, minWidth: 188 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--placeholder)', padding: '5px 10px 7px' }}>{t('Vai trò đề xuất')}</div>
                        {r.roleOptions.map((o) => (
                          <Hover as="button" key={o.key} onClick={o.onSelect}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, background: o.bg, border: 'none', borderRadius: 9, padding: '9px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, color: o.fg }}
                            hover={{ background: 'var(--jade-soft)' }}>
                            <span style={{ width: 8, height: 8, borderRadius: 99, background: o.dot, flex: 'none' }}></span>
                            <span style={{ flex: 1, textAlign: 'left' }}>{o.label}</span>
                            <span style={{ color: 'var(--jade)', fontWeight: 800 }}>{o.check}</span>
                          </Hover>
                        ))}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.roleFg, background: r.roleBg, padding: '4px 11px', borderRadius: 99 }}>{t('Đề xuất:')} {r.roleLabel}</span>
                  <Hover as="button" onClick={r.onApprove}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}
                    hover={{ filter: 'brightness(.94)' }}>✓ {t('Duyệt')}</Hover>
                  <Hover as="button" onClick={r.onReject}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--danger)', background: 'transparent', border: '1px solid var(--line)', borderRadius: 99, padding: '8px 16px', cursor: 'pointer', fontFamily: 'inherit' }}
                    hover={{ borderColor: 'var(--danger)', background: '#FBEAE7' }}>✕ {t('Từ chối')}</Hover>
                </Hover>
              ))}
              {signupRows.length === 0 && (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--placeholder)', fontSize: 13 }}>{t('Không còn yêu cầu nào đang chờ duyệt.')}</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* modals */}
      {s.overlay === 'invite' && <InviteModal />}
      {s.editUser && <EditUserModal />}
    </div>
  )
}
