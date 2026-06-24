import { useStore } from '@/store'
import { Hover } from '@/components/ui/Hover'
import type { SessionLog } from '@/types'

const sessStStyle: Record<SessionLog['status'], { dot: string; label: string; fg: string; bg: string; pulse: string }> = {
  running: { dot: 'var(--jade)', label: 'Đang chạy', fg: 'var(--jade-deep)', bg: 'var(--jade-soft)', pulse: 'wfpulse 1.6s infinite' },
  done:    { dot: '#0A7B52',     label: 'Hoàn tất',  fg: '#0A7B52',         bg: '#E2F3EC',         pulse: 'none' },
  failed:  { dot: '#C94F3D',     label: 'Thất bại',  fg: '#C94F3D',         bg: '#FBEAE7',         pulse: 'none' },
}

const lvlStyle: Record<'info' | 'debug' | 'warn' | 'error', { fg: string; bg: string; label: string; msgFg: string }> = {
  info:  { fg: '#28409E', bg: '#E8ECFB', label: 'INFO',  msgFg: 'var(--ink)' },
  debug: { fg: '#5A6B64', bg: '#EEF2F0', label: 'DEBUG', msgFg: 'var(--ink-2)' },
  warn:  { fg: '#9A6A1B', bg: '#FBF1DE', label: 'WARN',  msgFg: '#9A6A1B' },
  error: { fg: '#C94F3D', bg: '#FBEAE7', label: 'ERROR', msgFg: '#C94F3D' },
}

