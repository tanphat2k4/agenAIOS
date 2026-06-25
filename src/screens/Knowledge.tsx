import { useStore } from '@/store'
import { Hover } from '@/components/ui/Hover'
import { Modal } from '@/components/ui/Modal'
import { ConfirmModal } from '@/screens/channels/ChannelModals'
import type { KnowledgeEntry } from '@/types'

const catColor: Record<string, { fg: string; bg: string }> = {
  knowledge: { fg: '#28409E', bg: '#E8ECFB' },
  agent: { fg: '#0A7B52', bg: '#E2F3EC' },
  rule: { fg: '#5A6B64', bg: '#EEF2F0' },
  skill: { fg: '#9A6A1B', bg: '#FBF1DE' },
  note: { fg: '#7C3AED', bg: '#F1E9FD' },
  account: { fg: '#0E7490', bg: '#E0F2F4' },
}

const knowTabDefs = [
  { key: 'library', label: 'Library', count: 39 },
  { key: 'pending', label: 'Pending changes', count: 0 },
  { key: 'overrides', label: 'Active overrides', count: 0 },
  { key: 'trash', label: 'Trash', count: 26 },
]

const knowFilterDefs = [
  { key: 'all', label: 'All', count: 39 },
  { key: 'rule', label: 'Rules', count: 9 },
  { key: 'skill', label: 'Skills', count: 2 },
  { key: 'agent', label: 'Agents', count: 18 },
  { key: 'knowledge', label: 'Knowledge', count: 10 },
  { key: 'note', label: 'Notes', count: 0 },
  { key: 'account', label: 'Accounts', count: 0 },
]

const ghostBtn: React.CSSProperties = {
  fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)',
  border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit',
}

function CloseBtn({ onClick }: { onClick: () => void }) {
  return (
    <Hover as="button" onClick={onClick}
      style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)', flex: 'none' }}
      hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
  )
}

