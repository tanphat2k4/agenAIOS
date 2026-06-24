import { useStore } from '@/store'
import { Hover } from '@/components/ui/Hover'
import type { TaskItem, ViewName } from '@/types'

export function Overview() {
  const s = useStore()

  // ---- time-aware greeting ----
  const now = new Date()
  const hr = now.getHours()
  const ovGreeting = (hr < 11 ? 'Chào buổi sáng' : hr < 14 ? 'Chào buổi trưa' : hr < 18 ? 'Chào buổi chiều' : 'Chào buổi tối') + ', anh Giang'
  const ovDate = ('0' + now.getDate()).slice(-2) + '/' + ('0' + (now.getMonth() + 1)).slice(-2) + '/' + now.getFullYear()

  // ---- KPI cards ----
  const channelsCount = s.publicData.length + s.privateData.length + s.directData.length
  const openTasksN = s.tasksData.filter((t) => t.status !== 'done').length
  const ovKpis = [
    { icon: '🤖', label: 'Agents hoạt động', value: '18', hasDelta: true, delta: '+2', deltaUp: true, sub: 'tuần này', onOpen: null as (() => void) | null },
    { icon: '#', label: 'Channels', value: channelsCount + '', hasDelta: false, delta: '', deltaUp: true, sub: 'public · private · DM', onOpen: null as (() => void) | null },
    { icon: '💬', label: 'Tin nhắn 24h', value: '1.248', hasDelta: true, delta: '+12%', deltaUp: true, sub: 'so với hôm qua', onOpen: null as (() => void) | null },
    { icon: '🗂', label: 'Tasks đang mở', value: openTasksN + '', hasDelta: true, delta: '-3', deltaUp: false, sub: 'so với hôm qua', onOpen: (() => s.set({ overlay: 'openTasks' })) as (() => void) | null },
  ].map((k) => ({
    ...k,
    deltaFg: k.deltaUp ? '#0A7B52' : '#C94F3D',
    deltaBg: k.deltaUp ? '#E2F3EC' : '#FBEAE7',
    deltaArrow: k.deltaUp ? '↑' : '↓',
    cursor: k.onOpen ? 'pointer' : 'default',
  }))

  // ---- bar chart ----
  const days = [
    { d: 'T2', msg: 820, run: 34 }, { d: 'T3', msg: 1040, run: 42 }, { d: 'T4', msg: 960, run: 38 },
    { d: 'T5', msg: 1180, run: 51 }, { d: 'T6', msg: 1320, run: 63 }, { d: 'T7', msg: 740, run: 28 }, { d: 'CN', msg: 1248, run: 48 },
  ]
  const maxMsg = Math.max(...days.map((d) => d.msg))
  const maxRun = Math.max(...days.map((d) => d.run))
  const ovDays = days.map((d) => ({
    d: d.d,
    msgH: Math.round(d.msg / maxMsg * 150) + 'px',
    runH: Math.round(d.run / maxRun * 150) + 'px',
    msg: d.msg.toLocaleString('vi-VN'),
  }))

  // ---- top agents ----
  const ovTopAgents = [
    { name: 'Dragon - CEO', initial: 'D', color: '#C0392B', metric: 142, pct: '100%' },
    { name: 'Sabo - Facebook Research', initial: 'S', color: '#3B82C4', metric: 118, pct: '83%' },
    { name: 'Sanji - Xào nấu content', initial: 'S', color: '#0EA5A0', metric: 96, pct: '68%' },
    { name: 'Nami - Quản lý Fanpage', initial: 'N', color: '#E8A33D', metric: 74, pct: '52%' },
    { name: 'Morgans - Social Leader', initial: 'M', color: '#8B5CF6', metric: 51, pct: '36%' },
  ].map((a, i) => ({ ...a, rank: i + 1 }))

  // ---- system health ----
  const wfRunning = s.workflows.filter((w) => w.steps.some((st) => st.status === 'running')).length
  const ovHealth = [
    { label: 'Cron scheduler', status: 'Healthy', detail: '7 jobs · 0 failed', ok: true },
    { label: 'Knowledge base', status: 'Healthy', detail: '39 entries · 0 chờ duyệt', ok: true },
    { label: 'Agent workflow', status: wfRunning + ' đang chạy', detail: '4 pipeline · 98% success', ok: true },
    { label: 'Kết nối máy chủ', status: 'Online', detail: '9Router · Tailscale', ok: true },
  ].map((h) => ({
    ...h,
    dot: h.ok ? '#0A7B52' : '#C94F3D',
    sFg: h.ok ? '#0A7B52' : '#C94F3D',
    sBg: h.ok ? '#E2F3EC' : '#FBEAE7',
  }))

  // ---- workflow mini list ----
  const ovWfMini = s.workflows.filter((w) => w.enabled).slice(0, 3).map((w) => {
    const done = w.steps.filter((st) => st.status === 'done').length
    const running = w.steps.some((st) => st.status === 'running')
    return {
      name: w.name,
      pct: Math.round(done / w.steps.length * 100) + '%',
      label: done + '/' + w.steps.length + ' bước',
      dot: running ? 'var(--jade)' : '#0A7B52',
      dotPulse: running ? 'wfpulse 1.6s infinite' : 'none',
    }
  })

  // ---- recent activity feed (static seed merged with live recentActivity) ----
  const ovFeed = [
    { initial: 'D', color: '#C0392B', actor: 'Dragon - CEO', action: 'tạo knowledge "Chuẩn bị nội dung facebook"', time: '15:55', tag: 'knowledge', tagFg: '#28409E', tagBg: '#E8ECFB' },
    { initial: '⏱', color: '#3B5BDB', actor: 'Cron', action: '"ZyNovel rewrite pending" chạy thành công', time: '7m', tag: 'cron', tagFg: '#0A7B52', tagBg: '#E2F3EC' },
    { initial: 'N', color: '#E8A33D', actor: 'Nami - Quản lý Fanpage', action: 'cập nhật lịch đăng 6 fanpage vệ tinh', time: '11:20', tag: 'fanpage', tagFg: '#9A6A1B', tagBg: '#FBF1DE' },
    { initial: 'S', color: '#3B82C4', actor: 'Sabo - Facebook Research', action: 'hoàn tất research 12 bài viral', time: '09:10', tag: 'research', tagFg: '#28409E', tagBg: '#E8ECFB' },
    { initial: '⚡', color: '#8B5CF6', actor: 'Workflow', action: '"Kiểm duyệt nội dung" thất bại 1 lần', time: '1h', tag: 'failed', tagFg: '#C94F3D', tagBg: '#FBEAE7' },
    { initial: 'N', color: '#3B5BDB', actor: 'Nguyễn Thiện Giang', action: 'thêm Brook vào phòng Zy Novel', time: 'hôm qua', tag: 'room', tagFg: '#5A6B64', tagBg: '#EEF2F0' },
  ]
  const ovFeedAll = [...s.recentActivity, ...ovFeed]

  // ---- open tasks modal ----
  const showOpenTasks = s.overlay === 'openTasks'
  const openTasksCount = s.tasksData.filter((t) => t.status !== 'done').length
  const openTasksList = s.tasksData.filter((t) => t.status !== 'done').map((t: TaskItem) => {
    const prioMap: Record<string, { fg: string; bg: string; l: string }> = {
      high: { fg: '#C94F3D', bg: '#FBEAE7', l: 'Cao' },
      med: { fg: '#9A6A1B', bg: '#FBF1DE', l: 'TB' },
      low: { fg: '#5A6B64', bg: '#EEF2F0', l: 'Thấp' },
    }
    const stMap: Record<string, { l: string; fg: string; bg: string }> = {
      queued: { l: 'Chờ', fg: '#5A6B64', bg: '#EEF2F0' },
      running: { l: 'Đang xử lý', fg: 'var(--jade-deep)', bg: 'var(--jade-soft)' },
      review: { l: 'Cần duyệt', fg: '#9A6A1B', bg: '#FBF1DE' },
    }
    const prio = prioMap[t.priority] ?? prioMap['med']
    const st = stMap[t.status] ?? stMap['queued']
    return {
      id: t.id, title: t.title, assignee: t.assignee, initial: t.initial, color: t.color,
      room: t.room, time: t.time,
      prioFg: prio.fg, prioBg: prio.bg, prioLabel: prio.l,
      statusFg: st.fg, statusBg: st.bg, statusLabel: st.l,
    }
  })

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* header */}
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › Tổng quan</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>{ovGreeting} 👋</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Hôm nay · {ovDate}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Hover as="button"
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>
            📅 7 ngày qua <span style={{ opacity: .6 }}>⌄</span>
          </Hover>
          <Hover as="button"
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }}
            hover={{ background: 'var(--jade-deep)' }}>
            ↓ Xuất báo cáo
          </Hover>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>
        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
          {ovKpis.map((k, i) => (
            <div key={i} onClick={k.onOpen ?? undefined}
              style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 20px', cursor: k.cursor }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--jade-soft)', color: 'var(--jade-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{k.icon}</div>
                {k.hasDelta && (
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: k.deltaFg, background: k.deltaBg, padding: '3px 10px', borderRadius: 99 }}>
                    {k.deltaArrow} {k.delta}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: 'var(--ink)' }}>{k.value}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', marginTop: 8 }}>{k.label}</div>
              <div style={{ fontSize: 11, color: 'var(--placeholder)', marginTop: 2 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.55fr 1fr', gap: 20, alignItems: 'start', marginBottom: 20 }}>
          {/* left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* activity chart */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px' }}>Hoạt động 7 ngày</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>Tin nhắn &amp; lượt chạy workflow theo ngày</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-2)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--jade)', display: 'inline-block' }}></span>Tin nhắn
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--ink-2)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: '#A9B9F2', display: 'inline-block' }}></span>Lượt chạy
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 14, height: 172, paddingTop: 8 }}>
                {ovDays.map((day, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 150 }}>
                      <div title={day.msg} style={{ width: 16, borderRadius: '5px 5px 0 0', background: 'var(--jade)', height: day.msgH }}></div>
                      <div style={{ width: 16, borderRadius: '5px 5px 0 0', background: '#A9B9F2', height: day.runH }}></div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)' }}>{day.d}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* workflow running mini */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px', marginBottom: 14 }}>Workflow đang bật</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {ovWfMini.map((w, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 99, background: w.dot, flex: 'none', animation: w.dotPulse }}></span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.name}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>{w.label}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: w.pct, background: 'var(--jade)', borderRadius: 99 }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* top agents */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px', marginBottom: 4 }}>Top agents tuần này</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 16 }}>Theo số task &amp; lượt chạy hoàn tất</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
                {ovTopAgents.map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--placeholder)', width: 14, flex: 'none' }}>{a.rank}</span>
                    <div style={{ width: 32, height: 32, borderRadius: 99, background: a.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none' }}>{a.initial}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--jade-deep)', flex: 'none' }}>{a.metric}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: a.pct, background: 'var(--jade)', borderRadius: 99 }}></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* system health */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px', marginBottom: 14 }}>Sức khỏe hệ thống</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {ovHealth.map((h, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: h.dot, flex: 'none' }}></span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{h.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--placeholder)', marginTop: 1 }}>{h.detail}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: h.sFg, background: h.sBg, padding: '3px 10px', borderRadius: 99, flex: 'none' }}>{h.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* recent activity */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px' }}>Hoạt động gần đây</div>
            <Hover as="button"
              style={{ fontSize: 12, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
              hover={{ background: 'var(--jade)', color: '#fff' }}>
              Xem tất cả
            </Hover>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 28px' }}>
            {ovFeedAll.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0' }}>
                <div style={{ width: 32, height: 32, borderRadius: 99, background: f.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none' }}>{f.initial}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink)' }}><b>{f.actor}</b> {f.action}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: f.tagFg, background: f.tagBg, padding: '2px 8px', borderRadius: 99 }}>{f.tag}</span>
                    <span style={{ fontSize: 11, color: 'var(--placeholder)' }}>{f.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* open tasks modal */}
      {showOpenTasks && (
        <div onClick={s.closeOverlay} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fadeIn .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '94vw', maxHeight: '82vh', background: 'var(--surface)', borderRadius: 22, boxShadow: '0 24px 60px rgba(22,32,28,.22)', animation: 'pop .2s ease both', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 14px' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>Tasks đang mở · {openTasksCount}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>Các tác vụ chưa hoàn tất trong workspace</div>
              </div>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ width: 34, height: 34, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }}
                hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 12px' }}>
              {openTasksList.map((t, i) => (
                <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 13, padding: '13px 14px', margin: '4px 6px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--jade-deep)' }}>{t.id}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: t.statusFg, background: t.statusBg, padding: '2px 9px', borderRadius: 99 }}>{t.statusLabel}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: t.prioFg, background: t.prioBg, padding: '2px 9px', borderRadius: 99 }}>{t.prioLabel}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--placeholder)', marginLeft: 'auto' }}>{t.time}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 9 }}>{t.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 99, background: t.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: 'none' }}>{t.initial}</div>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{t.assignee}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', padding: '2px 9px', borderRadius: 99, marginLeft: 'auto' }}>#{t.room}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={() => s.set({ view: 'tasks' as ViewName, overlay: null })}
                style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '10px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade-deep)' }}>
                Mở bảng Tác vụ →
              </Hover>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
