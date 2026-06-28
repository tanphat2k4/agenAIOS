import { useStore } from '@/store'
import { useT } from '@/i18n'
import { Hover } from '@/components/ui/Hover'
import type { TaskItem } from '@/types'

// ---- view-model helpers (ported verbatim from renderVals) ----

const prioStyle: Record<string, { fg: string; bg: string; label: string }> = {
  high: { fg: '#C94F3D', bg: '#FBEAE7', label: 'Cao' },
  med:  { fg: '#9A6A1B', bg: '#FBF1DE', label: 'Trung bình' },
  low:  { fg: '#5A6B64', bg: '#EEF2F0', label: 'Thấp' },
}

const colDefs: { key: TaskItem['status']; label: string; accent: string }[] = [
  { key: 'queued',  label: 'Chờ',        accent: '#9AA8A1' },
  { key: 'running', label: 'Đang xử lý', accent: 'var(--jade)' },
  { key: 'review',  label: 'Cần duyệt',  accent: '#E8A33D' },
  { key: 'done',    label: 'Hoàn tất',   accent: '#0A7B52' },
]

const TASK_ROOMS = ['Zy Novel', 'Zy Page', 'Zy Tech', 'general']
const ROOMS_FILTER = ['all', ...TASK_ROOMS]

const stop = (e: React.MouseEvent) => e.stopPropagation()

// ---- Task Drawer ----

