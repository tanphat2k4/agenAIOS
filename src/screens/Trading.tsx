import { useState } from 'react'
import { api } from '@/api/client'
import { Hover } from '@/components/ui/Hover'
import { useStore } from '@/store'
import { MarkdownLite } from '@/components/MarkdownLite'

const SUGGEST = ['FPT', 'VCB', 'HPG', 'VNM', 'MWG', 'SSI', 'VHM', 'VIB']

type Action = { key: string; label: string; slow?: boolean }
const ACTIONS: Action[] = [
  { key: 'snapshot', label: 'Giá + chỉ báo' },
  { key: 'news', label: 'Tin tức' },
  { key: 'extras', label: 'Khối ngoại' },
  { key: 'macro', label: 'Vĩ mô (tỷ giá/lãi suất)' },
  { key: 'analyze', label: 'Phân tích đầy đủ', slow: true },
  { key: 'pipeline', label: 'Pipeline 5-agent', slow: true },
]

export function Trading() {
  const refreshOps = useStore((s) => s.refreshTradingOps)
  const [ticker, setTicker] = useState('FPT')
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [result, setResult] = useState('')

  const runFast = async (key: string, label: string) => {
    const t = ticker.trim().toUpperCase()
    if (!t && key !== 'macro') return
    setBusy(true)
    setTitle(label + (key === 'macro' ? '' : ' · ' + t))
    setResult('Đang tải…')
    try {
      const path =
        key === 'macro' ? '/trading/macro'
          : key === 'news' ? `/trading/news/${encodeURIComponent(t)}?days=7`
            : `/trading/${key}/${encodeURIComponent(t)}`
      const r = await api.get(path)
      setResult(r.text || '(không có kết quả)')
      refreshOps()
    } catch (e) {
      setResult('Lỗi: ' + (e instanceof Error ? e.message : 'unknown'))
    } finally {
      setBusy(false)
    }
  }

  const runAnalyze = async () => {
    const t = ticker.trim().toUpperCase()
    if (!t || busy) return
    setBusy(true)
    setTitle('Phân tích đầy đủ · ' + t)
    setResult('⏳ Đang chạy pipeline đa-agent (analyst → tranh luận → trader → rủi ro → portfolio). Lần đầu có thể mất vài phút; kết quả được lưu cache trong ngày…')
    try {
      await api.post('/trading/analyze', { ticker: t })
      const poll = async () => {
        try {
          const r = await api.get(`/trading/analyze?ticker=${encodeURIComponent(t)}`)
          if (r.status === 'done' || r.status === 'error') {
            setResult(r.result || '(không có kết quả)')
            setBusy(false)
            refreshOps()
          } else {
            setTimeout(poll, 3000)
          }
        } catch (e) {
          setResult('Lỗi khi chờ kết quả: ' + (e instanceof Error ? e.message : 'unknown'))
          setBusy(false)
        }
      }
      setTimeout(poll, 3000)
    } catch (e) {
      setResult('Lỗi: ' + (e instanceof Error ? e.message : 'unknown'))
      setBusy(false)
    }
  }

  const runPipeline = async () => {
    const t = ticker.trim().toUpperCase()
    if (!t || busy) return
    setBusy(true)
    setTitle('Pipeline 5-agent · ' + t)
    setResult('⏳ 5 agent đang chạy lần lượt: Analyst → Researcher → Trader → Risk → Portfolio (mỗi con 1 lượt 9Router)…')
    try {
      await api.post('/trading/pipeline', { ticker: t })
      const poll = async () => {
        try {
          const r = await api.get(`/trading/pipeline?ticker=${encodeURIComponent(t)}`)
          if (r.status === 'done' || r.status === 'error') {
            setResult(r.result || '(không có kết quả)')
            setBusy(false)
            refreshOps()
          } else {
            setTimeout(poll, 3000)
          }
        } catch (e) {
          setResult('Lỗi khi chờ kết quả: ' + (e instanceof Error ? e.message : 'unknown'))
          setBusy(false)
        }
      }
      setTimeout(poll, 3000)
    } catch (e) {
      setResult('Lỗi: ' + (e instanceof Error ? e.message : 'unknown'))
      setBusy(false)
    }
  }

  const onAction = (a: Action) => (a.key === 'analyze' ? runAnalyze() : a.key === 'pipeline' ? runPipeline() : runFast(a.key, a.label))

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px' }}>
        <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › Chứng khoán</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>Chứng khoán VN 📈</span>
          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Phân tích đa-agent qua TradingAgents · dữ liệu vnstock/FireAnt</span>
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
                placeholder="Mã CK (vd FPT)"
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
                {a.slow ? '🧠' : '⚡'} {a.label}
              </Hover>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 13, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--placeholder)', fontWeight: 600 }}>Gợi ý:</span>
            {SUGGEST.map((t) => (
              <Hover as="button" key={t} onClick={() => setTicker(t)}
                style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '4px 11px', font: 'inherit', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>{t}</Hover>
            ))}
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
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-2)' }}>Nhập mã cổ phiếu và chọn một hành động</div>
              <div style={{ fontSize: 13, maxWidth: 420, lineHeight: 1.55 }}>⚡ nhanh (giá/tin/khối ngoại/vĩ mô, không tốn LLM) · 🧠 phân tích đầy đủ chạy pipeline đa-agent (vài phút). Công cụ nghiên cứu — không phải lời khuyên đầu tư.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
