import { type CSSProperties, type ReactNode } from 'react'

const codeStyle: CSSProperties = { fontFamily: 'var(--mono)', fontSize: '12.5px', color: '#28409E', background: '#E8ECFB', padding: '1px 7px', borderRadius: '6px', fontWeight: 600 }

function mdInline(str: string, kp: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let last = 0, m: RegExpExecArray | null, key = 0
  while ((m = re.exec(str))) {
    if (m.index > last) out.push(str.slice(last, m.index))
    const tok = m[0]
    if (tok[0] === '`') out.push(<code key={kp + '-' + key++} style={codeStyle}>{tok.slice(1, -1)}</code>)
    else out.push(<strong key={kp + '-' + key++} style={{ fontWeight: 700, color: '#16201C' }}>{tok.slice(2, -2)}</strong>)
    last = m.index + tok.length
  }
  if (last < str.length) out.push(str.slice(last))
  return out
}

const hStyles: Record<string, CSSProperties> = {
  h1: { fontSize: '27px', fontWeight: 800, letterSpacing: '-.5px', margin: '4px 0 14px', color: '#16201C' },
  h2: { fontSize: '20px', fontWeight: 800, letterSpacing: '-.3px', margin: '24px 0 12px', color: '#16201C' },
  h3: { fontSize: '15.5px', fontWeight: 700, margin: '18px 0 9px', color: '#16201C' },
}

/** MDX-lite renderer — ported from the prototype's renderMarkdown(). */
export function renderMarkdown(text: string): ReactNode {
  const lines = (text || '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0, key = 0
  while (i < lines.length) {
    const ln = lines[i]
    if (/^#\s/.test(ln)) { blocks.push(<div key={'b' + key++} style={hStyles.h1}>{mdInline(ln.replace(/^#\s/, ''), 'h' + key)}</div>); i++; continue }
    if (/^##\s/.test(ln)) { blocks.push(<div key={'b' + key++} style={hStyles.h2}>{mdInline(ln.replace(/^##\s/, ''), 'h' + key)}</div>); i++; continue }
    if (/^###\s/.test(ln)) { blocks.push(<div key={'b' + key++} style={hStyles.h3}>{mdInline(ln.replace(/^###\s/, ''), 'h' + key)}</div>); i++; continue }
    if (/^>\s/.test(ln)) {
      blocks.push(<div key={'b' + key++} style={{ borderLeft: '3px solid #3B5BDB', background: '#E8ECFB', padding: '10px 14px', borderRadius: '0 10px 10px 0', margin: '12px 0', fontSize: '14px', lineHeight: 1.6, color: '#28409E' }}>{mdInline(ln.replace(/^>\s/, ''), 'q' + key)}</div>)
      i++; continue
    }
    if (/^[-*]\s/.test(ln)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s/.test(lines[i])) { items.push(lines[i].replace(/^[-*]\s/, '')); i++ }
      blocks.push(<ul key={'b' + key++} style={{ margin: '6px 0 12px', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>{items.map((it, ix) => <li key={ix} style={{ fontSize: '14px', lineHeight: 1.6, color: '#16201C' }}>{mdInline(it, 'li' + key + ix)}</li>)}</ul>)
      continue
    }
    if (/^\d+\.\s/.test(ln)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, '')); i++ }
      blocks.push(<ol key={'b' + key++} style={{ margin: '6px 0 12px', paddingLeft: 22, display: 'flex', flexDirection: 'column', gap: 6 }}>{items.map((it, ix) => <li key={ix} style={{ fontSize: '14px', lineHeight: 1.6, color: '#16201C' }}>{mdInline(it, 'oli' + key + ix)}</li>)}</ol>)
      continue
    }
    if (ln.trim() === '') { i++; continue }
    blocks.push(<p key={'b' + key++} style={{ fontSize: '14px', lineHeight: 1.65, color: '#16201C', margin: '0 0 12px' }}>{mdInline(ln, 'p' + key)}</p>)
    i++
  }
  return <div>{blocks}</div>
}
