import { useRef } from 'react'
import { useStore } from '@/store'
import { Hover } from '@/components/ui/Hover'
import { renderMarkdown } from '@/lib/markdown'

const editorTypeDefs = ['rule', 'skill', 'agent', 'knowledge', 'note', 'account'] as const
type EditorTypeDef = typeof editorTypeDefs[number]

const stop = (e: React.MouseEvent) => e.stopPropagation()

function RadioDot({ on }: { on: boolean }) {
  return (
    <span style={{ width: 15, height: 15, borderRadius: 99, border: '2px solid var(--jade)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      {on && <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--jade)' }} />}
    </span>
  )
}

export function Editor() {
  const s = useStore()
  const taRef = useRef<HTMLTextAreaElement>(null)

  // ---- toolbar helpers (ported from wrapSel / linePrefix) ----
  const wrapSel = (before: string, after: string) => {
    const el = taRef.current
    if (!el) return
    const { selectionStart: a, selectionEnd: b, value: v } = el
    const sel = v.slice(a, b) || 'text'
    const next = v.slice(0, a) + before + sel + after + v.slice(b)
    s.onEditorText(next)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = a + before.length
      el.selectionEnd = a + before.length + sel.length
    })
  }

  const linePrefix = (prefix: string) => {
    const el = taRef.current
    if (!el) return
    const { selectionStart: a, value: v } = el
    const lineStart = v.lastIndexOf('\n', a - 1) + 1
    const next = v.slice(0, lineStart) + prefix + v.slice(lineStart)
    s.onEditorText(next)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = a + prefix.length
    })
  }

  // ---- computed view model (ported from renderVals) ----
  const editorTypes = editorTypeDefs.map((t: EditorTypeDef) => {
    const sel = t === s.editorType
    return {
      key: t,
      label: t.charAt(0).toUpperCase() + t.slice(1),
      onSelect: () => s.setEditorType(t),
      bg: sel ? 'var(--jade-soft)' : 'var(--surface)',
      fg: sel ? 'var(--jade-deep)' : 'var(--ink-2)',
      border: sel ? 'var(--jade)' : 'var(--line)',
      weight: sel ? 700 : 500,
    }
  })

  const assignedCount = Object.values(s.editorAgentsChecked).filter(Boolean).length
  const assignedLabel = assignedCount + '/15'

  const editorAgentRows = s.editorAgents.map((a) => {
    const on = !!s.editorAgentsChecked[a.id]
    return {
      id: a.id, name: a.name, sub: a.sub || '', hasSub: !!a.sub, initial: a.initial, color: a.color,
      onToggle: () => s.toggleEditorAgent(a.id),
      boxBg: on ? 'var(--jade)' : 'var(--surface)',
      boxBorder: on ? 'var(--jade)' : 'var(--line)',
      check: on ? '✓' : '',
    }
  })

  const showEditorPane = s.editorMode !== 'preview'
  const showPreviewPane = s.editorMode !== 'edit'

  const editModeBg = s.editorMode === 'edit' ? 'var(--surface)' : 'transparent'
  const editModeFg = s.editorMode === 'edit' ? 'var(--jade-deep)' : 'rgba(255,255,255,.7)'
  const splitModeBg = s.editorMode === 'split' ? 'var(--surface)' : 'transparent'
  const splitModeFg = s.editorMode === 'split' ? 'var(--jade-deep)' : 'rgba(255,255,255,.7)'
  const previewModeBg = s.editorMode === 'preview' ? 'var(--surface)' : 'transparent'
  const previewModeFg = s.editorMode === 'preview' ? 'var(--jade-deep)' : 'rgba(255,255,255,.7)'

  const loadOndemand = s.editorLoadMode === 'on_demand'
  const loadBoot = s.editorLoadMode === 'boot'
  const visPublic = s.editorVisibility === 'public'
  const visPrivate = s.editorVisibility === 'private'

  const showCancelConfirm = s.editorConfirm === 'cancel'
  const showSubmitConfirm = s.editorConfirm === 'submit'

  const tbBtn = (label: string, onClick: () => void, extraStyle?: React.CSSProperties) => (
    <Hover as="button" onClick={onClick}
      style={{ border: 'none', background: 'transparent', color: 'var(--ink-2)', borderRadius: 7, padding: '6px 9px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', ...extraStyle }}
      hover={{ background: 'var(--jade-soft)', color: 'var(--jade-deep)' }}>{label}</Hover>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ===== TOP BAR ===== */}
      <div style={{ flex: 'none', height: 58, background: 'var(--jade-deep)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <Hover as="button" onClick={s.askCancelEditor} title="Quay lại"
            style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 16, cursor: 'pointer' }}
            hover={{ background: 'rgba(255,255,255,.24)' }}>←</Hover>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Knowledge editor</span>
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.3px', color: '#fff', background: 'rgba(255,255,255,.18)', padding: '3px 10px', borderRadius: 99 }}>knowledge</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'rgba(255,255,255,.65)' }}>k-325</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* segmented mode toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,.14)', borderRadius: 99, padding: 3 }}>
            <button onClick={() => s.setEditorMode('edit')}
              style={{ border: 'none', background: editModeBg, color: editModeFg, borderRadius: 99, padding: '6px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Edit</button>
            <button onClick={() => s.setEditorMode('split')}
              style={{ border: 'none', background: splitModeBg, color: splitModeFg, borderRadius: 99, padding: '6px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Split</button>
            <button onClick={() => s.setEditorMode('preview')}
              style={{ border: 'none', background: previewModeBg, color: previewModeFg, borderRadius: 99, padding: '6px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Preview</button>
          </div>
          <Hover as="button" onClick={s.askCancelEditor}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', borderRadius: 99, padding: '8px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            hover={{ background: 'rgba(255,255,255,.24)' }}>✕ Cancel</Hover>
          <Hover as="button" onClick={s.askSubmitEditor}
            style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: '#fff', color: 'var(--jade-deep)', borderRadius: 99, padding: '8px 18px', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
            hover={{ opacity: 0.9 }}>✓ Submit changes</Hover>
        </div>
      </div>

      {/* ===== MAIN AREA ===== */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* ===== LEFT SETTINGS PANEL ===== */}
        <aside style={{ width: 300, flex: 'none', background: 'var(--surface)', borderRight: '1px solid var(--line)', overflowY: 'auto', padding: '18px 18px 30px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)' }}>Entry settings</div>
              <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px', marginTop: 2 }}>Cấu hình entry</div>
            </div>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '3px 9px', borderRadius: 7 }}>k-325</span>
          </div>

          {/* Type grid */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 8 }}>Type</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 7, marginBottom: 20 }}>
            {editorTypes.map((t) => (
              <Hover key={t.key} as="button" onClick={t.onSelect}
                style={{ border: `1px solid ${t.border}`, background: t.bg, color: t.fg, borderRadius: 10, padding: '9px 4px', font: 'inherit', fontSize: 12, fontWeight: t.weight, cursor: 'pointer' }}
                hover={{ borderColor: 'var(--jade)' }}>{t.label}</Hover>
            ))}
          </div>

          {/* Title */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>Title *</label>
          <input
            value={s.editorTitle}
            onChange={(e) => s.onEditorTitle(e.target.value)}
            placeholder="Tên entry"
            style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, padding: '11px 13px', background: 'transparent', color: 'var(--ink)', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
          />

          {/* Category */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>Category</label>
          <input
            value={s.editorCategory}
            onChange={(e) => s.onEditorCategory(e.target.value)}
            placeholder="vd. zy-novel"
            style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, padding: '11px 13px', background: 'transparent', color: 'var(--ink)', outline: 'none', marginBottom: 16, boxSizing: 'border-box' }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
          />

          {/* Tags */}
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>Tags <span style={{ textTransform: 'none', fontWeight: 500, color: 'var(--placeholder)' }}>phẩy ngăn cách</span></label>
          <input
            value={s.editorTags}
            onChange={(e) => s.onEditorTags(e.target.value)}
            placeholder="php, slim4, backend"
            style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 11, fontFamily: 'inherit', fontSize: 13.5, padding: '11px 13px', background: 'transparent', color: 'var(--ink)', outline: 'none', marginBottom: 20, boxSizing: 'border-box' }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
            onBlur={(e) => (e.target.style.borderColor = 'var(--line)')}
          />

          {/* Load mode */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 3 }}>Menu load mode</div>
          <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 9 }}>cách agent load entry này</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <div onClick={() => s.setEditorLoadMode('on_demand')}
              style={{ flex: 1, border: `1.5px solid ${loadOndemand ? 'var(--jade)' : 'var(--line)'}`, background: loadOndemand ? 'var(--jade-soft)' : 'var(--surface)', borderRadius: 11, padding: 11, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <RadioDot on={loadOndemand} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>on_demand</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-2)', paddingLeft: 23 }}>load khi chạm scope</div>
            </div>
            <div onClick={() => s.setEditorLoadMode('boot')}
              style={{ flex: 1, border: `1.5px solid ${loadBoot ? 'var(--jade)' : 'var(--line)'}`, background: loadBoot ? 'var(--jade-soft)' : 'var(--surface)', borderRadius: 11, padding: 11, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <RadioDot on={loadBoot} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>boot</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-2)', paddingLeft: 23 }}>auto load đầu phiên</div>
            </div>
          </div>

          {/* Visibility */}
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 3 }}>Visibility</div>
          <div style={{ fontSize: 11, color: 'var(--ink-2)', marginBottom: 9 }}>ai thấy entry này</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <div onClick={() => s.setEditorVisibility('public')}
              style={{ flex: 1, border: `1.5px solid ${visPublic ? 'var(--jade)' : 'var(--line)'}`, background: visPublic ? 'var(--jade-soft)' : 'var(--surface)', borderRadius: 11, padding: 11, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <RadioDot on={visPublic} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>Public</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-2)', paddingLeft: 23 }}>mọi member tenant thấy</div>
            </div>
            <div onClick={() => s.setEditorVisibility('private')}
              style={{ flex: 1, border: `1.5px solid ${visPrivate ? 'var(--jade)' : 'var(--line)'}`, background: visPrivate ? 'var(--jade-soft)' : 'var(--surface)', borderRadius: 11, padding: 11, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <RadioDot on={visPrivate} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)' }}>Private</span>
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--ink-2)', paddingLeft: 23 }}>chỉ bạn + Owner</div>
            </div>
          </div>

          {/* Assigned agents */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)' }}>Assigned agents</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--jade-deep)' }}>{assignedLabel}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', borderRadius: 10, padding: '8px 11px', marginBottom: 10 }}>
            <span style={{ color: 'var(--placeholder)', fontSize: 13 }}>🔍</span>
            <input placeholder="Tìm agent theo tên, slug…" style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 12, background: 'transparent', color: 'var(--ink)' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {editorAgentRows.map((ag) => (
              <Hover key={ag.id} onClick={ag.onToggle}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 8px', borderRadius: 10, cursor: 'pointer' }}
                hover={{ background: 'var(--bg)' }}>
                <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${ag.boxBorder}`, background: ag.boxBg, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>{ag.check}</span>
                <div style={{ width: 28, height: 28, borderRadius: 99, background: ag.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>{ag.initial}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ag.name}</div>
                  {ag.hasSub && <div style={{ fontSize: 10.5, color: 'var(--placeholder)' }}>{ag.sub}</div>}
                </div>
              </Hover>
            ))}
          </div>
        </aside>

        {/* ===== EDITOR PANE ===== */}
        {showEditorPane && (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--line)', background: 'var(--surface)' }}>
            {/* toolbar */}
            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 3, padding: '9px 14px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
              {tbBtn('H1', () => linePrefix('# '), { fontWeight: 700 })}
              {tbBtn('H2', () => linePrefix('## '), { fontWeight: 700 })}
              {tbBtn('H3', () => linePrefix('### '), { fontWeight: 700 })}
              <span style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 5px' }} />
              {tbBtn('B', () => wrapSel('**', '**'), { fontSize: 13, fontWeight: 800 })}
              {tbBtn('i', () => wrapSel('*', '*'), { fontSize: 13, fontStyle: 'italic', fontWeight: 600 })}
              {tbBtn('</>', () => wrapSel('`', '`'), { fontSize: 13, fontWeight: 700 })}
              <span style={{ width: 1, height: 18, background: 'var(--line)', margin: '0 5px' }} />
              {tbBtn('• list', () => linePrefix('- '))}
              {tbBtn('1. list', () => linePrefix('1. '))}
              {tbBtn('quote', () => linePrefix('> '))}
              {tbBtn('link', () => wrapSel('[', '](url)'))}
              <Hover as="button"
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'var(--jade-soft)', color: 'var(--jade-deep)', borderRadius: 99, padding: '7px 14px', font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                hover={{ background: 'var(--jade)', color: '#fff' }}>✦ AI Tối Ưu</Hover>
            </div>
            {/* textarea */}
            <textarea
              ref={taRef}
              value={s.editorText}
              onChange={(e) => s.onEditorText(e.target.value)}
              spellCheck={false}
              style={{ flex: 1, width: '100%', border: 'none', outline: 'none', resize: 'none', fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.7, color: 'var(--ink)', background: 'var(--surface)', padding: '18px 22px', boxSizing: 'border-box' }}
            />
          </div>
        )}

        {/* ===== PREVIEW PANE ===== */}
        {showPreviewPane && (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 22px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>👁 Preview</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, fontWeight: 700, color: 'var(--placeholder)', background: 'var(--surface)', border: '1px solid var(--line)', padding: '3px 9px', borderRadius: 6 }}>MDX-lite</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '26px 30px 40px' }}>
              <div style={{ maxWidth: 680 }}>
                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '.3px', color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '4px 12px', borderRadius: 99, marginBottom: 18 }}>knowledge</span>
                {renderMarkdown(s.editorText)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== CANCEL CONFIRM ===== */}
      {showCancelConfirm && (
        <div onClick={s.dismissEditorConfirm} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, animation: 'fadeIn .15s ease' }}>
          <div onClick={stop} style={{ width: 420, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 22, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.28)', animation: 'pop .2s ease both' }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--warn-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 16 }}>💾</div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 8 }}>Lưu thay đổi trước khi thoát?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 24 }}>Bạn có thay đổi chưa lưu. Lưu lại hay thoát mà không lưu?</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Hover as="button" onClick={s.dismissEditorConfirm}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 18px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--line)' }}>Tiếp tục sửa</Hover>
              <Hover as="button" onClick={s.closeEditor}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', background: 'transparent', border: '1px solid var(--danger)', borderRadius: 99, padding: '11px 18px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: '#FBEAE7' }}>Thoát không lưu</Hover>
              <Hover as="button" onClick={s.closeEditor}
                style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade-deep)' }}>Lưu &amp; thoát</Hover>
            </div>
          </div>
        </div>
      )}

      {/* ===== SUBMIT CONFIRM ===== */}
      {showSubmitConfirm && (
        <div onClick={s.dismissEditorConfirm} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, animation: 'fadeIn .15s ease' }}>
          <div onClick={stop} style={{ width: 420, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 22, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.28)', animation: 'pop .2s ease both' }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 16 }}>✓</div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 8 }}>Gửi thay đổi để duyệt?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 24 }}>Bạn có chắc muốn submit entry này? Thay đổi sẽ được gửi vào Hub chờ duyệt.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={s.dismissEditorConfirm}
                style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--line)' }}>Hủy</Hover>
              <Hover as="button" onClick={s.closeEditor}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade-deep)' }}>Xác nhận submit</Hover>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