function TaskDrawer() {
  const s = useStore()
  const t = useT()
  const td = s.tasksData.find((t) => t.id === s.taskDrawer)
  if (!td) return null

  const p = prioStyle[td.priority]
  const statusBtns = colDefs.map((c) => ({
    key:    c.key,
    label:  c.label,
    bg:     c.key === td.status ? 'var(--jade)' : 'var(--surface)',
    fg:     c.key === td.status ? '#fff'         : 'var(--ink-2)',
    border: c.key === td.status ? 'var(--jade)'  : 'var(--line)',
  }))

  return (
    <div
      onClick={s.closeTask}
      style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'stretch', justifyContent: 'flex-end', zIndex: 45, animation: 'fadeIn .15s ease' }}
    >
      <div
        onClick={stop}
        style={{ width: 420, maxWidth: '94vw', height: '100vh', background: 'var(--surface)', boxShadow: '-12px 0 40px rgba(22,32,28,.18)', animation: 'pop .25s ease both', display: 'flex', flexDirection: 'column' }}
      >
        {/* drawer header */}
        <div style={{ padding: '22px 24px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '3px 11px', borderRadius: 8 }}>{td.id}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: p.fg, background: p.bg, padding: '3px 11px', borderRadius: 99 }}>{t('Ưu tiên')} {t(p.label)}</span>
            </div>
            <Hover as="button" onClick={s.closeTask}
              style={{ width: 34, height: 34, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }}
              hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.2px', lineHeight: 1.35 }}>{td.title}</div>
        </div>

        {/* drawer body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 24px' }}>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink)', marginBottom: 22 }}>{td.desc}</div>

          {/* assignee */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 13, padding: 13, marginBottom: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 99, background: td.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flex: 'none' }}>{td.initial}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)' }}>{t('Phụ trách')}</div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>{td.assignee}</div>
            </div>
          </div>

          {/* room + time */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 13, padding: 13 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 4 }}>{t('Phòng')}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>#{td.room}</div>
            </div>
            <div style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 13, padding: 13 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 4 }}>{t('Tạo lúc')}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{td.time} {t('trước')}</div>
            </div>
          </div>

          {/* status move */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 10 }}>{t('Chuyển trạng thái')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            {statusBtns.map((b) => (
              <Hover key={b.key} as="button"
                onClick={() => s.moveTask(td.id, b.key)}
                style={{ border: `1.5px solid ${b.border}`, background: b.bg, color: b.fg, borderRadius: 11, padding: 11, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                hover={{ borderColor: 'var(--jade)' }}>{t(b.label)}</Hover>
            ))}
          </div>

          {/* edit + delete */}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
            <Hover as="button" onClick={s.openEditTask}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', borderRadius: 11, padding: 12, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              hover={{ background: 'var(--bg)', borderColor: 'var(--jade)' }}>✎ {t('Sửa tác vụ')}</Hover>
            <Hover as="button" onClick={s.askDeleteTask}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid var(--danger)', background: '#FBEAE7', color: 'var(--danger)', borderRadius: 11, padding: 12, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              hover={{ background: 'var(--danger)', color: '#fff' }}>🗑 {t('Xóa tác vụ')}</Hover>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---- Create / Edit Task Modal ----

function TaskModal() {
  const s = useStore()
  const t = useT()
  if (!s.showCreateTask) return null

  const tf = s.taskForm
  const isEdit = !!s.editingTaskId
  const titleText    = isEdit ? t('Sửa tác vụ') : t('Tạo tác vụ mới')
  const subText      = isEdit
    ? `${t('Cập nhật thông tin tác vụ')} ${s.editingTaskId}.`
    : t('Giao việc cho agent hoặc thành viên trong workspace.')
  const submitLabel  = isEdit ? t('Lưu thay đổi') : t('Tạo tác vụ')
  const submitBg     = tf.title.trim() ? 'var(--jade)' : '#9FBDB1'
  const submitCursor = tf.title.trim() ? 'pointer'     : 'default'

  const assignees = s.agentsData.map((a) => a.name)

  const prioBtns = [
    { k: 'high', l: t('Cao') },
    { k: 'med',  l: t('TB')  },
    { k: 'low',  l: t('Thấp') },
  ].map((o) => ({
    k:  o.k,
    label: o.l,
    bg: tf.priority === o.k ? 'var(--jade)' : 'transparent',
    fg: tf.priority === o.k ? '#fff'         : 'var(--ink-2)',
  }))

  const statusBtns = colDefs.map((c) => ({
    key:   c.key,
    label: c.label,
    bg: tf.status === c.key ? 'var(--jade)' : 'transparent',
    fg: tf.status === c.key ? '#fff'         : 'var(--ink-2)',
  }))

  return (
    <div
      onClick={s.closeCreateTask}
      style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, animation: 'fadeIn .15s ease' }}
    >
      <div
        onClick={stop}
        style={{ width: 520, maxWidth: '94vw', maxHeight: '88vh', overflowY: 'auto', background: 'var(--surface)', borderRadius: 22, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.28)', animation: 'pop .2s ease both' }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>{titleText}</div>
          <Hover as="button" onClick={s.closeCreateTask}
            style={{ width: 34, height: 34, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }}
            hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 20, lineHeight: 1.5 }}>{subText}</div>

        {/* title field */}
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Tiêu đề')}</label>
        <input
          autoFocus
          value={tf.title}
          onChange={(e) => s.onTaskField('title', e.target.value)}
          placeholder={t('VD: Viết nội dung 5 fanpage tháng 07')}
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 11, padding: '12px 14px', font: 'inherit', fontSize: 13.5, color: 'var(--ink)', outline: 'none', marginBottom: 16 }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
          onBlur={(e)  => (e.target.style.borderColor = 'var(--line)')}
        />

        {/* desc */}
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Mô tả')}</label>
        <textarea
          value={tf.desc}
          onChange={(e) => s.onTaskField('desc', e.target.value)}
          placeholder={t('Chi tiết việc cần làm, yêu cầu, dataset…')}
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 11, padding: '12px 14px', font: 'inherit', fontSize: 13.5, color: 'var(--ink)', outline: 'none', marginBottom: 16, minHeight: 74, resize: 'vertical', lineHeight: 1.5 }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
          onBlur={(e)  => (e.target.style.borderColor = 'var(--line)')}
        />

        {/* assignee + room row */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Phụ trách')}</label>
            <select
              value={tf.assignee}
              onChange={(e) => s.onTaskField('assignee', e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 11, padding: '12px 14px', font: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none', cursor: 'pointer' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
              onBlur={(e)  => (e.target.style.borderColor = 'var(--line)')}
            >
              <option value="">{t('— Chưa giao —')}</option>
              {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Phòng')}</label>
            <select
              value={tf.room}
              onChange={(e) => s.onTaskField('room', e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 11, padding: '12px 14px', font: 'inherit', fontSize: 13, color: 'var(--ink)', outline: 'none', cursor: 'pointer' }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--jade)')}
              onBlur={(e)  => (e.target.style.borderColor = 'var(--line)')}
            >
              {TASK_ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>

        {/* priority */}
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Ưu tiên')}</label>
        <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: 3, marginBottom: 16 }}>
          {prioBtns.map((o) => (
            <button key={o.k} onClick={() => s.onTaskField('priority', o.k)}
              style={{ flex: 1, border: 'none', background: o.bg, color: o.fg, borderRadius: 99, padding: '9px 6px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
              {o.label}
            </button>
          ))}
        </div>

        {/* initial status */}
        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Trạng thái ban đầu')}</label>
        <div style={{ display: 'flex', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: 3, marginBottom: 24 }}>
          {statusBtns.map((o) => (
            <button key={o.key} onClick={() => s.onTaskField('status', o.key)}
              style={{ flex: 1, border: 'none', background: o.bg, color: o.fg, borderRadius: 99, padding: '9px 6px', font: 'inherit', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>
              {t(o.label)}
            </button>
          ))}
        </div>

        {/* actions */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Hover as="button" onClick={s.closeCreateTask}
            style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
            hover={{ background: 'var(--line)' }}>{t('Hủy')}</Hover>
          <button onClick={s.createTask}
            style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: submitBg, border: 'none', borderRadius: 99, padding: '11px 26px', cursor: submitCursor, fontFamily: 'inherit' }}>
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---- Delete Confirm Modal ----

function DeleteConfirmModal() {
  const s = useStore()
  const t = useT()
  if (!s.taskDeleteConfirm) return null

  const taskDeleteName =
    (s.tasksData.find((t) => t.id === s.taskDrawer) || {}).id || s.editingTaskId || ''
  const dismiss = () => s.set({ taskDeleteConfirm: false })

  return (
    <div
      onClick={dismiss}
      style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, animation: 'fadeIn .15s ease' }}
    >
      <div onClick={stop} style={{ width: 420, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 20, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.28)', animation: 'pop .2s ease both' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: '#FBEAE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>🗑</div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 8 }}>{t('Xóa tác vụ')} {taskDeleteName}?</div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 24 }}>{t('Tác vụ sẽ bị xóa khỏi bảng công việc. Hành động này không thể hoàn tác.')}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Hover as="button" onClick={dismiss}
            style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
            hover={{ background: 'var(--line)' }}>{t('Hủy')}</Hover>
          <Hover as="button" onClick={s.confirmDeleteTask}
            style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--danger)', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: 'pointer', fontFamily: 'inherit' }}
            hover={{ background: '#A63E2E' }}>{t('Xóa tác vụ')}</Hover>
        </div>
      </div>
    </div>
  )
}

// ---- Save Confirm Modal ----

function SaveConfirmModal() {
  const s = useStore()
  const t = useT()
  if (!s.taskSaveConfirm) return null

  const taskDeleteName =
    (s.tasksData.find((t) => t.id === s.taskDrawer) || {}).id || s.editingTaskId || ''
  const dismiss = () => s.set({ taskSaveConfirm: false })

  return (
    <div
      onClick={dismiss}
      style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 80, animation: 'fadeIn .15s ease' }}
    >
      <div onClick={stop} style={{ width: 420, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 20, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.28)', animation: 'pop .2s ease both' }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, marginBottom: 16 }}>💾</div>
        <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 8 }}>{t('Lưu thay đổi')}?</div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 24 }}>{t('Cập nhật thông tin tác vụ')} {taskDeleteName} {t('với các thay đổi vừa nhập.')}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Hover as="button" onClick={dismiss}
            style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
            hover={{ background: 'var(--line)' }}>{t('Tiếp tục sửa')}</Hover>
          <Hover as="button" onClick={s.confirmSaveTask}
            style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: 'pointer', fontFamily: 'inherit' }}
            hover={{ background: 'var(--jade-deep)' }}>{t('Lưu thay đổi')}</Hover>
        </div>
      </div>
    </div>
  )
}

