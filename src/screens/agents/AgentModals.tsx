import { useStore } from '@/store'
import { Hover } from '@/components/ui/Hover'
import { ConfirmModal } from '@/screens/channels/ChannelModals'
import type { Agent } from '@/types'

// ---- shared style helpers ----
const label: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px',
  textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7,
}
const ghostBtn: React.CSSProperties = {
  fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)',
  border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px',
  cursor: 'pointer', fontFamily: 'inherit',
}
const stop = (e: React.MouseEvent) => e.stopPropagation()

// ---- status / role color maps (verbatim from renderVals) ----
const agStStyle: Record<string, { dot: string; label: string; fg: string; bg: string; pulse: string }> = {
  online: { dot: '#0A7B52', label: 'Online',     fg: '#0A7B52',          bg: '#E2F3EC',            pulse: 'none' },
  busy:   { dot: 'var(--jade)', label: 'Đang chạy', fg: 'var(--jade-deep)', bg: 'var(--jade-soft)',   pulse: 'wfpulse 1.6s infinite' },
  idle:   { dot: '#E8A33D', label: 'Nghỉ',       fg: '#9A6A1B',          bg: '#FBF1DE',            pulse: 'none' },
  offline:{ dot: '#9AA8A1', label: 'Offline',    fg: '#5A6B64',          bg: '#EEF2F0',            pulse: 'none' },
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

const ALL_MODELS = ['Qwen3 35B', 'Qwen3 8B', 'Claude Sonnet', 'DeepSeek V3'] as const

// ---- Close button ----
function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <Hover as="button" onClick={onClick}
      style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)', flex: 'none' }}
      hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
  )
}

// ================================================================
// AGENT DRAWER
// ================================================================
export function AgentDrawer() {
  const s = useStore()
  const ad: Agent | undefined = s.agentsData.find((a) => a.id === s.agentDrawer)
  if (!ad) return null

  const st = statusStyle(ad.status)
  const rl = roleStyle(ad.roleType)
  const modelFg = ad.modelType === 'local' ? '#28409E' : '#9A6A1B'
  const modelBg = ad.modelType === 'local' ? '#E8ECFB' : '#FBF1DE'
  const modelIcon = ad.modelType === 'local' ? '🏠' : '☁️'

  return (
    <div onClick={s.closeAgent}
      style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', zIndex: 45, animation: 'fadeIn .15s ease' }}>
      <div onClick={stop}
        style={{ width: 420, maxWidth: '94vw', height: '100vh', background: 'var(--surface)', boxShadow: '-12px 0 40px rgba(22,32,28,.18)', animation: 'pop .25s ease both', display: 'flex', flexDirection: 'column' }}>

        {/* header */}
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <div style={{ position: 'relative', flex: 'none' }}>
                <div style={{ width: 54, height: 54, borderRadius: 16, background: ad.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, fontWeight: 700 }}>{ad.initial}</div>
                <span style={{ position: 'absolute', right: -3, bottom: -3, width: 15, height: 15, borderRadius: 99, background: st.dot, border: '2.5px solid var(--surface)', animation: st.pulse }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ad.name}</div>
                <div style={{ fontSize: 12, color: 'var(--placeholder)', marginTop: 2 }}>{ad.handle}</div>
              </div>
            </div>
            <Hover as="button" onClick={s.closeAgent}
              style={{ width: 34, height: 34, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)', flex: 'none' }}
              hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: rl.fg, background: rl.bg, padding: '3px 11px', borderRadius: 99 }}>{ad.role}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: st.fg, background: st.bg, padding: '3px 11px', borderRadius: 99 }}>{st.label}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: modelFg, background: modelBg, padding: '3px 11px', borderRadius: 99 }}>{modelIcon} {ad.model}</span>
          </div>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink)', marginBottom: 20 }}>{ad.bio}</div>

          {/* stats */}
          <div style={{ display: 'flex', gap: 9, marginBottom: 22 }}>
            <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 13, padding: 13, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{ad.tasks}</div>
              <div style={{ fontSize: 10.5, color: 'var(--placeholder)', marginTop: 4 }}>tasks</div>
            </div>
            <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 13, padding: 13, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{ad.rooms}</div>
              <div style={{ fontSize: 10.5, color: 'var(--placeholder)', marginTop: 4 }}>rooms</div>
            </div>
            <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 13, padding: 13, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--jade-deep)', lineHeight: 1 }}>{ad.success}%</div>
              <div style={{ fontSize: 10.5, color: 'var(--placeholder)', marginTop: 4 }}>success</div>
            </div>
          </div>

          {/* skills */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 9 }}>Kỹ năng</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 22 }}>
            {ad.skills.map((sk) => (
              <span key={sk} style={{ fontSize: 12, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '5px 12px', borderRadius: 99 }}>{sk}</span>
            ))}
          </div>

          {/* rooms list */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 9 }}>Phòng tham gia</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 22 }}>
            {ad.roomsList.map((r) => (
              <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, border: '1px solid var(--line)', borderRadius: 11, padding: '10px 13px' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--jade-soft)', color: 'var(--jade-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 10, flex: 'none' }}>ZY</div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{r}</span>
              </div>
            ))}
          </div>

          {/* recent tasks */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 9 }}>Task gần đây</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ad.recentTasks.map((t) => {
              const sFg = t.status === 'done' ? '#0A7B52' : 'var(--jade-deep)'
              const sBg = t.status === 'done' ? '#E2F3EC' : 'var(--jade-soft)'
              const sLabel = t.status === 'done' ? 'Xong' : 'Đang chạy'
              return (
                <div key={t.id} style={{ border: '1px solid var(--line)', borderRadius: 11, padding: '11px 13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--ink)' }}>{t.id}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: sFg, background: sBg, padding: '2px 8px', borderRadius: 99, marginLeft: 'auto' }}>{sLabel}</span>
                  </div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>{t.text}</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* footer */}
        <div style={{ flex: 'none', padding: '16px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
          <Hover as="button" onClick={() => s.setView('channels')}
            style={{ flex: 1, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: 12, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }}
            hover={{ background: 'var(--jade-deep)' }}>💬 Mở DM</Hover>
          <Hover as="button" onClick={s.openAgentConfig}
            style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '12px 20px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>⚙ Cấu hình</Hover>
          <Hover as="button" onClick={s.agentAskDelete} title="Xóa agent"
            style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '12px 16px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            hover={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: '#FBEAE7' }}>🗑</Hover>
        </div>
      </div>
    </div>
  )
}

