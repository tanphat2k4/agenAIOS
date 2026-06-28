import { type MouseEvent } from 'react'
import { useStore, cronSummary } from '@/store'
import type { CronForm } from '@/store'
import type { CronJob } from '@/types'
import { Hover } from '@/components/ui/Hover'
import { useT } from '@/i18n'

// --------------- local helper (mirrors store-private cronExprFrom) ---------------
function exprFrom(f: CronForm): string {
  const p = (f.time || '08:00').split(':')
  const hh = parseInt(p[0], 10) || 0
  const mm = parseInt(p[1], 10) || 0
  if (f.freq === 'daily') return `${mm} ${hh} * * *`
  if (f.freq === 'weekly') return `${mm} ${hh} * * ${f.dow}`
  if (f.freq === 'hourly') return `${mm} * * * *`
  if (f.freq === 'interval') return `*/${f.interval} * * * *`
  return `${mm} ${hh} * * *`
}

const CRON_TARGETS = [
  'Sabo - Facebook Research',
  'Dragon - CEO',
  'Sanji - Xào nấu content',
  'Nami - Quản lý Fanpage',
  'Morgans - Social Leader',
  'Brook - Báo Cáo Zy Novel',
  'Tim - Trợ Lý Zypage',
]

const FREQ_BTNS = [
  { k: 'daily', label: 'Mỗi ngày' },
  { k: 'weekly', label: 'Mỗi tuần' },
  { k: 'hourly', label: 'Mỗi giờ' },
  { k: 'interval', label: 'Khoảng phút' },
]

const DOW_CHIPS = [
  { d: 1, l: 'T2' }, { d: 2, l: 'T3' }, { d: 3, l: 'T4' },
  { d: 4, l: 'T5' }, { d: 5, l: 'T6' }, { d: 6, l: 'T7' }, { d: 0, l: 'CN' },
]

