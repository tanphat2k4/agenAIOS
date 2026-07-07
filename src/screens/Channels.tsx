import { useEffect, useRef, useState } from 'react'
import { useStore, AUTO_DELETE_OPTIONS, autoDeleteLabel } from '@/store'
import { useT } from '@/i18n'
import { api, assetUrl } from '@/api/client'
import { Hover } from '@/components/ui/Hover'
import { buildBlocks } from '@/lib/richtext'
import type { Channel } from '@/types'
import { ChannelModals } from './channels/ChannelModals'
import { BubbleEditor } from './channels/BubbleEditor'

// A comic page image url (comic-<id>-page-<n>-r<ts>.png) → its (comicId, pageNo) so we can
// open the speech-bubble editor on it; null for any other image.
const parseComicPage = (u: string): { comicId: string; pageNo: number } | null => {
  // matches both the versioned name (…-page-2-r103042.png) and the old fixed name (…-page-2.png)
  const m = u.match(/comic-([a-z0-9]+)-page-(\d+)(?:-r\d+)?\.png/i)
  return m ? { comicId: m[1], pageNo: parseInt(m[2], 10) } : null
}

function ChannelRow({ c, kind }: { c: Channel; kind: 'public' | 'private' | 'direct' }) {
  const t = useT()
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
      {!sel && unread > 0 && (
        <span title={t('Tin mới')} style={{ fontSize: 10.5, fontWeight: 700, background: 'var(--jade)', color: '#fff', minWidth: 19, height: 19, padding: '0 5px', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{unread}</span>
      )}
      {iconBtn(t('Đổi tên channel'), '✎', (e) => { e.stopPropagation(); askRename(c.id) })}
      {iconBtn(t('Xóa channel'), '🗑', (e) => { e.stopPropagation(); askDeleteChannel(c.id) }, true)}
    </Hover>
  )
}

const sectionLabel: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--placeholder)' }

