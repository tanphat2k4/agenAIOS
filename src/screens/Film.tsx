import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useStore } from '@/store'
import { useT } from '@/i18n'
import { api, getToken } from '@/api/client'
import { Hover } from '@/components/ui/Hover'
import type { Film } from '@/types'

// ArcReel pipeline stages, in order: [rawStage, emoji, label]. Gates start with "awaiting".
const STAGES: [string, string, string][] = [
  ['overview', '📖', 'Tổng quan'],
  ['script', '📝', 'Kịch bản'],
  ['awaiting_script_review', '🚪', 'Duyệt kịch bản'],
  ['asset_sheets', '👤', 'Thiết kế'],
  ['awaiting_asset_review', '🚪', 'Duyệt thiết kế'],
  ['storyboards', '🖼', 'Phân cảnh'],
  ['awaiting_review', '🚪', 'Duyệt phân cảnh'],
  ['videos', '🎬', 'Dựng video'],
  ['awaiting_video_review', '🚪', 'Duyệt video'],
  ['narration', '🎙', 'Lồng tiếng'],
  ['compose', '🎞', 'Ghép phim'],
  ['done', '✅', 'Xong'],
]
const GATE_PROMPT: Record<string, string> = {
  awaiting_script_review: 'Cần duyệt kịch bản',
  awaiting_asset_review: 'Cần duyệt thiết kế nhân vật',
  awaiting_review: 'Cần duyệt phân cảnh',
  awaiting_video_review: 'Cần duyệt video',
}
const STATUS: Record<string, { bg: string; fg: string; label: string }> = {
  queued: { bg: '#EEF1FB', fg: '#28409E', label: 'Đang xếp hàng' },
  running: { bg: '#FBF1DE', fg: '#9A6A1B', label: 'Đang chạy' },
  needs_review: { bg: '#FCEFE8', fg: '#D85A30', label: 'Cần duyệt' },
  done: { bg: '#E1F5EE', fg: '#0F6E56', label: 'Hoàn tất' },
  error: { bg: '#FBEAE7', fg: '#C94F3D', label: 'Lỗi' },
}

interface RItem { id: string; label: string; text?: string; image?: string; kind?: string; sceneId?: string; variants?: { variant: number; video: string }[] }

function stageIndex(stage: string): number {
  const i = STAGES.findIndex(([k]) => k === stage)
  if (i >= 0) return i
  if (/script/.test(stage)) return 1
  if (/asset|character/.test(stage)) return 3
  if (/storyboard/.test(stage)) return 5
  if (/video/.test(stage)) return 7
  if (/narrat|audio/.test(stage)) return 9
  if (/compose/.test(stage)) return 10
  return 0
}

function progressLine(e: Record<string, unknown>): string {
  return String(e.msg || e.label || e.sub_stage || e.stage || JSON.stringify(e))
}

