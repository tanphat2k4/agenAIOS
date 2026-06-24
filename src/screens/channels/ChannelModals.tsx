import { useStore } from '@/store'
import { Modal, ModalHead } from '@/components/ui/Modal'
import { Hover } from '@/components/ui/Hover'
import { Avatar } from '@/components/ui/Avatar'
import { dbRows, roomFiles, membersPool, addPeoplePool } from '@/data/channelsExtra'
import type { Channel } from '@/types'

const wfTitles = ['Lấy fanpage vệ tinh', 'Lọc bài chưa sử dụng', 'Phân tích hook & nội dung', 'Đánh giá độ phù hợp', 'Soạn facebook_post_cho', 'Kiểm tra trùng lặp', 'Ghi session log', 'Gửi Hub duyệt', 'Thông báo thành viên', 'Cập nhật trạng thái']

const ghostBtn: React.CSSProperties = { fontSize: 13.5, fontWeight: 600, color: 'var(--ink-2)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 99, padding: '11px 22px', cursor: 'pointer', fontFamily: 'inherit' }
const dangerBtn: React.CSSProperties = { fontSize: 13.5, fontWeight: 700, color: '#fff', background: 'var(--danger)', border: 'none', borderRadius: 99, padding: '11px 24px', cursor: 'pointer', fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }
const stop = (e: React.MouseEvent) => e.stopPropagation()

export function ChannelModals({ active, memberCount }: { active: Channel | undefined; memberCount: number }) {
  const s = useStore()
  const ov = s.overlay

  // switch results
  const q = s.switchQuery.trim().toLowerCase()
  const flat = [
    ...s.publicData.map((c) => ({ c, kind: 'Public', glyph: '#', color: 'var(--jade-soft)', fg: 'var(--jade-deep)', radius: '9px' })),
    ...s.privateData.map((c) => ({ c, kind: 'Private', glyph: '🔒', color: 'var(--jade-soft)', fg: 'var(--jade-deep)', radius: '9px' })),
    ...s.directData.map((c) => ({ c, kind: 'Direct', glyph: c.initial || '', color: c.color || 'var(--jade)', fg: '#fff', radius: '99px' })),
  ].filter(({ c }) => !q || c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))

  const wfTotal = active?.wfTotal || 0
  const wfDone = 0
  const fv = s.fileDetail
  const ct = s.channelTaskDetail
  const membersList = Array.from({ length: memberCount }).map((_, i) => membersPool[i % membersPool.length])

  return (
    <>
      {/* create channel */}
      {ov === 'create' && (
        <Modal onClose={s.closeOverlay}>
          <ModalHead title="Tạo channel mới" onClose={s.closeOverlay} sub="Channel giúp team gom hội thoại theo dự án và giao việc cho agent." />
          <label style={label}>Tên channel</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${s.createFocused ? 'var(--jade)' : 'var(--line)'}`, borderRadius: 14, padding: '0 14px', marginBottom: 18 }}>
            <span style={{ color: 'var(--placeholder)', fontSize: 15 }}>{s.createForm.type === 'public' ? '#' : '🔒'}</span>
            <input value={s.createForm.name} onChange={(e) => s.onCreateName(e.target.value)} onFocus={s.onCreateNameFocus} onBlur={s.onCreateNameBlur} placeholder="vd. room-zy-marketing" style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 14.5, padding: '13px 0', background: 'transparent', color: 'var(--ink)' }} />
          </div>
          <label style={label}>Quyền riêng tư</label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
            <div onClick={s.setTypePublic} style={{ flex: 1, border: `1.5px solid ${s.createForm.type === 'public' ? 'var(--jade)' : 'var(--line)'}`, background: s.createForm.type === 'public' ? 'var(--jade-soft)' : 'transparent', borderRadius: 14, padding: 13, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}># Public</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>Mọi thành viên workspace đều thấy.</div>
            </div>
            <div onClick={s.setTypePrivate} style={{ flex: 1, border: `1.5px solid ${s.createForm.type === 'private' ? 'var(--jade)' : 'var(--line)'}`, background: s.createForm.type === 'private' ? 'var(--jade-soft)' : 'transparent', borderRadius: 14, padding: 13, cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, fontWeight: 700, marginBottom: 3 }}>🔒 Private</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.4 }}>Chỉ người được mời mới vào.</div>
            </div>
          </div>
          <label style={label}>Mô tả</label>
          <input value={s.createForm.desc} onChange={(e) => s.onCreateDesc(e.target.value)} placeholder="Room channel cho…" style={{ width: '100%', border: '1.5px solid var(--line)', borderRadius: 14, fontFamily: 'inherit', fontSize: 14, padding: '13px 14px', background: 'transparent', color: 'var(--ink)', outline: 'none', marginBottom: 24 }} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Hover as="button" onClick={s.closeOverlay} style={ghostBtn} hover={{ background: 'var(--line)' }}>Hủy</Hover>
            <Hover as="button" onClick={s.createChannel} style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: s.createForm.name.trim() ? 'var(--jade)' : '#9FBDB1', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: s.createForm.name.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }} hover={{ background: 'var(--jade-deep)' }}>Tạo channel</Hover>
          </div>
        </Modal>
      )}

      {/* switch palette */}
      {ov === 'switch' && (
        <Modal onClose={s.closeOverlay} width={520} align="top" bare radius={22}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '16px 20px', borderBottom: '1px solid var(--line)' }}>
            <span style={{ fontSize: 18 }}>🔍</span>
            <input autoFocus value={s.switchQuery} onChange={(e) => s.onSwitchQuery(e.target.value)} placeholder="Tìm channel hoặc DM…" style={{ flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit', fontSize: 16, background: 'transparent', color: 'var(--ink)' }} />
            <span style={{ fontSize: 10.5, color: 'var(--placeholder)', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 7px' }}>ESC</span>
          </div>
          <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: 8 }}>
            {flat.map(({ c, kind, glyph, color, fg, radius }) => (
              <Hover key={c.id} onClick={() => s.selectChannel(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer' }} hover={{ background: 'var(--jade-soft)' }}>
                <Avatar initial={glyph} color={color} fg={fg} radius={radius} size={32} fontSize={14} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.desc}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--placeholder)' }}>{kind}</span>
              </Hover>
            ))}
            {flat.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: 'var(--placeholder)', fontSize: 13 }}>Không tìm thấy kết quả nào</div>}
          </div>
        </Modal>
      )}

      {/* database */}
      {ov === 'db' && (
        <Modal onClose={s.closeOverlay} width={760} bare radius={22} cardStyle={{ maxHeight: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🗄</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.2px' }}>Database · {active?.database}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{dbRows.length} bản ghi · table facebook_post_cho</div>
              </div>
            </div>
            <CloseBtn onClick={s.closeOverlay} />
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '6px 22px 22px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--placeholder)' }}>
                  {['ID', 'Tiêu đề bài viết', 'Fanpage', 'Trạng thái'].map((h) => <th key={h} style={{ padding: '12px 10px', fontWeight: 700, fontSize: 10.5, letterSpacing: '.5px', textTransform: 'uppercase', borderBottom: '1px solid var(--line)' }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {dbRows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ padding: '12px 10px', borderBottom: '1px solid var(--line)', fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--jade-deep)' }}>{r.id}</td>
                    <td style={{ padding: '12px 10px', borderBottom: '1px solid var(--line)', fontWeight: 500, color: 'var(--ink)' }}>{r.title}</td>
                    <td style={{ padding: '12px 10px', borderBottom: '1px solid var(--line)', color: 'var(--ink-2)' }}>{r.page}</td>
                    <td style={{ padding: '12px 10px', borderBottom: '1px solid var(--line)' }}><span style={{ fontSize: 10.5, fontWeight: 700, color: r.statusFg, background: r.statusBg, padding: '3px 10px', borderRadius: 99 }}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* workflow drawer */}
      {ov === 'workflow' && (
        <div onClick={s.closeOverlay} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,28,.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', zIndex: 50, animation: 'fadeIn .15s ease' }}>
          <div onClick={stop} style={{ width: 420, maxWidth: '94vw', height: '100vh', background: 'var(--surface)', boxShadow: '-12px 0 40px rgba(22,32,28,.18)', animation: 'pop .25s ease both', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px', borderBottom: '1px solid var(--line)' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 4 }}>Agent workflow</div>
                <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.2px' }}>{active?.name}</div>
              </div>
              <CloseBtn onClick={s.closeOverlay} />
            </div>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Tiến độ</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--jade-deep)' }}>{wfDone}/{wfTotal}</span>
              </div>
              <div style={{ height: 8, background: 'var(--bg)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: (wfTotal ? Math.round((wfDone / wfTotal) * 100) : 0) + '%', background: 'var(--jade)', borderRadius: 99 }} />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 22px 24px' }}>
              {Array.from({ length: wfTotal }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 13, padding: '11px 0', borderBottom: '1px solid var(--line)' }}>
                  <div style={{ width: 26, height: 26, borderRadius: 99, border: `2px solid ${wfDone > i ? 'var(--jade)' : 'var(--line)'}`, color: wfDone > i ? 'var(--jade-deep)' : 'var(--placeholder)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 700, flex: 'none' }}>{i + 1}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{wfTitles[i] || 'Bước ' + (i + 1)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--ink-2)' }}>{wfDone > i ? 'Hoàn thành' : 'Chưa chạy'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* leave confirm */}
      {ov === 'leave' && (
        <ConfirmModal icon="↩" title={`Rời kênh ${active?.name}?`} body={<>Bạn sẽ không còn nhận tin nhắn từ kênh này. Có thể được mời lại bất cứ lúc nào.</>} confirmLabel="Rời kênh" onConfirm={s.doLeave} onClose={s.closeOverlay} />
      )}

      {/* rename */}
      {ov === 'renameChannel' && (
        <Modal onClose={s.closeOverlay} width={420}>
          <ModalHead title="Đổi tên channel" onClose={s.closeOverlay} sub="Tên mới sẽ hiển thị cho tất cả thành viên của channel." />
          <label style={label}>Tên channel</label>
          <input autoFocus value={s.renameValue} onChange={(e) => s.onRenameInput(e.target.value)} placeholder="Nhập tên mới…" style={{ width: '100%', border: '1.5px solid var(--jade)', borderRadius: 14, fontFamily: 'inherit', fontSize: 14.5, padding: '13px 14px', background: 'transparent', color: 'var(--ink)', outline: 'none', marginBottom: 24 }} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Hover as="button" onClick={s.closeOverlay} style={ghostBtn} hover={{ background: 'var(--line)' }}>Hủy</Hover>
            <Hover as="button" onClick={s.doRename} style={{ fontSize: 13.5, fontWeight: 700, color: '#fff', background: s.renameValue.trim() ? 'var(--jade)' : '#9FBDB1', border: 'none', borderRadius: 99, padding: '11px 26px', cursor: s.renameValue.trim() ? 'pointer' : 'default', fontFamily: 'inherit' }} hover={{ background: 'var(--jade-deep)' }}>Lưu tên</Hover>
          </div>
        </Modal>
      )}

      {/* delete confirm */}
      {ov === 'deleteChannel' && (
        <ConfirmModal icon="🗑" title={`Xóa channel ${s.findChannel(s.deleteTarget || '')?.name || ''}?`} body={<>Toàn bộ tin nhắn và dữ liệu của channel sẽ bị xóa vĩnh viễn. <b style={{ color: 'var(--ink)' }}>Không thể hoàn tác.</b></>} confirmLabel="Xóa channel" onConfirm={s.doDeleteChannel} onClose={s.closeOverlay} />
      )}

      {/* room files */}
      {ov === 'files' && (
        <Modal onClose={s.closeOverlay} width={520} bare radius={22} cardStyle={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--jade-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>📁</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-.2px' }}>Room files</div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{active?.files || active?.id + '/'}</div>
              </div>
            </div>
            <CloseBtn onClick={s.closeOverlay} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {roomFiles.map((f) => (
              <Hover key={f.name} onClick={() => s.openFile(f)} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 13px', borderRadius: 12, cursor: 'pointer' }} hover={{ background: 'var(--bg)' }}>
                <span style={{ fontSize: 22, flex: 'none' }}>{f.icon}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--placeholder)' }}>{f.meta}</div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--placeholder)' }}>{f.time}</span>
                <button onClick={stop} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--jade-deep)', fontSize: 13, cursor: 'pointer', flex: 'none' }}>↓</button>
              </Hover>
            ))}
          </div>
        </Modal>
      )}

      {/* file preview */}
      {ov === 'fileView' && fv && (
        <Modal onClose={s.closeOverlay} width={620} bare radius={22} cardStyle={{ maxHeight: '84vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 22px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              <span style={{ fontSize: 24, flex: 'none' }}>{fv.icon}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 800, letterSpacing: '-.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{fv.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--placeholder)' }}>{fv.meta}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
              <Hover as="button" style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--jade-deep)', borderRadius: 99, padding: '7px 14px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} hover={{ background: 'var(--jade-soft)' }}>↓ Tải về</Hover>
              <CloseBtn onClick={s.closeOverlay} />
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 22, background: 'var(--bg)' }}>
            {fv.kind === 'text' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, padding: '22px 26px', fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.7, color: 'var(--ink)', whiteSpace: 'pre-wrap' }}>
                {(fv.lines || []).map((l, i) => <div key={i}>{l}</div>)}
              </div>
            )}
            {fv.kind === 'csv' && (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead><tr>{(fv.head || []).map((h, i) => <th key={i} style={{ textAlign: 'left', padding: '11px 14px', fontWeight: 700, fontSize: 10.5, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--placeholder)', borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>{h}</th>)}</tr></thead>
                  <tbody>{(fv.rows || []).map((r, ri) => <tr key={ri}>{r.map((cell, ci) => <td key={ci} style={{ padding: '11px 14px', borderBottom: '1px solid var(--line)', color: 'var(--ink)' }}>{cell}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
            {fv.kind === 'image' && (
              <div style={{ background: fv.bg, borderRadius: 14, height: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: 12 }}>
                <span style={{ fontSize: 54 }}>🖼</span>
                <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.92 }}>{fv.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{fv.meta}</div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* channel task detail */}
      {ov === 'channelTask' && ct && (
        <Modal onClose={s.closeOverlay} width={460} bare radius={22} cardStyle={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 13 }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '3px 11px', borderRadius: 8 }}>{ct.id}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.3px', color: 'var(--warn-ink)', background: 'var(--warn-bg)', padding: '3px 11px', borderRadius: 99 }}>{ct.status}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--placeholder)' }}>{ct.time} trước</span>
              <CloseBtn onClick={s.closeOverlay} small />
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.2px', lineHeight: 1.4 }}>{ct.text}</div>
          </div>
          <div style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, border: '1px solid var(--line)', borderRadius: 13, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ width: 34, height: 34, borderRadius: 99, background: 'var(--jade)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flex: 'none' }}>@</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--placeholder)' }}>Phụ trách</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--jade-deep)', marginTop: 2 }}>{ct.assignee}</div>
              </div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 9 }}>Mô tả chi tiết</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: 14, marginBottom: 16 }}>{ct.text} — agent đọc dữ liệu từ <span style={{ fontFamily: 'var(--mono)', color: 'var(--jade-deep)', background: 'var(--jade-soft)', padding: '1px 7px', borderRadius: 6 }}>facebook_post_cho</span>, soạn nội dung đầy đủ theo SOP và cập nhật lại bản ghi khi hoàn tất.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Hover as="button" onClick={s.openWorkflow} style={{ flex: 1, border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: 11, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 6px 16px rgba(40,64,158,.2)' }} hover={{ background: 'var(--jade-deep)' }}>Xem workflow</Hover>
              <Hover as="button" onClick={s.closeOverlay} style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '11px 20px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }} hover={{ background: 'var(--bg)' }}>Đóng</Hover>
            </div>
          </div>
        </Modal>
      )}

      {/* members list */}
      {ov === 'members' && (
        <Modal onClose={s.closeOverlay} width={440} bare radius={22} cardStyle={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 14px' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>Thành viên · {memberCount}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>User và agent trong {active?.name}</div>
            </div>
            <CloseBtn onClick={s.closeOverlay} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px 12px' }}>
            {membersList.map((m, i) => (
              <Hover key={i} onClick={() => s.openPersonCard({ name: m.name, initial: m.initial, color: m.color, role: m.role, isAgent: m.role === 'Agent', isOwner: m.role === 'Owner' })} title="Xem hồ sơ" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer' }} hover={{ background: 'var(--bg)' }}>
                <Avatar initial={m.initial} color={m.color} size={36} fontSize={13} />
                <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.name}</div></div>
                <span style={{ fontSize: 11, fontWeight: 700, color: m.rFg, background: m.rBg, padding: '3px 11px', borderRadius: 99, flex: 'none' }}>{m.role}</span>
              </Hover>
            ))}
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Hover as="button" onClick={s.openAddMember} style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: '9px 16px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade)', color: '#fff' }}>＋ Thêm thành viên</Hover>
            <Hover as="button" onClick={s.closeOverlay} style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '10px 22px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade-deep)' }}>Xong</Hover>
          </div>
        </Modal>
      )}

      {/* add member */}
      {ov === 'addMember' && (
        <Modal onClose={s.closeOverlay} width={460} bare radius={22} cardStyle={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 14px' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.3px' }}>Thêm thành viên</div>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>Thêm user hoặc agent vào {active?.name}</div>
            </div>
            <CloseBtn onClick={s.closeOverlay} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 12px 12px' }}>
            {addPeoplePool.map((p) => (
              <Hover key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12 }} hover={{ background: 'var(--bg)' }}>
                <Avatar initial={p.initial} color={p.color} size={34} fontSize={12} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--placeholder)' }}>{p.sub}</div>
                </div>
                <Hover as="button" onClick={() => s.addMemberTo(p.addArg)} style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--jade-deep)', background: 'var(--jade-soft)', border: 'none', borderRadius: 99, padding: '7px 16px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade)', color: '#fff' }}>Thêm</Hover>
              </Hover>
            ))}
          </div>
          <div style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}>
            <Hover as="button" onClick={s.closeOverlay} style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: 'var(--jade)', border: 'none', borderRadius: 99, padding: '10px 22px', cursor: 'pointer', fontFamily: 'inherit' }} hover={{ background: 'var(--jade-deep)' }}>Xong</Hover>
          </div>
        </Modal>
      )}
    </>
  )
}

function CloseBtn({ onClick, small }: { onClick: () => void; small?: boolean }) {
  const sz = small ? 32 : 34
  return <Hover as="button" onClick={onClick} style={{ width: sz, height: sz, borderRadius: 99, border: 'none', background: 'var(--bg)', fontSize: small ? 15 : 16, cursor: 'pointer', color: 'var(--ink-2)', flex: 'none' }} hover={{ background: 'var(--jade-soft)' }}>✕</Hover>
}

export function ConfirmModal({ icon, title, body, confirmLabel, onConfirm, onClose }: { icon: string; title: string; body: React.ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal onClose={onClose} width={400}>
      <div style={{ width: 52, height: 52, borderRadius: 15, background: '#FBEAE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.3px', marginBottom: 8, lineHeight: 1.35 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginBottom: 24 }}>{body}</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <Hover as="button" onClick={onClose} style={ghostBtn} hover={{ background: 'var(--line)' }}>Hủy</Hover>
        <Hover as="button" onClick={onConfirm} style={dangerBtn} hover={{ opacity: 0.9 }}>{confirmLabel}</Hover>
      </div>
    </Modal>
  )
}