export function Channels() {
  const s = useStore()
  const t = useT()
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const newMarkRef = useRef<HTMLDivElement>(null)
  const jumpDoneFor = useRef<string | null>(null)  // channel id whose open-scroll already ran
  const onPickAttach = (kind: string) => {
    if (kind === 'record') { s.pickAttach('record'); return }  // pickAttach closes the menu
    s.toggleAttachMenu()  // close menu, then open the real file dialog
    if (fileInputRef.current) {
      fileInputRef.current.accept = kind === 'image' ? 'image/*' : '*/*'
      fileInputRef.current.click()
    }
  }
  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) s.uploadAttach(f)
    e.target.value = ''
  }
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

  const members = active?.memberList || []
  const memberCount = members.length
  const memberAvatars = members.slice(0, 4)
  const draftHas = !!s.draft.trim()
  const wfTotal = active?.wfTotal || 0

  // ---- channel options menu (clear history + auto-delete timer) ----
  const [chanMenu, setChanMenu] = useState(false)
  // ---- Suno variant pick (buttons under audio messages in #am-nhac) ----
  const [pickSent, setPickSent] = useState<Record<string, string>>({})
  // ---- in-chat image lightbox (bấm ảnh xem ngay, không mở tab mới) ----
  const [lightbox, setLightbox] = useState<number | null>(null)
  // ---- visual speech-bubble editor (Cách B: kéo-thả chỉnh bóng thoại trên trang truyện) ----
  const [bubbleEdit, setBubbleEdit] = useState<{ comicId: string; pageNo: number } | null>(null)
  const galleryUrls = allMsgs.flatMap((mm) => (mm.raw || [])
    .filter((b) => b.kind === 'attach' && (b as { fileKind?: string }).fileKind === 'image' && (b as { url?: string }).url)
    .map((b) => (b as { url?: string }).url as string))
  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowLeft') setLightbox((i) => (i === null ? i : Math.max(0, i - 1)))
      if (e.key === 'ArrowRight') setLightbox((i) => (i === null ? i : Math.min(galleryUrls.length - 1, i + 1)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, galleryUrls.length])
  const sendPick = (slug: string, choice: string, label: string) => {
    setPickSent((p) => ({ ...p, [slug]: label }))
    api.post('/music/pick', { slug, choice }).then(() => {
      const tick = (n: number) => api.get('/music/pick').then((r) => {
        if (r.status === 'done' || r.status === 'error' || n <= 0) s.selectChannel(active.id)  // refetch → Beat's confirm shows
        else setTimeout(() => tick(n - 1), 4000)
      }).catch(() => {})
      tick(50)
    }).catch(() => {})
  }
  // ---- @mention autocomplete (real channel members) ----
  const [mention, setMention] = useState<{ q: string; start: number } | null>(null)
  const mentionMatches = mention ? members.filter((m) => m.name.toLowerCase().includes(mention.q.toLowerCase())).slice(0, 8) : []
  const onComposerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target
    s.onDraft(el.value)
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 140) + 'px'
    const pos = el.selectionStart || 0
    const m = el.value.slice(0, pos).match(/(?:^|\s)@([^\s@]*)$/)
    setMention(m ? { q: m[1], start: pos - m[1].length - 1 } : null)
  }
  const pickMention = (name: string) => {
    if (!mention) return
    const v = s.draft
    s.onDraft(v.slice(0, mention.start) + '@' + name + ' ' + v.slice(mention.start + 1 + mention.q.length))
    setMention(null)
    setTimeout(() => composerRef.current?.focus(), 0)
  }
  const onMentionBtn = () => {
    const el = composerRef.current
    const v = s.draft
    const pos = el?.selectionStart ?? v.length
    const ins = pos > 0 && !/\s/.test(v[pos - 1]) ? ' @' : '@'
    s.onDraft(v.slice(0, pos) + ins + v.slice(pos))
    setMention({ q: '', start: pos + ins.length - 1 })
    setTimeout(() => { el?.focus(); const np = pos + ins.length; el?.setSelectionRange(np, np) }, 0)
  }

  useEffect(() => { if (composerRef.current && !s.draft) composerRef.current.style.height = 'auto' }, [s.draft])

  // ---- auto-scroll: jump to the "— Tin mới —" marker (first bot reply you haven't seen),
  //      else open at the latest message; stick to the bottom while new replies stream in ----
  const jump = s.unreadJump && s.unreadJump.id === active?.id ? s.unreadJump : null
  const firstNewIdx = jump && allMsgs.length > 0 ? Math.max(0, allMsgs.length - jump.count) : -1
  const showNewMark = firstNewIdx >= 0 && !chatQ
  useEffect(() => {
    const el = scrollerRef.current
    if (!el || allMsgs.length === 0) return
    if (jumpDoneFor.current !== active?.id) {
      if (showNewMark && newMarkRef.current) newMarkRef.current.scrollIntoView({ block: 'start' })
      else el.scrollTop = el.scrollHeight
      jumpDoneFor.current = active?.id || null
    } else if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) {
      el.scrollTop = el.scrollHeight
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, allMsgs.length])

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
          <Hover as="button" onClick={s.openCreate} title={t('Tạo channel mới')}
            style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--jade-soft)', color: 'var(--jade-deep)', fontSize: 17, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            hover={{ background: 'var(--jade)', color: '#fff' }}>＋</Hover>
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <Hover as="button" onClick={s.openSwitch}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '9px 14px', cursor: 'pointer', color: 'var(--placeholder)', font: 'inherit', fontSize: 12.5, textAlign: 'left' }}
            hover={{ borderColor: 'var(--jade)' }}>🔍 <span>{t('Tìm channel hoặc DM')}</span></Hover>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 14px' }}>
          <div style={{ ...sectionLabel, padding: '6px 10px 6px' }}>Public</div>
          {s.publicData.map((c) => <ChannelRow key={c.id} c={c} kind="public" />)}
          <div style={{ ...sectionLabel, padding: '14px 10px 6px' }}>Private</div>
          {s.privateData.map((c) => <ChannelRow key={c.id} c={c} kind="private" />)}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 10px 6px' }}>
            <span style={sectionLabel}>Direct</span>
            <Hover as="span" onClick={s.openSwitch} title={t('Tin nhắn mới')} style={{ color: 'var(--placeholder)', fontSize: 15, cursor: 'pointer' }} hover={{ color: 'var(--jade-deep)' }}>＋</Hover>
          </div>
          {s.directData.map((c) => <ChannelRow key={c.id} c={c} kind="direct" />)}
        </div>
      </aside>

      {/* ===== CHAT COLUMN ===== */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        {!active ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 13, padding: 40 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>#</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink-2)' }}>{t('Chưa có channel nào')}</div>
            <div style={{ fontSize: 13, color: 'var(--placeholder)', textAlign: 'center', maxWidth: 340, lineHeight: 1.55 }}>{t('Tạo channel đầu tiên để bắt đầu trò chuyện với team và agent.')}</div>
            <Hover as="button" onClick={s.openCreate}
              style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '11px 22px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 4, boxShadow: '0 6px 16px rgba(40,64,158,.2)' }}
              hover={{ background: 'var(--jade-deep)' }}>＋ {t('Tạo channel mới')}</Hover>
          </div>
        ) : (<>
        <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '13px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <span style={{ fontSize: 15, color: 'var(--ink-2)', flex: 'none' }}>{isDM ? '💬' : isPublic ? '#' : '🔒'}</span>
              <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{active?.name}</span>
              {(active?.autoDeleteSeconds || 0) > 0 && <span title={t('Tự động xóa tin nhắn')} style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '2px 9px', borderRadius: 99, flex: 'none' }}>⏱ {autoDeleteLabel(active?.autoDeleteSeconds)}</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{active?.desc}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid var(--jade)', background: 'var(--surface)', borderRadius: 99, padding: '7px 13px', width: 163, height: 31 }}>
            <span style={{ color: 'var(--jade-deep)', fontSize: 13 }}>🔍</span>
            <input value={s.chatSearch} onChange={(e) => s.onChatSearch(e.target.value)} placeholder={t('Tìm trong hội thoại…')} style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, background: 'transparent', color: 'var(--ink)', minWidth: 0 }} />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--placeholder)' }}>{msgs.length}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
            <Hover as="button" onClick={s.confirmLeave} style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '8px 15px', font: 'inherit', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }} hover={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>↩</Hover>
            {headerBtn(t('Tìm trong hội thoại'), '🔍', s.toggleChatSearch)}
            {headerBtn(t('Thông báo'), '🔔', s.openNotifs)}
            <div style={{ position: 'relative' }}>
              {headerBtn(t('Tùy chọn kênh'), '⋯', () => setChanMenu((v) => !v))}
              {chanMenu && active && (
                <div style={{ position: 'absolute', top: 40, right: 0, width: 234, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 12px 32px rgba(22,32,28,.18)', padding: 6, zIndex: 40, animation: 'pop .15s ease both' }}>
                  <Hover onClick={() => { setChanMenu(false); if (window.confirm(`${t('Xóa toàn bộ lịch sử trò chuyện kênh')} "${active.name}"? ${t('Không thể hoàn tác.')}`)) s.clearHistory(active.id) }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--danger)' }} hover={{ background: '#FBEAE7' }}>🗑 {t('Xóa lịch sử trò chuyện')}</Hover>
                  <div style={{ borderTop: '1px solid var(--line)', margin: '5px 4px' }} />
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--placeholder)', padding: '6px 11px 4px' }}>⏱ {t('Tự động xóa sau')}</div>
                  {AUTO_DELETE_OPTIONS.map((o) => {
                    const sel = (active.autoDeleteSeconds || 0) === o.seconds
                    return (
                      <Hover key={o.seconds} onClick={() => { setChanMenu(false); s.setAutoDelete(active.id, o.seconds) }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 11px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: sel ? 700 : 500, color: sel ? 'var(--jade-deep)' : 'var(--ink)', background: sel ? 'var(--jade-soft)' : 'transparent' }} hover={{ background: 'var(--jade-soft)' }}>
                        <span>{o.label}</span>{sel && <span style={{ color: 'var(--jade-deep)' }}>✓</span>}
                      </Hover>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </header>

        <div ref={scrollerRef} className="msgscroll" style={{ flex: 1, overflowY: 'auto', padding: '18px 22px 8px' }}>
          {msgs.length === 0 && (
            <div style={{ height: '100%', minHeight: 380, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--ink-2)' }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 18 }}>🗂</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>{t('Chưa có tin nhắn nào')}</div>
              <div style={{ fontSize: 13, maxWidth: 340, lineHeight: 1.5 }}>{t('Đây là khởi đầu của')} <b>{active?.name}</b>. {t('Gửi tin nhắn đầu tiên hoặc nhắc một agent bằng')} <b>@</b> {t('để bắt đầu.')}</div>
            </div>
          )}
          {msgs.map((mm, i) => {
            const blocks = buildBlocks(mm.raw)
            const openCard = () => s.openPersonCard({ name: mm.authorName, initial: mm.avatarInitial, color: mm.avatarColor, isAgent: !!mm.isAgent })
            return (
              <div key={i}>
              {showNewMark && i === firstNewIdx && (
                <div ref={newMarkRef} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0 10px', scrollMarginTop: 12 }}>
                  <span style={{ flex: 1, height: 1, background: 'var(--jade)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '3px 10px', borderRadius: 99 }}>{t('Tin mới')} ↓</span>
                  <span style={{ flex: 1, height: 1, background: 'var(--jade)' }} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 13, padding: '10px 0 14px', animation: 'msgIn .25s ease both' }}>
                <div onClick={openCard} title={t('Xem hồ sơ')} style={{ width: 38, height: 38, borderRadius: 11, background: mm.avatarColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flex: 'none', cursor: 'pointer' }}>{mm.avatarInitial}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 5 }}>
                    <Hover as="span" onClick={openCard} title={t('Xem hồ sơ')} style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', cursor: 'pointer' }} hover={{ textDecoration: 'underline' }}>{mm.authorName}</Hover>
                    {mm.isAgent && <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.3px', color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '2px 8px', borderRadius: 99 }}>Agent</span>}
                    <span style={{ fontSize: 11, color: 'var(--placeholder)' }}>{mm.time}</span>
                    {mm.replyable && <Hover as="button" onClick={() => s.replyTo(mm.authorName)} style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: '4px 12px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade)', color: '#fff' }}>{t('Trả lời')}</Hover>}
                  </div>
                  {blocks.map((block, bi) => {
                    if ('isPara' in block) return <div key={bi} style={{ fontSize: 14, lineHeight: 1.62, color: 'var(--ink)', margin: '0 0 8px' }}>{block.node}</div>
                    if ('isList' in block) return <div key={bi} style={{ margin: '0 0 10px', display: 'flex', flexDirection: 'column', gap: 7 }}>{block.items.map((it, ii) => <div key={ii} style={{ display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}><span style={{ fontWeight: 700, color: 'var(--jade)', flex: 'none', minWidth: 18 }}>{it.num}.</span><div style={{ minWidth: 0 }}>{it.node}</div></div>)}</div>
                    if ('isTable' in block) return (
                      <div key={bi} style={{ margin: '4px 0 10px', overflowX: 'auto' }}>
                        <table style={{ borderCollapse: 'collapse', fontSize: 12.5 }}>
                          <tbody>
                            {block.rows.map((row, ri) => (
                              <tr key={ri}>
                                {row.map((cell, ci) => ri === 0
                                  ? <th key={ci} style={{ border: '1px solid var(--line)', padding: '5px 12px', textAlign: ci === 0 ? 'left' : 'right', fontWeight: 700, color: 'var(--ink)', background: 'var(--bg)', whiteSpace: 'nowrap' }}>{cell}</th>
                                  : <td key={ci} style={{ border: '1px solid var(--line)', padding: '5px 12px', textAlign: ci === 0 ? 'left' : 'right', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{cell}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                    if ('isTask' in block) return <div key={bi} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, maxWidth: '100%', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 13px', marginTop: 2, boxShadow: '0 1px 2px rgba(22,32,28,.04)' }}><span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '2px 8px', borderRadius: 7, flex: 'none' }}>{block.code}</span><span style={{ fontSize: 12.5, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.text}</span></div>
                    // attach block: image → preview, audio/video → player, file → download link, record → reference card
                    if (block.fileKind === 'video' && block.url) {
                      return (
                        <div key={bi} style={{ maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', marginTop: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                            <span style={{ fontSize: 17 }}>{block.icon || '🎬'}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--placeholder)' }}>{block.label}</div>
                            </div>
                          </div>
                          <video controls preload="metadata" src={assetUrl(block.url)} style={{ width: '100%', maxHeight: 300, borderRadius: 8, background: '#000' }} />
                        </div>
                      )
                    }
                    if (block.fileKind === 'audio' && block.url) {
                      return (
                        <div key={bi} style={{ maxWidth: 380, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', marginTop: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                            <span style={{ fontSize: 17 }}>{block.icon || '🎵'}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--placeholder)' }}>{block.label}</div>
                            </div>
                          </div>
                          <audio controls preload="none" src={assetUrl(block.url)} style={{ width: '100%', height: 34 }} />
                        </div>
                      )
                    }
                    if (block.fileKind === 'image' && block.url) {
                      const u = block.url
                      const cp = parseComicPage(u)  // comic page → offer the bubble editor
                      const img = <img src={assetUrl(u)} alt={block.name} title={t('Bấm để xem')} onClick={() => setLightbox(galleryUrls.indexOf(u))} style={{ maxWidth: 340, maxHeight: 260, borderRadius: 12, border: '1px solid var(--line)', display: 'block', marginTop: 4, cursor: 'zoom-in' }} />
                      if (!cp) return <span key={bi}>{img}</span>
                      return (
                        <div key={bi} style={{ position: 'relative', display: 'inline-block', marginTop: 4 }}>
                          {img}
                          <Hover as="button" title={t('Chỉnh bóng thoại')} onClick={(e: React.MouseEvent) => { e.stopPropagation(); setBubbleEdit(cp) }}
                            style={{ position: 'absolute', right: 8, bottom: 8, display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 8, background: 'rgba(20,20,20,.72)', color: '#fff', padding: '5px 10px', font: 'inherit', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(2px)' }}
                            hover={{ background: 'var(--jade)' }}>✎ {t('Sửa bóng')}</Hover>
                        </div>
                      )
                    }
                    if (block.url) {
                      return <a key={bi} href={assetUrl(block.url)} target="_blank" rel="noreferrer" download={block.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 11, maxWidth: '100%', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', marginTop: 4, textDecoration: 'none', color: 'inherit' }}><span style={{ fontSize: 20, flex: 'none' }}>{block.icon}</span><div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.name}</div><div style={{ fontSize: 11, color: 'var(--placeholder)' }}>{block.label}</div></div><span style={{ fontSize: 14, color: 'var(--jade-deep)', marginLeft: 6 }}>↓</span></a>
                    }
                    return <div key={bi} style={{ display: 'inline-flex', alignItems: 'center', gap: 11, maxWidth: '100%', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', marginTop: 4 }}><span style={{ fontSize: 20, flex: 'none' }}>{block.icon}</span><div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{block.name}</div><div style={{ fontSize: 11, color: 'var(--placeholder)' }}>{block.label}</div></div></div>
                  })}
                  {/* Suno variant picker — mirrors the Telegram inline buttons under generated tracks */}
                  {mm.isAgent && (() => {
                    const audio = (mm.raw || []).find((b) => b.kind === 'attach' && (b as { fileKind?: string }).fileKind === 'audio' && (b as { url?: string }).url)
                    if (!audio) return null
                    const slugMatch = String((audio as { url?: string }).url || '').match(/\/([a-z0-9-]+)-v\d\.mp3$/i)
                    if (!slugMatch) return null
                    const slug = slugMatch[1]
                    const sent = pickSent[slug]
                    const pickBtn = (choice: string, label: string, danger?: boolean) => (
                      <Hover as="button" key={choice} onClick={() => sendPick(slug, choice, label)}
                        style={{ border: '1px solid var(--line)', background: danger ? '#FBEAE7' : 'var(--jade-soft)', color: danger ? 'var(--danger)' : 'var(--jade-deep)', fontWeight: 700, fontSize: 12, borderRadius: 99, padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit' }}
                        hover={{ background: danger ? 'var(--danger)' : 'var(--jade)', color: '#fff' }}>{label}</Hover>
                    )
                    return (
                      <div style={{ display: 'flex', gap: 8, marginTop: 9, flexWrap: 'wrap', alignItems: 'center' }}>
                        {sent
                          ? <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--jade-deep)' }}>✓ {t('Đã gửi lựa chọn')}: {sent} — {t('chờ Beat xác nhận…')}</span>
                          : (<>
                              <span style={{ fontSize: 11.5, color: 'var(--placeholder)', fontWeight: 600 }}>{t('Chọn bản')}:</span>
                              {pickBtn('v1', '🎵 ' + t('Bản 1'))}
                              {pickBtn('v2', '🎵 ' + t('Bản 2'))}
                              {pickBtn('both', t('Cả 2 bản'))}
                              {pickBtn('skip', t('Bỏ qua'), true)}
                            </>)}
                      </div>
                    )
                  })()}
                </div>
              </div>
              </div>
            )
          })}
          <div style={{ height: 8 }} />
        </div>

        {/* composer */}
        <div style={{ flex: 'none', padding: '10px 22px 18px', position: 'relative' }}>
          {mention && mentionMatches.length > 0 && (
            <div style={{ position: 'absolute', bottom: 'calc(100% - 10px)', left: 22, right: 22, maxHeight: 224, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 12px 32px rgba(22,32,28,.18)', padding: 6, zIndex: 30, animation: 'pop .15s ease both' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', padding: '6px 10px 4px' }}>{t('Thành viên')} · {mentionMatches.length}</div>
              {mentionMatches.map((m, i) => (
                <Hover key={i} onClick={() => pickMention(m.name)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, cursor: 'pointer' }} hover={{ background: 'var(--jade-soft)' }}>
                  <div style={{ width: 28, height: 28, borderRadius: 99, background: m.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>{m.initial}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{m.name}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--placeholder)' }}>{m.isAgent ? 'Agent' : (m.role || t('Thành viên'))}</div>
                  </div>
                </Hover>
              ))}
            </div>
          )}
          <div style={{ background: 'var(--surface)', border: `1.5px solid ${s.composerFocused ? 'var(--jade)' : 'var(--line)'}`, borderRadius: 22, padding: '10px 12px 8px', transition: 'border-color .15s' }}>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={onFileChosen} />
            {s.pendingAttach && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '8px 11px', margin: '2px 4px 8px' }}>
                {s.pendingAttach.fileKind === 'image' && s.pendingAttach.url
                  ? <img src={assetUrl(s.pendingAttach.url)} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flex: 'none' }} />
                  : <span style={{ fontSize: 18 }}>{s.pendingAttach.icon}</span>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)' }}>{s.pendingAttach.name}</div>
                  <div style={{ fontSize: 10.5, color: 'var(--placeholder)' }}>{s.pendingAttach.label}</div>
                </div>
                <button onClick={s.clearAttach} title={t('Bỏ đính kèm')} style={{ width: 22, height: 22, borderRadius: 99, border: 'none', background: 'var(--line)', color: 'var(--ink-2)', fontSize: 11, cursor: 'pointer', marginLeft: 4 }}>✕</button>
              </div>
            )}
            <textarea
              ref={composerRef}
              value={s.draft}
              onChange={onComposerChange}
              onKeyDown={(e) => {
                if (mention && mentionMatches.length) {
                  if (e.key === 'Enter') { e.preventDefault(); pickMention(mentionMatches[0].name); return }
                  if (e.key === 'Escape') { e.preventDefault(); setMention(null); return }
                }
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); s.sendMessage() }
              }}
              onFocus={s.onComposerFocus} onBlur={s.onComposerBlur}
              placeholder={`${t('Nhắn cho')} ${active?.name}…`} rows={1}
              style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', fontFamily: 'inherit', fontSize: 15, lineHeight: 1.5, color: 'var(--ink)', background: 'transparent', maxHeight: 140, minHeight: 24, padding: '4px 6px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <div style={{ position: 'relative' }}>
                  <Hover as="button" onClick={s.toggleAttachMenu} title={t('Đính kèm')} style={{ width: 36, height: 36, borderRadius: 99, border: 'none', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} hover={{ background: 'var(--jade-soft)', color: 'var(--jade-deep)' }}><span className="material-symbols-rounded" style={{ fontSize: 21 }}>attach_file</span></Hover>
                  {s.attachMenuOpen && (
                    <div style={{ position: 'absolute', bottom: 44, left: 0, width: 210, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 12px 32px rgba(22,32,28,.16)', padding: 6, zIndex: 20, animation: 'pop .15s ease both' }}>
                      {[['file', '📎', t('Tệp đính kèm')], ['image', '🖼', t('Hình ảnh')], ['record', '🗄', t('Bản ghi database')]].map(([k, ic, lb]) => (
                        <Hover key={k} onClick={() => onPickAttach(k)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 11px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 500 }} hover={{ background: 'var(--jade-soft)' }}><span style={{ fontSize: 16 }}>{ic}</span>{lb}</Hover>
                      ))}
                    </div>
                  )}
                </div>
                <Hover as="button" title={t('Nhắc tên (@)')} onClick={onMentionBtn} style={{ width: 36, height: 36, borderRadius: 99, border: 'none', background: 'transparent', color: 'var(--ink-2)', cursor: 'pointer', fontSize: 17, fontWeight: 700 }} hover={{ background: 'var(--jade-soft)', color: 'var(--jade-deep)' }}>@</Hover>
                <span style={{ fontSize: 11, color: 'var(--placeholder)', marginLeft: 8 }}>{`Enter ${t('để gửi')} · Shift+Enter ${t('xuống dòng')} · @ ${t('để mention')}`}</span>
              </div>
              <button onClick={s.sendMessage} title={t('Gửi')} style={{ width: 42, height: 42, borderRadius: 99, border: 'none', background: draftHas || s.pendingAttach ? 'var(--jade)' : '#9FBDB1', color: '#fff', cursor: draftHas || s.pendingAttach ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(40,64,158,.22)', transition: 'background .15s' }}><span className="material-symbols-rounded" style={{ fontSize: 21 }}>send</span></button>
            </div>
          </div>
        </div>
        </>)}
      </main>

      {/* ===== RIGHT DETAILS PANEL ===== */}
      {active && (
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
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>{t('Thành viên')} · {memberCount}</span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {memberAvatars.map((m, i) => <div key={i} style={{ width: 26, height: 26, borderRadius: 99, background: m.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, border: '2px solid var(--surface)', marginLeft: -8 }}>{m.initial}</div>)}
              <span style={{ color: 'var(--placeholder)', fontSize: 15, marginLeft: 8 }}>›</span>
            </div>
          </Hover>

          <div style={{ ...sectionLabel, marginBottom: 9 }}>Room files</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 13px', border: '1px solid var(--line)', borderRadius: 14, marginBottom: 22 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600 }}><span style={{ fontSize: 15 }}>📁</span>{active?.files || active?.id + '/'}</span>
            <Hover as="button" onClick={s.openFiles} style={{ fontSize: 12, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade)', color: '#fff' }}>{t('Xem file')}</Hover>
          </div>

          {active?.database && (<>
            <div style={{ ...sectionLabel, marginBottom: 9 }}>Database</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 13px', border: '1px solid var(--line)', borderRadius: 14, marginBottom: 22 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600 }}><span style={{ fontSize: 15 }}>🗄</span>{active.database}</span>
              <Hover as="button" onClick={s.openDb} style={{ fontSize: 12, fontWeight: 600, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '5px 13px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade-deep)' }}>{t('Mở Database')}</Hover>
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
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ink-2)', marginBottom: 12 }}>{active?.wfNote || t('Chưa cấu hình workflow.')}</div>
            <Hover as="button" onClick={s.openWorkflow} style={{ width: '100%', fontSize: 12.5, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: 9, cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade)', color: '#fff' }}>{t('Quản lý workflow')} →</Hover>
          </div>
          <div style={{ fontSize: 11, color: 'var(--placeholder)', textAlign: 'center', paddingTop: 6 }}>• {wfTotal ? wfTotal + ' workflow ' + t('chưa đủ điều kiện') : t('Chưa có workflow nào')}</div>
        </div>
      </aside>
      )}

      <ChannelModals active={active} memberCount={memberCount} />

      {/* ── image lightbox ── */}
      {lightbox !== null && galleryUrls[lightbox] && (
        <div onClick={() => setLightbox(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10, 12, 11, .88)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn .12s ease' }}>
          <img src={assetUrl(galleryUrls[lightbox])} onClick={(e) => e.stopPropagation()} alt="" style={{ maxWidth: '92vw', maxHeight: '90vh', borderRadius: 10, boxShadow: '0 18px 60px rgba(0,0,0,.55)' }} />
          <button onClick={(e) => { e.stopPropagation(); setLightbox(null) }} title="Esc" style={{ position: 'fixed', top: 16, right: 20, width: 40, height: 40, borderRadius: 99, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 17, cursor: 'pointer' }}>✕</button>
          {lightbox > 0 && (
            <button onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1) }} style={{ position: 'fixed', left: 18, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: 99, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 20, cursor: 'pointer' }}>‹</button>
          )}
          {lightbox < galleryUrls.length - 1 && (
            <button onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1) }} style={{ position: 'fixed', right: 18, top: '50%', transform: 'translateY(-50%)', width: 44, height: 44, borderRadius: 99, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', fontSize: 20, cursor: 'pointer' }}>›</button>
          )}
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ color: 'rgba(255,255,255,.75)', fontSize: 12.5 }}>{lightbox + 1} / {galleryUrls.length}</span>
            <a href={assetUrl(galleryUrls[lightbox])} download style={{ color: '#fff', background: 'rgba(255,255,255,.14)', borderRadius: 99, padding: '7px 16px', fontSize: 12.5, fontWeight: 600, textDecoration: 'none' }}>⬇ {t('Tải về')}</a>
          </div>
        </div>
      )}

      {/* ── visual speech-bubble editor ── */}
      {bubbleEdit && (
        <BubbleEditor comicId={bubbleEdit.comicId} pageNo={bubbleEdit.pageNo}
          onClose={() => setBubbleEdit(null)}
          onSaved={() => { if (active?.id) s.selectChannel(active.id) }} />
      )}
    </div>
  )
}
