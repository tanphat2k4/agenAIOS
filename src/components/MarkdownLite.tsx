import React from 'react'

// Tiny dependency-free Markdown renderer for analyze reports / tool output.
// Handles: # headers, **bold**, `code`, - lists, > quotes, | tables |, paragraphs.

function inline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g
  let last = 0
  let key = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] != null) {
      out.push(<b key={key++} style={{ fontWeight: 700, color: 'var(--ink)' }}>{m[1]}</b>)
    } else {
      out.push(<code key={key++} style={{ fontFamily: 'var(--mono)', fontSize: '.9em', background: 'var(--bg)', padding: '1px 5px', borderRadius: 5 }}>{m[2]}</code>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const isSep = (cells: string[]) => cells.every((c) => /^:?-+:?$/.test(c))

export function MarkdownLite({ text }: { text: string }) {
  const lines = (text || '').split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const t = lines[i].trim()

    // table — consecutive | … | lines
    if (t.startsWith('|') && t.endsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
        i++
      }
      const header = rows[0] && !isSep(rows[0]) ? rows[0] : null
      const body = rows.filter((r, idx) => !isSep(r) && !(idx === 0 && header))
      blocks.push(
        <table key={key++} style={{ borderCollapse: 'collapse', margin: '8px 0', fontSize: 12.5, width: '100%' }}>
          {header && (
            <thead><tr>{header.map((c, ci) => (
              <th key={ci} style={{ textAlign: 'left', padding: '5px 14px 5px 0', color: 'var(--placeholder)', fontWeight: 700, borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{inline(c)}</th>
            ))}</tr></thead>
          )}
          <tbody>{body.map((r, ri) => (
            <tr key={ri}>{r.map((c, ci) => (
              <td key={ci} style={{ padding: '5px 14px 5px 0', borderBottom: '1px solid var(--line)' }}>{inline(c)}</td>
            ))}</tr>
          ))}</tbody>
        </table>,
      )
      continue
    }

    // heading
    const h = t.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const lvl = h[1].length
      const size = lvl === 1 ? 18 : lvl === 2 ? 15.5 : 14
      blocks.push(
        <div key={key++} style={{ fontSize: size, fontWeight: 800, color: 'var(--ink)', margin: lvl === 1 ? '2px 0 10px' : '14px 0 6px', letterSpacing: '-.2px' }}>{inline(h[2])}</div>,
      )
      i++
      continue
    }

    // blockquote
    if (t.startsWith('>')) {
      blocks.push(
        <div key={key++} style={{ borderLeft: '3px solid var(--jade)', paddingLeft: 12, margin: '8px 0', color: 'var(--ink-2)', fontStyle: 'italic', lineHeight: 1.55 }}>{inline(t.replace(/^>\s?/, ''))}</div>,
      )
      i++
      continue
    }

    // list — consecutive - / * items
    if (/^[-*]\s+/.test(t)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''))
        i++
      }
      blocks.push(
        <ul key={key++} style={{ margin: '6px 0', paddingLeft: 20 }}>{items.map((it, ii) => (
          <li key={ii} style={{ margin: '3px 0', lineHeight: 1.55 }}>{inline(it)}</li>
        ))}</ul>,
      )
      continue
    }

    // blank line
    if (!t) {
      blocks.push(<div key={key++} style={{ height: 8 }} />)
      i++
      continue
    }

    // paragraph
    blocks.push(<div key={key++} style={{ margin: '4px 0', lineHeight: 1.65 }}>{inline(t)}</div>)
    i++
  }

  return <div style={{ fontSize: 13, color: 'var(--ink)', fontFamily: '"Be Vietnam Pro", system-ui' }}>{blocks}</div>
}
