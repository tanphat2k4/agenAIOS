import { useEffect, useRef, useState } from 'react'
import { api, assetUrl } from '@/api/client'
import { useT } from '@/i18n'

// One speech bubble in page-pixel coordinates, tagged with its owning panel cell's rect
// so we can normalize positions (relative to the cell) when saving.
type Bubble = {
  panelNo: number; i: number; name: string; text: string
  x: number; y: number; w: number; h: number
  tailX: number; tailY: number
  cellX: number; cellY: number; cellW: number; cellH: number
}
type EditData = { bgUrl: string; pageW: number; pageH: number; bubbles: Bubble[] }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Visual drag-drop editor for a comic page's speech bubbles: move each bubble, drag its
 *  tail at the speaker, edit the text — then save. Positions are stored normalized to the
 *  panel cell so they survive the page being re-composed at a different scale. */
export function BubbleEditor({ comicId, pageNo, onClose, onSaved }: {
  comicId: string; pageNo: number; onClose: () => void; onSaved: () => void
}) {
  const t = useT()
  const [data, setData] = useState<EditData | null>(null)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const dragging = useRef(false)

  useEffect(() => {
    let ok = true
    api.get(`/comics/page/${comicId}/${pageNo}/edit`)
      .then((d: EditData) => { if (ok) { setData(d); setBubbles(d.bubbles) } })
      .catch((e) => ok && setErr(String(e?.message || e)))
    return () => { ok = false }
  }, [comicId, pageNo])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && editing === null) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, editing])

  const maxW = Math.min(660, window.innerWidth * 0.86)
  const maxH = window.innerHeight * 0.72
  const scale = data ? Math.min(maxW / data.pageW, maxH / data.pageH, 1) : 1

  const startDrag = (e: React.PointerEvent, idx: number, kind: 'move' | 'tail') => {
    e.preventDefault(); e.stopPropagation()
    if (editing !== null) return
    dragging.current = true
    const b = bubbles[idx]
    const ax = kind === 'move' ? b.x : b.tailX
    const ay = kind === 'move' ? b.y : b.tailY
    const dx = e.clientX - ax * scale
    const dy = e.clientY - ay * scale
    const move = (ev: PointerEvent) => {
      const nx = (ev.clientX - dx) / scale
      const ny = (ev.clientY - dy) / scale
      setBubbles((bs) => bs.map((bb, i) => i !== idx ? bb : (kind === 'move'
        ? { ...bb, x: clamp(nx, bb.cellX, bb.cellX + bb.cellW - bb.w), y: clamp(ny, bb.cellY, bb.cellY + bb.cellH - bb.h) }
        : { ...bb, tailX: clamp(nx, bb.cellX, bb.cellX + bb.cellW), tailY: clamp(ny, bb.cellY, bb.cellY + bb.cellH) })))
    }
    const up = () => {
      dragging.current = false
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const save = () => {
    setBusy(true); setErr('')
    const payload = {
      bubbles: bubbles.map((b) => ({
        panelNo: b.panelNo, i: b.i,
        nx: (b.x - b.cellX) / b.cellW, ny: (b.y - b.cellY) / b.cellH,
        tnx: (b.tailX - b.cellX) / b.cellW, tny: (b.tailY - b.cellY) / b.cellH,
        text: b.text,
      })),
    }
    api.post(`/comics/page/${comicId}/${pageNo}/bubbles`, payload)
      .then(() => { onSaved(); onClose() })
      .catch((e) => { setErr(String(e?.message || e)); setBusy(false) })
  }

  const reset = () => {
    setBusy(true); setErr('')
    api.post(`/comics/page/${comicId}/${pageNo}/bubbles`, { reset: true })
      .then(() => { onSaved(); onClose() })
      .catch((e) => { setErr(String(e?.message || e)); setBusy(false) })
  }

  const btn = (label: string, onClick: () => void, primary?: boolean, danger?: boolean): React.ReactNode => (
    <button onClick={onClick} disabled={busy}
      style={{
        border: '1px solid ' + (primary ? 'var(--jade)' : 'var(--line)'), borderRadius: 9,
        background: primary ? 'var(--jade)' : danger ? '#FBEAE7' : 'var(--surface)',
        color: primary ? '#fff' : danger ? 'var(--danger)' : 'var(--ink)',
        padding: '8px 16px', font: 'inherit', fontSize: 13, fontWeight: 600,
        cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
      }}>{label}</button>
  )

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,12,11,.86)', zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg)', borderRadius: 16, border: '1px solid var(--line)', padding: 16, maxHeight: '94vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>✎ {t('Chỉnh bóng thoại')} — {t('Trang')} {pageNo}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>{t('Kéo bóng để dời · kéo chấm cam để chỉnh đuôi · bấm đúp để sửa chữ')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {btn(t('Đặt lại tự động'), reset, false, true)}
            {btn(t('Hủy'), onClose)}
            {btn(busy ? t('Đang lưu…') : t('Lưu'), save, true)}
          </div>
        </div>
        {err && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
        {!data ? (
          <div style={{ width: 420, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)', fontSize: 13 }}>{t('Đang tải trang…')}</div>
        ) : (
          <div style={{ position: 'relative', width: data.pageW * scale, height: data.pageH * scale, touchAction: 'none', userSelect: 'none' }}>
            <img src={assetUrl(data.bgUrl)} alt="" draggable={false}
              style={{ width: data.pageW * scale, height: data.pageH * scale, display: 'block', borderRadius: 6 }} />
            {/* dashed connectors from each bubble to its tail target */}
            <svg width={data.pageW * scale} height={data.pageH * scale} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {bubbles.map((b, i) => (
                <line key={i} x1={(b.x + b.w / 2) * scale} y1={(b.y + b.h / 2) * scale} x2={b.tailX * scale} y2={b.tailY * scale}
                  stroke="#E8590C" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
              ))}
            </svg>
            {bubbles.map((b, idx) => (
              <div key={idx}>
                {/* bubble box */}
                <div onPointerDown={(e) => startDrag(e, idx, 'move')} onDoubleClick={() => setEditing(idx)}
                  style={{
                    position: 'absolute', left: b.x * scale, top: b.y * scale, width: b.w * scale, minHeight: b.h * scale,
                    background: 'rgba(255,255,255,.96)', border: '2px solid #141414', borderRadius: 12 * scale + 4,
                    boxShadow: editing === idx ? '0 0 0 3px var(--jade)' : '0 1px 4px rgba(0,0,0,.25)',
                    cursor: editing === idx ? 'text' : 'move', padding: `${6 * scale + 2}px ${8 * scale + 3}px`,
                    fontSize: Math.max(10, (b.name ? 13 : 13) * scale + 3), lineHeight: 1.25, overflow: 'hidden', boxSizing: 'border-box',
                  }}>
                  {b.name && <span style={{ fontWeight: 700, color: '#A03C0A' }}>{b.name}: </span>}
                  {editing === idx ? (
                    <textarea autoFocus value={b.text}
                      onChange={(e) => setBubbles((bs) => bs.map((bb, i) => i === idx ? { ...bb, text: e.target.value } : bb))}
                      onBlur={() => setEditing(null)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setEditing(null) } }}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', font: 'inherit', color: '#141414', resize: 'none', minHeight: 40, padding: 0 }} />
                  ) : <span style={{ color: '#141414' }}>{b.text}</span>}
                </div>
                {/* tail handle */}
                <div onPointerDown={(e) => startDrag(e, idx, 'tail')} title={t('Kéo tới mặt người nói')}
                  style={{
                    position: 'absolute', left: b.tailX * scale - 9, top: b.tailY * scale - 9, width: 18, height: 18,
                    borderRadius: 99, background: '#E8590C', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.4)',
                    cursor: 'grab', zIndex: 2,
                  }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
