import { useStore } from '@/store'
import { Hover } from '@/components/ui/Hover'
import { useT } from '@/i18n'
import type { Device } from '@/types'

// ---- view-model helpers (ported verbatim from renderVals) ----

const devTypeStyle: Record<string, { fg: string; bg: string; label: string }> = {
  server:  { fg: '#28409E', bg: '#E8ECFB', label: 'Server' },
  gateway: { fg: '#0E7490', bg: '#E0F2F4', label: 'Gateway' },
  desktop: { fg: '#9A6A1B', bg: '#FBF1DE', label: 'Desktop' },
  phone:   { fg: '#7C3AED', bg: '#F1E9FD', label: 'Phone' },
}

function gaugeColor(pct: number, online: boolean): string {
  if (!online) return '#CBD5D0'
  if (pct > 85)  return '#C94F3D'
  if (pct >= 60) return '#E8A33D'
  return '#0A7B52'
}

interface Gauge { label: string; pct: string; w: string; color: string }

function mkGauges(d: Device): Gauge[] {
  const on = d.status === 'online'
  return [
    { label: 'CPU', pct: d.cpuPct + '%',                          w: (on ? d.cpuPct : 0) + '%', color: gaugeColor(d.cpuPct, on) },
    { label: 'RAM', pct: d.ramPct + '%',                          w: (on ? d.ramPct : 0) + '%', color: gaugeColor(d.ramPct, on) },
    { label: 'GPU', pct: d.gpu === '—' ? '—' : d.gpuPct + '%',   w: (on ? d.gpuPct : 0) + '%', color: gaugeColor(d.gpuPct, on) },
  ]
}

// ---- shared style constants ----
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px',
  textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7,
}
const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)',
  background: 'var(--bg)', borderRadius: 11, padding: '12px 14px',
  font: 'inherit', fontSize: 13.5, color: 'var(--ink)', outline: 'none',
}
const ghostBtn: React.CSSProperties = {
  fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)',
  border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px',
  cursor: 'pointer', fontFamily: 'inherit',
}

// ---- sub-components ----

