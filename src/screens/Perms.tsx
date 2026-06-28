import { useStore } from '@/store'
import { useT } from '@/i18n'
import { Hover } from '@/components/ui/Hover'
import { PERMS } from '@/data/seed'
import type { RoleDef } from '@/types'

const GROUPS_ORDER = ['Kênh & Phòng', 'Kiến thức', 'Agents & Workflow', 'Cron & Tác vụ', 'Hệ thống']

// ---- Create role modal ----
function CreateRoleModal() {
  const s = useStore()
  const t = useT()
  const iconBtns = ['🛡', '🧭', '🤖', '👁', '✏️', '📊', '🔧', '⭐'].map((ic) => ({
    icon: ic,
    bg: ic === s.roleForm.icon ? 'var(--jade-soft)' : 'var(--bg)',
    border: ic === s.roleForm.icon ? 'var(--jade)' : 'var(--line)',
  }))
  const hasName = (s.roleForm.name || '').trim().length > 0
  return (
    <div onClick={s.closeCreateRole} style={{ position: 'fixed', inset: 0, background: 'rgba(20,35,30,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 62, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '100%', background: 'var(--surface)', borderRadius: 22, boxShadow: '0 24px 60px rgba(0,0,0,.28)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--jade-soft)', color: 'var(--jade-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>🛡</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>{t('Tạo vai trò mới')}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{t('Đặt tên, icon và mô tả cho vai trò tùy chỉnh.')}</div>
            </div>
          </div>
          <Hover as="button" onClick={s.closeCreateRole} style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }} hover={{ background: 'var(--line)' }}>✕</Hover>
        </div>
        <div style={{ padding: '18px 24px 4px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Tên vai trò')}</label>
            <input
              value={s.roleForm.name}
              onChange={(e) => s.onRoleField('name', e.target.value)}
              placeholder={t('vd. Marketing, Moderator…')}
              autoFocus
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 12, fontFamily: 'inherit', fontSize: 14, padding: '12px 14px', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 10 }}>Icon</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {iconBtns.map((b) => (
                <button key={b.icon} onClick={() => s.onRoleField('icon', b.icon)}
                  style={{ width: 40, height: 40, borderRadius: 10, border: `1.5px solid ${b.border}`, background: b.bg, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {b.icon}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Mô tả (tùy chọn)')}</label>
            <input
              value={s.roleForm.desc}
              onChange={(e) => s.onRoleField('desc', e.target.value)}
              placeholder={t('Mô tả ngắn về vai trò này…')}
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 12, fontFamily: 'inherit', fontSize: 14, padding: '12px 14px', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
            />
          </div>
        </div>
        <div style={{ padding: '18px 24px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Hover as="button" onClick={s.closeCreateRole} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>{t('Hủy')}</Hover>
          <Hover as="button" onClick={s.createRole} style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: hasName ? 'var(--jade)' : '#C9D4CF', border: 'none', borderRadius: 99, padding: '11px 24px', cursor: hasName ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }} hover={hasName ? { background: 'var(--jade-deep)' } : {}}>{t('Tạo vai trò')}</Hover>
        </div>
      </div>
    </div>
  )
}

// ---- Assign member modal ----
function AssignMemberModal() {
  const s = useStore()
  const t = useT()
  const ar = s.rolesData.find((r: RoleDef) => r.id === s.activeRole) || s.rolesData[0]
  const q = (s.assignForm.name || '').trim().toLowerCase()
  const have = (ar?.members || []).map((m) => m.name.toLowerCase())
  const pool: { name: string; sub: string; initial: string; color: string }[] = [
    ...s.usersData.map((u) => ({ name: u.name, sub: u.email, initial: u.initial, color: u.color })),
    ...s.agentsData.map((a) => ({ name: a.name, sub: a.handle + ' · ' + a.role, initial: a.initial, color: a.color })),
  ]
  const suggestions = q
    ? pool.filter((p) => p.name.toLowerCase().includes(q) && p.name.toLowerCase() !== q && !have.includes(p.name.toLowerCase())).slice(0, 5)
    : []
  const hasName = (s.assignForm.name || '').trim().length > 0
  return (
    <div onClick={s.closeAssignMember} style={{ position: 'fixed', inset: 0, background: 'rgba(20,35,30,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 62, padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '100%', background: 'var(--surface)', borderRadius: 22, boxShadow: '0 24px 60px rgba(0,0,0,.28)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px 4px' }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>{t('Gán thành viên')}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{t('Thêm user hoặc agent vào vai trò')} <b>{ar?.name}</b>.</div>
          </div>
          <Hover as="button" onClick={s.closeAssignMember} style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }} hover={{ background: 'var(--line)' }}>✕</Hover>
        </div>
        <div style={{ padding: '18px 24px 4px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Tên thành viên')}</label>
            <input
              value={s.assignForm.name}
              onChange={(e) => s.onAssignField('name', e.target.value)}
              placeholder={t('Tìm user hoặc agent…')}
              autoFocus
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 12, fontFamily: 'inherit', fontSize: 14, padding: '12px 14px', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
            />
            {suggestions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 12px 32px rgba(15,30,25,.16)', padding: 6, zIndex: 20, marginTop: 4 }}>
                {suggestions.map((p) => (
                  <Hover key={p.name} onClick={() => s.onAssignField('name', p.name)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 9, cursor: 'pointer' }}
                    hover={{ background: 'var(--jade-soft)' }}>
                    <div style={{ width: 30, height: 30, borderRadius: 99, background: p.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>{p.initial}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--placeholder)' }}>{p.sub}</div>
                    </div>
                  </Hover>
                ))}
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Ghi chú (tùy chọn)')}</label>
            <input
              value={s.assignForm.sub}
              onChange={(e) => s.onAssignField('sub', e.target.value)}
              placeholder={t('vd. user #89, agent #5…')}
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 12, fontFamily: 'inherit', fontSize: 14, padding: '12px 14px', color: 'var(--ink)', background: 'var(--bg)', outline: 'none', boxSizing: 'border-box' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
            />
          </div>
        </div>
        <div style={{ padding: '18px 24px 22px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Hover as="button" onClick={s.closeAssignMember} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>{t('Hủy')}</Hover>
          <Hover as="button" onClick={s.assignMember} style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: hasName ? 'var(--jade)' : '#C9D4CF', border: 'none', borderRadius: 99, padding: '11px 24px', cursor: hasName ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }} hover={hasName ? { background: 'var(--jade-deep)' } : {}}>{t('Gán thành viên')}</Hover>
        </div>
      </div>
    </div>
  )
}

// ---- Main screen ----
export function Perms() {
  const s = useStore()
  const t = useT()

  const R = s.rolesData
  const totalMembers = R.reduce((acc: number, r: RoleDef) => acc + r.members.length, 0)

  // stat cards
  const permStats = [
    { icon: '🛡', label: t('Vai trò'),        value: String(R.length),     sub: t('1 vai trò hệ thống') },
    { icon: '👥', label: t('Thành viên'),      value: String(totalMembers), sub: t('user & agent') },
    { icon: '🔑', label: t('Quyền hệ thống'), value: String(PERMS.length), sub: t('theo nhóm chức năng') },
    { icon: '✉️', label: t('Lời mời chờ'),    value: '2',                  sub: t('chưa phản hồi') },
  ]

  // role list
  const roleList = R.map((r: RoleDef) => {
    const sel = r.id === s.activeRole
    const on = Object.values(s.rolePerms[r.id] || {}).filter(Boolean).length
    return {
      ...r,
      bg: sel ? 'var(--jade-soft)' : 'var(--surface)',
      border: sel ? 'var(--jade)' : 'var(--line)',
      nameColor: sel ? 'var(--jade-deep)' : 'var(--ink)',
      accent: r.color,
      memberCount: r.members.length + ' ' + t('thành viên'),
      permCount: on + '/' + PERMS.length + ' ' + t('quyền'),
    }
  })

  // active role
  const ar = R.find((r: RoleDef) => r.id === s.activeRole) || R[1] || R[0]

  // permission groups
  const permGroups = GROUPS_ORDER.map((g) => ({
    group: g,
    items: PERMS.filter((p) => p.group === g).map((p) => {
      const on = ar ? !!(s.rolePerms[ar.id] && s.rolePerms[ar.id][p.id]) : false
      const locked = ar?.system ?? false
      return {
        id: p.id,
        label: p.label,
        on,
        locked,
        onToggle: locked ? () => {} : () => s.togglePerm(ar.id, p.id),
        toggleBg: on ? (locked ? '#9DBEF5' : 'var(--jade)') : '#CBD5D0',
        knobLeft: on ? '17px' : '2px',
      }
    }),
  }))

  // role detail
  const roleDetail = ar ? {
    name: ar.name,
    icon: ar.icon,
    desc: ar.desc,
    isSystem: ar.system,
    memberCount: ar.members.length,
    members: ar.members.map((mm) => ({ ...mm, onRemove: () => s.removeRoleMember(mm.name) })),
    grantedCount: Object.values(s.rolePerms[ar.id] || {}).filter(Boolean).length + '/' + PERMS.length,
  } : null

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* header */}
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › {t('Phân quyền')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>{t('Phân quyền')}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{t('Vai trò & quyền truy cập của user và agent')}</span>
          </div>
        </div>
        <Hover as="button" onClick={s.openCreateRole} style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }} hover={{ background: 'var(--jade-deep)' }}>＋ {t('Tạo vai trò')}</Hover>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>
        {/* stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
          {permStats.map((st) => (
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

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 18, alignItems: 'start' }}>
          {/* ---- role list ---- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {roleList.map((r) => (
              <Hover key={r.id} onClick={() => s.selectRole(r.id)}
                style={{ background: r.bg, border: `1.5px solid ${r.border}`, borderRadius: 14, padding: 14, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
                hover={{ borderColor: 'var(--jade)' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: r.accent }}></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 9, paddingLeft: 6 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flex: 'none' }}>{r.icon}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: r.nameColor }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--placeholder)' }}>{r.memberCount}</div>
                  </div>
                  {r.system && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '2px 8px', borderRadius: 99, flex: 'none' }}>{t('Hệ thống')}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--jade-deep)', paddingLeft: 6 }}>{r.permCount}</div>
              </Hover>
            ))}
          </div>

          {/* ---- role detail ---- */}
          {roleDetail && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* detail header card */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
                    <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flex: 'none' }}>{roleDetail.icon}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>{roleDetail.name}</span>
                        {roleDetail.isSystem && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '2px 9px', borderRadius: 99 }}>🔒 {t('Khóa')}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3 }}>{roleDetail.desc}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '5px 13px', borderRadius: 99, whiteSpace: 'nowrap', flex: 'none' }}>{roleDetail.grantedCount} {t('quyền')}</span>
                </div>
              </div>

              {/* permission groups */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
                {permGroups.map((g) => (
                  <div key={g.group} style={{ borderBottom: '1px solid var(--line)' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', padding: '14px 22px 4px' }}>{g.group}</div>
                    {g.items.map((p) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '12px 22px' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--ink)' }}>{p.label}</span>
                        <div
                          onClick={p.onToggle}
                          style={{ width: 38, height: 21, borderRadius: 99, background: p.toggleBg, position: 'relative', cursor: p.locked ? 'default' : 'pointer', flex: 'none', transition: 'background .15s' }}>
                          <div style={{ position: 'absolute', top: 2, left: p.knobLeft, width: 17, height: 17, borderRadius: 99, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)', transition: 'left .15s' }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* members with role */}
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px' }}>{t('Thành viên')} · {roleDetail.memberCount}</span>
                  <Hover as="button" onClick={s.openAssignMember} style={{ fontSize: 12, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade)', color: '#fff' }}>＋ {t('Gán thành viên')}</Hover>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {roleDetail.members.map((mm) => (
                    <div key={mm.name} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 12, padding: '10px 13px' }}>
                      <div style={{ width: 32, height: 32, borderRadius: 99, background: mm.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none' }}>{mm.initial}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mm.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--placeholder)' }}>{mm.sub}</div>
                      </div>
                      <Hover as="button" onClick={mm.onRemove} style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ color: 'var(--danger)' }}>{t('Gỡ')}</Hover>
                    </div>
                  ))}
                  {roleDetail.members.length === 0 && (
                    <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--placeholder)', fontSize: 13 }}>{t('Chưa có thành viên nào trong vai trò này.')}</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* modals */}
      {s.showCreateRole && <CreateRoleModal />}
      {s.showAssignMember && <AssignMemberModal />}
    </div>
  )
}
