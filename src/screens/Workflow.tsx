import { type MouseEvent } from 'react'
import { useStore } from '@/store'
import { Hover } from '@/components/ui/Hover'
import type { Workflow, WorkflowStep } from '@/types'

// ── trigger style map ─────────────────────────────────────────────────────────
const trigStyle: Record<string, { fg: string; bg: string; icon: string; label: string }> = {
  cron: { fg: '#28409E', bg: '#E8ECFB', icon: '⏱', label: 'Cron' },
  event: { fg: '#9A6A1B', bg: '#FBF1DE', icon: '⚡', label: 'Event' },
  manual: { fg: '#5A6B64', bg: '#EEF2F0', icon: '✋', label: 'Manual' },
}

// ── step status style ─────────────────────────────────────────────────────────
function stepStyle(status: WorkflowStep['status'], idx: number) {
  if (status === 'done')
    return { node: '#0A7B52', fg: '#fff', content: '✓', sLabel: 'Hoàn tất', sFg: '#0A7B52', sBg: '#E2F3EC' }
  if (status === 'running')
    return { node: 'var(--jade)', fg: '#fff', content: String(idx + 1), sLabel: 'Đang chạy', sFg: 'var(--jade-deep)', sBg: 'var(--jade-soft)' }
  if (status === 'paused')
    return { node: '#E8A33D', fg: '#fff', content: '❚❚', sLabel: 'Tạm dừng', sFg: '#9A6A1B', sBg: '#FBF1DE' }
  return { node: 'var(--surface)', fg: '#9AA8A1', content: String(idx + 1), sLabel: 'Chờ', sFg: '#5A6B64', sBg: '#EEF2F0' }
}

// ── run badge helpers ─────────────────────────────────────────────────────────
function runDot(status: string): string {
  if (status === 'success') return '#0A7B52'
  if (status === 'running') return 'var(--jade)'
  if (status === 'paused') return '#E8A33D'
  if (status === 'stopped') return '#5A6B64'
  return 'var(--danger)'
}
function runLabel(status: string): string {
  if (status === 'success') return 'Thành công'
  if (status === 'running') return 'Đang chạy'
  if (status === 'paused') return 'Tạm dừng'
  if (status === 'stopped') return 'Đã dừng'
  return 'Thất bại'
}
function runLabelFg(status: string): string {
  if (status === 'success') return '#0A7B52'
  if (status === 'running') return 'var(--jade-deep)'
  if (status === 'paused') return '#9A6A1B'
  if (status === 'stopped') return '#5A6B64'
  return 'var(--danger)'
}

// ─────────────────────────────────────────────────────────────────────────────

