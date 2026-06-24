import { Fragment, type CSSProperties, type ReactNode } from 'react'
import type { MsgBlock, RichSpan } from '@/data/richText'

const code: CSSProperties = { fontFamily: 'var(--mono)', fontSize: '12.5px', color: '#28409E', background: '#E8ECFB', padding: '1px 7px', borderRadius: 6, fontWeight: 600, whiteSpace: 'nowrap' }
const mention: CSSProperties = { color: '#28409E', fontWeight: 700, background: '#E8ECFB', padding: '1px 7px', borderRadius: 99 }
const amber: CSSProperties = { color: '#9A6A1B', fontWeight: 700, fontSize: '12px', background: '#FBF1DE', padding: '2px 9px', borderRadius: 99 }
const link: CSSProperties = { color: '#28409E', fontWeight: 600, fontFamily: 'var(--mono)', fontSize: '12.5px', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px' }

export function renderRich(rich: RichSpan[]): ReactNode {
  return rich.map((s, i) => {
    if (s.isCode) return <code key={i} style={code}>{s.v}</code>
    if (s.isMention) return <span key={i} style={mention}>{s.v}</span>
    if (s.isBold) return <strong key={i} style={{ fontWeight: 700, color: '#16201C' }}>{s.v}</strong>
    if (s.isAmber) return <span key={i} style={amber}>{s.v}</span>
    if (s.isLink) return <span key={i} style={link}>{s.v}</span>
    return <Fragment key={i}>{s.v}</Fragment>
  })
}

export type RenderedBlock =
  | { isPara: true; node: ReactNode }
  | { isList: true; items: { num: number; node: ReactNode }[] }
  | { isAttach: true; icon: string; name: string; label: string }
  | { isTask: true; code: string; text: string }

export function buildBlocks(raw: MsgBlock[]): RenderedBlock[] {
  return raw.map((bl): RenderedBlock => {
    if (bl.kind === 'para') return { isPara: true, node: <span>{renderRich(bl.rich)}</span> }
    if (bl.kind === 'list') return { isList: true, items: bl.items.map((it, i) => ({ num: i + 1, node: <span>{renderRich(it)}</span> })) }
    if (bl.kind === 'attach') return { isAttach: true, icon: bl.icon, name: bl.name, label: bl.label }
    return { isTask: true, code: bl.code, text: bl.text }
  })
}