// ================================================================
// ALL AGENT MODALS
// ================================================================
export function AgentModals() {
  const s = useStore()
  const ov = s.overlay

  const agentDeleteName = (s.agentsData.find((a) => a.id === s.agentDrawer))?.name || ''

  return (
    <>
      {/* agentDelete */}
      {ov === 'agentDelete' && (
        <ConfirmModal
          icon="🗑"
          title={`Xóa agent "${agentDeleteName}"?`}
          body={<>Agent sẽ bị gỡ khỏi workspace và mọi phòng. Tác vụ đang giao sẽ cần gán lại. Không thể hoàn tác.</>}
          confirmLabel="Xóa agent"
          onConfirm={s.agentDoDelete}
          onClose={s.closeOverlay}
        />
      )}

      {/* newAgent */}
      {ov === 'newAgent' && (
        <div onClick={s.closeOverlay}
          style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fadeIn .15s ease' }}>
          <div onClick={stop}
            style={{ width: 460, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 24, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.22)', animation: 'pop .2s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Tạo agent mới</div>
              <CloseBtn onClick={s.closeOverlay} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 20, lineHeight: 1.5 }}>Thêm một AI agent mới chạy trên model máy nhà hoặc đám mây.</div>

            {/* name */}
            <label style={label}>Tên agent</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid var(--line)', borderRadius: 14, padding: '0 14px', marginBottom: 18 }}>
              <span style={{ fontSize: 15 }}>🤖</span>
              <input
                autoFocus
                value={s.agentForm.name}
                onChange={(e) => s.onAgentField('name', e.target.value)}
                placeholder="vd. Luffy - Viết kịch bản"
                style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14.5, padding: '13px 0', background: 'transparent', color: 'var(--ink)' }}
              />
            </div>

            {/* role */}
            <label style={label}>Vai trò</label>
            <input
              value={s.agentForm.role}
              onChange={(e) => s.onAgentField('role', e.target.value)}
              placeholder="vd. Researcher / Writer / Manager"
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 14, fontFamily: 'inherit', fontSize: 14, padding: '13px 14px', background: 'transparent', color: 'var(--ink)', outline: 'none', marginBottom: 18, boxSizing: 'border-box' }}
            />

            {/* desc */}
            <label style={label}>Mô tả</label>
            <textarea
              value={s.agentForm.desc || ''}
              onChange={(e) => s.onAgentField('desc', e.target.value)}
              placeholder="Agent này phụ trách việc gì? vd. Chuyên thu thập và phân tích bài viral từ fanpage nguồn."
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 14, fontFamily: 'inherit', fontSize: 13.5, lineHeight: 1.5, padding: '12px 14px', background: 'transparent', color: 'var(--ink)', outline: 'none', resize: 'vertical', minHeight: 64, marginBottom: 18, boxSizing: 'border-box' }}
            />

            {/* skills */}
            <label style={label}>Kỹ năng <span style={{ textTransform: 'none', fontWeight: 500 }}>(phân cách bằng dấu phẩy)</span></label>
            <input
              value={s.agentForm.skills || ''}
              onChange={(e) => s.onAgentField('skills', e.target.value)}
              placeholder="vd. Crawl dữ liệu, Phân tích hook, Bắt trend"
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 14, fontFamily: 'inherit', fontSize: 14, padding: '13px 14px', background: 'transparent', color: 'var(--ink)', outline: 'none', marginBottom: 18, boxSizing: 'border-box' }}
            />

            {/* rooms */}
            <label style={label}>Phòng tham gia</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
              {s.rooms.map((r) => {
                const sel = (s.agentForm.rooms || []).indexOf(r.id) >= 0
                return (
                  <Hover as="button" key={r.id} onClick={() => s.toggleAgentRoom(r.id)}
                    style={{ border: `1.5px solid ${sel ? 'var(--jade)' : 'var(--line)'}`, background: sel ? 'var(--jade-soft)' : 'transparent', color: sel ? 'var(--jade-deep)' : 'var(--ink-2)', borderRadius: 99, padding: '8px 15px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                    {sel ? '✓ ' : ''}{r.name}
                  </Hover>
                )
              })}
            </div>

            {/* model */}
            <label style={label}>Model</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
              {ALL_MODELS.map((m) => {
                const sel = s.agentForm.model === m
                return (
                  <Hover as="button" key={m} onClick={() => s.setAgentModel(m)}
                    style={{ border: '1px solid var(--line)', background: sel ? 'var(--jade)' : 'transparent', color: sel ? '#fff' : 'var(--ink-2)', borderRadius: 99, padding: '8px 14px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {m}
                  </Hover>
                )
              })}
            </div>

            {/* status */}
            <label style={label}>Trạng thái</label>
            <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: 3, marginBottom: 24 }}>
              {([{ k: 'online', l: 'Online' }, { k: 'idle', l: 'Nghỉ' }, { k: 'offline', l: 'Offline' }] as const).map((o) => {
                const sel = s.agentForm.status === o.k
                return (
                  <button key={o.k} onClick={() => s.onAgentField('status', o.k)}
                    style={{ flex: 1, border: 'none', background: sel ? 'var(--jade)' : 'transparent', color: sel ? '#fff' : 'var(--ink-2)', borderRadius: 99, padding: '9px 6px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                    {o.l}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={s.closeOverlay} style={ghostBtn} hover={{ background: 'var(--line)' }}>Hủy</Hover>
              <Hover as="button" onClick={s.createAgent}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: s.agentForm.name.trim() ? 'var(--jade)' : '#9FBDB1', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: s.agentForm.name.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade-deep)' }}>Tạo agent</Hover>
            </div>
          </div>
        </div>
      )}

      {/* agentImport */}
      {ov === 'agentImport' && (
        <div onClick={s.closeOverlay}
          style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fadeIn .15s ease' }}>
          <div onClick={stop}
            style={{ width: 440, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 22, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.22)', animation: 'pop .2s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Import agent</div>
              <CloseBtn onClick={s.closeOverlay} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 18, lineHeight: 1.5 }}>Tải lên file cấu hình agent (.agent.json) để thêm vào workspace.</div>
            <Hover style={{ border: '2px dashed var(--line)', borderRadius: 16, padding: 34, textAlign: 'center', marginBottom: 22, cursor: 'pointer' }}
              hover={{ borderColor: 'var(--jade)', background: 'var(--jade-soft)' }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>📥</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Kéo thả file agent</div>
              <div style={{ fontSize: 12, color: 'var(--placeholder)' }}>hoặc bấm để chọn · .agent.json</div>
            </Hover>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Hover as="button" onClick={s.closeOverlay} style={ghostBtn} hover={{ background: 'var(--line)' }}>Hủy</Hover>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '11px 24px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade-deep)' }}>Tải lên</Hover>
            </div>
          </div>
        </div>
      )}

      {/* agentConfig */}
      {ov === 'agentConfig' && (
        <div onClick={s.closeOverlay}
          style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fadeIn .15s ease' }}>
          <div onClick={stop}
            style={{ width: 440, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 22, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.22)', animation: 'pop .2s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Cấu hình agent</div>
              <CloseBtn onClick={s.closeOverlay} />
            </div>

            {/* model */}
            <label style={label}>Model</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
              {ALL_MODELS.map((m) => {
                const sel = s.agentCfg.model === m
                return (
                  <Hover as="button" key={m} onClick={() => s.onAgentCfg('model', m)}
                    style={{ border: '1px solid var(--line)', background: sel ? 'var(--jade)' : 'transparent', color: sel ? '#fff' : 'var(--ink-2)', borderRadius: 99, padding: '8px 14px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {m}
                  </Hover>
                )
              })}
            </div>

            {/* status */}
            <label style={label}>Trạng thái</label>
            <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: 3, marginBottom: 24 }}>
              {([{ k: 'online', l: 'Online' }, { k: 'busy', l: 'Đang chạy' }, { k: 'idle', l: 'Nghỉ' }, { k: 'offline', l: 'Offline' }] as const).map((o) => {
                const sel = s.agentCfg.status === o.k
                return (
                  <button key={o.k} onClick={() => s.onAgentCfg('status', o.k)}
                    style={{ flex: 1, border: 'none', background: sel ? 'var(--jade)' : 'transparent', color: sel ? '#fff' : 'var(--ink-2)', borderRadius: 99, padding: '9px 6px', font: 'inherit', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
                    {o.l}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={s.closeOverlay} style={ghostBtn} hover={{ background: 'var(--line)' }}>Hủy</Hover>
              <Hover as="button" onClick={s.saveAgentConfig}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade-deep)' }}>Lưu cấu hình</Hover>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
