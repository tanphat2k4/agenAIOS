import { useStore } from '@/store'
import { Hover } from '@/components/ui/Hover'
import { useT } from '@/i18n'

export function Profile() {
  const s = useStore()
  const t = useT()

  // ---- computed view-model (mirrors renderVals) ----
  const PD = s.profileData

  const profileTabs = [
    { k: 'profile', label: 'Hồ sơ', icon: '👤' },
    { k: 'security', label: 'Bảo mật', icon: '🔒' },
    { k: 'sessions', label: 'Phiên đăng nhập', icon: '💻' },
  ].map((tab) => ({
    ...tab,
    onSelect: () => s.setProfileTab(tab.k),
    bg: tab.k === s.profileTab ? 'var(--jade-soft)' : 'transparent',
    fg: tab.k === s.profileTab ? 'var(--jade-deep)' : 'var(--ink-2)',
    bd: tab.k === s.profileTab ? 'var(--jade)' : 'transparent',
    weight: tab.k === s.profileTab ? 700 : 500,
  }))

  const profileRows = [
    { icon: '✉️', label: 'Email', value: PD.email },
    { icon: '📞', label: 'Số điện thoại', value: PD.phone },
    { icon: '💼', label: 'Chức danh', value: PD.title },
    { icon: '📍', label: 'Khu vực', value: PD.location },
  ]

  const profileStats = [
    { label: 'Phòng quản lý', value: String(s.rooms.length), icon: '🏠' },
    { label: 'Agent sở hữu', value: String(s.agentsData.length), icon: '🤖' },
    { label: 'Workflow', value: String(s.workflows.length), icon: '⚡' },
    { label: 'Thành viên', value: String(s.usersData.length), icon: '👥' },
  ]

  const avatarInitial = ((PD.name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || 'U').toUpperCase()

  const profSessions = s.profileSessions.map((x) => ({
    ...x,
    notCurrent: !x.current,
    onRevoke: () => s.revokeSession(x.id),
  }))

  const pwValid = !!(s.pwForm.cur && s.pwForm.next && s.pwForm.next === s.pwForm.confirm)
  const pwBtnBg = pwValid ? 'var(--jade)' : '#9FBDB1'
  const pwBtnCursor = pwValid ? 'pointer' : 'default'

  const twoFALabel = s.twoFA ? t('Đang bật') : t('Đang tắt')
  const twoFABg = s.twoFA ? 'var(--jade)' : '#C9D4CF'
  const twoFAX = s.twoFA ? '18px' : '2px'

  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* header */}
      <header style={{ flex: 'none', background: 'var(--surface)', borderBottom: '1px solid var(--line)', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginBottom: 3 }}>{t('Workspace › Tài khoản')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>{t('Tài khoản của tôi')}</span>
            <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{t('Quản lý hồ sơ, bảo mật và phiên đăng nhập')}</span>
          </div>
        </div>
        <Hover
          as="button"
          onClick={s.askLogout}
          style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--danger)', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          hover={{ background: '#FBEAE7', borderColor: 'var(--danger)' }}
        >⏻ {t('Đăng xuất')}</Hover>
      </header>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px 36px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>

          {/* === identity card === */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 20, overflow: 'hidden', marginBottom: 18 }}>
            {/* gradient cover */}
            <div style={{ height: 91, background: 'linear-gradient(120deg,#28409E,#3B5BDB 60%,#0E7490)', width: '100%' }} />
            {/* avatar + info row */}
            <div style={{ padding: '0 24px 22px', display: 'flex', alignItems: 'flex-end', gap: 18, marginTop: -38 }}>
              <div style={{ width: 88, height: 88, borderRadius: 99, background: '#A9B9F2', color: '#28409E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, fontWeight: 800, border: '4px solid var(--surface)', flex: 'none' }}>{avatarInitial}</div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 21, fontWeight: 800, letterSpacing: '-.4px' }}>{PD.name}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#28409E', background: '#E8ECFB', padding: '4px 11px', borderRadius: 99 }}>👑 {t('Owner')}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>{PD.email}</div>
              </div>
              <Hover
                as="button"
                onClick={s.openEditProfile}
                style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', borderRadius: 99, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', flex: 'none', marginBottom: 4 }}
                hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}
              >✎ {t('Chỉnh sửa hồ sơ')}</Hover>
            </div>
            {/* stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderTop: '1px solid var(--line)' }}>
              {profileStats.map((st, i) => (
                <div key={i} style={{ padding: '14px 20px', borderRight: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 11 }}>
                  <span style={{ fontSize: 18 }}>{st.icon}</span>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-.4px', lineHeight: 1 }}>{st.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--placeholder)', marginTop: 3 }}>{t(st.label)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* === tabs === */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {profileTabs.map((tab) => (
              <Hover
                key={tab.k}
                as="button"
                onClick={tab.onSelect}
                style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${tab.bd}`, background: tab.bg, color: tab.fg, borderRadius: 99, padding: '9px 18px', font: 'inherit', fontSize: 13, fontWeight: tab.weight, cursor: 'pointer' }}
                hover={{ borderColor: 'var(--jade)' }}
              >
                <span>{tab.icon}</span>{t(tab.label)}
              </Hover>
            ))}
          </div>

          {/* === profile tab === */}
          {s.profileTab === 'profile' && (
            <>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, padding: '20px 22px', marginBottom: 18 }}>
                <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.2px', marginBottom: 4 }}>{t('Giới thiệu')}</div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)' }}>{PD.bio}</div>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
                <div style={{ padding: '16px 22px 12px', fontSize: 15, fontWeight: 800, letterSpacing: '-.2px' }}>{t('Thông tin liên hệ')}</div>
                {profileRows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 22px', borderTop: '1px solid var(--line)' }}>
                    <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flex: 'none' }}>{r.icon}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--placeholder)', width: 130, flex: 'none' }}>{t(r.label)}</span>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* === security tab === */}
          {s.profileTab === 'security' && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
              {/* password row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 22px' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>🔑 {t('Mật khẩu')}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{t('Đổi lần cuối 3 tháng trước')}</div>
                </div>
                <Hover
                  as="button"
                  onClick={s.openChangePw}
                  style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', borderRadius: 99, padding: '9px 16px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                  hover={{ borderColor: 'var(--jade)', color: 'var(--jade-deep)' }}
                >{t('Đổi mật khẩu')}</Hover>
              </div>
              {/* 2FA row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 22px', borderTop: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>🛡 {t('Xác thực 2 lớp (2FA)')}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                    {t('Bảo vệ tài khoản bằng mã OTP')} · <b style={{ color: 'var(--ink)' }}>{twoFALabel}</b>
                  </div>
                </div>
                <button
                  onClick={s.toggle2FA}
                  style={{ width: 46, height: 26, borderRadius: 99, border: 'none', background: twoFABg, cursor: 'pointer', position: 'relative', flex: 'none', transition: 'background .15s' }}
                >
                  <span style={{ position: 'absolute', top: 3, left: twoFAX, width: 20, height: 20, borderRadius: 99, background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
                </button>
              </div>
              {/* recovery email row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px 22px', borderTop: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>📧 {t('Email khôi phục')}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>giang.backup@gmail.com</div>
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#0A7B52', background: '#E2F3EC', padding: '5px 12px', borderRadius: 99 }}>{t('Đã xác minh')}</span>
              </div>
            </div>
          )}

          {/* === sessions tab === */}
          {s.profileTab === 'sessions' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{t('Các thiết bị đang đăng nhập vào tài khoản của bạn')}</div>
                <Hover
                  as="button"
                  onClick={s.revokeAllSessions}
                  style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--danger)', borderRadius: 99, padding: '8px 15px', font: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
                  hover={{ background: '#FBEAE7', borderColor: 'var(--danger)' }}
                >{t('Đăng xuất tất cả thiết bị khác')}</Hover>
              </div>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 18, overflow: 'hidden' }}>
                {profSessions.map((x) => (
                  <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 22px', borderTop: '1px solid var(--line)' }}>
                    <span style={{ width: 40, height: 40, borderRadius: 11, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flex: 'none' }}>{x.icon}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{x.device}</span>
                        {x.current && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#0A7B52', background: '#E2F3EC', padding: '2px 8px', borderRadius: 99 }}>{t('Thiết bị này')}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--placeholder)', marginTop: 2 }}>{x.where} · {x.time}</div>
                    </div>
                    {x.notCurrent && (
                      <Hover
                        as="button"
                        onClick={x.onRevoke}
                        style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '7px 14px', font: 'inherit', fontSize: 12, fontWeight: 600, cursor: 'pointer', flex: 'none' }}
                        hover={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                      >{t('Đăng xuất')}</Hover>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== edit profile modal ===== */}
      {s.overlay === 'editProfile' && (
        <div
          onClick={s.closeOverlay}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,35,30,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 480, maxWidth: '100%', background: 'var(--surface)', borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,.28)', overflow: 'hidden' }}
          >
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.3px' }}>{t('Chỉnh sửa hồ sơ')}</div>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '60vh', overflow: 'auto' }}>
              {/* name */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Họ và tên')}</div>
                <input
                  value={s.profileForm.name ?? ''}
                  onChange={(e) => s.onProfileField('name', e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 14px', fontFamily: 'inherit', fontSize: 13.5, outline: 'none', background: 'var(--bg)', color: 'var(--ink)', boxSizing: 'border-box' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--jade)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                />
              </div>
              {/* email */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Email')}</div>
                <input
                  value={s.profileForm.email ?? ''}
                  onChange={(e) => s.onProfileField('email', e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 14px', fontFamily: 'inherit', fontSize: 13.5, outline: 'none', background: 'var(--bg)', color: 'var(--ink)', boxSizing: 'border-box' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--jade)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                />
              </div>
              {/* phone + location */}
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Số điện thoại')}</div>
                  <input
                    value={s.profileForm.phone ?? ''}
                    onChange={(e) => s.onProfileField('phone', e.target.value)}
                    style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 14px', fontFamily: 'inherit', fontSize: 13.5, outline: 'none', background: 'var(--bg)', color: 'var(--ink)', boxSizing: 'border-box' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--jade)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Khu vực')}</div>
                  <input
                    value={s.profileForm.location ?? ''}
                    onChange={(e) => s.onProfileField('location', e.target.value)}
                    style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 14px', fontFamily: 'inherit', fontSize: 13.5, outline: 'none', background: 'var(--bg)', color: 'var(--ink)', boxSizing: 'border-box' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--jade)')}
                    onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                  />
                </div>
              </div>
              {/* title */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Chức danh')}</div>
                <input
                  value={s.profileForm.title ?? ''}
                  onChange={(e) => s.onProfileField('title', e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 14px', fontFamily: 'inherit', fontSize: 13.5, outline: 'none', background: 'var(--bg)', color: 'var(--ink)', boxSizing: 'border-box' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--jade)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                />
              </div>
              {/* bio */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Giới thiệu')}</div>
                <textarea
                  value={s.profileForm.bio ?? ''}
                  onChange={(e) => s.onProfileField('bio', e.target.value)}
                  rows={3}
                  style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 14px', fontFamily: 'inherit', fontSize: 13.5, outline: 'none', background: 'var(--bg)', color: 'var(--ink)', boxSizing: 'border-box', resize: 'none' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--jade)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover
                as="button"
                onClick={s.closeOverlay}
                style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                hover={{ borderColor: 'var(--ink-2)' }}
              >{t('Hủy')}</Hover>
              <Hover
                as="button"
                onClick={s.saveProfile}
                style={{ border: 'none', background: 'var(--jade)', color: '#fff', borderRadius: 99, padding: '10px 20px', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                hover={{ background: 'var(--jade-deep)' }}
              >{t('Lưu thay đổi')}</Hover>
            </div>
          </div>
        </div>
      )}

      {/* ===== change password modal ===== */}
      {s.overlay === 'changePw' && (
        <div
          onClick={s.closeOverlay}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,35,30,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 420, maxWidth: '100%', background: 'var(--surface)', borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,.28)', overflow: 'hidden' }}
          >
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.3px' }}>{t('Đổi mật khẩu')}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 3 }}>{t('Mật khẩu mới tối thiểu 8 ký tự')}</div>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* current password */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Mật khẩu hiện tại')}</div>
                <input
                  type="password"
                  value={s.pwForm.cur}
                  onChange={(e) => s.onPwField('cur', e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 14px', fontFamily: 'inherit', fontSize: 13.5, outline: 'none', background: 'var(--bg)', color: 'var(--ink)', boxSizing: 'border-box' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--jade)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                />
              </div>
              {/* new password */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Mật khẩu mới')}</div>
                <input
                  type="password"
                  value={s.pwForm.next}
                  onChange={(e) => s.onPwField('next', e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 14px', fontFamily: 'inherit', fontSize: 13.5, outline: 'none', background: 'var(--bg)', color: 'var(--ink)', boxSizing: 'border-box' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--jade)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                />
              </div>
              {/* confirm password */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: 'var(--placeholder)', marginBottom: 7 }}>{t('Xác nhận mật khẩu mới')}</div>
                <input
                  type="password"
                  value={s.pwForm.confirm}
                  onChange={(e) => s.onPwField('confirm', e.target.value)}
                  style={{ width: '100%', border: '1px solid var(--line)', borderRadius: 11, padding: '11px 14px', fontFamily: 'inherit', fontSize: 13.5, outline: 'none', background: 'var(--bg)', color: 'var(--ink)', boxSizing: 'border-box' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--jade)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--line)')}
                />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Hover
                as="button"
                onClick={s.closeOverlay}
                style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: '10px 18px', font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                hover={{ borderColor: 'var(--ink-2)' }}
              >{t('Hủy')}</Hover>
              <button
                onClick={s.savePw}
                style={{ border: 'none', background: pwBtnBg, color: '#fff', borderRadius: 99, padding: '10px 20px', font: 'inherit', fontSize: 13, fontWeight: 700, cursor: pwBtnCursor }}
              >{t('Đổi mật khẩu')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== logout confirm modal ===== */}
      {s.overlay === 'logout' && (
        <div
          onClick={s.closeOverlay}
          style={{ position: 'fixed', inset: 0, background: 'rgba(20,35,30,.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 24 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 380, maxWidth: '100%', background: 'var(--surface)', borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,.28)', overflow: 'hidden' }}
          >
            <div style={{ padding: '24px 24px 18px', textAlign: 'center' }}>
              <div style={{ width: 52, height: 52, borderRadius: 99, background: '#FBEAE7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, margin: '0 auto 14px' }}>⏻</div>
              <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.3px' }}>{t('Đăng xuất khỏi PHT Entertainment?')}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6, lineHeight: 1.5 }}>{t('Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng workspace.')}</div>
            </div>
            <div style={{ padding: '14px 24px 20px', display: 'flex', gap: 10 }}>
              <Hover
                as="button"
                onClick={s.closeOverlay}
                style={{ flex: 1, border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink-2)', borderRadius: 99, padding: 11, font: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                hover={{ borderColor: 'var(--ink-2)' }}
              >{t('Hủy')}</Hover>
              <Hover
                as="button"
                onClick={s.doLogout}
                style={{ flex: 1, border: 'none', background: 'var(--danger)', color: '#fff', borderRadius: 99, padding: 11, font: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                hover={{ opacity: 0.92 }}
              >{t('Đăng xuất')}</Hover>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