// ---- Main Tasks Screen ----

export function Tasks() {
  const s = useStore()
  const t = useT()
  const T = s.tasksData

  // stat cards
  const tkStats = [
    { icon: '🗂', label: t('Tổng tác vụ'), value: String(T.length),                                       sub: t('trong workspace')   },
    { icon: '⚡', label: t('Đang xử lý'),  value: String(T.filter((t) => t.status === 'running').length), sub: t('agent đang chạy')   },
    { icon: '👀', label: t('Cần duyệt'),   value: String(T.filter((t) => t.status === 'review').length),  sub: t('chờ owner duyệt')   },
    { icon: '✓',  label: t('Hoàn tất'),    value: String(T.filter((t) => t.status === 'done').length),    sub: t('đã xong')           },
  ]

  // room filter chips
  const tkRoomFilters = ROOMS_FILTER.map((r) => {
    const sel = r === s.tasksRoom
    return {
      key:    r,
      label:  r === 'all' ? t('Tất cả phòng') : r,
      onSelect: () => s.setTasksRoom(r),
      bg:     sel ? 'var(--jade-soft)' : 'var(--surface)',
      border: sel ? 'var(--jade)'      : 'var(--line)',
      fg:     sel ? 'var(--jade-deep)' : 'var(--ink)',
    }
  })

  // visible tasks after room + search filter
  const tq = s.tasksQuery.trim().toLowerCase()
  const visibleTasks = T
    .filter((t) => s.tasksRoom === 'all' || t.room === s.tasksRoom)
    .filter((t) => !tq || t.title.toLowerCase().includes(tq) || t.id.toLowerCase().includes(tq) || t.assignee.toLowerCase().includes(tq))

  // kanban columns
  const tkColumns = colDefs.map((c) => {
    const items = visibleTasks.filter((t) => t.status === c.key)
    return {
      key:     c.key,
      label:   c.label,
      accent:  c.accent,
      count:   items.length,
      isEmpty: items.length === 0,
      cards: items.map((t) => {
        const p = prioStyle[t.priority]
        return { ...t, prioFg: p.fg, prioBg: p.bg, prioLabel: p.label }
      }),
    }
  })

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ===== PAGE HEADER ===== */}
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › {t('Tác vụ')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>{t('Tác vụ')}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{t('Bảng công việc của user & agent')}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 11, padding: '9px 14px', width: 230 }}>
            <span style={{ color: 'var(--placeholder)', fontSize: 14 }}>🔍</span>
            <input
              value={s.tasksQuery}
              onChange={(e) => s.set({ tasksQuery: e.target.value })}
              placeholder={t('Tìm theo mã, tiêu đề, agent…')}
              style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, background: 'transparent', color: 'var(--ink)' }}
            />
          </div>
          <Hover as="button" onClick={s.openCreateTask}
            style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }}
            hover={{ background: 'var(--jade-deep)' }}>＋ {t('Tạo tác vụ')}</Hover>
        </div>
      </header>

      {/* ===== SCROLLABLE BODY ===== */}
      <div style={{ flex: 1, overflow: 'auto', padding: '22px 28px 32px' }}>

        {/* stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 18 }}>
          {tkStats.map((st) => (
            <div key={st.label} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 13, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flex: 'none' }}>{st.icon}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 4 }}>{st.label}</div>
                <div style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-.6px', lineHeight: 1, color: 'var(--ink)' }}>{st.value}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 4 }}>{st.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* room filter chips */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {tkRoomFilters.map((f) => (
            <Hover key={f.key} as="button" onClick={f.onSelect}
              style={{ border: `1px solid ${f.border}`, background: f.bg, borderRadius: 99, padding: '7px 15px', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: f.fg, cursor: 'pointer' }}
              hover={{ borderColor: 'var(--jade)' }}>{f.label}</Hover>
          ))}
        </div>

        {/* kanban board */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, alignItems: 'start' }}>
          {tkColumns.map((col) => (
            <div key={col.key} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', minHeight: 120 }}>

              {/* column header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', borderBottom: '1px solid var(--line)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: col.accent, display: 'inline-block', flex: 'none' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{t(col.label)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--placeholder)', background: 'var(--bg)', padding: '2px 9px', borderRadius: 99, marginLeft: 'auto' }}>{col.count}</span>
              </div>

              {/* task cards */}
              <div style={{ padding: 11, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.cards.map((c) => (
                  <Hover key={c.id} onClick={() => s.openTask(c.id)}
                    style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 13, padding: 13, cursor: 'pointer', transition: 'border-color .15s' }}
                    hover={{ borderColor: 'var(--jade)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700, color: 'var(--jade-deep)' }}>{c.id}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: c.prioFg, background: c.prioBg, padding: '2px 8px', borderRadius: 99 }}>{t(c.prioLabel)}</span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: 'var(--ink)', marginBottom: 11 }}>{c.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 99, background: c.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flex: 'none' }}>{c.initial}</div>
                      <span style={{ fontSize: 11, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{c.assignee}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--placeholder)', flex: 'none' }}>{c.time}</span>
                    </div>
                    <div style={{ marginTop: 9, fontSize: 10, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--surface)', border: '1px solid var(--line)', padding: '2px 9px', borderRadius: 99, display: 'inline-block' }}>#{c.room}</div>
                  </Hover>
                ))}
                {col.isEmpty && (
                  <div style={{ textAlign: 'center', color: 'var(--placeholder)', fontSize: 12, padding: '18px 0' }}>{t('Không có tác vụ')}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== OVERLAYS ===== */}
      {s.taskDrawer && <TaskDrawer />}
      <TaskModal />
      <DeleteConfirmModal />
      <SaveConfirmModal />
    </div>
  )
}
