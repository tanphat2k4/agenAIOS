import { useStore } from '@/store'
import { Hover } from '@/components/ui/Hover'
import { Modal, ModalHead } from '@/components/ui/Modal'
import { addPeoplePool } from '@/data/channelsExtra'
import type { RoomMember } from '@/types'

// ---- shared style constants ----
const ghostBtn: React.CSSProperties = {
  fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)',
  background: 'var(--bg)', border: '1px solid var(--line)',
  borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit',
}
const label: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  letterSpacing: '.5px', textTransform: 'uppercase',
  color: 'var(--placeholder)', marginBottom: 7,
}

export function Rooms() {
  const s = useStore()

  // ---- view-model (replicated verbatim from renderVals ~4991–5034) ----
  const activeRoom = s.rooms.find((r) => r.id === s.activeRoom) || s.rooms[1]

  const roomList = s.rooms.map((r) => {
    const sel = r.id === s.activeRoom
    return {
      id: r.id, name: r.name, slug: r.slug,
      onSelect: () => s.selectRoom(r.id),
      bg: sel ? 'var(--jade-soft)' : 'transparent',
      border: sel ? 'var(--jade)' : 'transparent',
      nameColor: sel ? 'var(--jade-deep)' : 'var(--ink)',
      tileBg: sel ? 'var(--jade)' : 'var(--jade-soft)',
      tileFg: sel ? '#fff' : 'var(--jade-deep)',
    }
  })

  const roomMembers = (s.roomMembersById[s.activeRoom] || []).map((m: RoomMember) => ({
    name: m.name, handle: m.handle, initial: m.initial, color: m.color,
    type: m.type,
    typeFg: m.type === 'user' ? '#3B6FB5' : '#28409E',
    typeBg: m.type === 'user' ? '#E6EEF8' : '#E8ECFB',
    role: m.role,
    roleFg: m.role === 'lead' ? '#9A6A1B' : '#28409E',
    roleBg: m.role === 'lead' ? '#FBF1DE' : '#E8ECFB',
    onRemove: () => s.roomRemoveMember(m.name),
  }))

  const memberTotal = (s.roomMembersById[s.activeRoom] || []).length
  const agentTotal = (s.roomMembersById[s.activeRoom] || []).filter((m: RoomMember) => m.type === 'agent').length
  const userTotal = memberTotal - agentTotal

  const roomTabs = [
    { key: 'overview', label: 'Tổng quan', count: 0 },
    { key: 'members', label: 'Thành viên', count: memberTotal },
    { key: 'log', label: 'Log', count: 0 },
    { key: 'settings', label: 'Cài đặt', count: 0 },
  ].map((t) => {
    const sel = t.key === s.roomTab
    return {
      key: t.key, label: t.label, count: t.count,
      onSelect: () => s.selectRoomTab(t.key),
      weight: sel ? 700 : 500,
      color: sel ? 'var(--jade-deep)' : 'var(--ink-2)',
      underline: sel ? 'var(--jade)' : 'transparent',
    }
  })

  const roomStats = [
    { label: 'Thành viên', value: memberTotal, sub: userTotal + ' user · ' + agentTotal + ' agent' },
    { label: 'Channel', value: 1, sub: activeRoom ? activeRoom.slug.split(' ')[0].toLowerCase() : '' },
    { label: 'Trạng thái', value: 'Active', sub: 'Đang hoạt động' },
  ]

  const roomLogs = [
    { actor: 'Dragon - CEO', action: 'đã tạo knowledge mới "Chuẩn bị nội dung facebook".', time: 'Hôm nay · 15:55', dot: 'var(--jade)' },
    { actor: 'Nami - Quản lý Fanpage', action: 'cập nhật lịch đăng 6 fanpage vệ tinh.', time: 'Hôm nay · 11:20', dot: 'var(--jade)' },
    { actor: 'Nguyễn Thiện Giang', action: 'thêm Brook - Báo Cáo Zy Novel vào phòng.', time: 'Hôm qua · 17:42', dot: 'var(--amber)' },
    { actor: 'Sabo - Facebook Research', action: 'hoàn tất research 12 bài viral.', time: 'Hôm qua · 09:10', dot: 'var(--jade)' },
    { actor: 'Hệ thống', action: 'tạo phòng ' + (activeRoom?.name || '') + '.', time: '12/06/2026', dot: 'var(--placeholder)' },
  ]

  const roomSettings = [
    { label: 'Tên phòng', desc: 'Hiển thị trong danh sách phòng', value: activeRoom?.name || '' },
    { label: 'Channel chính', desc: 'Channel mặc định khi mở phòng', value: activeRoom ? activeRoom.slug.split(' ')[0].toLowerCase() : '' },
    { label: 'Quyền truy cập', desc: 'Ai có thể tham gia phòng', value: 'Chỉ được mời' },
    { label: 'Tự động giao việc', desc: 'Agent tự nhận task mới trong phòng', value: 'Bật' },
  ]

  // addPeople: people not already in this room
  const curNames = new Set((s.roomMembersById[s.activeRoom] || []).map((m: RoomMember) => m.name))
  const roomAddPeople: RoomMember[] = addPeoplePool
    .filter((p) => !curNames.has(p.name))
    .map((p) => {
      const isAgent = p.sub.startsWith('agent')
      const isLead = p.sub.includes('lead') || p.sub.includes('Lead')
      return {
        name: p.name,
        handle: p.sub,
        type: isAgent ? 'agent' : 'user',
        role: isLead ? 'lead' : 'staff',
        initial: p.initial,
        color: p.color,
      } as RoomMember
    })

  const activeRoomName = activeRoom?.name || ''
  const activeRoomSlug = activeRoom?.slug || ''
  const roomFormName = s.roomForm.name
  const createRoomBg = roomFormName.trim() ? 'var(--jade)' : '#9FBDB1'
  const createRoomCursor = roomFormName.trim() ? 'pointer' : 'default'
  const ov = s.overlay

  return (
    <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>

      {/* ===== ROOM LIST ===== */}
      <aside style={{ width: 266, flex: 'none', background: 'var(--surface)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '18px 18px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Phòng</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 2 }}>{s.rooms.length} phòng làm việc</div>
          </div>
          <Hover as="button" onClick={s.openNewRoom} title="Tạo phòng mới"
            style={{ width: 30, height: 30, borderRadius: 9, border: '1px solid var(--line)', background: 'var(--jade-soft)', color: 'var(--jade-deep)', fontSize: 17, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            hover={{ background: 'var(--jade)', color: '#fff' }}>＋</Hover>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 14px' }}>
          {roomList.map((r) => (
            <Hover key={r.id} onClick={r.onSelect}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 10px', borderRadius: 13, cursor: 'pointer', marginBottom: 3, background: r.bg, border: `1px solid ${r.border}` }}
              hover={{ background: 'var(--jade-soft)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: r.tileBg, color: r.tileFg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 12, flex: 'none', letterSpacing: '.3px' }}>ZY</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: r.nameColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', color: 'var(--placeholder)', marginTop: 2 }}>{r.slug}</div>
              </div>
            </Hover>
          ))}
        </div>
      </aside>

      {/* ===== ROOM DETAIL ===== */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 26px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 17 }}>🗂</span>
                <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.3px' }}>{activeRoomName}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.3px', color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '3px 11px', borderRadius: 99 }}>● active</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 3, fontWeight: 600, letterSpacing: '.3px' }}>{activeRoomSlug}</div>
            </div>
            <Hover as="button" onClick={s.openRoomEdit}
              style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '8px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
              hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}>✎ Sửa</Hover>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {roomTabs.map((tab) => (
              <Hover as="button" key={tab.key} onClick={tab.onSelect}
                style={{ position: 'relative', border: 'none', background: 'transparent', font: 'inherit', fontSize: 13.5, fontWeight: tab.weight, color: tab.color, padding: '11px 14px', cursor: 'pointer', borderBottom: `2.5px solid ${tab.underline}` }}
                hover={{ color: 'var(--jade-deep)' }}>
                {tab.label}
                {tab.count > 0 && (
                  <span style={{ fontSize: 11.5, color: 'var(--placeholder)', marginLeft: 6, fontWeight: 700 }}>{tab.count}</span>
                )}
              </Hover>
            ))}
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px 30px' }}>

          {/* MEMBERS TAB */}
          {s.roomTab === 'members' && (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.2px' }}>Thành viên phòng</div>
                  <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3 }}>User và agent được phép làm việc trong phòng.</div>
                </div>
                <Hover as="button" onClick={s.openRoomAddMember}
                  style={{ display: 'flex', alignItems: 'center', gap: 7, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 16px rgba(40,64,158,.2)' }}
                  hover={{ background: 'var(--jade-deep)' }}>＋ Thêm thành viên</Hover>
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px 90px', padding: '12px 20px', borderBottom: '1px solid var(--line)', fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)' }}>
                  <div>Thành viên</div><div>Loại</div><div>Vai trò</div><div></div>
                </div>
                {roomMembers.map((m, i) => (
                  <Hover key={i}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 150px 150px 90px', alignItems: 'center', padding: '13px 20px', borderBottom: '1px solid var(--line)' }}
                    hover={{ background: 'var(--bg)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 99, background: m.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flex: 'none' }}>{m.initial}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginTop: 1 }}>{m.handle}</div>
                      </div>
                    </div>
                    <div><span style={{ fontSize: 11, fontWeight: 700, color: m.typeFg, background: m.typeBg, padding: '3px 11px', borderRadius: 99 }}>{m.type}</span></div>
                    <div><span style={{ fontSize: 11, fontWeight: 700, color: m.roleFg, background: m.roleBg, padding: '3px 11px', borderRadius: 99 }}>{m.role}</span></div>
                    <div>
                      <Hover as="button" onClick={m.onRemove}
                        style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0' }}
                        hover={{ color: 'var(--danger)' }}>Remove</Hover>
                    </div>
                  </Hover>
                ))}
              </div>
            </>
          )}

          {/* OVERVIEW TAB */}
          {s.roomTab === 'overview' && (
            <>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.2px', marginBottom: 16 }}>Tổng quan phòng</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 22 }}>
                {roomStats.map((st, i) => (
                  <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 18 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 8 }}>{st.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.5px', color: 'var(--jade-deep)' }}>{st.value}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-2)', marginTop: 4 }}>{st.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 10 }}>Mô tả phòng</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>
                  Phòng <b>{activeRoomName}</b> là không gian làm việc cho team nội dung — nơi các agent phối hợp nghiên cứu, soạn và đăng bài cho hệ thống fanpage vệ tinh. Channel chính: <code style={{ fontFamily: 'var(--mono)', fontSize: 12.5, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '1px 8px', borderRadius: 6 }}>{activeRoomSlug}</code>.
                </div>
              </div>
            </>
          )}

          {/* LOG TAB */}
          {s.roomTab === 'log' && (
            <>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.2px', marginBottom: 16 }}>Nhật ký hoạt động</div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden' }}>
                {roomLogs.map((lg, i) => (
                  <div key={i} style={{ display: 'flex', gap: 13, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 99, background: lg.dot, marginTop: 6, flex: 'none' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: 'var(--ink)' }}><b>{lg.actor}</b> {lg.action}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginTop: 2 }}>{lg.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* SETTINGS TAB */}
          {s.roomTab === 'settings' && (
            <>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.2px', marginBottom: 16 }}>Cài đặt phòng</div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden', marginBottom: 18 }}>
                {roomSettings.map((se, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{se.label}</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{se.desc}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '7px 14px', borderRadius: 99, whiteSpace: 'nowrap', flex: 'none' }}>{se.value}</div>
                  </div>
                ))}
              </div>
              <Hover as="button" onClick={s.roomAskDelete}
                style={{ border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', borderRadius: 99, padding: '11px 22px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                hover={{ background: 'var(--danger)', color: '#fff' }}>Xóa phòng</Hover>
            </>
          )}

        </div>
      </main>

      {/* ===== MODALS ===== */}

      {/* room edit */}
      {ov === 'roomEdit' && (
        <Modal onClose={s.closeOverlay} width={420}>
          <ModalHead title="Sửa phòng" onClose={s.closeOverlay} />
          <label style={label}>Tên phòng</label>
          <input
            value={s.roomForm.name}
            onChange={(e) => s.onRoomField('name', e.target.value)}
            placeholder="Tên phòng"
            autoFocus
            style={{ width: '100%', border: '1.5px solid var(--jade)', borderRadius: 14, fontFamily: 'inherit', fontSize: 14.5, padding: '13px 14px', background: 'transparent', color: 'var(--ink)', outline: 'none', marginBottom: 24, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Hover as="button" onClick={s.closeOverlay} style={ghostBtn} hover={{ background: 'var(--line)' }}>Hủy</Hover>
            <Hover as="button" onClick={s.saveRoomEdit}
              style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: createRoomBg, border: 'none', borderRadius: 99, padding: '11px 26px', cursor: createRoomCursor, fontFamily: 'inherit' }}
              hover={{ background: 'var(--jade-deep)' }}>Lưu</Hover>
          </div>
        </Modal>
      )}

      {/* room add member */}
      {ov === 'roomAddMember' && (
        <div onClick={s.closeOverlay} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fadeIn .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '92vw', maxHeight: '80vh', background: 'var(--surface)', borderRadius: 22, boxShadow: '0 24px 60px rgba(22,32,28,.22)', animation: 'pop .2s ease both', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 14px' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>Thêm thành viên</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>Thêm user hoặc agent vào {activeRoomName}</div>
              </div>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ width: 34, height: 34, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }}
                hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px 12px' }}>
              {roomAddPeople.map((p, i) => (
                <Hover key={i}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12 }}
                  hover={{ background: 'var(--bg)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 99, background: p.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flex: 'none' }}>{p.initial}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--placeholder)' }}>{p.handle}</div>
                  </div>
                  <Hover as="button" onClick={() => s.roomAddMember(p)}
                    style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: '7px 16px', cursor: 'pointer', fontFamily: 'inherit' }}
                    hover={{ background: 'var(--jade)', color: '#fff' }}>Thêm</Hover>
                </Hover>
              ))}
              {roomAddPeople.length === 0 && (
                <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: 13, color: 'var(--placeholder)' }}>Tất cả thành viên đã có trong phòng.</div>
              )}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '10px 22px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade-deep)' }}>Xong</Hover>
            </div>
          </div>
        </div>
      )}

      {/* room delete confirm */}
      {ov === 'roomDelete' && (
        <div onClick={s.closeOverlay} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55, animation: 'fadeIn .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 410, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 22, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.28)', animation: 'pop .2s ease both' }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, background: '#FBEAE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 16 }}>🗑</div>
            <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 8, lineHeight: 1.35 }}>Xóa phòng "{activeRoomName}"?</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 24 }}>Toàn bộ thành viên và liên kết channel của phòng sẽ bị gỡ. Không thể hoàn tác.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={s.closeOverlay} style={ghostBtn} hover={{ background: 'var(--line)' }}>Hủy</Hover>
              <Hover as="button" onClick={s.roomDoDelete}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--danger)', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: 'pointer', fontFamily: 'inherit' }}
                hover={{ opacity: .9 }}>Xóa phòng</Hover>
            </div>
          </div>
        </div>
      )}

      {/* new room */}
      {ov === 'newRoom' && (
        <div onClick={s.closeOverlay} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, animation: 'fadeIn .15s ease' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '92vw', background: 'var(--surface)', borderRadius: 24, padding: 26, boxShadow: '0 24px 60px rgba(22,32,28,.22)', animation: 'pop .2s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px' }}>Tạo phòng mới</div>
              <Hover as="button" onClick={s.closeOverlay}
                style={{ width: 32, height: 32, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: 16, cursor: 'pointer', color: 'var(--ink-2)' }}
                hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginBottom: 20, lineHeight: 1.5 }}>Phòng là không gian làm việc gom channel, thành viên và agent theo một mảng dự án.</div>

            <label style={label}>Tên phòng</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid var(--line)', borderRadius: 14, padding: '0 14px', marginBottom: 18 }}>
              <span style={{ color: 'var(--placeholder)', fontSize: 15 }}>🗂</span>
              <input
                value={s.roomForm.name}
                onChange={(e) => s.onRoomField('name', e.target.value)}
                placeholder="vd. Zy Marketing"
                autoFocus
                style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14.5, padding: '13px 0', background: 'transparent', color: 'var(--ink)' }}
              />
            </div>

            <label style={label}>Channel chính <span style={{ textTransform: 'none', fontWeight: 500 }}>(tùy chọn)</span></label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1.5px solid var(--line)', borderRadius: 14, padding: '0 14px', marginBottom: 18 }}>
              <span style={{ color: 'var(--placeholder)', fontSize: 15 }}>#</span>
              <input
                value={s.roomForm.channel}
                onChange={(e) => s.onRoomField('channel', e.target.value)}
                placeholder="vd. zy-marketing (tự tạo nếu để trống)"
                style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'var(--mono)', fontSize: 13.5, padding: '13px 0', background: 'transparent', color: 'var(--ink)' }}
              />
            </div>

            <label style={label}>Quyền riêng tư</label>
            <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
              <div onClick={() => s.onRoomField('visibility', 'public')}
                style={{ flex: 1, border: `1.5px solid ${s.roomForm.visibility === 'public' ? 'var(--jade)' : 'var(--line)'}`, background: s.roomForm.visibility === 'public' ? 'var(--jade-soft)' : 'transparent', borderRadius: 14, padding: 13, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}># Public</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>Mọi thành viên workspace đều thấy.</div>
              </div>
              <div onClick={() => s.onRoomField('visibility', 'private')}
                style={{ flex: 1, border: `1.5px solid ${s.roomForm.visibility === 'private' ? 'var(--jade)' : 'var(--line)'}`, background: s.roomForm.visibility === 'private' ? 'var(--jade-soft)' : 'transparent', borderRadius: 14, padding: 13, cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>🔒 Private</div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>Chỉ người được mời mới vào.</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover as="button" onClick={s.closeOverlay} style={ghostBtn} hover={{ background: 'var(--line)' }}>Hủy</Hover>
              <Hover as="button" onClick={s.createRoom}
                style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: createRoomBg, border: 'none', borderRadius: 99, padding: '11px 26px', cursor: createRoomCursor, fontFamily: 'inherit' }}
                hover={{ background: 'var(--jade-deep)' }}>Tạo phòng</Hover>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