export function WorkflowView() {
  const s = useStore()

  // ── derived view-model (mirrors renderVals) ───────────────────────────────
  const wfRunning = s.workflows.filter((w) => w.steps.some((st) => st.status === 'running')).length
  const wfRuns24 = s.workflows.reduce((a, w) => a + w.runs24, 0)
  const wfSuccessAvg = s.workflows.length
    ? Math.round(s.workflows.reduce((a, w) => a + w.success, 0) / s.workflows.length)
    : 0

  const wfStats = [
    { icon: '🧩', label: 'Tổng workflow', value: s.workflows.length, sub: s.workflows.filter((w) => w.enabled).length + ' đang bật' },
    { icon: '⚡', label: 'Đang chạy', value: wfRunning, sub: 'pipeline hoạt động' },
    { icon: '📈', label: 'Runs 24h', value: wfRuns24, sub: 'lượt thực thi' },
    { icon: '✓', label: 'Tỉ lệ thành công', value: wfSuccessAvg + '%', sub: 'trung bình 7 ngày' },
  ]

  const wfList = s.workflows.map((w) => {
    const sel = w.id === s.activeWorkflow
    const running = w.steps.some((st) => st.status === 'running')
    const tg = trigStyle[w.trigger]
    return {
      id: w.id,
      name: w.name,
      desc: w.desc,
      bg: sel ? 'var(--jade-soft)' : 'var(--surface)',
      border: sel ? 'var(--jade)' : 'var(--line)',
      nameColor: sel ? 'var(--jade-deep)' : 'var(--ink)',
      trigIcon: tg.icon, trigLabel: tg.label, trigFg: tg.fg, trigBg: tg.bg,
      stepCount: w.steps.length + ' bước',
      lastRun: w.lastRun,
      dotColor: running ? 'var(--jade)' : (w.enabled ? '#0A7B52' : '#9AA8A1'),
      dotPulse: running ? 'wfpulse 1.6s infinite' : 'none',
    }
  })

  const aw: Workflow = s.workflows.find((w) => w.id === s.activeWorkflow) || s.workflows[0] || ({} as Workflow)
  const awTg = trigStyle[aw?.trigger || 'cron']
  const doneCount = (aw?.steps || []).filter((st) => st.status === 'done').length
  const totalSteps = (aw?.steps || []).length

  const awIsRunning = aw?.runState === 'running' || aw?.runState === 'paused'
  const awNotRunning = !(aw?.runState === 'running' || aw?.runState === 'paused')
  const pauseLabel = aw?.runState === 'paused' ? '▶ Tiếp tục' : '❚❚ Tạm dừng'

  const awSteps = (aw?.steps || []).map((st, ix) => {
    const isLast = ix === (aw?.steps || []).length - 1
    const ss = stepStyle(st.status, ix)
    return {
      ...st,
      nodeBg: ss.node, nodeFg: ss.fg, nodeContent: ss.content,
      nodeBorder: st.status === 'idle' ? '2px solid var(--line)' : '2px solid transparent',
      nodePulse: st.status === 'running' ? 'wfpulse 1.6s infinite' : 'none',
      statusLabel: ss.sLabel, statusFg: ss.sFg, statusBg: ss.sBg,
      showLine: !isLast,
      lineColor: st.status === 'done' ? '#0A7B52' : 'var(--line)',
      idx: ix,
    }
  })

  const awRuns = (aw?.runs || []).map((r) => ({
    time: r.time, dur: r.dur,
    dot: runDot(r.status),
    label: runLabel(r.status),
    labelFg: runLabelFg(r.status),
  }))

  const awProgressPct = totalSteps ? Math.round((doneCount / totalSteps) * 100) + '%' : '0%'
  const awProgressLabel = doneCount + '/' + totalSteps + ' bước hoàn tất'

  // ── step detail (stepDetail is the step index) ────────────────────────────
  const sdIdx = s.stepDetail
  const sdStep = (sdIdx !== null && aw?.steps) ? aw.steps[sdIdx] : null
  const sdSS = sdStep ? stepStyle(sdStep.status, sdIdx as number) : null
  const sd = sdStep && sdIdx !== null && sdSS ? {
    num: sdIdx + 1,
    agent: sdStep.agent,
    initial: sdStep.initial,
    color: sdStep.color,
    title: sdStep.title,
    io: sdStep.io,
    dur: sdStep.dur,
    statusLabel: sdSS.sLabel,
    statusFg: sdSS.sFg,
    statusBg: sdSS.sBg,
  } : null

  // ── new workflow form view-model ──────────────────────────────────────────
  const wfAgentOptions = [
    'Sabo - Facebook Research', 'Dragon - CEO', 'Sanji - Xào nấu content',
    'Nami - Quản lý Fanpage', 'Morgans - Social Leader', 'Brook - Báo Cáo Zy Novel',
    'Robin - Biên tập', 'Usopp - Group Seeding', 'Franky - Thiết kế', 'Tim - Trợ Lý Zypage',
  ]
  const wfTriggerBtns: { k: 'cron' | 'event' | 'manual'; label: string }[] = [
    { k: 'cron', label: '⏱ Cron' },
    { k: 'event', label: '⚡ Event' },
    { k: 'manual', label: '✋ Manual' },
  ]
  const createWfBg = s.wfForm.name.trim() ? 'var(--jade)' : '#9FBDB1'
  const createWfCursor = s.wfForm.name.trim() ? 'pointer' : 'default'

  if (!aw) return null

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › Agent Workflow</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>Agent Workflow</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>tự động hóa nhiều bước cho agent</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <Hover as="button" onClick={s.openWfImport}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>↑ Import</Hover>
          <Hover as="button" onClick={s.openNewWorkflow}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }}
            hover={{ background: 'var(--jade-deep)' }}>＋ New workflow</Hover>
        </div>
      </header>

      {/* ── BODY ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>
        {/* stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 22 }}>
          {wfStats.map((st, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 15 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--jade-soft)', color: 'var(--jade-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flex: 'none' }}>{st.icon}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 4 }}>{st.label}</div>
                <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: -1, lineHeight: 1, color: 'var(--ink)' }}>{st.value}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 5 }}>{st.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* two-col layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 20, alignItems: 'start' }}>
          {/* ── WORKFLOW LIST ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            {wfList.map((w) => (
              <Hover key={w.id} onClick={() => s.selectWorkflow(w.id)}
                style={{ background: w.bg, border: `1.5px solid ${w.border}`, borderRadius: 16, padding: '15px 16px', cursor: 'pointer' }}
                hover={{ borderColor: 'var(--jade)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: w.nameColor, lineHeight: 1.35 }}>{w.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none', marginTop: 1 }}>
                    <Hover as="button" onClick={(e: MouseEvent) => { e.stopPropagation(); s.reloadWorkflows() }} title="Tải lại dữ liệu workflow"
                      style={{ width: 24, height: 24, borderRadius: 99, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontSize: 13, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>⟳</Hover>
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: w.dotColor, flex: 'none', animation: w.dotPulse }}></span>
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.45, marginBottom: 11 }}>{w.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: w.trigFg, background: w.trigBg, padding: '3px 10px', borderRadius: 99 }}>{w.trigIcon} {w.trigLabel}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-2)' }}>{w.stepCount}</span>
                  <span style={{ fontSize: 11, color: 'var(--placeholder)', marginLeft: 'auto' }}>{w.lastRun}</span>
                </div>
              </Hover>
            ))}
          </div>

          {/* ── DETAIL PANEL ──────────────────────────────────────────────── */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, overflow: 'hidden' }}>
            {/* summary bar */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 5 }}>{aw.name}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{aw.desc}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 'none' }}>
                  {/* delete */}
                  <Hover as="button" onClick={s.wfAskDelete} title="Xóa workflow"
                    style={{ width: 36, height: 36, borderRadius: 99, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontSize: 14, cursor: 'pointer', flex: 'none' }}
                    hover={{ borderColor: 'var(--danger)', color: 'var(--danger)', background: '#FBEAE7' }}>🗑</Hover>
                  {/* enable toggle */}
                  <div onClick={() => s.toggleWorkflow(aw.id)} title="Bật/tắt"
                    style={{ width: 38, height: 21, borderRadius: 99, background: aw.enabled ? 'var(--jade)' : '#CBD5D0', position: 'relative', cursor: 'pointer', transition: 'background .15s' }}>
                    <div style={{ position: 'absolute', top: 2, left: aw.enabled ? 19 : 2, width: 17, height: 17, borderRadius: 99, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)', transition: 'left .15s' }}></div>
                  </div>
                  {/* running: pause + stop */}
                  {awIsRunning && (
                    <>
                      <Hover as="button" onClick={s.pauseWorkflow}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--amber)', background: 'var(--surface)', color: 'var(--warn-ink)', borderRadius: 99, padding: '9px 15px', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                        hover={{ background: 'var(--warn-bg)' }}>{pauseLabel}</Hover>
                      <Hover as="button" onClick={s.stopWorkflow}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--danger)', background: 'var(--surface)', color: 'var(--danger)', borderRadius: 99, padding: '9px 15px', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}
                        hover={{ background: '#FBEAE7' }}>■ Dừng</Hover>
                    </>
                  )}
                  {/* not running: run now */}
                  {awNotRunning && (
                    <Hover as="button" onClick={s.runWorkflow}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '9px 18px', font: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }}
                      hover={{ background: 'var(--jade-deep)' }}>▶ Chạy ngay</Hover>
                  )}
                </div>
              </div>

              {/* trigger chip + stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: awTg.fg, background: awTg.bg, padding: '5px 12px', borderRadius: 99 }}>{awTg.icon} {awTg.label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--line)', padding: '4px 11px', borderRadius: 8 }}>{aw.triggerLabel}</span>
                <span style={{ fontSize: 12, color: 'var(--ink-2)', marginLeft: 'auto' }}>Thành công <b style={{ color: 'var(--jade-deep)' }}>{aw.success}%</b> · {aw.runs24} runs/24h</span>
              </div>

              {/* progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>{awProgressLabel}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--jade-deep)' }}>{awProgressPct}</span>
              </div>
              <div style={{ height: 7, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: awProgressPct, background: 'var(--jade)', borderRadius: 99 }}></div>
              </div>
            </div>

            {/* ── PIPELINE ─────────────────────────────────────────────── */}
            <div style={{ padding: '8px 24px 18px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', padding: '16px 0 6px' }}>Pipeline</div>
              {awSteps.map((st) => (
                <div key={st.idx} style={{ display: 'flex', gap: 16 }}>
                  {/* node + vertical connector */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 'none', width: 34 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 99, background: st.nodeBg, border: st.nodeBorder, color: st.nodeFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flex: 'none', animation: st.nodePulse }}>{st.nodeContent}</div>
                    {st.showLine && (
                      <div style={{ flex: 1, width: 2, minHeight: 30, background: st.lineColor, margin: '2px 0' }}></div>
                    )}
                  </div>
                  {/* step card */}
                  <div style={{ flex: 1, minWidth: 0, paddingBottom: 14 }}>
                    <Hover onClick={() => s.openStepDetail(st.idx)}
                      style={{ border: '1px solid var(--line)', borderRadius: 14, padding: '13px 15px', cursor: 'pointer' }}
                      hover={{ borderColor: 'var(--jade)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                          <div style={{ width: 26, height: 26, borderRadius: 99, background: st.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, flex: 'none' }}>{st.initial}</div>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.agent}</span>
                        </div>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: st.statusFg, background: st.statusBg, padding: '3px 10px', borderRadius: 99, flex: 'none' }}>{st.statusLabel}</span>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>{st.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '3px 9px', borderRadius: 7 }}>{st.io}</span>
                        <span style={{ fontSize: 11, color: 'var(--placeholder)', marginLeft: 'auto' }}>⏱ {st.dur}</span>
                      </div>
                    </Hover>
                  </div>
                </div>
              ))}
            </div>

            {/* ── RECENT RUNS ──────────────────────────────────────────── */}
            <div style={{ padding: '0 24px 22px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', padding: '8px 0 8px' }}>Lần chạy gần đây</div>
              <div style={{ border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
                {awRuns.map((r, i) => (
                  <Hover key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 15px', borderBottom: i < awRuns.length - 1 ? '1px solid var(--line)' : 'none' }} hover={{ background: 'var(--bg)' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: r.dot, flex: 'none' }}></span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: r.labelFg, width: 90, flex: 'none' }}>{r.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', flex: 1 }}>{r.time}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--placeholder)' }}>{r.dur}</span>
                  </Hover>
                ))}
                {awRuns.length === 0 && (
                  <div style={{ padding: 16, fontSize: 12.5, color: 'var(--placeholder)', textAlign: 'center' }}>Chưa có lần chạy nào</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── STEP DETAIL MODAL ────────────────────────────────────────────────── */}
      {s.overlay === 'stepDetail' && sd && (
        <div onClick={s.closeStepDetail} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fadeIn .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 22, boxShadow: '0 24px 60px rgba(22,32,28,.22)', animation: 'pop .2s ease both', overflow: 'hidden' }}>
            <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)' }}>Bước {sd.num} · Pipeline</span>
                <Hover as="button" onClick={s.closeStepDetail}
                  style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 15, cursor: 'pointer', color: 'var(--ink-2)' }}
                  hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.2px', lineHeight: 1.4 }}>{sd.title}</div>
            </div>
            <div style={{ padding: '18px 22px' }}>
              {/* agent row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 13, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 99, background: sd.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flex: 'none' }}>{sd.initial}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)' }}>Agent phụ trách</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>{sd.agent}</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: sd.statusFg, background: sd.statusBg, padding: '4px 11px', borderRadius: 99, flex: 'none' }}>{sd.statusLabel}</span>
              </div>
              {/* dataset io */}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 8 }}>Dataset in / out</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--jade-deep)', background: 'var(--jade-soft)', borderRadius: 11, padding: '12px 14px', marginBottom: 14 }}>{sd.io}</div>
              {/* dur + status */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 13, padding: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 4 }}>Thời lượng</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>⏱ {sd.dur}</div>
                </div>
                <div style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 13, padding: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 4 }}>Trạng thái</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: sd.statusFg }}>{sd.statusLabel}</div>
                </div>
              </div>
              {/* description */}
              <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px' }}>
                Bước này do <b style={{ color: 'var(--ink)' }}>{sd.agent}</b> thực hiện: <b style={{ color: 'var(--ink)' }}>{sd.title}</b>. Agent đọc/ghi dữ liệu qua <span style={{ fontFamily: 'var(--mono)', color: 'var(--jade-deep)' }}>{sd.io}</span> rồi chuyển sang bước kế tiếp trong pipeline.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── WORKFLOW DELETE MODAL ────────────────────────────────────────────── */}
      {s.overlay === 'wfDelete' && (
        <div onClick={s.closeOverlay} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55, animation: 'fadeIn .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 410, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 22, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.28)', animation: 'pop .2s ease both' }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: '#FBEAE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 16 }}>🗑</div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 8, lineHeight: 1.35 }}>Xóa workflow "{aw.name}"?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 24 }}>Toàn bộ pipeline, bước và lịch sử chạy sẽ bị xóa. Không thể hoàn tác.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--line)' }}>Hủy</Hover>
              <Hover as="button" onClick={s.wfDoDelete}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--danger)', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ opacity: .9 }}>Xóa workflow</Hover>
            </div>
          </div>
        </div>
      )}

      {/* ── NEW WORKFLOW MODAL ───────────────────────────────────────────────── */}
      {s.overlay === 'newWorkflow' && (
        <div onClick={s.closeOverlay} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fadeIn .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 24, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.22)', animation: 'pop .2s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Tạo workflow mới</div>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }}
                hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 20, lineHeight: 1.5 }}>Tạo pipeline tự động nhiều bước. Bạn có thể thêm các bước sau khi tạo.</div>

            {/* name */}
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>Tên workflow</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid var(--line)', borderRadius: 14, padding: '0 14px', marginBottom: 18 }}>
              <span style={{ color: 'var(--placeholder)', fontSize: 15 }}>🧩</span>
              <input value={s.wfForm.name} onChange={(e) => s.onWfField('name', e.target.value)} placeholder="vd. Chuẩn bị nội dung tuần"
                style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14.5, padding: '13px 0', background: 'transparent', color: 'var(--ink)' }} />
            </div>

            {/* desc */}
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>Mô tả</label>
            <input value={s.wfForm.desc} onChange={(e) => s.onWfField('desc', e.target.value)} placeholder="Pipeline làm gì…"
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 14, fontFamily: 'inherit', fontSize: 14, padding: '13px 14px', background: 'transparent', color: 'var(--ink)', outline: 'none', marginBottom: 18, boxSizing: 'border-box' }} />

            {/* trigger */}
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>Trigger</label>
            <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: 3, marginBottom: 10 }}>
              {wfTriggerBtns.map((o) => (
                <button key={o.k} onClick={() => s.setWfTrigger(o.k)}
                  style={{ flex: 1, border: 'none', background: s.wfForm.trigger === o.k ? 'var(--jade)' : 'transparent', color: s.wfForm.trigger === o.k ? '#fff' : 'var(--ink-2)', borderRadius: 99, padding: '9px 6px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{o.label}</button>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 10, padding: '10px 13px', marginBottom: 20 }}>{s.wfForm.triggerLabel}</div>

            {/* steps */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)' }}>Các bước pipeline · {s.wfForm.steps.length}</label>
              <Hover as="button" onClick={s.addWfStep}
                style={{ fontSize: 12, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: '6px 13px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade)', color: '#fff' }}>＋ Thêm bước</Hover>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {s.wfForm.steps.map((st, i) => (
                <div key={i} style={{ display: 'flex', gap: 11, border: '1px solid var(--line)', borderRadius: 14, padding: '12px 13px' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 99, background: 'var(--jade-soft)', color: 'var(--jade-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none', marginTop: 2 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <select value={st.agent} onChange={(e) => s.onWfStep(i, 'agent', e.target.value)}
                      style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 10, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, padding: '9px 11px', background: 'var(--surface)', color: 'var(--ink)', outline: 'none', cursor: 'pointer' }}>
                      {wfAgentOptions.map((ag) => <option key={ag} value={ag}>{ag}</option>)}
                    </select>
                    <input value={st.title} onChange={(e) => s.onWfStep(i, 'title', e.target.value)} placeholder="Việc cần làm (vd. Thu thập 12 bài viral)"
                      style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 10, fontFamily: 'inherit', fontSize: 13, padding: '9px 11px', background: 'transparent', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }} />
                    <input value={st.io} onChange={(e) => s.onWfStep(i, 'io', e.target.value)} placeholder="Dataset in/out (vd. → research)"
                      style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 10, fontFamily: 'var(--mono)', fontSize: 12, padding: '9px 11px', background: 'transparent', color: 'var(--ink)', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  {s.wfForm.steps.length > 1 && (
                    <Hover as="button" onClick={() => s.removeWfStep(i)} title="Xóa bước"
                      style={{ width: 28, height: 28, borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--placeholder)', fontSize: 13, cursor: 'pointer', flex: 'none' }}
                      hover={{ background: '#FBEAE7', color: 'var(--danger)' }}>🗑</Hover>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--line)' }}>Hủy</Hover>
              <Hover as="button" onClick={s.createWorkflow}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: createWfBg, border: 'none', borderRadius: 99, padding: '11px 26px', cursor: createWfCursor, fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade-deep)' }}>Tạo workflow</Hover>
            </div>
          </div>
        </div>
      )}

      {/* ── IMPORT MODAL ─────────────────────────────────────────────────────── */}
      {s.overlay === 'wfImport' && (
        <div onClick={s.closeOverlay} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fadeIn .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 440, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 22, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.22)', animation: 'pop .2s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Import workflow</div>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }}
                hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 18, lineHeight: 1.5 }}>Tải lên file JSON định nghĩa workflow (.flow.json) để thêm pipeline.</div>
            <Hover style={{ border: '2px dashed var(--line)', borderRadius: 16, padding: 34, textAlign: 'center' as const, marginBottom: 22, cursor: 'pointer' }} hover={{ borderColor: 'var(--jade)', background: 'var(--jade-soft)' }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>📥</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Kéo thả file workflow</div>
              <div style={{ fontSize: 12, color: 'var(--placeholder)' }}>hoặc bấm để chọn · .flow.json</div>
            </Hover>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--line)' }}>Hủy</Hover>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '11px 24px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade-deep)' }}>Tải lên</Hover>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