export function FilmView() {
  const t = useT()
  const s = useStore()
  const films = s.filmsData
  const film = films.find((f) => f.id === s.activeFilm) || null
  const form = s.filmForm
  const [videoUrl, setVideoUrl] = useState('')
  const [review, setReview] = useState<{ kind: string; items: RItem[] } | null>(null)
  const [picks, setPicks] = useState<Record<string, number>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})

  useEffect(() => { s.loadFilms() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // poll the open film while it's live
  useEffect(() => {
    if (!film || film.status === 'done' || film.status === 'error') return
    const id = setInterval(() => s.refreshFilm(film.id), 4000)
    return () => clearInterval(id)
  }, [film?.id, film?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // fetch the finished mp4 as a blob (auth header can't ride a bare <video src>)
  useEffect(() => {
    setVideoUrl('')
    if (!(film && film.status === 'done' && film.publicUrl)) return
    let url = ''
    fetch(`${api.base}/films/${film.id}/video`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('video'))))
      .then((b) => { url = URL.createObjectURL(b); setVideoUrl(url) })
      .catch(() => {})
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [film?.id, film?.status, film?.publicUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // load the gate's review items (segments / asset+storyboard images / video variants)
  useEffect(() => {
    setReview(null); setPicks({}); setFeedback({})
    if (film && (film.status === 'needs_review' || film.status === 'done')) {
      api.get(`/films/${film.id}/review`).then((r) => setReview(r)).catch(() => {})
    }
  }, [film?.id, film?.status, film?.stage]) // eslint-disable-line react-hooks/exhaustive-deps

  const assetSrc = (fid: string, p: string) => `${api.base}/films/${fid}/asset?path=${encodeURIComponent(p)}&token=${getToken()}`
  const doRegen = (fid: string, sceneId: string) => {
    api.post(`/films/${fid}/regenerate`, { sceneId, instructions: feedback[sceneId] || '' })
      .then(() => { s.fireToast(t('Đã yêu cầu dựng lại') + ' ' + sceneId); api.get(`/films/${fid}/review`).then((r) => setReview(r)).catch(() => {}) })
      .catch(() => s.fireToast(t('Không dựng lại được')))
  }
  const doPick = (fid: string, sceneId: string, variant: number) => {
    setPicks((x) => ({ ...x, [sceneId]: variant }))
    api.post(`/films/${fid}/pick`, { sceneId, variant }).catch(() => {})
  }
  const refetchReview = (fid: string) => api.get(`/films/${fid}/review`).then((r) => setReview(r)).catch(() => {})
  const doRegenAsset = (fid: string, kind: string, name: string) => {
    api.post(`/films/${fid}/regenerate-asset`, { kind, name }).then(() => { s.fireToast(t('Đã yêu cầu dựng lại') + ' ' + name); refetchReview(fid) }).catch(() => s.fireToast(t('Không dựng lại được')))
  }
  const doSceneOk = (fid: string, sceneId: string) => {
    api.post(`/films/${fid}/scene-ok`, { sceneId }).then((r) => { s.fireToast('✓ ' + sceneId + (r && r.total ? ` (${r.approved}/${r.total})` : '')); if (r && r.all_approved) s.refreshFilm(fid) }).catch(() => {})
  }
  const doAssetOk = (fid: string, kind: string, name: string) => {
    api.post(`/films/${fid}/asset-ok`, { kind, name }).then((r) => s.fireToast('✓ ' + name + (r && r.total ? ` (${r.approved}/${r.total})` : ''))).catch(() => {})
  }
  const doRetry = (fid: string) => { api.post(`/films/${fid}/retry-videos`, {}).then(() => { s.fireToast(t('Đang dựng lại cảnh lỗi…')); s.refreshFilm(fid) }).catch(() => {}) }
  const doRecompose = (fid: string) => { api.post(`/films/${fid}/recompose`, { selections: picks }).then(() => { s.fireToast(t('Đang ghép lại phim…')); s.refreshFilm(fid) }).catch(() => {}) }
  const renderGate = (f: Film) => {
    if (!review) return <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4 }}>{t('Đang tải nội dung duyệt…')}</div>
    const items = review.items || []
    if (items.length === 0) return <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 4 }}>{t('(chưa có nội dung để duyệt)')}</div>
    if (review.kind === 'script') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto', marginBottom: 4 }}>
          {items.map((it) => (
            <div key={it.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--jade-deep)' }}>{it.label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5, marginTop: 2 }}>{it.text}</div>
            </div>
          ))}
        </div>
      )
    }
    if (review.kind === 'asset' || review.kind === 'storyboard') {
      const isAsset = review.kind === 'asset'
      return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, marginBottom: 4 }}>
          {items.map((it) => (
            <div key={it.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden' }}>
              <img src={assetSrc(f.id, it.image || '')} alt={it.label} style={{ width: '100%', display: 'block', aspectRatio: '1 / 1', objectFit: 'cover', background: '#eee' }} />
              <div style={{ padding: '6px 8px 2px', fontSize: 11, fontWeight: 600 }}>{it.label}</div>
              <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <input value={feedback[it.id] || ''} onChange={(e) => setFeedback((x) => ({ ...x, [it.id]: e.target.value }))} placeholder={t('góp ý…')} style={{ fontSize: 11, border: '1px solid var(--line)', borderRadius: 6, padding: '3px 6px', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }} />
                <div style={{ display: 'flex', gap: 4 }}>
                  <Hover as="button" onClick={() => isAsset ? doRegenAsset(f.id, it.kind || 'character', it.label) : doRegen(f.id, it.id)} style={{ flex: 1, fontSize: 11, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 6, padding: '3px', cursor: 'pointer' }} hover={{ borderColor: 'var(--jade)' }}>{t('Dựng lại')}</Hover>
                  <Hover as="button" onClick={() => isAsset ? doAssetOk(f.id, it.kind || 'character', it.label) : doSceneOk(f.id, it.id)} style={{ flex: 1, fontSize: 11, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 6, padding: '3px', cursor: 'pointer', color: 'var(--jade-deep)' }} hover={{ background: 'var(--jade-soft)' }}>✓ {t('OK')}</Hover>
                </div>
              </div>
            </div>
          ))}
        </div>
      )
    }
    if (review.kind === 'video') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 4 }}>
          <Hover as="button" onClick={() => doRetry(f.id)} style={{ alignSelf: 'flex-start', fontSize: 11.5, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 99, padding: '5px 12px', cursor: 'pointer' }} hover={{ borderColor: 'var(--jade)' }}>↻ {t('Dựng lại cảnh lỗi')}</Hover>
          {items.map((it) => (
            <div key={it.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, padding: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>{t('Cảnh')} {it.label}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(it.variants || []).map((v) => (
                  <div key={v.variant} style={{ textAlign: 'center' }}>
                    <video src={assetSrc(f.id, v.video)} controls style={{ width: 150, borderRadius: 6, background: '#000' }} />
                    {(it.variants || []).length > 1 && (
                      <Hover as="button" onClick={() => doPick(f.id, it.sceneId || it.id, v.variant)} style={{ display: 'block', width: '100%', marginTop: 4, fontSize: 11, border: '1px solid', borderColor: picks[it.sceneId || it.id] === v.variant ? 'var(--jade)' : 'var(--line)', background: picks[it.sceneId || it.id] === v.variant ? 'var(--jade-soft)' : 'var(--surface)', borderRadius: 6, padding: '3px', cursor: 'pointer' }} hover={{ borderColor: 'var(--jade)' }}>{picks[it.sceneId || it.id] === v.variant ? '✓ ' : ''}{t('Bản')} {v.variant}</Hover>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                <input value={feedback[it.sceneId || it.id] || ''} onChange={(e) => setFeedback((x) => ({ ...x, [it.sceneId || it.id]: e.target.value }))} placeholder={t('góp ý…')} style={{ flex: 1, fontSize: 11, border: '1px solid var(--line)', borderRadius: 6, padding: '3px 6px', fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }} />
                <Hover as="button" onClick={() => doRegen(f.id, it.sceneId || it.id)} style={{ fontSize: 11, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', flex: 'none' }} hover={{ borderColor: 'var(--jade)' }}>{t('Dựng lại')}</Hover>
              </div>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  const badge = (st: string) => {
    const v = STATUS[st] || STATUS.queued
    return <span style={{ fontSize: 10.5, fontWeight: 700, color: v.fg, background: v.bg, padding: '2px 9px', borderRadius: 99 }}>{t(v.label)}</span>
  }

  const fieldStyle: CSSProperties = { width: '100%', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', font: 'inherit', fontSize: 13.5, background: 'var(--surface)', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }

  const renderCreate = () => (
    <div style={{ maxWidth: 640 }}>
      <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 14 }}>{t('Phim mới')}</div>
      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{t('Truyện (dán nội dung)')}</label>
      <textarea value={form.novel} onChange={(e) => s.onFilmField('novel', e.target.value)} rows={9} placeholder={t('Dán nội dung truyện vào đây…')} style={{ ...fieldStyle, marginTop: 6, marginBottom: 14, resize: 'vertical', lineHeight: 1.5 }} />
      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{t('Tên phim (tuỳ chọn)')}</label>
      <input value={form.title} onChange={(e) => s.onFilmField('title', e.target.value)} placeholder={t('Tự lấy từ dòng đầu nếu để trống')} style={{ ...fieldStyle, marginTop: 6, marginBottom: 14 }} />
      <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{t('Khổ hình')}</label>
          <select value={form.aspectRatio} onChange={(e) => s.onFilmField('aspectRatio', e.target.value)} style={{ ...fieldStyle, marginTop: 6 }}>
            <option value="9:16">{t('Dọc 9:16')}</option>
            <option value="16:9">{t('Ngang 16:9')}</option>
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>{t('Kiểu nội dung')}</label>
          <select value={form.contentMode} onChange={(e) => s.onFilmField('contentMode', e.target.value)} style={{ ...fieldStyle, marginTop: 6 }}>
            <option value="narration">{t('Thuyết minh')}</option>
            <option value="drama">{t('Phim truyện')}</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <Hover as="button" onClick={s.createFilm} style={{ border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '10px 20px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} hover={{ background: 'var(--jade-deep)' }}>{t('Tạo phim')}</Hover>
        <Hover as="button" onClick={s.closeCreateFilm} style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '10px 20px', font: 'inherit', fontSize: 13, fontWeight: 500, cursor: 'pointer' }} hover={{ borderColor: 'var(--ink-2)' }}>{t('Hủy')}</Hover>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginTop: 14, lineHeight: 1.6 }}>{t('ArcReel sẽ chạy pipeline (~30–120 phút) và dừng ở các cổng để bạn duyệt. Dùng GPU ComfyUI.')}</div>
    </div>
  )

  const renderDetail = (f: Film) => {
    const cur = stageIndex(f.stage)
    const prog = (f.progress || []) as Record<string, unknown>[]
    return (
      <div style={{ maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 18, fontWeight: 800 }}>{f.title || t('Phim chưa đặt tên')}</span>
          {badge(f.status)}
          {f.offline && <span style={{ fontSize: 11, color: 'var(--danger)' }}>{t('ArcReel ngoại tuyến — kiểm tra Thiết bị')}</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 18 }}>{f.aspectRatio} · {f.contentMode === 'drama' ? t('Phim truyện') : t('Thuyết minh')}{f.elapsedSeconds ? ` · ${Math.round(f.elapsedSeconds / 60)} ${t('phút')}` : ''}</div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
          {STAGES.map(([key, emoji, label], i) => {
            const done = i < cur || f.status === 'done'
            const active = i === cur && f.status !== 'done'
            const isGate = key.startsWith('awaiting')
            return (
              <span key={key} style={{
                fontSize: 11, fontWeight: active ? 700 : 500, padding: '5px 10px', borderRadius: 99,
                border: isGate ? '1px dashed' : '1px solid',
                borderColor: active ? '#D85A30' : done ? '#1D9E75' : 'var(--line)',
                background: active ? '#FCEFE8' : done ? '#E1F5EE' : 'var(--surface)',
                color: active ? '#D85A30' : done ? '#0F6E56' : 'var(--placeholder)',
              }}>{emoji} {t(label)}</span>
            )
          })}
        </div>

        {f.status === 'needs_review' && (
          <div style={{ background: '#FCEFE8', border: '1px solid #F0997B', borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#993C1D', marginBottom: 4 }}>🚪 {t(GATE_PROMPT[f.stage] || 'Cần duyệt')}</div>
            <div style={{ fontSize: 12.5, color: '#712B13', marginBottom: 14 }}>{t('Xem rồi bấm Duyệt để pipeline tiếp tục.')}</div>
            {renderGate(f)}
            <Hover as="button" onClick={() => s.approveFilm(f.id, review?.kind === 'video' ? picks : undefined)} style={{ border: 'none', background: '#D85A30', color: '#fff', borderRadius: 99, padding: '9px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 14 }} hover={{ background: '#993C1D' }}>{t('Duyệt & tiếp')}</Hover>
          </div>
        )}

        {f.status === 'error' && (
          <div style={{ background: '#FBEAE7', border: '1px solid #F0997B', borderRadius: 12, padding: 14, marginBottom: 20, fontSize: 13, color: '#993C1D' }}>{f.errorMessage || t('Lỗi')}</div>
        )}

        {f.status === 'done' && videoUrl && (
          <video src={videoUrl} controls style={{ width: '100%', maxWidth: f.aspectRatio === '9:16' ? 320 : 640, borderRadius: 12, marginBottom: 20, background: '#000' }} />
        )}

        {f.status === 'done' && review?.kind === 'video' && (review.items || []).some((it) => (it.variants || []).length > 1) && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{t('Đổi bản & ghép lại')}</div>
            {renderGate(f)}
            <Hover as="button" onClick={() => doRecompose(f.id)} style={{ border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '8px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', marginTop: 10 }} hover={{ background: 'var(--jade-deep)' }}>{t('Ghép lại')}</Hover>
          </div>
        )}

        {prog.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>{t('Nhật ký')}</div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, padding: 12, maxHeight: 220, overflowY: 'auto', fontSize: 12, lineHeight: 1.7, color: 'var(--ink-2)', fontFamily: 'var(--mono)' }}>
              {prog.slice(-12).map((e, i) => <div key={i}>· {progressLine(e)}</div>)}
            </div>
          </div>
        )}

        {f.status !== 'done' && f.status !== 'error' && (
          <div style={{ marginTop: 20 }}>
            <Hover as="button" onClick={() => s.cancelFilm(f.id)} style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--danger)', borderRadius: 99, padding: '8px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }} hover={{ borderColor: 'var(--danger)' }}>{t('Hủy phim')}</Hover>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '13px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.2px' }}>🎬 {t('Phim')}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{t('Xưởng làm phim AI (ArcReel)')}</div>
        </div>
        <Hover as="button" onClick={s.openCreateFilm}
          style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          hover={{ background: 'var(--jade-deep)' }}>＋ {t('Phim mới')}</Hover>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <aside style={{ width: 280, flex: 'none', borderRight: '1px solid var(--line)', overflowY: 'auto', background: 'var(--surface)' }}>
          {films.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.6 }}>
              {t('Chưa có phim nào.')}<br />{t('Tạo phim đầu tiên từ một truyện ngắn.')}
            </div>
          )}
          {films.map((f) => (
            <Hover key={f.id} onClick={() => s.openFilm(f.id)}
              style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', cursor: 'pointer', background: f.id === s.activeFilm ? 'var(--jade-soft)' : 'transparent' }}
              hover={{ background: 'var(--jade-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title || t('Phim chưa đặt tên')}</span>
                {badge(f.status)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--placeholder)', marginTop: 4 }}>{f.aspectRatio} · {f.contentMode === 'drama' ? t('Phim truyện') : t('Thuyết minh')} · {f.updatedAt}</div>
            </Hover>
          ))}
        </aside>

        <main style={{ flex: 1, overflowY: 'auto', padding: '22px 26px', minWidth: 0 }}>
          {s.showCreateFilm ? renderCreate() : film ? renderDetail(film) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--placeholder)', fontSize: 14 }}>
              {t('Chọn một phim để xem tiến độ.')}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