function GaugeRow({ g, large }: { g: Gauge; large?: boolean }) {
  if (large) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{g.label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{g.pct}</span>
        </div>
        <div style={{ height: 9, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: g.w, background: g.color, borderRadius: 99 }} />
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--placeholder)', width: 30, flex: 'none' }}>{g.label}</span>
      <div style={{ flex: 1, height: 7, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: g.w, background: g.color, borderRadius: 99 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', width: 36, textAlign: 'right', flex: 'none' }}>{g.pct}</span>
    </div>
  )
}

function DeviceDrawer({ dd }: { dd: Device }) {
  const s = useStore()
  const t = useT()
  const ts = devTypeStyle[dd.type] ?? devTypeStyle.server
  const on = dd.status === 'online'
  const gauges = mkGauges(dd)

  const specs = [
    { k: t('Hệ điều hành'), v: dd.os },
    { k: 'CPU',          v: dd.cpu },
    { k: 'RAM',          v: dd.ram },
    { k: 'GPU',          v: dd.gpu },
    { k: 'VRAM',         v: dd.vram },
    { k: 'Uptime',       v: dd.uptime },
  ]

  return (
    <div
      onClick={s.closeDevice}
      style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', zIndex: 45, animation: 'fadeIn .15s ease' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 430, maxWidth: '94vw', height: '100vh', background: 'var(--surface)', boxShadow: '-12px 0 40px rgba(22,32,28,.18)', animation: 'pop .25s ease both', display: 'flex', flexDirection: 'column' }}
      >
        {/* header */}
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
              <div style={{ position: 'relative', flex: 'none' }}>
                <div style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{dd.icon}</div>
                <span style={{ position: 'absolute', right: -3, bottom: -3, width: 15, height: 15, borderRadius: 99, background: on ? '#0A7B52' : '#9AA8A1', border: '2.5px solid var(--surface)' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 700, letterSpacing: '-.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{dd.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: ts.fg, background: ts.bg, padding: '2px 9px', borderRadius: 99 }}>{ts.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: on ? '#0A7B52' : '#5A6B64', background: on ? '#E2F3EC' : '#EEF2F0', padding: '2px 10px', borderRadius: 99 }}>{on ? 'Online' : 'Offline'}</span>
                </div>
              </div>
            </div>
            <Hover
              as="button"
              onClick={s.closeDevice}
              style={{ width: 34, height: 34, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)', flex: 'none' }}
              hover={{ background: 'var(--jade-soft)' }}
            >✕</Hover>
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
            {dd.role} · <span style={{ fontFamily: 'var(--mono)', color: 'var(--placeholder)' }}>{dd.addr}</span>
          </div>
        </div>

        {/* scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 11 }}>{t('Tài nguyên')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {gauges.map((g) => <GaugeRow key={g.label} g={g} large />)}
          </div>

          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 10 }}>{t('Thông số')}</div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 13, overflow: 'hidden', marginBottom: 22 }}>
            {specs.map((sp) => (
              <div key={sp.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 14px', borderBottom: '1px solid var(--line)' }}>
                <span style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{sp.k}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', textAlign: 'right' }}>{sp.v}</span>
              </div>
            ))}
          </div>

          {dd.models.length > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 10 }}>{t('Model đang nạp')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {dd.models.map((m) => (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 11, border: '1px solid var(--line)', borderRadius: 11, padding: '11px 13px' }}>
                    <span style={{ fontSize: 15 }}>🧠</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>{m.name}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '3px 9px', borderRadius: 7 }}>{m.vram}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* footer actions */}
        <div style={{ flex: 'none', padding: '16px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
          <Hover
            as="button"
            onClick={s.openDevSsh}
            style={{ flex: 1, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: 12, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }}
            hover={{ background: 'var(--jade-deep)' }}
          >⟳ {t('Mở SSH')}</Hover>
          <Hover
            as="button"
            onClick={s.toggleDevicePower}
            style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '12px 20px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            hover={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
          >{on ? t('Tắt thiết bị') : t('Đánh thức')}</Hover>
          <Hover
            as="button"
            onClick={s.askDeleteDevice}
            title={t('Xóa thiết bị')}
            style={{ width: 46, flex: 'none', border: '1px solid var(--danger)', background: '#FBEAE7', color: 'var(--danger)', borderRadius: 99, padding: 12, font: 'inherit', fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            hover={{ background: 'var(--danger)', color: '#fff' }}
          >🗑</Hover>
        </div>
      </div>
    </div>
  )
}

function AddDeviceModal() {
  const s = useStore()
  const t = useT()
  const devTypeBtns = (
    [
      { key: 'server',  label: '🖥 Server' },
      { key: 'gateway', label: '🌐 Gateway' },
      { key: 'desktop', label: '💻 Desktop' },
      { key: 'phone',   label: '📱 Phone' },
    ] as { key: Device['type']; label: string }[]
  ).map((t) => {
    const sel = t.key === s.devForm.type
    return { ...t, bg: sel ? 'var(--jade-soft)' : 'var(--bg)', border: sel ? 'var(--jade)' : 'var(--line)', fg: sel ? 'var(--jade-deep)' : 'var(--ink-2)' }
  })

  const canCreate = !!s.devForm.name.trim()

  return (
    <div
      onClick={s.closeAddDevice}
      style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, animation: 'fadeIn .15s ease' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 500, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 22, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.28)', animation: 'pop .2s ease both' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>{t('Thêm thiết bị')}</div>
          <Hover as="button" onClick={s.closeAddDevice} style={{ width: 34, height: 34, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }} hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 20, lineHeight: 1.5 }}>{t('Đăng ký máy nhà hoặc client mới vào mạng Tailscale của workspace.')}</div>

        <label style={labelStyle}>{t('Tên thiết bị')}</label>
        <input
          autoFocus
          value={s.devForm.name}
          onChange={(e) => s.onDevField('name', e.target.value)}
          placeholder={t('VD: máy-nhà-04')}
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        <label style={labelStyle}>{t('Loại thiết bị')}</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          {devTypeBtns.map((t) => (
            <Hover
              key={t.key}
              as="button"
              onClick={() => s.onDevField('type', t.key)}
              style={{ border: `1.5px solid ${t.border}`, background: t.bg, color: t.fg, borderRadius: 11, padding: 11, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              hover={{ borderColor: 'var(--jade)' }}
            >{t.label}</Hover>
          ))}
        </div>

        <label style={labelStyle}>{t('Địa chỉ Tailscale')}</label>
        <input
          value={s.devForm.addr}
          onChange={(e) => s.onDevField('addr', e.target.value)}
          placeholder={t('VD: 100.84.12.6 hoặc host.zy.ts.net')}
          style={{ ...inputStyle, marginBottom: 16, fontFamily: 'var(--mono)' }}
        />

        <label style={labelStyle}>{t('Vai trò')}</label>
        <input
          value={s.devForm.role}
          onChange={(e) => s.onDevField('role', e.target.value)}
          placeholder={t('VD: Model host phụ trợ')}
          style={{ ...inputStyle, marginBottom: 22 }}
        />

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Hover as="button" onClick={s.closeAddDevice} style={ghostBtn} hover={{ background: 'var(--line)' }}>{t('Hủy')}</Hover>
          <button
            onClick={s.createDevice}
            style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: canCreate ? 'var(--jade)' : '#9FBDB1', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: canCreate ? 'pointer' : 'default', fontFamily: 'inherit' }}
          >{t('Thêm thiết bị')}</button>
        </div>
      </div>
    </div>
  )
}

function DeleteDeviceConfirm({ deviceName }: { deviceName: string }) {
  const s = useStore()
  const t = useT()
  const dismiss = () => s.set({ devDeleteConfirm: false })

  return (
    <div
      onClick={dismiss}
      style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, animation: 'fadeIn .15s ease' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 420, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 20, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.28)', animation: 'pop .2s ease both' }}
      >
        <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FBEAE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>🗑</div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 8 }}>{t('Xóa thiết bị')} {deviceName}?</div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 24 }}>{t('Thiết bị sẽ bị gỡ khỏi mạng Tailscale của workspace. Model đang nạp sẽ ngừng phục vụ. Hành động này không thể hoàn tác.')}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Hover as="button" onClick={dismiss} style={ghostBtn} hover={{ background: 'var(--line)' }}>{t('Hủy')}</Hover>
          <Hover
            as="button"
            onClick={s.confirmDeleteDevice}
            style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--danger)', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: 'pointer', fontFamily: 'inherit' }}
            hover={{ background: '#A63E2E' }}
          >{t('Xóa thiết bị')}</Hover>
        </div>
      </div>
    </div>
  )
}

