import { useStore } from '@/store'
import { useT } from '@/i18n'
import { Hover } from '@/components/ui/Hover'
import type { McpServer } from '@/types'

// ---- style helpers (verbatim from prototype renderVals) ----
const mcpStStyle: Record<McpServer['status'], { dot: string; label: string; fg: string; bg: string; pulse: string }> = {
  connected: { dot: '#0A7B52', label: 'Đã kết nối', fg: '#0A7B52', bg: '#E2F3EC', pulse: 'none' },
  disabled:  { dot: '#9AA8A1', label: 'Tạm tắt',    fg: '#5A6B64', bg: '#EEF2F0', pulse: 'none' },
  error:     { dot: '#C94F3D', label: 'Lỗi',         fg: '#C94F3D', bg: '#FBEAE7', pulse: 'wfpulse 1.6s infinite' },
}

const transStyle: Record<string, { fg: string; bg: string }> = {
  stdio: { fg: '#28409E', bg: '#E8ECFB' },
  SSE:   { fg: '#9A6A1B', bg: '#FBF1DE' },
  HTTP:  { fg: '#0E7490', bg: '#E0F2F4' },
}

const stop = (e: React.MouseEvent) => e.stopPropagation()

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px',
  textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7,
}

export function Mcp() {
  const s = useStore()
  const t = useT()
  const M = s.mcpData

  // ---- stat cards ----
  const mcpStats = [
    { icon: '🔌', label: t('Tổng MCP'),       value: String(M.length),                                                                   sub: t('server đã đăng ký') },
    { icon: '🟢', label: t('Đang kết nối'),   value: String(M.filter((m) => m.status === 'connected').length),                           sub: t('hoạt động ổn định') },
    { icon: '🧰', label: t('Tools khả dụng'), value: String(M.reduce((a, m) => a + (m.status === 'connected' ? m.tools.length : 0), 0)), sub: t('công cụ cho agent') },
    { icon: '📡', label: t('Lượt gọi 24h'),   value: M.reduce((a, m) => a + m.calls24, 0).toLocaleString('vi-VN'),                       sub: t('tool call') },
  ]

  // ---- filter chips ----
  const mcpFilterDefs = [
    { key: 'all',       label: t('Tất cả'),     count: M.length },
    { key: 'connected', label: t('Đã kết nối'), count: M.filter((m) => m.status === 'connected').length },
    { key: 'disabled',  label: t('Tạm tắt'),    count: M.filter((m) => m.status === 'disabled').length },
    { key: 'error',     label: t('Lỗi'),        count: M.filter((m) => m.status === 'error').length },
  ]

  // ---- filtered + searched cards ----
  const mq = s.mcpQuery.trim().toLowerCase()
  const mcpCards = M
    .filter((m) => s.mcpFilter === 'all' || m.status === s.mcpFilter)
    .filter((m) => !mq || m.name.toLowerCase().includes(mq) || m.desc.toLowerCase().includes(mq) || m.tools.join(' ').toLowerCase().includes(mq))

  // ---- drawer data ----
  const md = M.find((m) => m.id === s.mcpDrawer) ?? null
  const mc = md
    ? (() => {
        const st = mcpStStyle[md.status]
        const tr = transStyle[md.transport] ?? transStyle['HTTP']
        return {
          name: md.name, icon: md.icon, desc: md.desc,
          transport: md.transport, transFg: tr.fg, transBg: tr.bg, endpoint: md.endpoint,
          dot: st.dot, dotPulse: st.pulse, statusLabel: st.label, statusFg: st.fg, statusBg: st.bg,
          toolCount: md.tools.length, agents: md.agents, calls24: md.calls24.toLocaleString('vi-VN'),
          tools: md.tools,
          recentCalls: md.recentCalls.map((c) => ({
            tool: c.tool, time: c.time,
            dot: c.ok ? '#0A7B52' : '#C94F3D',
            label: c.ok ? 'OK' : 'Failed',
            labelFg: c.ok ? '#0A7B52' : '#C94F3D',
          })),
          hasCalls: md.recentCalls.length > 0,
          toggleLabel: md.status === 'disabled' ? t('Bật MCP') : t('Tắt MCP'),
        }
      })()
    : null

  // ---- delete confirm: name ----
  const mcpDeleteName = M.find((m) => m.id === s.mcpDrawer)?.name ?? ''

  // ---- new MCP form ----
  const canCreate = (s.mcpForm.name ?? '').trim().length > 0

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ===== HEADER ===== */}
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>{t('Workspace › MCP')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>MCP</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{t('Model Context Protocol · công cụ cho agent')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Hover as="button" onClick={s.syncMcp}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>
            ⟳ {t('Đồng bộ')}
          </Hover>
          <Hover as="button" onClick={s.openNewMcp}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }}
            hover={{ background: 'var(--jade-deep)' }}>
            ＋ {t('Kết nối MCP')}
          </Hover>
        </div>
      </header>

      {/* ===== BODY ===== */}
      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>

        {/* stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
          {mcpStats.map((st) => (
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
            {mcpFilterDefs.map((f) => {
              const sel = f.key === s.mcpFilter
              return (
                <Hover key={f.key} as="button" onClick={() => s.setMcpFilter(f.key)}
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
              value={s.mcpQuery}
              onChange={(e) => s.set({ mcpQuery: e.target.value })}
              placeholder={t('Tìm MCP theo tên, tool…')}
              style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, background: 'transparent', color: 'var(--ink)' }}
            />
          </div>
        </div>

        {/* mcp cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 16 }}>
          {mcpCards.map((m) => {
            const st = mcpStStyle[m.status]
            const tr = transStyle[m.transport] ?? transStyle['HTTP']
            return (
              <Hover key={m.id} onClick={() => s.openMcp(m.id)}
                style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 18, cursor: 'pointer', transition: 'border-color .15s' }}
                hover={{ borderColor: 'var(--jade)' }}>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 13 }}>
                  <div style={{ position: 'relative', flex: 'none' }}>
                    <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{m.icon}</div>
                    <span style={{ position: 'absolute', right: -3, bottom: -3, width: 14, height: 14, borderRadius: 99, background: st.dot, border: '2.5px solid var(--surface)', animation: st.pulse, display: 'block' }} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: tr.fg, background: tr.bg, padding: '2px 8px', borderRadius: 6 }}>{m.transport}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: st.fg, background: st.bg, padding: '2px 9px', borderRadius: 99 }}>{t(st.label)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--ink-2)', marginBottom: 13, minHeight: 36 }}>{m.desc}</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 13 }}>
                  {m.tools.slice(0, 3).map((t) => (
                    <span key={t} style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '3px 9px', borderRadius: 7 }}>{t}</span>
                  ))}
                  {m.tools.length > 3 && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--placeholder)' }}>+{m.tools.length - 3}</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 11.5, color: 'var(--ink-2)' }}>
                  <span>🧰 {m.tools.length} tools</span>
                  <span>🤖 {m.agents} agents</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--placeholder)' }}>⟳ {m.lastSync}</span>
                </div>
              </Hover>
            )
          })}
        </div>
      </div>

      {/* ===== DRAWER ===== */}
      {s.mcpDrawer && mc && (
        <div onClick={s.closeMcp} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', zIndex: 45, animation: 'fadeIn .15s ease' }}>
          <div onClick={stop} style={{ width: 430, maxWidth: '94vw', height: '100vh', background: 'var(--surface)', boxShadow: '-12px 0 40px rgba(22,32,28,.18)', animation: 'pop .25s ease both', display: 'flex', flexDirection: 'column' }}>

            {/* drawer header */}
            <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  <div style={{ position: 'relative', flex: 'none' }}>
                    <div style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{mc.icon}</div>
                    <span style={{ position: 'absolute', right: -3, bottom: -3, width: 15, height: 15, borderRadius: 99, background: mc.dot, border: '2.5px solid var(--surface)', animation: mc.dotPulse, display: 'block' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mc.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 700, color: mc.transFg, background: mc.transBg, padding: '2px 8px', borderRadius: 6 }}>{mc.transport}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: mc.statusFg, background: mc.statusBg, padding: '2px 10px', borderRadius: 99 }}>{t(mc.statusLabel)}</span>
                    </div>
                  </div>
                </div>
                <Hover as="button" onClick={s.closeMcp}
                  style={{ width: 34, height: 34, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)', flex: 'none' }}
                  hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
              </div>
            </div>

            {/* drawer body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>
              <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink)', marginBottom: 18 }}>{mc.desc}</div>

              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 8 }}>Endpoint</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 13px', marginBottom: 20, wordBreak: 'break-all' }}>{mc.endpoint}</div>

              <div style={{ display: 'flex', gap: 9, marginBottom: 22 }}>
                <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 13, padding: 13, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{mc.toolCount}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--placeholder)', marginTop: 4 }}>tools</div>
                </div>
                <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 13, padding: 13, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{mc.agents}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--placeholder)', marginTop: 4 }}>agents</div>
                </div>
                <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 13, padding: 13, textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--jade-deep)', lineHeight: 1 }}>{mc.calls24}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--placeholder)', marginTop: 4 }}>calls 24h</div>
                </div>
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 9 }}>{t('Tools cung cấp')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
                {mc.tools.map((t) => (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', borderRadius: 11, padding: '10px 13px' }}>
                    <span style={{ fontSize: 14 }}>🔧</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{t}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 9 }}>{t('Lượt gọi gần đây')}</div>
              {mc.hasCalls && (
                <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                  {mc.recentCalls.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 99, background: c.dot, flex: 'none', display: 'block' }} />
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink)', flex: 1 }}>{c.tool}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: c.labelFg }}>{c.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--placeholder)', width: 54, textAlign: 'right' }}>{c.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* drawer footer */}
            <div style={{ flex: 'none', padding: '16px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
              <Hover as="button" onClick={s.testMcp}
                style={{ flex: 1, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: 12, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }}
                hover={{ background: 'var(--jade-deep)' }}>⟳ {t('Kiểm tra kết nối')}</Hover>
              <Hover as="button" onClick={s.toggleMcp}
                style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '12px 20px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                hover={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{mc.toggleLabel}</Hover>
              <Hover as="button" onClick={s.askDeleteMcp} title={t('Xóa MCP')}
                style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--danger)', borderRadius: 99, width: 44, flex: 'none', fontSize: 15, cursor: 'pointer' }}
                hover={{ borderColor: 'var(--danger)', background: '#FBEAE7' }}>🗑</Hover>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRM ===== */}
      {s.mcpDeleteConfirm && (
        <div onClick={() => s.set({ mcpDeleteConfirm: false })} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, animation: 'fadeIn .15s ease' }}>
          <div onClick={stop} style={{ width: 420, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 22, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.28)', animation: 'pop .2s ease both' }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: '#FBEAE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 16 }}>🗑</div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 8 }}>{t('Xóa MCP')} {mcpDeleteName}{t('?')}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 24 }}>{t('Server và toàn bộ tools của nó sẽ bị gỡ khỏi workspace. Các agent đang dùng sẽ mất quyền truy cập. Không thể hoàn tác.')}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={() => s.set({ mcpDeleteConfirm: false })}
                style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--line)' }}>{t('Hủy')}</Hover>
              <Hover as="button" onClick={s.confirmDeleteMcp}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--danger)', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ filter: 'brightness(.92)' }}>{t('Xóa MCP')}</Hover>
            </div>
          </div>
        </div>
      )}

      {/* ===== NEW MCP MODAL ===== */}
      {s.overlay === 'newMcp' && (
        <div onClick={s.closeOverlay} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fadeIn .15s ease' }}>
          <div onClick={stop} style={{ width: 470, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 24, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.22)', animation: 'pop .2s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>{t('Kết nối MCP server')}</div>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }}
                hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 20, lineHeight: 1.5 }}>{t('Đăng ký một Model Context Protocol server để cung cấp tools cho agent.')}</div>

            <label style={labelStyle}>{t('Tên server')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid var(--jade)', borderRadius: 14, padding: '0 14px', marginBottom: 18 }}>
              <span style={{ fontSize: 15 }}>🔌</span>
              <input
                value={s.mcpForm.name}
                onChange={(e) => s.onMcpField('name', e.target.value)}
                placeholder={t('vd. Notion Sync')}
                autoFocus
                style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14.5, padding: '12px 0', background: 'transparent', color: 'var(--ink)' }}
              />
            </div>

            <label style={labelStyle}>Transport</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
              {(['stdio', 'SSE', 'HTTP'] as const).map((t) => {
                const sel = s.mcpForm.transport === t
                return (
                  <Hover key={t} as="button" onClick={() => s.setMcpTransport(t)}
                    style={{ flex: 1, border: `1.5px solid ${sel ? 'var(--jade)' : 'var(--line)'}`, background: sel ? 'var(--jade-soft)' : 'var(--surface)', color: sel ? 'var(--jade-deep)' : 'var(--ink-2)', borderRadius: 12, padding: 10, font: 'inherit', fontFamily: 'var(--mono)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                    hover={{ borderColor: 'var(--jade)' }}>{t}</Hover>
                )
              })}
            </div>

            <label style={labelStyle}>{t('Endpoint / lệnh chạy')}</label>
            <input
              value={s.mcpForm.endpoint}
              onChange={(e) => s.onMcpField('endpoint', e.target.value)}
              placeholder={t('https://… hoặc npx -y @org/mcp')}
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 14, fontFamily: 'var(--mono)', fontSize: 12.5, padding: '11px 14px', boxSizing: 'border-box', marginBottom: 18, outline: 'none', color: 'var(--ink)', background: 'var(--surface)' }}
            />

            <label style={labelStyle}>Tools <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--placeholder)' }}>{t('· phân tách bằng dấu phẩy')}</span></label>
            <input
              value={s.mcpForm.tools}
              onChange={(e) => s.onMcpField('tools', e.target.value)}
              placeholder={t('vd. query, insert, update')}
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 14, fontFamily: 'var(--mono)', fontSize: 12.5, padding: '11px 14px', boxSizing: 'border-box', marginBottom: 18, outline: 'none', color: 'var(--ink)', background: 'var(--surface)' }}
            />

            <label style={labelStyle}>{t('Mô tả')}</label>
            <textarea
              value={s.mcpForm.desc}
              onChange={(e) => s.onMcpField('desc', e.target.value)}
              placeholder={t('Server này cung cấp gì cho agent?')}
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 14, fontFamily: 'inherit', fontSize: 13.5, padding: '11px 14px', boxSizing: 'border-box', marginBottom: 22, outline: 'none', color: 'var(--ink)', background: 'var(--surface)', minHeight: 64, resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--line)' }}>{t('Hủy')}</Hover>
              <Hover as="button" onClick={s.createMcp}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: canCreate ? 'var(--jade)' : 'var(--line)', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: canCreate ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade-deep)' }}>{t('Kết nối')}</Hover>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
