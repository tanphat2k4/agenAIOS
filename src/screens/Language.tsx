import { useStore } from '@/store'
import { Hover } from '@/components/ui/Hover'
import { TIMEZONES, CURRENCIES } from '@/data/langs'

// Lang cards matching the prototype (5 entries)
const LANG_CARDS = [
  { id: 'vi', flag: '🇻🇳', name: 'Tiếng Việt', native: 'Tiếng Việt' },
  { id: 'en', flag: '🇬🇧', name: 'English', native: 'English' },
  { id: 'zh', flag: '🇨🇳', name: 'Tiếng Trung', native: '中文' },
  { id: 'ja', flag: '🇯🇵', name: 'Tiếng Nhật', native: '日本語' },
  { id: 'ko', flag: '🇰🇷', name: '한국어', native: '한국어' },
]

export function Language() {
  const s = useStore()

  // ---- computed view-model (mirrors renderVals) ----
  const sampleDate =
    s.dateFormat === 'dmy' ? '24/06/2026' :
    s.dateFormat === 'mdy' ? '06/24/2026' :
    '2026-06-24'
  const sampleTime = s.timeFormat === '24h' ? '15:56' : '3:56 PM'

  const tzOpts = TIMEZONES.map((tz) => ({ k: tz.id, label: `${tz.gmt} · ${tz.label}` }))
  const curOpts = CURRENCIES.map((c) => ({ k: c.id, label: `${c.id.toUpperCase()} · ${c.sym}` }))

  const tzLabel = (tzOpts.find((o) => o.k === s.timezone) || tzOpts[0]).label
  const curLabel = (curOpts.find((o) => o.k === s.currency) || curOpts[0]).label

  const langCards = LANG_CARDS.map((l) => {
    const sel = l.id === s.activeLang
    return {
      ...l,
      border: sel ? 'var(--jade)' : 'var(--line)',
      bg: sel ? 'var(--jade-soft)' : 'var(--surface)',
      checkBg: sel ? 'var(--jade)' : 'transparent',
      checkBorder: sel ? 'var(--jade)' : 'var(--line)',
      check: sel ? '✓' : '',
      onSelect: () => s.setLang(l.id),
    }
  })

  const seg = <K extends string>(
    val: string,
    opts: readonly { k: K; label: string }[],
    setter: (v: K) => void,
  ) =>
    opts.map((o) => ({
      label: o.label,
      onSelect: () => setter(o.k),
      bg: o.k === val ? 'var(--jade)' : 'transparent',
      fg: o.k === val ? '#fff' : 'var(--ink-2)',
    }))

  const agentLangSeg = seg(
    s.agentLang,
    [
      { k: 'user', label: 'Theo người dùng' },
      { k: 'vi', label: 'Tiếng Việt' },
      { k: 'en', label: 'English' },
    ] as const,
    s.setAgentLang,
  )

  const timeSeg = seg(
    s.timeFormat,
    [
      { k: '24h', label: '24 giờ' },
      { k: '12h', label: '12 giờ (AM/PM)' },
    ] as const,
    s.setTimeFormat,
  )

  const dateSeg = seg(
    s.dateFormat,
    [
      { k: 'dmy', label: 'DD/MM/YYYY' },
      { k: 'mdy', label: 'MM/DD/YYYY' },
      { k: 'ymd', label: 'YYYY-MM-DD' },
    ] as const,
    s.setDateFormat,
  )

  const weekSeg = seg(
    s.weekStart,
    [
      { k: 'mon', label: 'Thứ 2' },
      { k: 'sun', label: 'Chủ nhật' },
    ] as const,
    s.setWeekStart,
  )

  // picker rows for the picker modal
  const pickerOpts = s.langPicker === 'timezone' ? tzOpts : s.langPicker === 'currency' ? curOpts : []
  const pickerActiveKey = s.langPicker === 'timezone' ? s.timezone : s.currency
  const pickerRows = pickerOpts.map((o) => {
    const sel = o.k === pickerActiveKey
    return {
      label: o.label,
      sel,
      check: sel ? '✓' : '',
      onSelect: () => (s.langPicker === 'timezone' ? s.setTimezone(o.k) : s.setCurrency(o.k)),
    }
  })
  const pickerTitle = s.langPicker === 'timezone' ? 'Chọn múi giờ' : 'Chọn đơn vị tiền tệ'

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px' }}>
        <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › Ngôn ngữ &amp; khu vực</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>Ngôn ngữ &amp; khu vực</span>
          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Chọn ngôn ngữ hiển thị và định dạng vùng</span>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px 32px' }}>
        <div style={{ maxWidth: 760 }}>

          {/* === display language === */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px', marginBottom: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px', marginBottom: 3 }}>Ngôn ngữ hiển thị</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 16 }}>Áp dụng cho giao diện AgentAIOS trên thiết bị này</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              {langCards.map((l) => (
                <Hover
                  key={l.id}
                  onClick={l.onSelect}
                  style={{ display: 'flex', alignItems: 'center', gap: 13, border: `1.5px solid ${l.border}`, background: l.bg, borderRadius: 13, padding: '13px 15px', cursor: 'pointer' }}
                  hover={{ borderColor: 'var(--jade)' }}
                >
                  <span style={{ fontSize: 24, flex: 'none' }}>{l.flag}</span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{l.native}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--placeholder)' }}>{l.name}</div>
                  </div>
                  <span style={{ width: 20, height: 20, borderRadius: 99, border: `2px solid ${l.checkBorder}`, background: l.checkBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>
                    {l.check}
                  </span>
                </Hover>
              ))}
            </div>
          </div>

          {/* === agent language === */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px', marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px', marginBottom: 3 }}>Ngôn ngữ agent trả lời</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>Ngôn ngữ mặc định khi agent phản hồi trong hội thoại</div>
              </div>
              <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: 3, flex: 'none' }}>
                {agentLangSeg.map((o) => (
                  <button
                    key={o.label}
                    onClick={o.onSelect}
                    style={{ border: 'none', background: o.bg, color: o.fg, borderRadius: 99, padding: '8px 14px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >{o.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* === region & format === */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 14px' }}>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px' }}>Khu vực &amp; định dạng</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                Ví dụ: <b style={{ color: 'var(--ink)' }}>{sampleDate}</b> · <b style={{ color: 'var(--ink)' }}>{sampleTime}</b>
              </div>
            </div>

            {/* timezone */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 22px', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>🌏 Múi giờ</span>
              <Hover
                as="button"
                onClick={() => s.openLangPicker('timezone')}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '7px 14px', borderRadius: 99, border: 'none', cursor: 'pointer' }}
                hover={{ opacity: 0.85 }}
              >{tzLabel}</Hover>
            </div>

            {/* date format */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 22px', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>📅 Định dạng ngày</span>
              <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: 3, flex: 'none' }}>
                {dateSeg.map((o) => (
                  <button
                    key={o.label}
                    onClick={o.onSelect}
                    style={{ border: 'none', background: o.bg, color: o.fg, borderRadius: 99, padding: '7px 13px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >{o.label}</button>
                ))}
              </div>
            </div>

            {/* time format */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 22px', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>🕐 Định dạng giờ</span>
              <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: 3, flex: 'none' }}>
                {timeSeg.map((o) => (
                  <button
                    key={o.label}
                    onClick={o.onSelect}
                    style={{ border: 'none', background: o.bg, color: o.fg, borderRadius: 99, padding: '7px 13px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >{o.label}</button>
                ))}
              </div>
            </div>

            {/* week start */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 22px', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>🗓 Ngày đầu tuần</span>
              <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: 3, flex: 'none' }}>
                {weekSeg.map((o) => (
                  <button
                    key={o.label}
                    onClick={o.onSelect}
                    style={{ border: 'none', background: o.bg, color: o.fg, borderRadius: 99, padding: '7px 14px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >{o.label}</button>
                ))}
              </div>
            </div>

            {/* currency */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 22px', borderTop: '1px solid var(--line)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>💱 Đơn vị tiền tệ</span>
              <Hover
                as="button"
                onClick={() => s.openLangPicker('currency')}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '7px 14px', borderRadius: 99, border: 'none', cursor: 'pointer' }}
                hover={{ opacity: 0.85 }}
              >{curLabel}</Hover>
            </div>
          </div>

          {/* action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <Hover
              as="button"
              onClick={s.resetLangDefaults}
              style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '11px 22px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              hover={{ background: 'var(--bg)' }}
            >Khôi phục mặc định</Hover>
            <Hover
              as="button"
              onClick={s.saveLang}
              style={{ border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '11px 26px', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }}
              hover={{ background: 'var(--jade-deep)' }}
            >Lưu thay đổi</Hover>
          </div>
        </div>
      </div>

      {/* ===== timezone / currency picker modal ===== */}
      {s.langPicker && (
        <div
          onClick={s.closeLangPicker}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,35,30,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 380, maxWidth: '100%', background: 'var(--surface)', borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,.28)', overflow: 'hidden' }}
          >
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.3px' }}>{pickerTitle}</div>
              <Hover
                as="button"
                onClick={s.closeLangPicker}
                style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'transparent', color: 'var(--ink-2)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                hover={{ background: 'var(--bg)' }}
              >✕</Hover>
            </div>
            <div style={{ maxHeight: '60vh', overflow: 'auto' }}>
              {pickerRows.map((row, i) => (
                <Hover
                  key={i}
                  onClick={row.onSelect}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 24px', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: row.sel ? 'var(--jade-soft)' : 'transparent' }}
                  hover={{ background: 'var(--jade-soft)' }}
                >
                  <span style={{ fontSize: 13.5, fontWeight: row.sel ? 700 : 500, color: row.sel ? 'var(--jade-deep)' : 'var(--ink)' }}>{row.label}</span>
                  {row.check && (
                    <span style={{ width: 20, height: 20, borderRadius: 99, background: 'var(--jade)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>{row.check}</span>
                  )}
                </Hover>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
