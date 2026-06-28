import { useEffect, useState } from 'react'
import { api } from '@/api/client'
import { Hover } from '@/components/ui/Hover'
import { useStore } from '@/store'
import { MarkdownLite } from '@/components/MarkdownLite'
import { useT } from '@/i18n'

const PIPELINE_STEPS = [
  { initial: 'Re', color: '#3B5BDB', label: 'Research' },
  { initial: 'St', color: '#E8A33D', label: 'Strategy' },
  { initial: 'So', color: '#0A7B52', label: 'Songwriter' },
  { initial: 'Fc', color: '#C94F3D', label: 'Fact-check' },
  { initial: 'Ar', color: '#0EA5A0', label: 'Arrangement' },
  { initial: 'Rv', color: '#9A6A1B', label: 'Reviewer' },
  { initial: 'Sc', color: '#8B5CF6', label: 'Scorer' },
  { initial: 'Pr', color: '#3B82C4', label: 'Producer' },
  { initial: 'Cl', color: '#C0392B', label: 'Clipmaker' },
]

interface Song { title: string; lyrics: string; score?: string; category?: string; slug?: string; generated?: boolean; picked?: string; clipped?: boolean }

const MEDALS = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣']
const scoreColor = (sc?: string) => {
  const n = parseFloat(sc || '0')
  return n >= 75 ? { bg: '#E2F3EC', fg: '#0A7B52' } : n >= 60 ? { bg: '#FBF1DE', fg: '#9A6A1B' } : { bg: '#FBEAE7', fg: '#C0392B' }
}

