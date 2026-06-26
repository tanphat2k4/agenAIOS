import { useState } from 'react'
import { api } from '@/api/client'
import { Hover } from '@/components/ui/Hover'
import { useStore } from '@/store'
import { MarkdownLite } from '@/components/MarkdownLite'

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

export function Music() {
  const runMusicBatch = useStore((s) => s.runMusicBatch)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState('')
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')

  const handleBatch = async () => {
    if (busy) return
    setBusy(true)
    setStatus('running')
    setResult('⏳ Đang trigger Beat (music-orchestrator) qua OpenClaw…\n\nPipeline ~15 phút: Research → Strategy → Songwriter → Fact-check → Arrangement → Reviewer → Scorer. Beat sẽ gửi batch (lời + điểm) lên Telegram để anh duyệt.')
    try {
      await api.post('/music/batch')
      const poll = async () => {
        try {
          const r = await api.get('/music/batch')
          if (r.status === 'done' || r.status === 'error') {
            setResult(r.result || '(không có kết quả)')
            setStatus(r.status)
            setBusy(false)
            runMusicBatch()
          } else {
            setTimeout(poll, 5000)
          }
        } catch (e) {
          setResult('Lỗi khi poll: ' + (e instanceof Error ? e.message : 'unknown'))
          setStatus('error')
          setBusy(false)
        }
      }
      setTimeout(poll, 5000)
    } catch (e) {
      setResult('Lỗi: ' + (e instanceof Error ? e.message : 'unknown'))
      setStatus('error')
      setBusy(false)
    }
  }

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px' }}>
        <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › Âm nhạc</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>Âm nhạc AI 🎵</span>
          <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>Làm nhạc bắt trend VN — Beat / music-orchestrator · Suno</span>
        </div>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>
        {/* pipeline steps */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 20px', marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--placeholder)', marginBottom: 12, letterSpacing: '.4px', textTransform: 'uppercase' }}>Pipeline 9 khâu</div>
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
          <div style={{ marginTop: 14, fontSize: 11.5, color: 'var(--placeholder)', lineHeight: 1.55 }}>
            🚪 <b>Cổng duyệt:</b> Beat gửi batch (lời + điểm) lên Telegram. Anh chọn bài → gõ "generate bài X".
            Sau khi Suno render xong: gõ "làm clip" để Producer → Clipmaker dựng video YT/TikTok/Canvas.
          </div>
        </div>

        {/* action card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 20px', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Hover as="button" onClick={handleBatch} disabled={busy}
              style={{
                display: 'flex', alignItems: 'center', gap: 9, border: 'none', borderRadius: 99,
                padding: '11px 22px', font: 'inherit', fontSize: 13.5, fontWeight: 700,
                cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.65 : 1,
                background: 'var(--jade)', color: '#fff',
              }}
              hover={busy ? {} : { background: 'var(--jade-deep)' }}>
              {busy
                ? <><span style={{ width: 10, height: 10, borderRadius: 99, background: '#fff', animation: 'wfpulse 1.4s infinite', flex: 'none' }} /> Đang chạy pipeline…</>
                : <>🎵 Chạy batch nhạc tuần này</>}
            </Hover>
            <div style={{ fontSize: 12, color: 'var(--placeholder)', lineHeight: 1.5 }}>
              Beat trigger qua OpenClaw → đẩy kết quả lên Telegram · ~15 phút · mirror in-app
            </div>
          </div>
        </div>

        {/* result card */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 22px', minHeight: 260 }}>
          {status !== 'idle' ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                {busy && <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--jade)', animation: 'wfpulse 1.6s infinite', flex: 'none' }} />}
                <span style={{ fontSize: 14, fontWeight: 800, letterSpacing: '-.2px' }}>
                  {status === 'running' ? '⏳ Pipeline đang chạy…' : status === 'error' ? '⚠️ Lỗi' : '✅ Batch hoàn tất'}
                </span>
              </div>
              <MarkdownLite text={result} />
            </>
          ) : (
            <div style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--placeholder)', textAlign: 'center' }}>
              <div style={{ fontSize: 44 }}>🎵</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-2)' }}>Hệ làm nhạc AI bắt trend VN</div>
              <div style={{ fontSize: 13, maxWidth: 480, lineHeight: 1.6 }}>
                Mỗi batch ra 3–5 bài (concept + lời + sound brief + điểm hit-potential). Beat dừng ở cổng duyệt để anh chọn bài trước khi tốn credit Suno.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
