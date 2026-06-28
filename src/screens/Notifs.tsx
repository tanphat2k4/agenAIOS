import { useStore } from '@/store'
import { useT } from '@/i18n'
import { Hover } from '@/components/ui/Hover'
import type { Notif, ViewName } from '@/types'

export function Notifs() {
  const s = useStore()
  const t = useT()

  // ---- notif type style map ----
  const notifTypeStyle: Record<string, { icon: string; label: string; fg: string; bg: string; route: ViewName }> = {
    mention:   { icon: '💬', label: 'Mention',    fg: '#28409E', bg: '#E8ECFB', route: 'channels' },
    task:      { icon: '🗂', label: t('Tác vụ'),     fg: '#0A7B52', bg: '#E2F3EC', route: 'tasks' },
    workflow:  { icon: '⚡', label: 'Workflow',   fg: '#C94F3D', bg: '#FBEAE7', route: 'workflow' },
    system:    { icon: '🖥', label: t('Hệ thống'),   fg: '#9A6A1B', bg: '#FBF1DE', route: 'devices' },
    knowledge: { icon: '📚', label: 'Knowledge',  fg: '#0E7490', bg: '#E0F2F4', route: 'knowledge' },
    cron:      { icon: '⏱', label: 'Cron',        fg: '#28409E', bg: '#E8ECFB', route: 'cron' },
    billing:   { icon: '💳', label: t('Hóa đơn'),    fg: '#9A6A1B', bg: '#FBF1DE', route: 'overview' },
  }

  const routeLabel: Record<string, string> = {
    channels: t('Mở kênh'),
    tasks: t('Xem tác vụ'),
    workflow: t('Xem workflow'),
    devices: t('Xem thiết bị'),
    knowledge: t('Mở knowledge'),
    cron: t('Xem cron'),
    billing: t('Xem hóa đơn'),
  }

  const N = s.notifsData
  const unreadCount = N.filter((n: Notif) => n.unread).length

  // ---- filter chips ----
  const notifFilterDefs = [
    { key: 'all',    label: t('Tất cả'),   count: N.length },
    { key: 'unread', label: t('Chưa đọc'), count: unreadCount },
    { key: 'mention',label: 'Mention',  count: N.filter((n: Notif) => n.type === 'mention').length },
    { key: 'task',   label: t('Tác vụ'),   count: N.filter((n: Notif) => n.type === 'task').length },
    { key: 'system', label: t('Hệ thống'), count: N.filter((n: Notif) => ['system', 'workflow', 'cron', 'billing'].indexOf(n.type) >= 0).length },
  ]
  const notifFilters = notifFilterDefs.map((f) => {
    const sel = f.key === s.notifFilter
    return {
      label: f.label, count: f.count, onSelect: () => s.setNotifFilter(f.key),
      bg: sel ? 'var(--jade-soft)' : 'var(--surface)',
      border: sel ? 'var(--jade)' : 'var(--line)',
      fg: sel ? 'var(--jade-deep)' : 'var(--ink)',
    }
  })

  // ---- filter + group ----
  const matchFilter = (n: Notif) => {
    const f = s.notifFilter
    if (f === 'all') return true
    if (f === 'unread') return n.unread
    if (f === 'system') return ['system', 'workflow', 'cron', 'billing'].indexOf(n.type) >= 0
    return n.type === f
  }
  const filtered = N.filter(matchFilter)
  const groupOrder = [t('Hôm nay'), t('Hôm qua'), t('Trước đó')]
  const notifGroups = groupOrder.map((g) => ({
    label: g,
    items: filtered.filter((n: Notif) => n.group === g).map((n: Notif) => {
      const ts = notifTypeStyle[n.type] ?? notifTypeStyle['system']
      return {
        actor: n.actor, initial: n.initial, color: n.color,
        action: n.action, preview: n.preview, time: n.time,
        unread: n.unread,
        onRead: () => s.markRead(n.id),
        onDelete: (e: React.MouseEvent) => { e.stopPropagation(); s.deleteNotif(n.id) },
        typeIcon: ts.icon, typeLabel: ts.label, typeFg: ts.fg, typeBg: ts.bg,
        rowBg: n.unread ? 'var(--jade-soft)' : 'var(--surface)',
        actionLabel: routeLabel[ts.route] ?? t('Xem'),
        onAction: (e: React.MouseEvent) => {
          e.stopPropagation()
          s.markRead(n.id)
          if (n.type === 'task' && n.taskId) {
            s.set({ view: 'tasks' as ViewName, taskDrawer: n.taskId })
          } else if (n.type === 'cron' && n.cronId) {
            s.openCronFromNotif(n.cronId)
          } else {
            s.setView(ts.route)
          }
        },
      }
    }),
  })).filter((g) => g.items.length > 0)

  const notifsEmpty = filtered.length === 0

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* header */}
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › {t('Thông báo')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>{t('Thông báo')}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{unreadCount} {t('chưa đọc')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Hover as="button" onClick={s.markAllRead}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>
            ✓ {t('Đánh dấu tất cả đã đọc')}
          </Hover>
          {N.length > 0 && (
            <Hover as="button" onClick={s.clearNotifs}
              style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--danger)', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              hover={{ borderColor: 'var(--danger)', background: 'var(--danger)', color: '#fff' }}>
              🗑 {t('Xóa tất cả')}
            </Hover>
          )}
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>
        {/* filter chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {notifFilters.map((f, i) => (
            <Hover key={i} as="button" onClick={f.onSelect}
              style={{ display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${f.border}`, background: f.bg, borderRadius: 99, padding: '7px 15px', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: f.fg, cursor: 'pointer' }}
              hover={{ borderColor: 'var(--jade)' }}>
              {f.label}<span style={{ color: 'var(--placeholder)', fontWeight: 700 }}>{f.count}</span>
            </Hover>
          ))}
        </div>

        <div style={{ maxWidth: 760 }}>
          {notifGroups.map((g, gi) => (
            <div key={gi} style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 10 }}>{g.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {g.items.map((n, ni) => (
                  <Hover key={ni} onClick={n.onRead} className="chrow"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 13, background: n.rowBg, border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px', cursor: 'pointer' }}
                    hover={{ borderColor: 'var(--jade)' }}>
                    {/* avatar with type badge */}
                    <div style={{ position: 'relative', flex: 'none' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: n.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }}>{n.initial}</div>
                      <span style={{ position: 'absolute', right: -3, bottom: -3, width: 18, height: 18, borderRadius: 99, background: n.typeBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, border: '2px solid var(--surface)' }}>{n.typeIcon}</span>
                    </div>
                    {/* content */}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: n.typeFg, background: n.typeBg, padding: '2px 8px', borderRadius: 99 }}>{n.typeLabel}</span>
                        <span style={{ fontSize: 11, color: 'var(--placeholder)', marginLeft: 'auto' }}>{n.time}</span>
                      </div>
                      <div style={{ fontSize: 13.5, lineHeight: 1.45, color: 'var(--ink)' }}><b>{n.actor}</b> {n.action}</div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)', marginTop: 3 }}>{n.preview}</div>
                      <Hover as="button" onClick={n.onAction}
                        style={{ marginTop: 9, fontSize: 12, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: '5px 13px', cursor: 'pointer', fontFamily: 'inherit' }}
                        hover={{ background: 'var(--jade)', color: '#fff' }}>
                        {n.actionLabel} →
                      </Hover>
                    </div>
                    {/* unread dot */}
                    {n.unread && (
                      <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--jade)', flex: 'none', marginTop: 4 }}></span>
                    )}
                    {/* delete */}
                    <Hover as="button" className="delbtn" title={t('Xóa thông báo')} onClick={n.onDelete}
                      style={{ flex: 'none', width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--placeholder)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}
                      hover={{ background: '#FBEAE7', color: 'var(--danger)' }}>🗑</Hover>
                  </Hover>
                ))}
              </div>
            </div>
          ))}

          {notifsEmpty && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 60, textAlign: 'center', color: 'var(--ink-2)' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>🔔</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{t('Không có thông báo')}</div>
              <div style={{ fontSize: 13 }}>{t('Bạn đã xem hết thông báo ở bộ lọc này.')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
