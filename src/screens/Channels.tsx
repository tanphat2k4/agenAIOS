import { useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { Hover } from '@/components/ui/Hover'
import { buildBlocks } from '@/lib/richtext'
import type { Channel } from '@/types'
import { ChannelModals } from './channels/ChannelModals'

const memberPalette = ['#3B5BDB', '#E8A33D', '#C94F3D', '#3B82C4', '#8B5CF6']

function ChannelRow({ c, kind }: { c: Channel; kind: 'public' | 'private' | 'direct' }) {
  const activeId = useStore((s) => s.activeId)
  const unread = useStore((s) => s.unread[c.id] || 0)
  const selectChannel = useStore((s) => s.selectChannel)
  const askRename = useStore((s) => s.askRename)
  const askDeleteChannel = useStore((s) => s.askDeleteChannel)
  const sel = c.id === activeId
  const nameColor = sel ? 'var(--jade-deep)' : 'var(--ink)'
  const tile = kind === 'direct'
    ? <div style={{ width: 30, height: 30, borderRadius: 99, background: c.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flex: 'none' }}>{c.initial}</div>
    : <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--jade-soft)', color: 'var(--jade-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: kind === 'public' ? 15 : 14, flex: 'none' }}>{kind === 'public' ? '#' : '🔒'}</div>
  const iconBtn = (title: string, glyph: string, onClick: (e: React.MouseEvent) => void, danger?: boolean) => (
    <Hover as="button" className="delbtn" title={title} onClick={onClick}
      style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', color: danger ? 'var(--danger)' : 'var(--ink-2)', fontSize: 13, cursor: 'pointer', flex: 'none' }}
      hover={danger ? { background: '#FBEAE7', color: 'var(--danger)' } : { background: 'var(--jade-soft)', color: 'var(--jade-deep)' }}>{glyph}</Hover>
  )
  return (
    <Hover className="chrow" onClick={() => selectChannel(c.id)}
      style={{ display: 'flex', alignItems: 'center', gap: 11, padding: kind === 'direct' ? '8px 10px' : '9px 10px', borderRadius: 11, cursor: 'pointer', marginBottom: 1, background: sel ? 'var(--jade-soft)' : 'transparent' }}
      hover={{ background: 'var(--jade-soft)' }}>
      {tile}
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: kind === 'direct' ? 13 : 13.5, fontWeight: 600, color: nameColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
        <div style={{ fontSize: kind === 'direct' ? 10.5 : 11, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.desc}</div>
      </div>
      {kind === 'private' && unread > 0 && (
        <span style={{ fontSize: 10.5, fontWeight: 700, background: 'var(--jade)', color: '#fff', minWidth: 19, height: 19, padding: '0 5px', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{unread}</span>
      )}
      {iconBtn('Đổi tên channel', '✎', (e) => { e.stopPropagation(); askRename(c.id) })}
      {iconBtn('Xóa channel', '🗑', (e) => { e.stopPropagation(); askDeleteChannel(c.id) }, true)}
    </Hover>
  )
}

const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--placeholder)' }

export function Channels() {
  const s = useStore()
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const active = s.findChannel(s.activeId) || s.privateData[2] || s.publicData[0]
  const isDM = s.directData.some((d) => d.id === active?.id)
  const isPublic = s.publicData.some((p) => p.id === active?.id)

  const chatQ = s.chatSearch.trim().toLowerCase()
  const allMsgs = s.messages[active?.id] || []
  const matchMsg = (mm: typeof allMsgs[number]) => !chatQ || mm.authorName.toLowerCase().includes(chatQ) || mm.raw.some((bl) =>
    ('rich' in bl && bl.rich.some((r) => (r.v || '').toLowerCase().includes(chatQ))) ||
    ('items' in bl && bl.items.some((it) => it.some((r) => (r.v || '').toLowerCase().includes(chatQ)))) ||
    ('text' in bl && (bl.text || '').toLowerCase().includes(chatQ)))
  const msgs = allMsgs.filter(matchMsg)

  const memberCount = (active?.members || 1) + (s.addedMembers[active?.id] || 0)
  const memberAvatars = ['N', 'D', 'S', 'M'].map((ini, i) => ({ initial: ini, color: memberPalette[i % memberPalette.length] }))
  const draftHas = !!s.draft.trim()
  const wfTotal = active?.wfTotal || 0

  useEffect(() => { if (composerRef.current && !s.draft) composerRef.current.style.height = 'auto' }, [s.draft])

  const headerBtn = (title: string, glyph: string, onClick: () => void, danger?: boolean) => (
    <Hover as="button" title={title} onClick={onClick}
      style={{ width: 38, height: 38, borderRadius: 99, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: 15, cursor: 'pointer', flex: 'none' }}
      hover={{ background: 'var(--jade-soft)' }}>{glyph}</Hover>
  )

  return (
    <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
      {/* ===== CHANNEL LIST ===== */}
      <aside style={{ width: 266, flex: 'none', background: 'var(--surface)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 18px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Channels</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>{s.publicData.length + s.privateData.length} channel</div>
          </div>
          <Hover as="button" onClick={s.openCreate} title="Tạo channel mới"
            style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--jade-soft)', color: 'var(--jade-deep)', fontSize: 17, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            hover={{ background: 'var(--jade)', color: '#fff' }}>＋</Hover>
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <Hover as="button" onClick={s.openSwitch}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '9px 14px', cursor: 'pointer', color: 'var(--placeholder)', font: 'inherit', fontSize: 12.5, textAlign: 'left' }}
            hover={{ borderColor: 'var(--jade)' }}>🔍 <span>Tìm channel hoặc DM</span></Hover>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 14px' }}>
          <div style={{ ...sectionLabel, padding: '6px 10px 6px' }}>Public</div>
          {s.publicData.map((c) => <ChannelRow key={c.id} c={c} kind="public" />)}
          <div style={{ ...sectionLabel, padding: '14px 10px 6px' }}>Private</div>
          {s.privateData.map((c) => <ChannelRow key={c.id} c={c} kind="private" />)}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 10px 6px' }}>
            <span style={sectionLabel}>Direct</span>
            <Hover as="span" onClick={s.openSwitch} title="Tin nhắn mới" style={{ color: 'var(--placeholder)', fontSize: 15, cursor: 'pointer' }} hover={{ color: 'var(--jade-deep)' }}>＋</Hover>
          </div>
          {s.directData.map((c) => <ChannelRow key={c.id} c={c} kind="direct" />)}
        </div>
      </aside>

      {/* ===== CHAT COLUMN ===== */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '13px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ fontSize: 15, color: 'var(--ink-2)', flex: 'none' }}>{isDM ? '💬' : isPublic ? '#' : '🔒'}</span>
              <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{active?.name}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{active?.desc}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid var(--jade)', background: 'var(--surface)', borderRadius: 99, padding: '7px 13px', width: 163, height: 31 }}>
            <span style={{ color: 'var(--jade-deep)', fontSize: 13 }}>🔍</span>
            <input value={s.chatSearch} onChange={(e) => s.onChatSearch(e.target.value)} placeholder="Tìm trong hội thoại…" style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, background: 'transparent', color: 'var(--ink)', minWidth: 0 }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--placeholder)' }}>{msgs.length}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
            <Hover as="button" onClick={s.confirmLeave} style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '8px 15px', font: 'inherit', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }} hover={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>↩</Hover>
            {headerBtn('Tìm trong hội thoại', '🔍', s.toggleChatSearch)}
            {headerBtn('Thông báo', '🔔', s.openNotifs)}
          </div>
        </header>

        <div className="msgscroll" style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 8px' }}>
          {msgs.length === 0 && (
            <div style={{ height: '100%', minHeight: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--ink-2)' }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 18 }}>🗂</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Chưa có tin nhắn nào</div>
              <div style={{ fontSize: 13, maxWidth: 340, lineHeight: 1.5 }}>Đây là khởi đầu của <b>{active?.name}</b>. Gửi tin nhắn đầu tiên hoặc nhắc một agent bằng <b>@</b> để bắt đầu.</div>
            </div>
          )}
          {msgs.map((mm, i) => {
            const blocks = buildBlocks(mm.raw)
            const openCard = () => s.openPersonCard({ name: mm.authorName, initial: mm.avatarInitial, color: mm.avatarColor, isAgent: !!mm.isAgent })
            return (
              <div key={i} style={{ display: 'flex', gap: 13, padding: '10px 0 14px', animation: 'msgIn .25s ease both' }}>
                <div onClick={openCard} title="Xem hồ sơ" style={{ width: 38, height: 38, borderRadius: 11, background: mm.avatarColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flex: 'none', cursor: 'pointer' }}>{mm.avatarInitial}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
                    <Hover as="span" onClick={openCard} title="Xem hồ sơ" style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }} hover={{ textDecoration: 'underline' }}>{mm.authorName}</Hover>
                    {mm.isAgent && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.3px', color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '2px 8px', borderRadius: 99 }}>Agent</span>}
                    <span style={{ fontSize: 11, color: 'var(--placeholder)' }}>{mm.time}</span>
                    {mm.replyable && <Hover as="button" onClick={() => s.replyTo(mm.authorName)} style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade)', color: '#fff' }}>Trả lời</Hover>}
                  </div>
                  {blocks.map((block, bi) => {
                    if ('isPara' in block) return <div key={bi} style={{ fontSize: 14, lineHeight: 1.62, color: 'var(--ink)', margin: '0 0 8px' }}>{block.node}</div>
                    if ('isList' in block) return <div key={bi} style={{ margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>{block.items.map((it, ii) => <div key={ii} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}><span style={{ fontWeight: 700, color: 'var(--jade)', flex: 'none', minWidth: 18 }}>{it.num}.</span><div style={{ minWidth: 0 }}>{it.node}</div></div>)}</div>
                    if ('isTask' in block) return <div key={bi} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, maxWidth: '100%', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 13px', marginTop: 2, boxShadow: '0 1px 2px rgba(22,32,28,.04)' }}><span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '2px 8px', borderRadius: 7, flex: 'none' }}>{block.code}</span><span style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.text}</span></div>
                    return <div key={bi} style={{ display: 'inline-flex', alignItems: 'center', gap: 11, maxWidth: '100%', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', marginTop: 4 }}><span style={{ fontSize: 20, flex: 'none' }}>{block.icon}</span><div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.name}</div><div style={{ fontSize: 11, color: 'var(--placeholder)' }}>{block.label}</div></div><span style={{ fontSize: 14, color: 'var(--jade-deep)', marginLeft: 6 }}>↓</span></div>
                  })}
                </div>
              </div>
            )
          })}
          <div style={{ height: 8 }} />
        </div>

        {/* composer */}
        <div style={{ flex: 'none', padding: '10px 22px 18px' }}>
          <div style={{ background: 'var(--surface)', border: `1.5px solid ${s.composerFocused ? 'var(--jade)' : 'var(--line)'}`, borderRadius: 22, padding: '10px 12px 8px', transition: 'border-color .15s' }}>
            {s.pendingAttach && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 11px', margin: '2px 4px 8px' }}>
                <span style={{ fontSize: 18 }}>{s.pendingAttach.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{s.pendingAttach.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--placeholder)' }}>{s.pendingAttach.label}</div>
                </div>
                <button onClick={s.clearAttach} title="Bỏ đính kèm" style={{ width: 22, height: 22, borderRadius: 99, border: 'none', background: 'var(--line)', color: 'var(--ink-2)', fontSize: 11, cursor: 'pointer', marginLeft: 4 }}>✕</button>
              </div>
            )}
            <textarea
              ref={composerRef}
              value={s.draft}
              onChange={(e) => { s.onDraft(e.target.value); const el = e.target; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px' }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); s.sendMessage() } }}
              onFocus={s.onComposerFocus} onBlur={s.onComposerBlur}
              placeholder={`Nhắn cho ${active?.name}…`} rows={1}
              style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.5, color: 'var(--ink)', background: 'transparent', maxHeight: 140, minHeight: 24, padding: '4px 6px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <div style={{ position: 'relative' }}>
                  <Hover as="button" onClick={s.toggleAttachMenu} title="Đính kèm" style={{ width: 36, height: 36, borderRadius: 99, border: 'none', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} hover={{ background: 'var(--jade-soft)', color: 'var(--jade-deep)' }}><span className="material-symbols-rounded" style={{ fontSize: 21 }}>attach_file</span></Hover>
                  {s.attachMenuOpen && (
                    <div style={{ position: 'absolute', bottom: 44, left: 0, width: 210, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 12px 32px rgba(22,32,28,.16)', padding: 6, zIndex: 20, animation: 'pop .15s ease both' }}>
                      {[['file', '📎', 'Tệp đính kèm'], ['image', '🖼', 'Hình ảnh'], ['record', '🗄', 'Bản ghi database']].map(([k, ic, lb]) => (
                        <Hover key={k} onClick={() => s.pickAttach(k)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 500 }} hover={{ background: 'var(--jade-soft)' }}><span style={{ fontSize: 16 }}>{ic}</span>{lb}</Hover>
                      ))}
                    </div>
                  )}
                </div>
                <Hover as="button" title="Mention" onClick={s.insertMention} style={{ width: 36, height: 36, borderRadius: 99, border: 'none', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', fontSize: 17, fontWeight: 700 }} hover={{ background: 'var(--jade-soft)', color: 'var(--jade-deep)' }}>@</Hover>
                <span style={{ fontSize: 11, color: 'var(--placeholder)', marginLeft: 8 }}>Enter để gửi · Shift+Enter xuống dòng · @ để mention</span>
              </div>
              <button onClick={s.sendMessage} title="Gửi" style={{ width: 42, height: 42, borderRadius: 99, border: 'none', background: draftHas || s.pendingAttach ? 'var(--jade)' : '#9FBDB1', color: '#fff', cursor: draftHas || s.pendingAttach ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(40,64,158,.22)', transition: 'background .15s' }}><span className="material-symbols-rounded" style={{ fontSize: 21 }}>send</span></button>
            </div>
          </div>
        </div>
      </main>

      {/* ===== RIGHT DETAILS PANEL ===== */}
      <aside style={{ width: 308, flex: 'none', background: 'var(--surface)', borderLeft: '1px solid var(--line)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ ...sectionLabel, marginBottom: 4 }}>Details</div>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.2px' }}>Channel info</div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.4px', color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '4px 10px', borderRadius: 99 }}>{active?.visibility || 'PRIVATE'}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
            <div style={sectionLabel}>Members</div>
            <Hover as="button" onClick={s.openAddMember} style={{ width: 24, height: 24, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--jade-deep)', fontSize: 14, cursor: 'pointer', lineHeight: 1 }} hover={{ background: 'var(--jade-soft)' }}>＋</Hover>
          </div>
          <Hover onClick={s.openMembers} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 13px', border: '1px solid var(--line)', borderRadius: 14, marginBottom: 22, cursor: 'pointer' }} hover={{ borderColor: 'var(--jade)', background: 'var(--jade-soft)' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Thành viên · {memberCount}</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {memberAvatars.map((m, i) => <div key={i} style={{ width: 26, height: 26, borderRadius: 99, background: m.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: '2px solid var(--surface)', marginLeft: -8 }}>{m.initial}</div>)}
              <span style={{ color: 'var(--placeholder)', fontSize: 15, marginLeft: 8 }}>›</span>
            </div>
          </Hover>

          <div style={{ ...sectionLabel, marginBottom: 9 }}>Room files</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 13px', border: '1px solid var(--line)', borderRadius: 14, marginBottom: 22 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600 }}><span style={{ fontSize: 15 }}>📁</span>{active?.files || active?.id + '/'}</span>
            <Hover as="button" onClick={s.openFiles} style={{ fontSize: 12, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade)', color: '#fff' }}>Xem file</Hover>
          </div>

          {active?.database && (<>
            <div style={{ ...sectionLabel, marginBottom: 9 }}>Database</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 13px', border: '1px solid var(--line)', borderRadius: 14, marginBottom: 22 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600 }}><span style={{ fontSize: 15 }}>🗄</span>{active.database}</span>
              <Hover as="button" onClick={s.openDb} style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '5px 13px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade-deep)' }}>Mở Database</Hover>
            </div>
          </>)}

          {(active?.tasks || []).length > 0 && (<>
            <div style={{ ...sectionLabel, marginBottom: 9 }}>Channel task · {active.tasks.length}</div>
            {active.tasks.map((t, i) => (
              <Hover key={i} onClick={() => s.openChannelTask(t)} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: '12px 13px', marginBottom: 10, cursor: 'pointer' }} hover={{ borderColor: 'var(--jade)', background: 'var(--jade-soft)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--ink)' }}>{t.id}</span>
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.3px', color: 'var(--warn-ink)', background: 'var(--warn-bg)', padding: '2px 8px', borderRadius: 99 }}>{t.status}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10.5, color: 'var(--placeholder)' }}>{t.time}</span>
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--jade-deep)', marginBottom: 5 }}>{t.assignee}</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>{t.text}</div>
              </Hover>
            ))}
            <div style={{ height: 12 }} />
          </>)}

          <div style={{ ...sectionLabel, marginBottom: 9 }}>Agent workflow · 0/{wfTotal}</div>
          <div style={{ border: '1px solid var(--line)', borderRadius: 14, padding: 13, marginBottom: 6 }}>
            <div style={{ ...sectionLabel, marginBottom: 9 }}>Workflow list</div>
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)', marginBottom: 12 }}>{active?.wfNote || 'Chưa cấu hình workflow.'}</div>
            <Hover as="button" onClick={s.openWorkflow} style={{ width: '100%', fontSize: 12.5, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: 9, cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade)', color: '#fff' }}>Quản lý workflow →</Hover>
          </div>
          <div style={{ fontSize: 11, color: 'var(--placeholder)', textAlign: 'center', paddingTop: 6 }}>• {wfTotal ? wfTotal + ' workflow chưa đủ điều kiện' : 'Chưa có workflow nào'}</div>
        </div>
      </aside>

      <ChannelModals active={active} memberCount={memberCount} />
    </div>
  )
}
