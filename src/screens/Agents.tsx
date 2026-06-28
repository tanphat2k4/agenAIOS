import { useStore } from '@/store'
import { useT } from '@/i18n'
import { Hover } from '@/components/ui/Hover'
import { AgentDrawer, AgentModals } from './agents/AgentModals'
import type { Agent } from '@/types'

// ---- status / role color maps (verbatim from renderVals) ----
const agStStyle: Record<string, { dot: string; label: string; fg: string; bg: string; pulse: string }> = {
  online:  { dot: '#0A7B52',        label: 'Online',     fg: '#0A7B52',          bg: '#E2F3EC',           pulse: 'none' },
  busy:    { dot: 'var(--jade)',    label: 'Đang chạy', fg: 'var(--jade-deep)', bg: 'var(--jade-soft)',  pulse: 'wfpulse 1.6s infinite' },
  idle:    { dot: '#E8A33D',        label: 'Nghỉ',       fg: '#9A6A1B',          bg: '#FBF1DE',           pulse: 'none' },
  offline: { dot: '#9AA8A1',        label: 'Offline',    fg: '#5A6B64',          bg: '#EEF2F0',           pulse: 'none' },
}
const agRoleStyle: Record<string, { fg: string; bg: string }> = {
  manager:  { fg: '#28409E', bg: '#E8ECFB' },
  research: { fg: '#0E7490', bg: '#E0F2F4' },
  writer:   { fg: '#9A6A1B', bg: '#FBF1DE' },
}
function roleStyle(roleType: string) {
  return agRoleStyle[roleType] ?? { fg: '#28409E', bg: '#E8ECFB' }
}
function statusStyle(status: string) {
  return agStStyle[status] ?? agStStyle['offline']
}