export function Knowledge() {
  const s = useStore()

  // ---- computed view model (ported from renderVals) ----
  const knowTabs = knowTabDefs.map((t) => {
    const sel = t.key === s.knowledgeTab
    return {
      key: t.key, label: t.label, count: t.count, onSelect: () => s.setKnowTab(t.key),
      bg: sel ? 'var(--jade-soft)' : 'transparent',
      fg: sel ? 'var(--jade-deep)' : 'var(--ink-2)',
      border: sel ? 'var(--jade)' : 'var(--line)',
      weight: sel ? 700 : 500,
      countFg: sel ? 'var(--jade-deep)' : 'var(--placeholder)',
    }
  })

  const knowFilters = knowFilterDefs.map((f) => {
    const sel = f.key === s.knowledgeFilter
    return {
      key: f.key, label: f.label, count: f.count, onSelect: () => s.setKnowFilter(f.key),
      bg: sel ? 'var(--jade-soft)' : 'var(--surface)',
      border: sel ? 'var(--jade)' : 'var(--line)',
      fg: sel ? 'var(--jade-deep)' : 'var(--ink)',
    }
  })

  const kq = s.knowledgeQuery.trim().toLowerCase()
  const knowVisible: KnowledgeEntry[] = s.knowledgeData
    .filter((k) => s.knowledgeFilter === 'all' || k.type === s.knowledgeFilter)
    .filter((k) => s.knowledgeCategory === 'all' || k.repo === s.knowledgeCategory)
    .filter((k) => !kq || k.title.toLowerCase().includes(kq))

  const knowCats = ['all', 'zy-novel', 'zypage', 'zy-tech'].map((c) => ({
    label: c === 'all' ? 'Tất cả category' : c,
    value: c,
    active: c === s.knowledgeCategory,
    onSelect: () => s.setKnowCategory(c),
  }))
  const knowCatLabel = s.knowledgeCategory === 'all' ? 'Tất cả category' : s.knowledgeCategory

  const knowRows = knowVisible.map((k) => ({
    type: k.type,
    typeFg: (catColor[k.type] || catColor.note).fg,
    typeBg: (catColor[k.type] || catColor.note).bg,
    title: k.title, repo: k.repo, ver: k.ver, time: k.time, isPrivate: !!k.private,
    onOpen: () => (k.hasContent ? s.openKnowledgeContent(k) : s.openEditor(k)),
    onEdit: (e: React.MouseEvent) => s.knowEdit(k, e),
    onDuplicate: (e: React.MouseEvent) => s.knowDuplicate(k.title, e),
    onDelete: (e: React.MouseEvent) => s.knowAskDelete(k.title, e),
    avatars: k.avatars.map((a) => ({ initial: a.i, color: a.c })),
    hasExtra: !!k.extra,
    extra: '+' + (k.extra || 0),
  }))

  const knowTabLibrary = s.knowledgeTab === 'library'
  const knowTabPending = s.knowledgeTab === 'pending'
  const knowTabOverrides = s.knowledgeTab === 'overrides'
  const knowTabTrash = s.knowledgeTab === 'trash'

  return (
    <>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        {/* ===== HEADER ===== */}
        <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>Workspace › Knowledge</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>Knowledge</span>
                <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>39 item · 0 chờ duyệt · 0 hot-edit</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Hover as="button" onClick={s.openKnowExport}
                style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>↓ Export</Hover>
              <Hover as="button" onClick={s.openKnowImport}
                style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>↑ Import</Hover>
              <Hover as="button" onClick={s.newEntry}
                style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 16px rgba(10,92,72,.2)' }}
                hover={{ background: 'var(--jade-deep)' }}>＋ New entry</Hover>
            </div>
          </div>
          {/* tabs */}
          <div style={{ display: 'flex', gap: 8 }}>
            {knowTabs.map((tab) => (
              <Hover key={tab.key} as="button" onClick={tab.onSelect}
                style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${tab.border}`, background: tab.bg, borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 13, fontWeight: tab.weight, color: tab.fg, cursor: 'pointer' }}
                hover={{ borderColor: 'var(--jade)' }}>
                {tab.label}<span style={{ fontSize: 11, fontWeight: 700, color: tab.countFg }}>{tab.count}</span>
              </Hover>
            ))}
          </div>
        </header>

        {/* ===== BODY ===== */}
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 28px 30px' }}>

          {/* filter row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {knowFilters.map((f) => (
                <Hover key={f.key} as="button" onClick={f.onSelect}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, border: `1px solid ${f.border}`, background: f.bg, borderRadius: 99, padding: '7px 14px', font: 'inherit', fontSize: 12.5, fontWeight: 600, color: f.fg, cursor: 'pointer' }}
                  hover={{ borderColor: 'var(--jade)' }}>
                  {f.label}<span style={{ color: 'var(--placeholder)', fontWeight: 700 }}>{f.count}</span>
                </Hover>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
              {/* category dropdown */}
              <div style={{ position: 'relative' }}>
                <Hover as="button" onClick={s.toggleKnowCat}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 11, padding: '9px 14px', font: 'inherit', fontSize: 12.5, color: 'var(--ink-2)', cursor: 'pointer' }}
                  hover={{ borderColor: 'var(--jade)' }}>
                  {knowCatLabel} <span style={{ opacity: 0.6 }}>⌄</span>
                </Hover>
                {s.knowCatOpen && (
                  <div style={{ position: 'absolute', top: 44, left: 0, width: 190, background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 13, boxShadow: '0 12px 32px rgba(22,32,28,.16)', padding: 6, zIndex: 20, animation: 'pop .15s ease both' }}>
                    {knowCats.map((cat) => (
                      <Hover key={cat.value} onClick={cat.onSelect}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 11px', borderRadius: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 500, color: 'var(--ink)' }}
                        hover={{ background: 'var(--jade-soft)' }}>
                        {cat.label}
                        {cat.active && <span style={{ color: 'var(--jade-deep)', fontWeight: 700 }}>✓</span>}
                      </Hover>
                    ))}
                  </div>
                )}
              </div>
              {/* search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line)', background: 'var(--surface)', borderRadius: 11, padding: '9px 14px', width: 240 }}>
                <span style={{ color: 'var(--placeholder)', fontSize: 14 }}>🔍</span>
                <input
                  value={s.knowledgeQuery}
                  onChange={(e) => s.onKnowQuery(e.target.value)}
                  placeholder="Tìm theo title hoặc nội dung…"
                  style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 12.5, background: 'transparent', color: 'var(--ink)' }}
                />
              </div>
            </div>
          </div>

          {/* LIBRARY TAB */}
          {knowTabLibrary && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px' }}>Knowledge library</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>{knowRows.length} mục đang hiển thị</div>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, color: '#0A7B52', background: '#E2F3EC', padding: '5px 12px', borderRadius: 99 }}>● healthy</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 920 }}>
                  {knowRows.map((k, idx) => (
                    <Hover key={idx} onClick={k.onOpen}
                      style={{ display: 'grid', gridTemplateColumns: '108px minmax(240px,1.6fr) minmax(130px,0.9fr) 120px 64px 130px 96px', alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}
                      hover={{ background: 'var(--bg)' }}>
                      {/* type badge */}
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: k.typeFg, background: k.typeBg, padding: '3px 10px', borderRadius: 7 }}>{k.type}</span>
                      </div>
                      {/* title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.title}</span>
                        {k.isPrivate && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', padding: '2px 8px', borderRadius: 99, flex: 'none' }}>🔒 Private</span>
                        )}
                      </div>
                      {/* avatars */}
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {k.avatars.map((a, ai) => (
                          <div key={ai} style={{ width: 26, height: 26, borderRadius: 99, background: a.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, border: '2px solid var(--surface)', marginLeft: ai === 0 ? 0 : -7 }}>{a.initial}</div>
                        ))}
                        {k.hasExtra && (
                          <div style={{ width: 26, height: 26, borderRadius: 99, background: 'var(--bg)', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, border: '2px solid var(--surface)', marginLeft: -7 }}>{k.extra}</div>
                        )}
                      </div>
                      {/* repo */}
                      <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{k.repo}</div>
                      {/* version */}
                      <div>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11.5, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '2px 8px', borderRadius: 6 }}>{k.ver}</span>
                      </div>
                      {/* time */}
                      <div style={{ fontSize: 12, color: 'var(--placeholder)' }}>{k.time}</div>
                      {/* actions */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                        <Hover as="button" onClick={k.onEdit} title="Sửa"
                          style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--ink-2)', fontSize: 12, cursor: 'pointer' }}
                          hover={{ background: 'var(--jade-soft)', color: 'var(--jade-deep)' }}>✎</Hover>
                        <Hover as="button" onClick={k.onDuplicate} title="Nhân bản"
                          style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--ink-2)', fontSize: 12, cursor: 'pointer' }}
                          hover={{ background: 'var(--jade-soft)', color: 'var(--jade-deep)' }}>⧉</Hover>
                        <Hover as="button" onClick={k.onDelete} title="Xóa"
                          style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--ink-2)', fontSize: 12, cursor: 'pointer' }}
                          hover={{ background: '#FBEAE7', color: 'var(--danger)' }}>🗑</Hover>
                      </div>
                    </Hover>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PENDING TAB */}
          {knowTabPending && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 60, textAlign: 'center', color: 'var(--ink-2)' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Không có thay đổi chờ duyệt</div>
              <div style={{ fontSize: 13 }}>Mọi chỉnh sửa knowledge đã được duyệt và áp dụng.</div>
            </div>
          )}

          {/* OVERRIDES TAB */}
          {knowTabOverrides && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 60, textAlign: 'center', color: 'var(--ink-2)' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>🧩</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>Chưa có override nào đang hoạt động</div>
              <div style={{ fontSize: 13 }}>Override cho phép ghi đè knowledge theo từng phòng hoặc agent.</div>
            </div>
          )}

          {/* TRASH TAB */}
          {knowTabTrash && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: 60, textAlign: 'center', color: 'var(--ink-2)' }}>
              <div style={{ fontSize: 36, marginBottom: 14 }}>🗑</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>26 mục trong thùng rác</div>
              <div style={{ fontSize: 13 }}>Các knowledge đã xóa được giữ 30 ngày trước khi xóa vĩnh viễn.</div>
            </div>
          )}

        </div>
      </div>

      {/* ===== MODALS ===== */}

      {/* Export */}
      {s.overlay === 'knowExport' && (
        <Modal onClose={s.closeOverlay} width={440}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Export knowledge</div>
            <CloseBtn onClick={s.closeOverlay} />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 18, lineHeight: 1.5 }}>Xuất toàn bộ knowledge đang hiển thị ra file để sao lưu hoặc chia sẻ.</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 22 }}>
            <Hover style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px', cursor: 'pointer' }} hover={{ borderColor: 'var(--jade)', background: 'var(--jade-soft)' }}>
              <span style={{ fontSize: 18 }}>🗂</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>JSON</div>
                <div style={{ fontSize: 11.5, color: 'var(--placeholder)' }}>Giữ nguyên cấu trúc &amp; metadata</div>
              </div>
              <span style={{ color: 'var(--jade-deep)' }}>↓</span>
            </Hover>
            <Hover style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px', cursor: 'pointer' }} hover={{ borderColor: 'var(--jade)', background: 'var(--jade-soft)' }}>
              <span style={{ fontSize: 18 }}>📄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>Markdown</div>
                <div style={{ fontSize: 11.5, color: 'var(--placeholder)' }}>Mỗi entry một file .md</div>
              </div>
              <span style={{ color: 'var(--jade-deep)' }}>↓</span>
            </Hover>
            <Hover style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 12, padding: '13px 15px', cursor: 'pointer' }} hover={{ borderColor: 'var(--jade)', background: 'var(--jade-soft)' }}>
              <span style={{ fontSize: 18 }}>🗄</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>CSV</div>
                <div style={{ fontSize: 11.5, color: 'var(--placeholder)' }}>Bảng tổng hợp title · type · version</div>
              </div>
              <span style={{ color: 'var(--jade-deep)' }}>↓</span>
            </Hover>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Hover as="button" onClick={s.closeOverlay}
              style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '10px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
              hover={{ background: 'var(--jade-deep)' }}>Xong</Hover>
          </div>
        </Modal>
      )}

      {/* Import */}
      {s.overlay === 'knowImport' && (
        <Modal onClose={s.closeOverlay} width={440}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Import knowledge</div>
            <CloseBtn onClick={s.closeOverlay} />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 18, lineHeight: 1.5 }}>Tải lên file JSON / Markdown / CSV để thêm vào thư viện knowledge.</div>
          <Hover style={{ border: '2px dashed var(--line)', borderRadius: 16, padding: 34, textAlign: 'center', marginBottom: 22, cursor: 'pointer', display: 'block' }} hover={{ borderColor: 'var(--jade)', background: 'var(--jade-soft)' }}>
            <div style={{ fontSize: 34, marginBottom: 10 }}>📥</div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>Kéo thả file vào đây</div>
            <div style={{ fontSize: 12, color: 'var(--placeholder)' }}>hoặc bấm để chọn từ máy · tối đa 20 MB</div>
          </Hover>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Hover as="button" onClick={s.closeOverlay} style={ghostBtn} hover={{ background: 'var(--line)' }}>Hủy</Hover>
            <Hover as="button" onClick={s.closeOverlay}
              style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '11px 24px', cursor: 'pointer', fontFamily: 'inherit' }}
              hover={{ background: 'var(--jade-deep)' }}>Tải lên</Hover>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {s.overlay === 'knowDelete' && (
        <ConfirmModal
          icon="🗑"
          title={`Xóa "${s.knowDeleteTarget}"?`}
          body={<>Entry sẽ chuyển vào thùng rác và giữ 30 ngày trước khi xóa vĩnh viễn.</>}
          confirmLabel="Xóa entry"
          onConfirm={s.knowDoDelete}
          onClose={s.closeOverlay}
        />
      )}

      {/* Analysis report viewer (full-text knowledge) */}
      {s.overlay === 'knowContent' && s.knowContent && (
        <Modal onClose={s.closeOverlay} width={720} bare radius={22} cardStyle={{ maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: '-.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.knowContent.title}</div>
                <div style={{ fontSize: 11.5, color: 'var(--placeholder)' }}>Báo cáo phân tích · TradingAgents</div>
              </div>
            </div>
            <CloseBtn onClick={s.closeOverlay} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: 'var(--bg)' }}>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.65, color: 'var(--ink)', fontFamily: '"Be Vietnam Pro", system-ui' }}>{s.knowContent.body}</div>
          </div>
        </Modal>
      )}
    </>
  )
}
