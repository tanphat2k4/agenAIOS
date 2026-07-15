import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Hover } from '@/components/ui/Hover'
import { useStore } from '@/store'
import { MarkdownLite } from '@/components/MarkdownLite'
import { useT } from '@/i18n'

const SUGGEST = ['FPT', 'VCB', 'HPG', 'VNM', 'MWG', 'SSI', 'VHM', 'VIB']

type Action = { key: string; label: string; slow?: boolean }
const ACTIONS: Action[] = [
  { key: 'snapshot', label: 'Giá + chỉ báo' },
  { key: 'news', label: 'Tin tức' },
  { key: 'extras', label: 'Khối ngoại' },
  { key: 'macro', label: 'Vĩ mô (tỷ giá/lãi suất)' },
  { key: 'analyze', label: 'Phân tích đầy đủ', slow: true },
  { key: 'pipeline', label: 'Pipeline đa-agent', slow: true },
]

export function Trading() {
  const t = useT()
  const refreshOps = useStore((s) => s.refreshTradingOps)
  const [ticker, setTicker] = useState('FPT')
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [result, setResult] = useState('')
  const [portfolio, setPortfolio] = useState<{ holdings: any[]; totalPnlM: number; totalPnlPct: number; totalValueM: number; totalCostM: number } | null>(null)
  const [pfForm, setPfForm] = useState({ ticker: '', qty: '', avg: '' })
  const [pfBusy, setPfBusy] = useState(false)
  const [pfEditing, setPfEditing] = useState<string | null>(null) // mã đang sửa (POST upsert theo ticker)

  const [wl, setWl] = useState<{ tickers: string[]; deep: number; max: number } | null>(null)
  const [wlForm, setWlForm] = useState('')
  const [wlBusy, setWlBusy] = useState(false)
  const [wlErr, setWlErr] = useState('')

  useEffect(() => { api.get('/trading/portfolio').then(setPortfolio).catch(() => {}) }, [])
  useEffect(() => { api.get('/trading/watchlist').then(setWl).catch(() => {}) }, [])

  const wlAct = async (action: string, tk?: string) => {
    if (wlBusy) return
    setWlBusy(true)
    setWlErr('')
    try {
      setWl(await api.post('/trading/watchlist', { action, ticker: tk || '' }))
      if (action === 'add') setWlForm('')
    } catch (e) {
      setWlErr(e instanceof Error ? e.message : 'Lỗi')
    } finally { setWlBusy(false) }
  }

  const addHolding = async () => {
    const t = pfForm.ticker.trim().toUpperCase()
    const qty = parseFloat(pfForm.qty)
    const avg = parseFloat(pfForm.avg)
    if (!t || !(qty > 0) || !(avg > 0) || pfBusy) return
    setPfBusy(true)
    try {
      setPortfolio(await api.post('/trading/portfolio', { ticker: t, qty, avg }))  // upsert theo mã → dùng chung cho Thêm + Sửa
      setPfForm({ ticker: '', qty: '', avg: '' })
      setPfEditing(null)
    } catch { /* ignore */ } finally { setPfBusy(false) }
  }
  const startEditHolding = (h: { ticker: string; qty: number; avg: number }) => {
    setPfEditing(h.ticker)
    setPfForm({ ticker: h.ticker, qty: String(h.qty), avg: String(h.avg) })
  }
  const cancelEditHolding = () => { setPfEditing(null); setPfForm({ ticker: '', qty: '', avg: '' }) }
  // màu P/L theo yêu cầu: lãi = XANH LÁ, lỗ = ĐỎ, hoà vốn = VÀNG (không dùng --jade vì theme này nó là xanh dương)
  const pnlColor = (v: number) => (v > 0 ? '#16A34A' : v < 0 ? '#C94F3D' : '#D97706')
  const removeHolding = async (t: string) => { try { setPortfolio(await api.del('/trading/portfolio/' + t)); if (pfEditing === t) cancelEditHolding() } catch { /* ignore */ } }
  const pfInput = { border: '1.5px solid var(--line)', borderRadius: 10, padding: '8px 10px', font: 'inherit', fontSize: 12.5, background: 'var(--bg)', color: 'var(--ink)', outline: 'none' } as const

  const runFast = async (key: string, label: string) => {
    const sym = ticker.trim().toUpperCase()
    if (!sym && key !== 'macro') return
    setBusy(true)
    setTitle(t(label) + (key === 'macro' ? '' : ' · ' + sym))
    setResult(t('Đang tải…'))
    try {
      const path =
        key === 'macro' ? '/trading/macro'
          : key === 'news' ? `/trading/news/${encodeURIComponent(sym)}?days=7`
            : `/trading/${key}/${encodeURIComponent(sym)}`
      const r = await api.get(path)
      setResult(r.text || t('(không có kết quả)'))
      refreshOps()
    } catch (e) {
      setResult(t('Lỗi: ') + (e instanceof Error ? e.message : 'unknown'))
    } finally {
      setBusy(false)
    }
  }

  const runAnalyze = async () => {
    const sym = ticker.trim().toUpperCase()
    if (!sym || busy) return
    setBusy(true)
    setTitle(t('Phân tích đầy đủ · ') + sym)
    setResult(t('⏳ Đang chạy pipeline đa-agent (analyst → tranh luận → trader → rủi ro → portfolio). Lần đầu có thể mất vài phút; kết quả được lưu cache trong ngày…'))
    try {
      await api.post('/trading/analyze', { ticker: sym })
      const poll = async () => {
        try {
          const r = await api.get(`/trading/analyze?ticker=${encodeURIComponent(sym)}`)
          if (r.status === 'done' || r.status === 'error') {
            setResult(r.result || t('(không có kết quả)'))
            setBusy(false)
            refreshOps()
          } else {
            setTimeout(poll, 3000)
          }
        } catch (e) {
          setResult(t('Lỗi khi chờ kết quả: ') + (e instanceof Error ? e.message : 'unknown'))
          setBusy(false)
        }
      }
      setTimeout(poll, 3000)
    } catch (e) {
      setResult(t('Lỗi: ') + (e instanceof Error ? e.message : 'unknown'))
      setBusy(false)
    }
  }

  const runPipeline = async () => {
    const sym = ticker.trim().toUpperCase()
    if (!sym || busy) return
    setBusy(true)
    setTitle(t('Pipeline đa-agent · ') + sym)
    setResult(t('⏳ Pipeline đa-agent đang chạy: Market Data · Fundamental · Technical · News → Bull/Bear → Backtest → Risk → Trader → Portfolio (mỗi agent 1 lượt 9Router)…'))
    try {
      await api.post('/trading/pipeline', { ticker: sym })
      const poll = async () => {
        try {
          const r = await api.get(`/trading/pipeline?ticker=${encodeURIComponent(sym)}`)
          if (r.status === 'done' || r.status === 'error') {
            setResult(r.result || t('(không có kết quả)'))
            setBusy(false)
            refreshOps()
          } else {
            setTimeout(poll, 3000)
          }
        } catch (e) {
          setResult(t('Lỗi khi chờ kết quả: ') + (e instanceof Error ? e.message : 'unknown'))
          setBusy(false)
        }
      }
      setTimeout(poll, 3000)
    } catch (e) {
      setResult(t('Lỗi: ') + (e instanceof Error ? e.message : 'unknown'))
      setBusy(false)
    }
  }

  const onAction = (a: Action) => (a.key === 'analyze' ? runAnalyze() : a.key === 'pipeline' ? runPipeline() : runFast(a.key, a.label))

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px' }}>
        <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › {t('Chứng khoán')}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>{t('Chứng khoán VN')} 📈</span>
          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{t('Phân tích đa-agent qua TradingAgents · dữ liệu vnstock/FireAnt')}</span>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>
        {/* control card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 20px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid var(--jade)', background: 'var(--bg)', borderRadius: 12, padding: '9px 14px', width: 200 }}>
              <span style={{ color: 'var(--placeholder)', fontSize: 14 }}>🔎</span>
              <input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter' && !busy) runFast('snapshot', 'Giá + chỉ báo') }}
                placeholder={t('Mã CK (vd FPT)')}
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, letterSpacing: '.5px', background: 'transparent', color: 'var(--ink)' }}
              />
            </div>
            {ACTIONS.map((a) => (
              <Hover as="button" key={a.key} onClick={() => onAction(a)} disabled={busy}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, border: 'none', borderRadius: 99, padding: '10px 16px',
                  font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                  background: a.slow ? 'var(--jade)' : 'var(--jade-soft)', color: a.slow ? '#fff' : 'var(--jade-deep)',
                }}
                hover={busy ? {} : { background: a.slow ? 'var(--jade-deep)' : 'var(--jade)', color: '#fff' }}>
                {a.slow ? '🧠' : '⚡'} {t(a.label)}
              </Hover>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 13, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--placeholder)', fontWeight: 600 }}>{t('Gợi ý:')}</span>
            {SUGGEST.map((t) => (
              <Hover as="button" key={t} onClick={() => setTicker(t)}
                style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '4px 11px', font: 'inherit', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>{t}</Hover>
            ))}
          </div>
        </div>

        {/* portfolio card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 20px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.2px' }}>💼 {t('Danh mục của tôi')}</span>
            {portfolio && portfolio.holdings.length > 0 && (
              <span style={{ fontSize: 13, fontWeight: 700, color: pnlColor(portfolio.totalPnlM) }}>
                {portfolio.totalValueM}tr · P/L {portfolio.totalPnlM > 0 ? '+' : ''}{portfolio.totalPnlM}tr ({portfolio.totalPnlPct > 0 ? '+' : ''}{portfolio.totalPnlPct}%)
              </span>
            )}
          </div>
          {portfolio && portfolio.holdings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {portfolio.holdings.map((h) => {
                const plus = h.pnlM > 0 ? '+' : ''
                return (
                  <div key={h.ticker} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, padding: '7px 10px', background: pfEditing === h.ticker ? 'var(--jade-soft)' : 'var(--bg)', borderRadius: 10 }}>
                    <span style={{ fontWeight: 800, width: 44 }}>{h.ticker}</span>
                    <span style={{ color: 'var(--ink-2)', flex: 1, minWidth: 0 }}>{Number(h.qty).toLocaleString()}cp · {t('vốn')} {h.avg} → {h.price ?? '—'}</span>
                    <span style={{ fontWeight: 700, color: pnlColor(h.pnlM) }}>{plus}{h.pnlM}tr ({plus && h.pnlPct > 0 ? '+' : ''}{h.pnlPct}%)</span>
                    <Hover as="button" title={t('Sửa số lượng / giá vốn')} onClick={() => startEditHolding(h)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--placeholder)', fontSize: 13.5, lineHeight: 1, padding: 2 }} hover={{ color: 'var(--jade-deep)' }}>✎</Hover>
                    <Hover as="button" onClick={() => removeHolding(h.ticker)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--placeholder)', fontSize: 15, lineHeight: 1, padding: 2 }} hover={{ color: '#C94F3D' }}>✕</Hover>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--placeholder)', marginBottom: 12 }}>{t('Chưa có mã nào — thêm cổ phiếu anh đang giữ để theo dõi lãi/lỗ real-time (giá vốn nhập theo nghìn đồng, vd 15.5).')}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={pfForm.ticker} disabled={!!pfEditing} onChange={(e) => setPfForm({ ...pfForm, ticker: e.target.value.toUpperCase() })} placeholder={t('Mã')} style={{ ...pfInput, width: 70, fontWeight: 700, letterSpacing: '.5px', opacity: pfEditing ? 0.55 : 1 }} />
            <input value={pfForm.qty} onChange={(e) => setPfForm({ ...pfForm, qty: e.target.value.replace(/[^\d]/g, '') })} placeholder={t('Số CP')} inputMode="numeric" style={{ ...pfInput, width: 90 }} />
            <input value={pfForm.avg} onChange={(e) => setPfForm({ ...pfForm, avg: e.target.value.replace(/[^\d.]/g, '') })} onKeyDown={(e) => { if (e.key === 'Enter') addHolding() }} placeholder={t('Giá vốn (nghìn)')} inputMode="decimal" style={{ ...pfInput, width: 120 }} />
            <Hover as="button" onClick={addHolding} disabled={pfBusy} style={{ border: 'none', borderRadius: 10, padding: '9px 18px', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: pfBusy ? 'default' : 'pointer', background: 'var(--jade)', color: '#fff', opacity: pfBusy ? 0.6 : 1 }} hover={pfBusy ? {} : { background: 'var(--jade-deep)' }}>{pfEditing ? '✓ ' + t('Lưu') + ' ' + pfEditing : '＋ ' + t('Thêm')}</Hover>
            {pfEditing && (
              <Hover as="button" onClick={cancelEditHolding} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '8px 14px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: 'var(--surface)', color: 'var(--ink-2)' }} hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>{t('Hủy')}</Hover>
            )}
          </div>
        </div>

        {/* watchlist báo cáo sáng — user quản mã, team CK lập báo cáo 08:00 (2 mã đầu deep-dive) */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 20px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.2px' }}>📋 {t('Watchlist báo cáo sáng')}</span>
            <span style={{ fontSize: 11.5, color: 'var(--placeholder)' }}>{t('Chạy 08:00 mỗi sáng · đổi mã áp dụng từ báo cáo kế tiếp')}</span>
          </div>
          {wl && wl.tickers.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {wl.tickers.map((tk, i) => (
                <div key={tk} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, padding: '7px 10px', background: 'var(--bg)', borderRadius: 10 }}>
                  <span style={{ fontSize: 14, width: 20, textAlign: 'center', color: i < wl.deep ? 'var(--jade-deep)' : 'var(--placeholder)' }}>{['①', '②', '③', '④', '⑤'][i] || '•'}</span>
                  <span style={{ fontWeight: 800, width: 48, letterSpacing: '.5px' }}>{tk}</span>
                  {i < wl.deep && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '2px 8px', borderRadius: 99 }}>⭐ {t('phân tích sâu')}</span>
                  )}
                  <span style={{ flex: 1 }} />
                  {i > 0 && (
                    <Hover as="button" title={t('Đưa lên đầu (vào nhóm phân tích sâu)')} onClick={() => wlAct('top', tk)}
                      style={{ border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 8, width: 26, height: 26, cursor: 'pointer', fontSize: 13, lineHeight: 1, color: 'var(--ink-2)' }}
                      hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>↑</Hover>
                  )}
                  <Hover as="button" onClick={() => wlAct('remove', tk)}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--placeholder)', fontSize: 15, lineHeight: 1, padding: 2 }}
                    hover={{ color: '#C94F3D' }}>✕</Hover>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 12.5, color: 'var(--placeholder)', marginBottom: 12 }}>{t('Chưa có mã nào — thêm cổ phiếu để team CK phân tích mỗi sáng.')}</div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={wlForm} onChange={(e) => setWlForm(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter' && wlForm.trim()) wlAct('add', wlForm.trim()) }}
              placeholder={t('Mã')} style={{ ...pfInput, width: 80, fontWeight: 700, letterSpacing: '.5px' }} />
            <Hover as="button" onClick={() => wlForm.trim() && wlAct('add', wlForm.trim())} disabled={wlBusy}
              style={{ border: 'none', borderRadius: 10, padding: '9px 18px', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: wlBusy ? 'default' : 'pointer', background: 'var(--jade)', color: '#fff', opacity: wlBusy ? 0.6 : 1 }}
              hover={wlBusy ? {} : { background: 'var(--jade-deep)' }}>＋ {t('Thêm')}</Hover>
            {wlErr && <span style={{ fontSize: 12, color: '#C94F3D', fontWeight: 600 }}>{wlErr}</span>}
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: 'var(--placeholder)' }}>{t('Tối đa')} {wl?.max ?? 5} {t('mã')} · {wl?.deep ?? 2} {t('mã đầu chạy pipeline sâu')} · {t('gõ "theo dõi HPG" trong kênh hoặc Telegram cũng được')}</span>
          </div>
        </div>

        {/* result card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 22px', minHeight: 280 }}>
          {title ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                {busy && <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--jade)', animation: 'wfpulse 1.6s infinite', flex: 'none' }} />}
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.2px' }}>{title}</span>
              </div>
              <MarkdownLite text={result} />
            </>
          ) : (
            <div style={{ height: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--placeholder)', textAlign: 'center' }}>
              <div style={{ fontSize: 44 }}>📈</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-2)' }}>{t('Nhập mã cổ phiếu và chọn một hành động')}</div>
              <div style={{ fontSize: 13, maxWidth: 420, lineHeight: 1.55 }}>⚡ {t('nhanh (giá/tin/khối ngoại/vĩ mô, không tốn LLM) · 🧠 phân tích đầy đủ chạy pipeline đa-agent (vài phút). Công cụ nghiên cứu — không phải lời khuyên đầu tư.')}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