export function Music() {
  const t = useT()
  const runMusicBatch = useStore((s) => s.runMusicBatch)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')

  // M2 — batch review
  const [songs, setSongs] = useState<Song[]>([])
  const [week, setWeek] = useState('')
  const [loadingBatch, setLoadingBatch] = useState(true)
  const [openLyrics, setOpenLyrics] = useState<number | null>(null)
  const [genBusy, setGenBusy] = useState<string | null>(null)
  const [genMsg, setGenMsg] = useState('')
  const [health, setHealth] = useState<{ suno_bot: boolean; comfyui: boolean } | null>(null)
  const [pickBusy, setPickBusy] = useState<string | null>(null)
  const [clipBusy, setClipBusy] = useState<string | null>(null)

  useEffect(() => { api.get('/music/health').then(setHealth).catch(() => {}) }, [])

  const loadBatch = async () => {
    setLoadingBatch(true)
    try {
      const r = await api.get('/music/batch/songs')
      setWeek(r.week || '')
      setSongs(r.songs || [])
    } catch { /* keep empty */ }
    setLoadingBatch(false)
  }
  useEffect(() => { loadBatch() }, [])

  const handleBatch = async () => {
    if (busy) return
    setBusy(true)
    setStatus('running')
    setResult(t('⏳ Đang trigger Beat (music-orchestrator) qua OpenClaw…\n\nPipeline ~15 phút: Research → Strategy → Songwriter → Fact-check → Arrangement → Reviewer → Scorer. Beat sẽ gửi batch (lời + điểm) lên Telegram + hiện ở mục "Batch tuần này" dưới đây.'))
    try {
      await api.post('/music/batch')
      const poll = async () => {
        try {
          const r = await api.get('/music/batch')
          if (r.status === 'done' || r.status === 'error') {
            setResult(r.result || t('(không có kết quả)'))
            setStatus(r.status)
            setBusy(false)
            runMusicBatch()
            loadBatch()
          } else { setTimeout(poll, 5000) }
        } catch (e) {
          setResult(t('Lỗi khi poll: ') + (e instanceof Error ? e.message : 'unknown'))
          setStatus('error'); setBusy(false)
        }
      }
      setTimeout(poll, 5000)
    } catch (e) {
      setResult(t('Lỗi: ') + (e instanceof Error ? e.message : 'unknown'))
      setStatus('error'); setBusy(false)
    }
  }

  const handleGenerate = async (title: string) => {
    if (genBusy) return
    if (!window.confirm(`${t('Generate bài')} "${title}"?\n\n${t('Beat sẽ gọi Suno tạo nhạc (~6 phút, TỐN credit Suno). Khi xong, bản nhạc + nút chọn bản sẽ tới Telegram.')}`)) return
    setGenBusy(title)
    setGenMsg(`🎵 ${t('Đang gửi lệnh generate')} "${title}" ${t('cho Beat…')}`)
    try {
      await api.post('/music/generate', { title })
      const poll = async () => {
        try {
          const r = await api.get('/music/generate')
          if (r.status === 'done' || r.status === 'error') {
            setGenMsg(r.result || t('Đã gửi lệnh generate.'))
            setGenBusy(null)
            runMusicBatch()
          } else { setTimeout(poll, 4000) }
        } catch { setGenBusy(null) }
      }
      setTimeout(poll, 4000)
    } catch (e) {
      setGenMsg(t('Lỗi: ') + (e instanceof Error ? e.message : 'unknown'))
      setGenBusy(null)
    }
  }

  const handlePick = async (slug: string, choice: string) => {
    if (pickBusy) return
    setPickBusy(slug + choice)
    setGenMsg(`🎧 ${t('Đang gửi chọn bản')} "${choice}" ${t('cho Beat…')}`)
    try {
      await api.post('/music/pick', { slug, choice })
      const poll = async () => {
        try {
          const r = await api.get('/music/pick')
          if (r.status === 'done' || r.status === 'error') {
            setGenMsg(r.result || t('Đã chọn bản.'))
            setPickBusy(null)
            loadBatch()
            runMusicBatch()
          } else { setTimeout(poll, 4000) }
        } catch { setPickBusy(null) }
      }
      setTimeout(poll, 4000)
    } catch (e) {
      setGenMsg(t('Lỗi: ') + (e instanceof Error ? e.message : 'unknown'))
      setPickBusy(null)
    }
  }

  const handleClip = async (slug: string) => {
    if (clipBusy) return
    setClipBusy(slug)
    setGenMsg(`🎬 ${t('Đang gửi lệnh làm clip cho')} "${slug}"…`)
    try {
      await api.post('/music/clip', { slug })
      const poll = async () => {
        try {
          const r = await api.get('/music/clip')
          if (r.status === 'done' || r.status === 'error') {
            setGenMsg(r.result || t('Đã gửi lệnh làm clip.'))
            setClipBusy(null)
            loadBatch()
            runMusicBatch()
          } else { setTimeout(poll, 4000) }
        } catch { setClipBusy(null) }
      }
      setTimeout(poll, 4000)
    } catch (e) {
      setGenMsg(t('Lỗi: ') + (e instanceof Error ? e.message : 'unknown'))
      setClipBusy(null)
    }
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px' }}>
        <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › {t('Âm nhạc')}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>{t('Âm nhạc AI')} 🎵</span>
          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{t('Làm nhạc bắt trend VN — Beat / music-orchestrator · Suno')}</span>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>
        {/* pipeline steps */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 20px', marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--placeholder)', marginBottom: 12, letterSpacing: '.4px', textTransform: 'uppercase' }}>Pipeline 9 {t('khâu')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {PIPELINE_STEPS.map((s, i) => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg)', border: '1.5px solid var(--line)', borderRadius: 99, padding: '5px 11px 5px 7px' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 99, background: s.color, color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{s.initial}</div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{s.label}</span>
                </div>
                {i < PIPELINE_STEPS.length - 1 && <span style={{ color: 'var(--placeholder)', fontSize: 12 }}>→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* action card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 20px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Hover as="button" onClick={handleBatch} disabled={busy}
              style={{ display: 'flex', alignItems: 'center', gap: 9, border: 'none', borderRadius: 99, padding: '11px 22px', font: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.65 : 1, background: 'var(--jade)', color: '#fff' }}
              hover={busy ? {} : { background: 'var(--jade-deep)' }}>
              {busy
                ? <><span style={{ width: 10, height: 10, borderRadius: 99, background: '#fff', animation: 'wfpulse 1.4s infinite', flex: 'none' }} /> {t('Đang chạy pipeline…')}</>
                : <>🎵 {t('Chạy batch nhạc tuần này')}</>}
            </Hover>
            <div style={{ fontSize: 12, color: 'var(--placeholder)', lineHeight: 1.5 }}>{t('Beat chạy pipeline ~15 phút → batch hiện ở dưới + đẩy Telegram')}</div>
          </div>
        </div>

        {/* M2 — batch review */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 20px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px' }}>
              📋 {t('Batch tuần này')} {week && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--placeholder)' }}>· {week} · {songs.length} {t('bài')}</span>}
            </div>
            <Hover as="button" onClick={loadBatch} style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '6px 13px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>↻ {t('Tải lại')}</Hover>
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 10 }}>🚪 {t('Cổng duyệt: đọc lời + điểm hit-potential, chọn bài để Beat generate qua Suno.')}</div>
          {health && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 12, fontWeight: 600, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: health.suno_bot ? 'var(--jade-deep)' : 'var(--danger)' }}>{health.suno_bot ? '🟢' : '🔴'} Suno-bot (PC-B)</span>
              <span style={{ color: health.comfyui ? 'var(--jade-deep)' : 'var(--danger)' }}>{health.comfyui ? '🟢' : '🔴'} ComfyUI</span>
              <span style={{ color: 'var(--placeholder)', fontWeight: 500 }}>{health.suno_bot && health.comfyui ? t('Sẵn sàng generate + làm clip') : t('Cần bật máy thiếu để generate/clip')}</span>
            </div>
          )}

          {loadingBatch ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--placeholder)', fontSize: 13 }}>{t('Đang tải batch…')}</div>
          ) : songs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--placeholder)', fontSize: 13 }}>{t('Chưa có batch — bấm "Chạy batch nhạc tuần này" ở trên để Beat tạo.')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {songs.map((s, i) => {
                const sc = scoreColor(s.score)
                return (
                  <div key={i} style={{ border: '1px solid var(--line)', borderRadius: 14, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 18, flex: 'none' }}>{MEDALS[i] || `${i + 1}.`}</span>
                      <span style={{ fontSize: 15, fontWeight: 700, flex: 1, minWidth: 120, color: 'var(--ink)' }}>{s.title}</span>
                      {s.score && <span style={{ fontSize: 12, fontWeight: 800, color: sc.fg, background: sc.bg, padding: '3px 11px', borderRadius: 99, flex: 'none' }}>{s.score}đ</span>}
                      {s.category && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '3px 10px', borderRadius: 99, flex: 'none' }}>{s.category}</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Hover as="button" onClick={() => setOpenLyrics(openLyrics === i ? null : i)} style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '7px 14px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }} hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>{openLyrics === i ? '▲ ' + t('Ẩn lời') : '📄 ' + t('Xem lời')}</Hover>
                      {!s.generated && (
                        <Hover as="button" onClick={() => handleGenerate(s.title)} disabled={!!genBusy} style={{ border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '7px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: genBusy ? 'default' : 'pointer', opacity: genBusy && genBusy !== s.title ? 0.5 : 1 }} hover={genBusy ? {} : { background: 'var(--jade-deep)' }}>{genBusy === s.title ? '⏳ ' + t('Đang gửi…') : '🎵 ' + t('Generate bài này')}</Hover>
                      )}
                      {s.generated && !s.picked && s.slug && (<>
                        <span style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 600 }}>🎧 {t('Chọn bản:')}</span>
                        {['v1', 'v2', 'both', 'skip'].map((ch) => (
                          <Hover key={ch} as="button" onClick={() => handlePick(s.slug as string, ch)} disabled={!!pickBusy} style={{ border: '1px solid var(--line)', background: ch === 'skip' ? 'var(--surface)' : 'var(--jade-soft)', color: ch === 'skip' ? 'var(--ink-2)' : 'var(--jade-deep)', borderRadius: 99, padding: '6px 13px', font: 'inherit', fontSize: 12, fontWeight: 700, cursor: pickBusy ? 'default' : 'pointer' }} hover={pickBusy ? {} : { background: 'var(--jade)', color: '#fff' }}>{pickBusy === (s.slug as string) + ch ? '…' : ch}</Hover>
                        ))}
                      </>)}
                      {s.picked && s.picked !== 'skip' && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0A7B52', background: '#E2F3EC', padding: '5px 11px', borderRadius: 99 }}>✅ {t('Đã chọn')} {s.picked}</span>}
                      {s.picked && s.picked !== 'skip' && !s.clipped && s.slug && (
                        <Hover as="button" onClick={() => handleClip(s.slug as string)} disabled={!!clipBusy} style={{ border: 'none', background: '#28409E', color: '#fff', borderRadius: 99, padding: '7px 15px', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: clipBusy ? 'default' : 'pointer', opacity: clipBusy && clipBusy !== s.slug ? 0.5 : 1 }} hover={clipBusy ? {} : { background: '#1E2F7A' }}>{clipBusy === s.slug ? '⏳ ' + t('Đang gửi…') : '🎬 ' + t('Làm clip')}</Hover>
                      )}
                      {s.picked === 'skip' && <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-2)', background: 'var(--bg)', padding: '5px 11px', borderRadius: 99 }}>⊘ {t('Đã bỏ qua')}</span>}
                      {s.clipped && <span style={{ fontSize: 11.5, fontWeight: 700, color: '#28409E', background: '#E8ECFB', padding: '5px 11px', borderRadius: 99 }}>🎬 {t('Đã làm clip')}</span>}
                    </div>
                    {openLyrics === i && (
                      <div style={{ marginTop: 12, padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 360, overflow: 'auto', color: 'var(--ink)' }}>{s.lyrics}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {genMsg && <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--ink-2)', background: 'var(--jade-soft)', borderRadius: 10, padding: '10px 13px', lineHeight: 1.5 }}>{genMsg}</div>}
        </div>

        {/* batch-run result card */}
        {status !== 'idle' && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
              {busy && <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--jade)', animation: 'wfpulse 1.6s infinite', flex: 'none' }} />}
              <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.2px' }}>
                {status === 'running' ? '⏳ Pipeline ' + t('đang chạy…') : status === 'error' ? '⚠️ ' + t('Lỗi') : '✅ Batch ' + t('hoàn tất')}
              </span>
            </div>
            <MarkdownLite text={result} />
          </div>
        )}
      </div>
    </div>
  )
}
