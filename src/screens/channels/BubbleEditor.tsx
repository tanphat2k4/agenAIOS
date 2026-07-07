import { useEffect, useRef, useState } from 'react'
import { api, assetUrl } from '@/api/client'
import { useT } from '@/i18n'

// One speech bubble in page-pixel coordinates, tagged with its owning panel cell's rect
// so we can normalize positions (relative to the cell) when saving.
type Bubble = {
  panelNo: number; i: number; name: string; text: string; hidden?: boolean
  x: number; y: number; w: number; h: number
  tailX: number; tailY: number
  cellX: number; cellY: number; cellW: number; cellH: number
}
type EditData = { bgUrl: string; pageW: number; pageH: number; bubbles: Bubble[] }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), v))

/** Visual drag-drop editor for a comic page's speech bubbles: move each bubble, drag its
 *  tail at the speaker, edit or delete the text — then save. Positions are stored normalized
 *  to the panel cell so they survive the page being re-composed at a different scale. */
export function BubbleEditor({ comicId, pageNo, onClose, onSaved }: {
  comicId: string; pageNo: number; onClose: () => void; onSaved: () => void
}) {
  const t = useT()
  const [data, setData] = useState<EditData | null>(null)
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [editing, setEditing] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const editingRef = useRef<number | null>(null)
  editingRef.current = editing

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
  const maxH = window.innerHeight * 0.7
  const scale = data ? Math.min(maxW / data.pageW, maxH / data.pageH, 1) : 1

  const setB = (idx: number, patch: Partial<Bubble> | ((b: Bubble) => Partial<Bubble>)) =>
    setBubbles((bs) => bs.map((b, i) => i === idx ? { ...b, ...(typeof patch === 'function' ? patch(b) : patch) } : b))

  // Robust drag via pointer capture: all move/up events route to the grabbed element even
  // when the cursor leaves it, so dragging never "sticks" or drops.
  const startDrag = (e: React.PointerEvent, idx: number, kind: 'move' | 'tail') => {
    if (editingRef.current !== null) return
    e.preventDefault(); e.stopPropagation()
    const el = e.currentTarget as HTMLElement
    try { el.setPointerCapture(e.pointerId) } catch { /* noop */ }
    const b = bubbles[idx]
    const sx = e.clientX, sy = e.clientY
    const ox = kind === 'move' ? b.x : b.tailX
    const oy = kind === 'move' ? b.y : b.tailY
    const onMove = (ev: PointerEvent) => {
      const px = ox + (ev.clientX - sx) / scale
      const py = oy + (ev.clientY - sy) / scale
      setB(idx, (bb) => kind === 'move'
        ? { x: clamp(px, bb.cellX, bb.cellX + bb.cellW - bb.w), y: clamp(py, bb.cellY, bb.cellY + bb.cellH - bb.h) }
        : { tailX: clamp(px, bb.cellX, bb.cellX + bb.cellW), tailY: clamp(py, bb.cellY, bb.cellY + bb.cellH) })
    }
    const onUp = () => {
      try { el.releasePointerCapture(e.pointerId) } catch { /* noop */ }
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
  }

  const post = (body: unknown) => {
    setBusy(true); setErr('')
    api.post(`/comics/page/${comicId}/${pageNo}/bubbles`, body)
      .then(() => { onSaved(); onClose() })
      .catch((e) => { setErr(String(e?.message || e)); setBusy(false) })
  }
  const save = () => post({
    bubbles: bubbles.map((b) => ({
      panelNo: b.panelNo, i: b.i,
      nx: (b.x - b.cellX) / b.cellW, ny: (b.y - b.cellY) / b.cellH,
      tnx: (b.tailX - b.cellX) / b.cellW, tny: (b.tailY - b.cellY) / b.cellH,
      text: b.text, hidden: !!b.hidden,
    })),
  })
  const reset = () => post({ reset: true })

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

  const hidden = bubbles.filter((b) => b.hidden)

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(10,12,11,.86)', zIndex: 95, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg)', borderRadius: 16, border: '1px solid var(--line)', padding: 16, maxHeight: '94vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>✎ {t('Chỉnh bóng thoại')} — {t('Trang')} {pageNo}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>{t('Kéo bóng để dời · kéo chấm cam chỉnh đuôi · bấm đúp sửa chữ · ✕ để ẩn')}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {btn(t('Đặt lại tự động'), reset, false, true)}
            {btn(t('Hủy'), onClose)}
            {btn(busy ? t('Đang lưu…') : t('Lưu'), save, true)}
          </div>
        </div>
        {err && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 8 }}>{err}</div>}
        {hidden.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10, padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10 }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink-2)' }}>{t('Đã ẩn')}:</span>
            {bubbles.map((b, idx) => b.hidden ? (
              <button key={idx} onClick={() => setB(idx, { hidden: false })} title={t('Hiện lại')}
                style={{ border: '1px solid var(--line)', borderRadius: 99, background: 'var(--bg)', color: 'var(--ink)', padding: '3px 10px', font: 'inherit', fontSize: 11.5, cursor: 'pointer' }}>
                ↩ {b.name ? b.name + ': ' : ''}{b.text.slice(0, 16)}{b.text.length > 16 ? '…' : ''}
              </button>
            ) : null)}
          </div>
        )}
        {!data ? (
          <div style={{ width: 420, height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-2)', fontSize: 13 }}>{t('Đang tải trang…')}</div>
        ) : (
          <div style={{ position: 'relative', width: data.pageW * scale, height: data.pageH * scale, touchAction: 'none', userSelect: 'none' }}>
            <img src={assetUrl(data.bgUrl)} alt="" draggable={false}
              style={{ width: data.pageW * scale, height: data.pageH * scale, display: 'block', borderRadius: 6, background: 'rgb(245,240,228)' }} />
            {/* dashed connectors bubble → tail target (visible bubbles only) */}
            <svg width={data.pageW * scale} height={data.pageH * scale} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {bubbles.map((b, i) => b.hidden ? null : (
                <line key={i} x1={(b.x + b.w / 2) * scale} y1={(b.y + b.h / 2) * scale} x2={b.tailX * scale} y2={b.tailY * scale}
                  stroke="#E8590C" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.7} />
              ))}
            </svg>
            {bubbles.map((b, idx) => b.hidden ? null : (
              <div key={idx}>
                {/* bubble box — whole box is the drag handle */}
                <div onPointerDown={(e) => startDrag(e, idx, 'move')} onDoubleClick={() => setEditing(idx)}
                  style={{
                    position: 'absolute', left: b.x * scale, top: b.y * scale, width: b.w * scale, minHeight: b.h * scale,
                    background: 'rgba(255,255,255,.97)', border: '2px solid #141414', borderRadius: 12 * scale + 4,
                    boxShadow: editing === idx ? '0 0 0 3px var(--jade)' : '0 1px 4px rgba(0,0,0,.25)',
                    cursor: editing === idx ? 'text' : 'grab', padding: `${6 * scale + 2}px ${8 * scale + 3}px`,
                    fontSize: Math.max(10, 13 * scale + 3), lineHeight: 1.25, overflow: 'hidden', boxSizing: 'border-box', touchAction: 'none',
                  }}>
                  {b.name && <span style={{ fontWeight: 700, color: '#A03C0A' }}>{b.name}: </span>}
                  {editing === idx ? (
                    <textarea autoFocus value={b.text}
                      onChange={(e) => setB(idx, { text: e.target.value })}
                      onBlur={() => setEditing(null)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); setEditing(null) } }}
                      onPointerDown={(e) => e.stopPropagation()}
                      style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', font: 'inherit', color: '#141414', resize: 'none', minHeight: 40, padding: 0 }} />
                  ) : <span style={{ color: '#141414' }}>{b.text}</span>}
                </div>
                {/* delete (hide) button */}
                <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setEditing(null); setB(idx, { hidden: true }) }}
                  title={t('Ẩn bóng này')}
                  style={{
                    position: 'absolute', left: (b.x + b.w) * scale - 11, top: b.y * scale - 11, width: 22, height: 22,
                    borderRadius: 99, background: '#C0392B', color: '#fff', border: '2px solid #fff', boxShadow: '0 1px 4px rgba(0,0,0,.4)',
                    fontSize: 12, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, zIndex: 3,
                  }}>✕</button>
                {/* tail handle */}
                <div onPointerDown={(e) => startDrag(e, idx, 'tail')} title={t('Kéo tới mặt người nói')}
                  style={{
                    position: 'absolute', left: b.tailX * scale - 11, top: b.tailY * scale - 11, width: 22, height: 22,
                    borderRadius: 99, background: '#E8590C', border: '3px solid #fff', boxShadow: '0 1px 5px rgba(0,0,0,.45)',
                    cursor: 'grab', zIndex: 2, touchAction: 'none',
                  }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