export function Logs() {
  const s = useStore()

  const SS = s.sessionsData
  const logStats = [
    { icon: '🗂', label: 'Phiên hôm nay', value: SS.length + '', sub: 'agent session' },
    { icon: '⚡', label: 'Đang chạy', value: SS.filter((x) => x.status === 'running').length + '', sub: 'session live' },
    { icon: '🔢', label: 'Tokens 24h', value: '61.3k', sub: 'tổng input + output' },
    { icon: '⚠️', label: 'Phiên lỗi', value: SS.filter((x) => x.status === 'failed').length + '', sub: 'cần xem lại' },
  ]

  const logTabs = [
    { key: 'sessions', label: 'Phiên agent' },
    { key: 'audit', label: 'Nhật ký hệ thống' },
  ].map((t) => {
    const sel = t.key === s.logsTab
    return {
      key: t.key,
      label: t.label,
      onSelect: () => s.setLogsTab(t.key),
      bg: sel ? 'var(--jade-soft)' : 'transparent',
      fg: sel ? 'var(--jade-deep)' : 'var(--ink-2)',
      border: sel ? 'var(--jade)' : 'var(--line)',
      weight: sel ? 700 : 500,
    }
  })

  const sessList = SS.map((x) => {
    const st = sessStStyle[x.status]
    const sel = x.id === s.activeSession
    return {
      id: x.id,
      agent: x.agent,
      initial: x.initial,
      color: x.color,
      room: x.room,
      started: x.started,
      duration: x.duration,
      tokens: x.tokens,
      onSelect: () => s.selectSession(x.id),
      bg: sel ? 'var(--jade-soft)' : 'transparent',
      border: sel ? 'var(--jade)' : 'var(--line)',
      dot: st.dot,
      dotPulse: st.pulse,
      statusLabel: st.label,
      statusFg: st.fg,
      statusBg: st.bg,
      modelIcon: x.modelType === 'local' ? '🏠' : '☁️',
      model: x.model,
    }
  })

  const asess = SS.find((x) => x.id === s.activeSession) || SS[0]
  const ast = sessStStyle[asess.status]
  const sessLog = asess.log.map((l) => {
    const lv = lvlStyle[l.lvl]
    return { t: l.t, lvlLabel: lv.label, lvlFg: lv.fg, lvlBg: lv.bg, msg: l.msg, msgFg: lv.msgFg }
  })
  const sessActive = {
    id: asess.id,
    agent: asess.agent,
    initial: asess.initial,
    color: asess.color,
    room: asess.room,
    modelIcon: asess.modelType === 'local' ? '🏠' : '☁️',
    model: asess.model,
    statusLabel: ast.label,
    statusFg: ast.fg,
    statusBg: ast.bg,
    dot: ast.dot,
    dotPulse: ast.pulse,
    started: asess.started,
    duration: asess.duration,
    tokens: asess.tokens,
    isRunning: asess.status === 'running',
  }

  const auditRows = s.auditLog.map((a) => {
    const lv = lvlStyle[a.lvl as 'info' | 'debug' | 'warn' | 'error']
    return {
      actor: a.actor,
      action: a.action,
      target: a.target,
      time: a.time,
      lvlLabel: lv.label,
      lvlFg: lv.fg,
      lvlBg: lv.bg,
      dot: lv.fg,
    }
  })

  const logTabSessions = s.logsTab === 'sessions'
  const logTabAudit = s.logsTab === 'audit'

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › Phiên &amp; nhật ký</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>Phiên &amp; nhật ký</span>
              <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Theo dõi phiên chạy của agent và audit hệ thống</span>
            </div>
          </div>
          <Hover as="button"
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>
            ↓ Tải log
          </Hover>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {logTabs.map((t) => (
            <Hover key={t.key} as="button" onClick={t.onSelect}
              style={{ border: `1px solid ${t.border}`, background: t.bg, color: t.fg, borderRadius: 99, padding: '9px 18px', font: 'inherit', fontSize: 13, fontWeight: t.weight, cursor: 'pointer' }}
              hover={{ borderColor: 'var(--jade)' }}>
              {t.label}
            </Hover>
          ))}
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>
        {/* stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
          {logStats.map((st) => (
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

        {/* sessions master-detail */}
        {logTabSessions && (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, alignItems: 'start' }}>
            {/* session list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {sessList.map((x) => (
                <Hover key={x.id} onClick={x.onSelect}
                  style={{ background: x.bg, border: `1.5px solid ${x.border}`, borderRadius: 14, padding: '13px 14px', cursor: 'pointer' }}
                  hover={{ borderColor: 'var(--jade)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 99, background: x.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>{x.initial}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.agent}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 10.5, color: 'var(--placeholder)' }}>{x.id}</div>
                    </div>
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: x.dot, flex: 'none', animation: x.dotPulse }}></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: x.statusFg, background: x.statusBg, padding: '2px 8px', borderRadius: 99 }}>{x.statusLabel}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--ink-2)' }}>#{x.room}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--placeholder)', marginLeft: 'auto' }}>{x.duration} · {x.tokens}</span>
                  </div>
                </Hover>
              ))}
            </div>

            {/* log viewer */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: sessActive.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flex: 'none' }}>{sessActive.initial}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{sessActive.agent}</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--placeholder)' }}>{sessActive.id}.md</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flex: 'none' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: sessActive.statusFg, background: sessActive.statusBg, padding: '3px 10px', borderRadius: 99 }}>{sessActive.statusLabel}</span>
                    <Hover as="button" title="Sao chép"
                      style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontSize: 12, cursor: 'pointer' }}
                      hover={{ background: 'var(--jade-soft)', color: 'var(--jade-deep)' }}>
                      ⧉
                    </Hover>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '3px 10px', borderRadius: 99 }}>{sessActive.modelIcon} {sessActive.model}</span>
                  <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>#{sessActive.room}</span>
                  <span style={{ fontSize: 11, color: 'var(--placeholder)' }}>Bắt đầu {sessActive.started} · {sessActive.duration} · {sessActive.tokens} tokens</span>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', background: 'var(--bg)', minHeight: 300 }}>
                {sessLog.map((l, i) => (
                  <div key={i} style={{ display: 'flex', gap: 11, padding: '5px 0', fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.55 }}>
                    <span style={{ color: 'var(--placeholder)', flex: 'none', width: 62 }}>{l.t}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, color: l.lvlFg, background: l.lvlBg, padding: '1px 6px', borderRadius: 5, flex: 'none', height: 16, display: 'flex', alignItems: 'center' }}>{l.lvlLabel}</span>
                    <span style={{ color: l.msgFg, minWidth: 0, wordBreak: 'break-word' }}>{l.msg}</span>
                  </div>
                ))}
                {sessActive.isRunning && (
                  <div style={{ display: 'flex', gap: 11, padding: '5px 0', fontFamily: 'var(--mono)', fontSize: 12 }}>
                    <span style={{ color: 'var(--placeholder)', width: 62, flex: 'none' }}></span>
                    <span style={{ color: 'var(--jade)', animation: 'blink 1s steps(2) infinite', fontWeight: 700 }}>▍</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* audit log */}
        {logTabAudit && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
            {auditRows.map((a, i) => (
              <Hover key={i}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid var(--line)' }}
                hover={{ background: 'var(--bg)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: a.dot, flex: 'none' }}></span>
                <span style={{ fontSize: 9.5, fontWeight: 700, color: a.lvlFg, background: a.lvlBg, padding: '2px 8px', borderRadius: 5, flex: 'none', width: 46, textAlign: 'center' }}>{a.lvlLabel}</span>
                <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--ink)' }}><b>{a.actor}</b> {a.action} · <span style={{ color: 'var(--ink-2)' }}>{a.target}</span></div>
                <span style={{ fontSize: 11.5, color: 'var(--placeholder)', flex: 'none' }}>{a.time}</span>
              </Hover>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
