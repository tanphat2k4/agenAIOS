import { useStore } from '@/store'
import { Hover } from '@/components/ui/Hover'

export function Billing() {
  const s = useStore()

  const billStats = [
    { icon: '💳', label: 'Chi phí tháng này', value: '6,42M ₫', sub: 'kỳ 01/06 – 30/06' },
    { icon: '🔢', label: 'Tokens 30 ngày', value: '4,8M', sub: 'máy nhà + đám mây' },
    { icon: '📡', label: 'Tool calls 30 ngày', value: '128k', sub: 'qua MCP' },
    { icon: '🪑', label: 'Seats đang dùng', value: '12 / 20', sub: 'user + agent' },
  ]

  const allMonths = s.billMonths
  const shown = s.billRange === '6m' ? allMonths.slice(-6) : allMonths
  const maxV = Math.max(...shown.map((x) => x.v))
  const billBars = shown.map((x) => ({ m: x.m, h: Math.round((x.v / maxV) * 150) + 'px', val: x.v.toFixed(2) + 'M' }))

  const rangeBtns = [{ k: '6m', label: '6 tháng' }, { k: '12m', label: '12 tháng' }].map((b) => {
    const sel = b.k === s.billRange
    return {
      k: b.k,
      label: b.label,
      onSelect: () => s.setBillRange(b.k),
      bg: sel ? 'var(--jade-soft)' : 'var(--surface)',
      border: sel ? 'var(--jade)' : 'var(--line)',
      fg: sel ? 'var(--jade-deep)' : 'var(--ink-2)',
    }
  })

  const quotas = [
    { label: 'Tokens đám mây', used: '1,3M', total: '10M', pct: 13 },
    { label: 'Agents', used: '12', total: '20', pct: 60 },
    { label: 'Lưu trữ dataset', used: '38 GB', total: '100 GB', pct: 38 },
    { label: 'Tool calls / tháng', used: '128k', total: '500k', pct: 26 },
  ].map((q) => ({
    ...q,
    w: q.pct + '%',
    color: q.pct > 85 ? '#C94F3D' : q.pct >= 60 ? '#E8A33D' : '#0A7B52',
  }))

  const modelCost = [
    { name: 'Qwen3 35B', icon: '🏠', tier: 'Máy nhà', tokens: '2,1M tokens', cost: 'Miễn phí', free: true },
    { name: 'Qwen3 8B', icon: '🏠', tier: 'Máy nhà', tokens: '1,4M tokens', cost: 'Miễn phí', free: true },
    { name: 'Claude Sonnet', icon: '☁️', tier: 'Đám mây', tokens: '980k tokens', cost: '3,82M ₫', free: false },
    { name: 'DeepSeek V3', icon: '☁️', tier: 'Đám mây', tokens: '320k tokens', cost: '1,10M ₫', free: false },
  ].map((m) => ({
    ...m,
    costFg: m.free ? '#0A7B52' : 'var(--ink)',
    costBg: m.free ? '#E2F3EC' : 'transparent',
    tierFg: m.free ? '#28409E' : '#9A6A1B',
    tierBg: m.free ? '#E8ECFB' : '#FBF1DE',
  }))

  const invoices = [
    { id: 'INV-2026-06', period: 'Tháng 06/2026', amount: '6,42M ₫', status: 'Đã thanh toán', ok: true },
    { id: 'INV-2026-05', period: 'Tháng 05/2026', amount: '5,88M ₫', status: 'Đã thanh toán', ok: true },
    { id: 'INV-2026-04', period: 'Tháng 04/2026', amount: '6,01M ₫', status: 'Đã thanh toán', ok: true },
    { id: 'INV-2026-03', period: 'Tháng 03/2026', amount: '5,40M ₫', status: 'Đã thanh toán', ok: true },
  ].map((iv) => ({
    ...iv,
    sFg: iv.ok ? '#0A7B52' : '#9A6A1B',
    sBg: iv.ok ? '#E2F3EC' : '#FBF1DE',
  }))

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › Thanh toán &amp; sử dụng</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>Sử dụng</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Gói, hạn mức và lịch sử hóa đơn</span>
          </div>
        </div>
        <Hover as="button"
          style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>
          ↓ Xuất hóa đơn
        </Hover>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>
        {/* plan banner */}
        <div style={{ background: 'linear-gradient(135deg,#4F46E5 0%,#6D28D9 100%)', borderRadius: 18, padding: '20px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flex: 'none' }}>🏢</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                <span style={{ fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-.3px' }}>Enterprise</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: '#C4B5FD', background: 'rgba(255,255,255,.15)', padding: '2px 9px', borderRadius: 99 }}>Gói hiện tại</span>
              </div>
              <div style={{ fontSize: 12, color: '#C4B5FD' }}>4.990.000 ₫/tháng · Gia hạn 01/07/2026 · 20 seats</div>
            </div>
          </div>
          <Hover as="button"
            style={{ border: '1.5px solid rgba(255,255,255,.35)', background: 'transparent', color: '#fff', borderRadius: 99, padding: '9px 20px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            hover={{ background: 'rgba(255,255,255,.15)' }}>
            Quản lý gói
          </Hover>
        </div>

        {/* stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 20 }}>
          {billStats.map((st) => (
            <div key={st.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>{st.icon}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 4 }}>{st.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-.6px', lineHeight: 1, color: 'var(--ink)' }}>{st.value}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4 }}>{st.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20, alignItems: 'start', marginBottom: 20 }}>
          {/* left: cost chart + model breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* bar chart */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px' }}>Chi phí theo tháng</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>Tổng phí nền tảng + model đám mây (triệu ₫)</div>
                </div>
                <div style={{ display: 'flex', gap: 7 }}>
                  {rangeBtns.map((b) => (
                    <Hover key={b.k} as="button" onClick={b.onSelect}
                      style={{ border: `1px solid ${b.border}`, background: b.bg, color: b.fg, borderRadius: 99, padding: '6px 14px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      hover={{ borderColor: 'var(--jade)' }}>
                      {b.label}
                    </Hover>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, height: 178, paddingTop: 8 }}>
                {billBars.map((bar) => (
                  <div key={bar.m} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div title={bar.val} style={{ width: '100%', maxWidth: 34, borderRadius: '6px 6px 0 0', background: 'var(--jade)', height: bar.h }}></div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{bar.m}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* model cost */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px', marginBottom: 14 }}>Chi phí theo model</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {modelCost.map((m) => (
                  <div key={m.name} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 13, padding: '12px 14px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flex: 'none' }}>{m.icon}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{m.name}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: m.tierFg, background: m.tierBg, padding: '2px 8px', borderRadius: 99 }}>{m.tier}</span>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginTop: 2 }}>{m.tokens}</div>
                    </div>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: m.costFg, background: m.costBg, padding: '4px 11px', borderRadius: 99, flex: 'none' }}>{m.cost}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* right: quotas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px', marginBottom: 16 }}>Hạn mức sử dụng</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {quotas.map((q) => (
                  <div key={q.label}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{q.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--ink-2)' }}><b style={{ color: 'var(--ink)' }}>{q.used}</b> / {q.total}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: q.w, background: q.color, borderRadius: 99 }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* invoices */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px' }}>Lịch sử hóa đơn</div>
            <span style={{ fontSize: 11.5, color: 'var(--placeholder)' }}>Tự động xuất vào ngày 1 hàng tháng</span>
          </div>
          {invoices.map((iv) => (
            <Hover key={iv.id}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 22px', borderBottom: '1px solid var(--line)' }}
              hover={{ background: 'var(--bg)' }}>
              <span style={{ fontSize: 18 }}>🧾</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{iv.period}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--placeholder)', marginTop: 1 }}>{iv.id}</div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', width: 110, textAlign: 'right' }}>{iv.amount}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: iv.sFg, background: iv.sBg, padding: '3px 11px', borderRadius: 99, width: 120, textAlign: 'center' }}>{iv.status}</span>
              <Hover as="button"
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade)', color: '#fff' }}>
                Tải PDF
              </Hover>
            </Hover>
          ))}
        </div>
      </div>
    </div>
  )
}