// ---- main screen ----

export function Devices() {
  const s = useStore()
  const t = useT()
  const D = s.devicesData

  // ---- view-model (ported from renderVals) ----
  const onlineDevs = D.filter((d) => d.status === 'online')
  const warnCount = onlineDevs.filter((d) => d.cpuPct > 85 || d.ramPct > 85 || d.gpuPct > 85).length

  const devStats = [
    { icon: '🖥',  label: t('Tổng thiết bị'),  value: D.length + '',                                    sub: t('đã đăng ký') },
    { icon: '🟢', label: t('Đang online'),     value: onlineDevs.length + '',                           sub: t('qua Tailscale') },
    { icon: '🧠', label: t('Model phục vụ'),   value: D.reduce((a, d) => a + d.models.length, 0) + '',  sub: t('đang nạp trên GPU') },
    { icon: '⚠️', label: t('Cảnh báo tải'),    value: warnCount + '',                                   sub: t('thiết bị quá ngưỡng') },
  ]

  const devFilterDefs = [
    { key: 'all',     label: t('Tất cả'),  count: D.length },
    { key: 'server',  label: 'Server',  count: D.filter((d) => d.type === 'server').length },
    { key: 'gateway', label: 'Gateway', count: D.filter((d) => d.type === 'gateway').length },
    { key: 'desktop', label: 'Desktop', count: D.filter((d) => d.type === 'desktop').length },
    { key: 'phone',   label: 'Phone',   count: D.filter((d) => d.type === 'phone').length },
  ]

  const dvq = s.devicesQuery.trim().toLowerCase()
  const devCards = D
    .filter((d) => s.devicesFilter === 'all' || d.type === s.devicesFilter)
    .filter((d) => !dvq || d.name.toLowerCase().includes(dvq) || d.role.toLowerCase().includes(dvq) || d.addr.toLowerCase().includes(dvq))

  const dd = D.find((d) => d.id === s.deviceDrawer) ?? null
  const devDeleteName = dd ? dd.name : ''

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* ===== HEADER ===== */}
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › {t('Thiết bị')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>{t('Thiết bị')}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{t('Máy nhà & client trong mạng Tailscale')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Hover
            as="button"
            onClick={s.refreshDevices}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}
          >⟳ {t('Làm mới')}</Hover>
          <Hover
            as="button"
            onClick={s.openAddDevice}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }}
            hover={{ background: 'var(--jade-deep)' }}
          >＋ {t('Thêm thiết bị')}</Hover>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>
        {/* ===== STAT CARDS ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
          {devStats.map((st) => (
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

        {/* ===== FILTERS + SEARCH ===== */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {devFilterDefs.map((f) => {
              const sel = f.key === s.devicesFilter
              return (
                <Hover
                  key={f.key}
                  as="button"
                  onClick={() => s.setDevicesFilter(f.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${sel ? 'var(--jade)' : 'var(--line)'}`, background: sel ? 'var(--jade-soft)' : 'var(--surface)', borderRadius: 99, padding: '7px 15px', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: sel ? 'var(--jade-deep)' : 'var(--ink)', cursor: 'pointer' }}
                  hover={{ borderColor: 'var(--jade)' }}
                >
                  {f.label}<span style={{ color: 'var(--placeholder)', fontWeight: 700 }}>{f.count}</span>
                </Hover>
              )
            })}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 11, padding: '9px 14px', width: 250, flex: 'none' }}>
            <span style={{ color: 'var(--placeholder)', fontSize: 14 }}>🔍</span>
            <input
              value={s.devicesQuery}
              onChange={(e) => s.set({ devicesQuery: e.target.value })}
              placeholder={t('Tìm thiết bị theo tên, IP, vai trò…')}
              style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, background: 'transparent', color: 'var(--ink)' }}
            />
          </div>
        </div>

        {/* ===== DEVICE CARDS ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(330px,1fr))', gap: 16 }}>
          {devCards.map((d) => {
            const ts = devTypeStyle[d.type] ?? devTypeStyle.server
            const on = d.status === 'online'
            const gauges = mkGauges(d)
            return (
              <Hover
                key={d.id}
                onClick={() => s.openDevice(d.id)}
                style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 18, cursor: 'pointer', transition: 'border-color .15s' }}
                hover={{ borderColor: 'var(--jade)' }}
              >
                {/* card header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, marginBottom: 14 }}>
                  <div style={{ position: 'relative', flex: 'none' }}>
                    <div style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{d.icon}</div>
                    <span style={{ position: 'absolute', right: -3, bottom: -3, width: 14, height: 14, borderRadius: 99, background: on ? '#0A7B52' : '#9AA8A1', border: '2.5px solid var(--surface)' }} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: ts.fg, background: ts.bg, padding: '2px 9px', borderRadius: 99 }}>{ts.label}</span>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: on ? '#0A7B52' : '#5A6B64', background: on ? '#E2F3EC' : '#EEF2F0', padding: '2px 9px', borderRadius: 99 }}>{on ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginBottom: 4 }}>{d.role}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--placeholder)', marginBottom: 14 }}>{d.addr}</div>

                {/* resource gauges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 13 }}>
                  {gauges.map((g) => <GaugeRow key={g.label} g={g} />)}
                </div>

                {/* loaded models */}
                {d.models.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {d.models.map((m) => (
                      <span key={m.name} style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '3px 9px', borderRadius: 7 }}>🧠 {m.name}</span>
                    ))}
                  </div>
                )}

                {/* card footer */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 12, borderTop: '1px solid var(--line)', fontSize: 11, color: 'var(--ink-2)' }}>
                  <span>⏱ {d.uptime}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--placeholder)' }}>📡 {d.lastSeen}</span>
                </div>
              </Hover>
            )
          })}
        </div>
      </div>

      {/* ===== DEVICE DRAWER ===== */}
      {dd && <DeviceDrawer dd={dd} />}

      {/* ===== ADD DEVICE MODAL ===== */}
      {s.showAddDevice && <AddDeviceModal />}

      {/* ===== DELETE CONFIRM ===== */}
      {s.devDeleteConfirm && <DeleteDeviceConfirm deviceName={devDeleteName} />}
    </div>
  )
}