export function Cron() {
  const s = useStore()
  const t = useT()

  // ---- view-model (mirrors renderVals cron block) ----
  const enabledCount = s.cronJobsData.filter((j) => j.enabled).length

  const runs24 = s.cronJobsData.reduce((a, j) => a + (j.spark || []).reduce((x, y) => x + y, 0), 0)
  const scheduled = enabledCount

  const cronStats = [
    { icon: '⏰', label: 'Total cron jobs', value: s.cronJobsData.length, sub: s.cronJobsData.length + ' ' + t('jobs cấu hình') },
    { icon: '▶', label: 'Active', value: enabledCount, sub: (s.cronJobsData.length - enabledCount) + ' disabled' },
    { icon: '📈', label: 'Last 24h runs', value: runs24, sub: runs24 + ' success · 0 failed' },
    { icon: '🔔', label: 'Next 1h scheduled', value: scheduled, sub: t('jobs trong 1 giờ tới') },
  ]

  const cronPills = [
    { label: 'Scheduler', value: enabledCount > 0 ? 'Active' : 'Idle', fg: 'var(--jade-deep)', bg: 'var(--jade-soft)' },
    { label: 'Next window', value: scheduled + ' jobs / 1h', fg: 'var(--jade-deep)', bg: 'var(--jade-soft)' },
    { label: 'Failure rate', value: '0%', fg: 'var(--jade-deep)', bg: 'var(--jade-soft)' },
  ]

  const filterDefs = [
    { key: 'all', label: 'All', count: s.cronJobsData.length, dot: 'var(--jade)' },
    { key: 'active', label: 'Active', count: enabledCount, dot: 'var(--jade)' },
    { key: 'disabled', label: 'Disabled', count: s.cronJobsData.length - enabledCount, dot: 'var(--placeholder)' },
    { key: 'agent', label: t('Tạo bởi agent'), count: 0, dot: '#E8A33D' },
    { key: 'oneshot', label: 'One-shot', count: 0, dot: '#8B5CF6' },
  ]

  let cronVisible: CronJob[] = s.cronJobsData
  if (s.cronFilter === 'active') cronVisible = cronVisible.filter((j) => j.enabled)
  else if (s.cronFilter === 'disabled') cronVisible = cronVisible.filter((j) => !j.enabled)
  else if (s.cronFilter === 'agent' || s.cronFilter === 'oneshot') cronVisible = []

  const cronJobs = cronVisible.map((j) => ({
    ...j,
    toggleBg: j.enabled ? 'var(--jade)' : '#CBD5D0',
    knobLeft: j.enabled ? '17px' : '2px',
    bars: j.spark.map((v) => ({ h: '24px', fill: Math.round(v / 100 * 24) + 'px' })),
  }))

  // ---- modal computed ----
  const f = s.cronForm
  const showNewCron = s.overlay === 'newCron'
  const showCronApply = s.overlay === 'cronApply'
  const showCronDelete = s.overlay === 'cronDelete'
  const cronDeleteName = (s.cronJobsData.find((j) => j.id === s.cronDeleteTarget) || {}).name || ''

  const cronModalTitle = s.editingCronId ? t('Cài đặt cron job') : t('Tạo cron job mới')
  const cronPrimaryLabel = s.editingCronId ? t('Lưu thay đổi') : t('Tạo cron job')
  const cronPrimaryAction = s.editingCronId ? s.askApplyCron : s.createCron
  const createCronBg = f.name.trim() ? 'var(--jade)' : '#9FBDB1'
  const createCronCursor = f.name.trim() ? 'pointer' : 'default'

  const cronShowTime = f.freq === 'daily' || f.freq === 'weekly'
  const cronShowDow = f.freq === 'weekly'
  const cronShowMinute = f.freq === 'hourly'
  const cronShowInterval = f.freq === 'interval'

  const cronFormToggleBg = f.enabled ? 'var(--jade)' : '#CBD5D0'
  const cronFormKnob = f.enabled ? '19px' : '2px'

  const cronSummaryText = cronSummary(f)
  const cronExprText = exprFrom(f)

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* ===== HEADER ===== */}
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › Cron &amp; flows</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>Cron &amp; flows</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{s.devicesData.length} {t('thiết bị')} · {s.devicesData.filter((d) => d.status === 'online').length} online</span>
          </div>
        </div>
        <Hover as="button" onClick={s.openNewCron}
          style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '11px 20px', font: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 16px rgba(40,64,158,.2)' }}
          hover={{ background: 'var(--jade-deep)' }}>＋ New cron</Hover>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>

        {/* ===== STAT CARDS ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
          {cronStats.map((st, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--jade-soft)', color: 'var(--jade-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flex: 'none' }}>{st.icon}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 4 }}>{st.label}</div>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1, color: 'var(--ink)' }}>{st.value}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 5 }}>{st.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ===== PILL STATS ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
          {cronPills.map((p, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>{p.label}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: p.fg, background: p.bg, padding: '5px 13px', borderRadius: 99, whiteSpace: 'nowrap' }}>{p.value}</span>
            </div>
          ))}
        </div>

        {/* ===== FILTER CHIPS ===== */}
        <div style={{ display: 'flex', gap: 9, marginBottom: 18, flexWrap: 'wrap' }}>
          {filterDefs.map((fd) => {
            const sel = fd.key === s.cronFilter
            return (
              <Hover key={fd.key} as="button"
                onClick={() => s.setCronFilter(fd.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${sel ? 'var(--jade)' : 'var(--line)'}`, background: sel ? 'var(--jade-soft)' : 'var(--surface)', borderRadius: 99, padding: '7px 15px', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: sel ? 'var(--jade-deep)' : 'var(--ink)', cursor: 'pointer' }}
                hover={{ borderColor: 'var(--jade)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: fd.dot, flex: 'none' }} />
                {fd.label}
                <span style={{ color: 'var(--placeholder)', fontWeight: 700 }}>{fd.count}</span>
              </Hover>
            )
          })}
        </div>

        {/* ===== TABLE ===== */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15 }}>🕓</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>Scheduled flows</span>
            <span style={{ fontSize: 11.5, color: 'var(--placeholder)' }}>{t('click dòng để sửa cấu hình')}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 1180 }}>
              {/* table header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(230px,1.6fr) 160px 84px minmax(170px,1.2fr) 150px 110px 100px 96px 104px', padding: '11px 20px', borderBottom: '1px solid var(--line)', fontSize: 10, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--placeholder)' }}>
                <div>Name</div>
                <div>Creator</div>
                <div>Type</div>
                <div>Target</div>
                <div>Cron expr</div>
                <div>Last run</div>
                <div>Next run</div>
                <div>Runs 7d</div>
                <div style={{ textAlign: 'right' }}>Actions</div>
              </div>

              {/* table rows */}
              {cronJobs.map((j) => (
                <Hover key={j.id}
                  onClick={() => s.editCron(j)}
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(230px,1.6fr) 160px 84px minmax(170px,1.2fr) 150px 110px 100px 96px 104px', alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                  hover={{ background: 'var(--bg)' }}>

                  {/* name + toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                    <div
                      onClick={(e) => { e.stopPropagation(); s.toggleCron(j.id) }}
                      style={{ width: 34, height: 19, borderRadius: 99, background: j.toggleBg, flex: 'none', position: 'relative', transition: 'background .15s', cursor: 'pointer' }}>
                      <div style={{ position: 'absolute', top: 2, left: j.knobLeft, width: 15, height: 15, borderRadius: 99, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)', transition: 'left .15s' }} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.name}</div>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600, color: 'var(--ink-2)', marginTop: 3 }}>🔒 Private</span>
                    </div>
                  </div>

                  {/* creator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 99, background: j.creatorColor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: 'none' }}>{j.creatorInitial}</div>
                    <span style={{ fontSize: 12, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.creator}</span>
                  </div>

                  {/* type */}
                  <div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '3px 10px', borderRadius: 7 }}>⚙ Task</span>
                  </div>

                  {/* target */}
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{j.target}</div>

                  {/* cron expr */}
                  <div>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--line)', padding: '3px 9px', borderRadius: 7 }}>{j.expr}</span>
                  </div>

                  {/* last run */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-2)' }}>
                    <span style={{ width: 7, height: 7, borderRadius: 99, background: 'var(--jade)', flex: 'none' }} />
                    {j.last}
                  </div>

                  {/* next run */}
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--jade-deep)' }}>{j.next}</div>

                  {/* sparkline */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 24 }}>
                    {j.bars.map((bar, bi) => (
                      <div key={bi} style={{ width: 5, borderRadius: 2, background: 'var(--jade-soft)', height: bar.h }}>
                        <div style={{ width: '100%', borderRadius: 2, background: 'var(--jade)', height: bar.fill }} />
                      </div>
                    ))}
                  </div>

                  {/* actions */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                    <Hover as="button" title={t('Chạy')}
                      onClick={(e: MouseEvent) => s.cronRunNow(j.id, e)}
                      style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--jade-deep)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      hover={{ background: 'var(--jade-soft)' }}>▶</Hover>
                    <Hover as="button" title={t('Sửa')}
                      onClick={(e: MouseEvent) => { e.stopPropagation(); s.editCron(j) }}
                      style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      hover={{ background: 'var(--jade-soft)', color: 'var(--jade-deep)' }}>✎</Hover>
                    <Hover as="button" title={t('Xóa')}
                      onClick={(e: MouseEvent) => s.cronAskDelete(j.id, e)}
                      style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      hover={{ background: '#FBEAE7', color: 'var(--danger)', borderColor: 'var(--danger)' }}>🗑</Hover>
                  </div>
                </Hover>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== MODALS ===== */}

      {/* --- newCron / editCron modal --- */}
      {showNewCron && (
        <div onClick={s.closeOverlay} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fadeIn .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 480, maxWidth: '92vw', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 24, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.22)', animation: 'pop .2s ease both' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>{cronModalTitle}</div>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }}
                hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 20, lineHeight: 1.5 }}>{t('Lên lịch để agent tự động chạy một tác vụ theo chu kỳ.')}</div>

            {/* job name */}
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Tên job')}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid var(--line)', borderRadius: 14, padding: '0 14px', marginBottom: 18 }}>
              <span style={{ color: 'var(--placeholder)', fontSize: 15 }}>⏱</span>
              <input
                autoFocus={!s.editingCronId}
                value={f.name}
                onChange={(e) => s.onCronField('name', e.target.value)}
                placeholder={t('vd. Quét bài mới từ fanpage')}
                style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14.5, padding: '13px 0', background: 'transparent', color: 'var(--ink)' }}
              />
            </div>

            {/* target */}
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Agent đích')}</label>
            <select
              value={f.target}
              onChange={(e) => s.onCronField('target', e.target.value)}
              style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 14, fontFamily: 'inherit', fontSize: 14, padding: '13px 14px', background: 'var(--surface)', color: 'var(--ink)', outline: 'none', marginBottom: 18, cursor: 'pointer' }}>
              {(!f.target || CRON_TARGETS.includes(f.target) ? CRON_TARGETS : [f.target, ...CRON_TARGETS]).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* freq tabs */}
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Lịch chạy')}</label>
            <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: 3, marginBottom: 14 }}>
              {FREQ_BTNS.map((o) => {
                const sel = f.freq === o.k
                return (
                  <button key={o.k} onClick={() => s.onCronField('freq', o.k)}
                    style={{ flex: 1, border: 'none', background: sel ? 'var(--jade)' : 'transparent', color: sel ? '#fff' : 'var(--ink-2)', borderRadius: 99, padding: '9px 6px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {o.label}
                  </button>
                )
              })}
            </div>

            {/* dow chips */}
            {cronShowDow && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {DOW_CHIPS.map((dc) => {
                  const sel = f.dow === dc.d
                  return (
                    <Hover key={dc.d} as="button" onClick={() => s.onCronField('dow', dc.d)}
                      style={{ flex: 1, border: `1.5px solid ${sel ? 'var(--jade)' : 'var(--line)'}`, background: sel ? 'var(--jade)' : 'var(--surface)', color: sel ? '#fff' : 'var(--ink-2)', borderRadius: 10, padding: '9px 0', font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      hover={{ borderColor: 'var(--jade)' }}>
                      {dc.l}
                    </Hover>
                  )
                })}
              </div>
            )}

            {/* time picker (daily / weekly) */}
            {cronShowTime && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid var(--line)', borderRadius: 14, padding: '11px 15px', marginBottom: 16 }}>
                <span style={{ fontSize: 17 }}>🕐</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>{t('Vào lúc')}</span>
                <input type="time" value={f.time}
                  onChange={(e) => s.onCronField('time', e.target.value)}
                  style={{ border: '1px solid var(--line)', borderRadius: 10, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, padding: '8px 11px', background: 'var(--surface)', color: 'var(--ink)', outline: 'none', cursor: 'pointer' }} />
              </div>
            )}

            {/* minute picker (hourly) */}
            {cronShowMinute && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid var(--line)', borderRadius: 14, padding: '11px 15px', marginBottom: 16 }}>
                <span style={{ fontSize: 17 }}>🕐</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>{t('Vào phút thứ (mỗi giờ)')}</span>
                <input type="time" value={f.time}
                  onChange={(e) => s.onCronField('time', e.target.value)}
                  style={{ border: '1px solid var(--line)', borderRadius: 10, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, padding: '8px 11px', background: 'var(--surface)', color: 'var(--ink)', outline: 'none', cursor: 'pointer' }} />
              </div>
            )}

            {/* interval picker */}
            {cronShowInterval && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid var(--line)', borderRadius: 14, padding: '11px 15px', marginBottom: 16 }}>
                <span style={{ fontSize: 17 }}>⏱</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>{t('Chạy mỗi')}</span>
                <input type="number" min={1} max={1440} value={f.interval}
                  onChange={(e) => s.onCronField('interval', parseInt(e.target.value, 10) || 1)}
                  style={{ width: 80, border: '1px solid var(--line)', borderRadius: 10, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, padding: '8px 11px', background: 'var(--surface)', color: 'var(--ink)', outline: 'none', textAlign: 'center' }} />
                <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{t('phút')}</span>
              </div>
            )}

            {/* summary bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--jade-soft)', borderRadius: 12, padding: '11px 14px', marginBottom: 20 }}>
              <span style={{ fontSize: 15 }}>📅</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--jade-deep)', flex: 1 }}>{cronSummaryText}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--jade-deep)', opacity: 0.7 }}>{cronExprText}</span>
            </div>

            {/* enabled toggle row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--line)', borderRadius: 14, padding: '13px 15px', marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{t('Kích hoạt ngay')}</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>{t('Job sẽ bắt đầu chạy theo lịch sau khi tạo')}</div>
              </div>
              <div onClick={s.toggleCronFormEnabled}
                style={{ width: 38, height: 21, borderRadius: 99, background: cronFormToggleBg, position: 'relative', cursor: 'pointer', flex: 'none', transition: 'background .15s' }}>
                <div style={{ position: 'absolute', top: 2, left: cronFormKnob, width: 17, height: 17, borderRadius: 99, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)', transition: 'left .15s' }} />
              </div>
            </div>

            {/* footer buttons */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--line)' }}>{t('Hủy')}</Hover>
              <Hover as="button" onClick={cronPrimaryAction}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: createCronBg, border: 'none', borderRadius: 99, padding: '11px 26px', cursor: createCronCursor, fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade-deep)' }}>{cronPrimaryLabel}</Hover>
            </div>
          </div>
        </div>
      )}

      {/* --- cronApply confirm --- */}
      {showCronApply && (
        <div onClick={s.backToCronForm} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55, animation: 'fadeIn .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 410, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 22, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.28)', animation: 'pop .2s ease both' }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 16 }}>⚙</div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 8 }}>{t('Áp dụng thay đổi?')}</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 24 }}>{t('Bạn có chắc muốn cập nhật cấu hình cron job này vào hệ thống? Lịch chạy sẽ áp dụng từ lần kế tiếp.')}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={s.backToCronForm}
                style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--line)' }}>{t('Quay lại')}</Hover>
              <Hover as="button" onClick={s.applyCron}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade-deep)' }}>{t('Xác nhận áp dụng')}</Hover>
            </div>
          </div>
        </div>
      )}

      {/* --- cronDelete confirm --- */}
      {showCronDelete && (
        <div onClick={s.closeOverlay} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55, animation: 'fadeIn .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 410, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 22, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.28)', animation: 'pop .2s ease both' }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: '#FBEAE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 16 }}>🗑</div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 8, lineHeight: 1.35 }}>{t('Xóa cron job')} "{cronDeleteName}"?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 24 }}>{t('Lịch chạy sẽ dừng và job bị gỡ khỏi danh sách. Không thể hoàn tác.')}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--line)' }}>{t('Hủy')}</Hover>
              <Hover as="button" onClick={s.cronDoDelete}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--danger)', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ opacity: 0.9 }}>{t('Xóa job')}</Hover>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