export function Agents() {
  const s = useStore()
  const t = useT()
  const A = s.agentsData

  // ---- agStats (verbatim from renderVals) ----
  const agStats = [
    { icon: '🤖', label: t('Tổng agents'),       value: String(A.length),                                                                                                                                  sub: t('trong workspace') },
    { icon: '🟢', label: t('Đang online'),        value: String(A.filter((a: Agent) => a.status === 'online').length),                                                                                     sub: t('sẵn sàng nhận việc') },
    { icon: '⚡', label: t('Đang chạy'),          value: String(A.filter((a: Agent) => a.status === 'busy').length),                                                                                       sub: t('pipeline hoạt động') },
    { icon: '🏠', label: t('Máy nhà · Đám mây'),  value: A.filter((a: Agent) => a.modelType === 'local').length + ' · ' + A.filter((a: Agent) => a.modelType === 'cloud').length, sub: t('phân bổ model') },
  ]

  // ---- agFilters (verbatim from renderVals) ----
  const agFilterDefs = [
    { key: 'all',     label: t('Tất cả'),    count: A.length },
    { key: 'online',  label: 'Online',    count: A.filter((a: Agent) => a.status === 'online').length },
    { key: 'busy',    label: t('Đang chạy'), count: A.filter((a: Agent) => a.status === 'busy').length },
    { key: 'idle',    label: t('Nghỉ'),      count: A.filter((a: Agent) => a.status === 'idle').length },
    { key: 'offline', label: 'Offline',   count: A.filter((a: Agent) => a.status === 'offline').length },
  ]

  // ---- agCards (verbatim from renderVals) ----
  const aq = s.agentsQuery.trim().toLowerCase()
  const agCards = A
    .filter((a: Agent) => s.agentsFilter === 'all' || a.status === s.agentsFilter)
    .filter((a: Agent) => !aq || a.name.toLowerCase().includes(aq) || a.handle.toLowerCase().includes(aq) || a.role.toLowerCase().includes(aq))

  const agCount = agCards.length

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* ===== HEADER ===== */}
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › Agents</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>Agents</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{agCount} {t('agent trong workspace')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Hover as="button" onClick={() => s.set({ overlay: 'agentImport' })}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>↑ Import</Hover>
          <Hover as="button" onClick={s.openNewAgent}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }}
            hover={{ background: 'var(--jade-deep)' }}>＋ New agent</Hover>
        </div>
      </header>

      {/* ===== BODY ===== */}
      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>

        {/* stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
          {agStats.map((st) => (
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

        {/* filters + search */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {agFilterDefs.map((f) => {
              const sel = f.key === s.agentsFilter
              return (
                <Hover as="button" key={f.key}
                  onClick={() => s.setAgentsFilter(f.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${sel ? 'var(--jade)' : 'var(--line)'}`, background: sel ? 'var(--jade-soft)' : 'var(--surface)', borderRadius: 99, padding: '7px 15px', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: sel ? 'var(--jade-deep)' : 'var(--ink)', cursor: 'pointer' }}
                  hover={{ borderColor: 'var(--jade)' }}>
                  {f.label}<span style={{ color: 'var(--placeholder)', fontWeight: 700 }}>{f.count}</span>
                </Hover>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 11, padding: '9px 14px', width: 260, flex: 'none' }}>
            <span style={{ color: 'var(--placeholder)', fontSize: 14 }}>🔍</span>
            <input
              value={s.agentsQuery}
              onChange={(e) => s.set({ agentsQuery: e.target.value })}
              placeholder={t('Tìm agent theo tên, @handle, vai trò…')}
              style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, background: 'transparent', color: 'var(--ink)' }}
            />
          </div>
        </div>

        {/* agent cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(310px,1fr))', gap: 16 }}>
          {agCards.map((a: Agent) => {
            const st = statusStyle(a.status)
            const rl = roleStyle(a.roleType)
            const modelFg = a.modelType === 'local' ? '#28409E' : '#9A6A1B'
            const modelBg = a.modelType === 'local' ? '#E8ECFB' : '#FBF1DE'
            const modelIcon = a.modelType === 'local' ? '🏠' : '☁️'
            return (
              <Hover key={a.id} onClick={() => s.openAgent(a.id)}
                style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 18, cursor: 'pointer', transition: 'border-color .15s' }}
                hover={{ borderColor: 'var(--jade)' }}>

                {/* avatar + name + badges */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 14 }}>
                  <div style={{ position: 'relative', flex: 'none' }}>
                    <div style={{ width: 46, height: 46, borderRadius: 14, background: a.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700 }}>{a.initial}</div>
                    <span style={{ position: 'absolute', right: -3, bottom: -3, width: 14, height: 14, borderRadius: 99, background: st.dot, border: '2.5px solid var(--surface)', animation: st.pulse }} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginTop: 1 }}>{a.handle}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: rl.fg, background: rl.bg, padding: '2px 9px', borderRadius: 99 }}>{a.role}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: st.fg, background: st.bg, padding: '2px 9px', borderRadius: 99 }}>{st.label}</span>
                    </div>
                  </div>
                </div>

                {/* model chip */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 13 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: modelFg, background: modelBg, padding: '5px 11px', borderRadius: 99 }}>{modelIcon} {a.model}</span>
                </div>

                {/* stats mini */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 13 }}>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 11, padding: '9px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{a.tasks}</div>
                    <div style={{ fontSize: 10, color: 'var(--placeholder)', marginTop: 3 }}>tasks</div>
                  </div>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 11, padding: '9px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{a.rooms}</div>
                    <div style={{ fontSize: 10, color: 'var(--placeholder)', marginTop: 3 }}>rooms</div>
                  </div>
                  <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 11, padding: '9px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--jade-deep)', lineHeight: 1 }}>{a.success}%</div>
                    <div style={{ fontSize: 10, color: 'var(--placeholder)', marginTop: 3 }}>success</div>
                  </div>
                </div>

                {/* skills + last active */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {a.skills.map((sk) => (
                    <span key={sk} style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', padding: '3px 9px', borderRadius: 7 }}>{sk}</span>
                  ))}
                  <span style={{ fontSize: 10.5, color: 'var(--placeholder)', marginLeft: 'auto' }}>⏱ {a.lastActive}</span>
                </div>
              </Hover>
            )
          })}
        </div>
      </div>

      {/* drawer + modals */}
      {s.agentDrawer && <AgentDrawer />}
      <AgentModals />
    </div>
  )
}
