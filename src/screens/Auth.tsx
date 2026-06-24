import { useRef, useState, type CSSProperties } from 'react'
import { useStore } from '@/store'
import { Hover } from '@/components/ui/Hover'

const perks = [
  { icon: '🗂️', title: 'Channel & Phòng làm việc', sub: 'Tổ chức hội thoại theo dự án' },
  { icon: '📚', title: 'Knowledge có kiểm duyệt', sub: 'Agent học từ tài liệu của bạn' },
  { icon: '⚡', title: 'Workflow & Cron tự động', sub: 'Lên lịch tác vụ chạy 24/7' },
]

const emailValid = (em: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)
const pwScore = (pw: string) => {
  let s = 0
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}
const sLabels = ['Quá yếu', 'Yếu', 'Trung bình', 'Khá mạnh', 'Mạnh']

const labelText: CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#16201C', marginBottom: 7 }
const fieldIcon: CSSProperties = { position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 19, color: '#9AA8A1' }

export function Auth() {
  const setAuthed = useStore((s) => s.setAuthed)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [terms, setTerms] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [toast, setToast] = useState('')
  const tt = useRef<ReturnType<typeof setTimeout>>()

  const isLogin = mode === 'login'
  const isRegister = mode === 'register'

  const fireToast = (msg: string) => {
    if (tt.current) clearTimeout(tt.current)
    setToast(msg)
    tt.current = setTimeout(() => setToast(''), 2600)
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!emailValid(form.email)) { setEmailTouched(true); return }
    if (mode === 'register') {
      if (!form.name.trim()) { fireToast('Vui lòng nhập họ và tên'); return }
      if (!terms) { fireToast('Vui lòng đồng ý với điều khoản'); return }
      fireToast('Tạo tài khoản thành công! Đang thiết lập workspace…')
    } else {
      fireToast('Đăng nhập thành công! Đang vào workspace…')
    }
    setTimeout(() => setAuthed(true), 650)
  }

  const score = pwScore(form.password)
  const sFill = ['#C94F3D', '#E8A33D', '#E8A33D', '#0A7B52']
  const sColors = ['#E4EAE6', '#E4EAE6', '#E4EAE6', '#E4EAE6']
  for (let i = 0; i < score; i++) sColors[i] = sFill[Math.min(score - 1, 3)]
  const strengthLabel = form.password ? 'Độ mạnh: ' + sLabels[score] : 'Dùng 8+ ký tự, gồm chữ hoa, số và ký tự đặc biệt'
  const emailBad = emailTouched && !!form.email && !emailValid(form.email)

  const tabOn = { bg: '#fff', fg: '#16201C', shadow: '0 1px 4px rgba(22,32,28,.1)' }
  const tabOff = { bg: 'transparent', fg: '#5A6B64', shadow: 'none' }
  const L = isLogin ? tabOn : tabOff
  const R = isRegister ? tabOn : tabOff

  const inputBase: CSSProperties = { width: '100%', border: '1.5px solid #E4EAE6', borderRadius: 11, padding: '12px 13px 12px 41px', font: 'inherit', fontSize: 14, background: '#fff' }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%', background: '#F7F9F7', fontSize: 14 }}>
      {/* BRAND PANEL */}
      <div style={{ width: '46%', flex: 'none', position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg,#28409E 0%,#3B5BDB 58%,#4D6BE8 100%)', color: '#fff', display: 'flex', flexDirection: 'column', padding: '48px 52px' }}>
        <div style={{ position: 'absolute', width: 340, height: 340, borderRadius: '50%', background: 'rgba(255,255,255,.07)', top: -90, right: -70, animation: 'floatA 9s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,.05)', bottom: 60, left: -60, animation: 'floatB 11s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', width: 140, height: 140, borderRadius: 34, background: 'rgba(169,185,242,.18)', bottom: -30, right: 90, transform: 'rotate(22deg)', animation: 'floatB 8s ease-in-out infinite' }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M12 12 L12 5 M12 12 L6 17 M12 12 L18 17" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" /><circle cx="12" cy="12" r="2.7" fill="#fff" /><circle cx="12" cy="5" r="1.9" fill="#fff" /><circle cx="6" cy="17" r="1.9" fill="#fff" /><circle cx="18" cy="17" r="1.9" fill="#fff" /></svg>
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, letterSpacing: '-.4px' }}>AgentAIOS</div>
        </div>
        <div style={{ position: 'relative', marginTop: 'auto', marginBottom: 'auto', maxWidth: 420 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.2)', padding: '6px 13px', borderRadius: 99, fontSize: 12, fontWeight: 600, marginBottom: 22 }}>✨ Nền tảng điều phối Agent AI</div>
          <h1 style={{ fontSize: 38, lineHeight: 1.18, fontWeight: 800, letterSpacing: '-.8px', margin: '0 0 18px' }}>Vận hành đội ngũ<br />agent AI của bạn<br />tại một nơi.</h1>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,.82)', margin: '0 0 30px' }}>Channel, knowledge, workflow và thiết bị — tất cả trong một workspace duy nhất cho doanh nghiệp của bạn.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {perks.map((p) => (
              <div key={p.title} style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
                <div style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, background: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{p.icon}</div>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.68)' }}>{p.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FORM PANEL */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', minWidth: 0 }}>
        <div style={{ width: '100%', maxWidth: 404 }}>
          <div style={{ display: 'flex', background: '#EEF1F6', borderRadius: 14, padding: 5, marginBottom: 28 }}>
            <button onClick={() => setMode('login')} style={{ flex: 1, border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 13.5, fontWeight: 700, padding: 10, borderRadius: 10, transition: 'all .18s', background: L.bg, color: L.fg, boxShadow: L.shadow }}>Đăng nhập</button>
            <button onClick={() => setMode('register')} style={{ flex: 1, border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 13.5, fontWeight: 700, padding: 10, borderRadius: 10, transition: 'all .18s', background: R.bg, color: R.fg, boxShadow: R.shadow }}>Đăng ký</button>
          </div>

          <div key={mode} style={{ animation: 'authFade .3s ease forwards' }}>
            <h2 style={{ fontSize: 25, fontWeight: 800, letterSpacing: '-.5px', margin: '0 0 7px' }}>{isLogin ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}</h2>
            <p style={{ fontSize: 13.5, color: '#5A6B64', margin: '0 0 26px', lineHeight: 1.5 }}>{isLogin ? 'Đăng nhập để tiếp tục vào workspace của bạn.' : 'Bắt đầu miễn phí — không cần thẻ tín dụng.'}</p>

            <div style={{ display: 'flex', gap: 11, marginBottom: 22 }}>
              <Hover as="button" onClick={() => fireToast('Đang chuyển hướng đăng nhập…')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: '#fff', border: '1px solid #E4EAE6', borderRadius: 11, padding: 11, font: 'inherit', fontSize: 13, fontWeight: 600, color: '#16201C', cursor: 'pointer' }} hover={{ background: '#F7F9F7', borderColor: '#CFDAD4' }}><span style={{ fontSize: 15, fontWeight: 800, color: '#4285F4' }}>G</span> Google</Hover>
              <Hover as="button" onClick={() => fireToast('Đang chuyển hướng đăng nhập…')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: '#fff', border: '1px solid #E4EAE6', borderRadius: 11, padding: 11, font: 'inherit', fontSize: 13, fontWeight: 600, color: '#16201C', cursor: 'pointer' }} hover={{ background: '#F7F9F7', borderColor: '#CFDAD4' }}><span style={{ fontSize: 15 }}>🪪</span> SSO</Hover>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
              <div style={{ flex: 1, height: 1, background: '#E4EAE6' }} />
              <span style={{ fontSize: 11.5, color: '#9AA8A1', fontWeight: 500 }}>hoặc dùng email</span>
              <div style={{ flex: 1, height: 1, background: '#E4EAE6' }} />
            </div>

            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isRegister && (
                <label style={{ display: 'block' }}>
                  <span style={labelText}>Họ và tên</span>
                  <div style={{ position: 'relative' }}>
                    <span className="material-symbols-rounded" style={fieldIcon}>person</span>
                    <input className="auth-field" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} type="text" placeholder="Nguyễn Văn A" style={inputBase} />
                  </div>
                </label>
              )}

              <label style={{ display: 'block' }}>
                <span style={labelText}>Email công ty</span>
                <div style={{ position: 'relative' }}>
                  <span className="material-symbols-rounded" style={fieldIcon}>mail</span>
                  <input className="auth-field" value={form.email} onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setEmailTouched(true) }} type="email" placeholder="ban@congty.vn" style={{ ...inputBase, borderColor: emailBad ? '#C94F3D' : '#E4EAE6' }} />
                </div>
                {emailBad && <span style={{ display: 'block', fontSize: 11.5, color: '#C94F3D', marginTop: 6 }}>Email không hợp lệ</span>}
              </label>

              <label style={{ display: 'block' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: '#16201C' }}>Mật khẩu</span>
                  {isLogin && <a onClick={() => fireToast('Đã gửi liên kết đặt lại mật khẩu tới email của bạn')} style={{ fontSize: 11.5, color: '#3B5BDB', fontWeight: 600, cursor: 'pointer', textDecoration: 'none' }}>Quên mật khẩu?</a>}
                </div>
                <div style={{ position: 'relative' }}>
                  <span className="material-symbols-rounded" style={fieldIcon}>lock</span>
                  <input className="auth-field" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} type={showPw ? 'text' : 'password'} placeholder="••••••••" style={{ ...inputBase, padding: '12px 41px' }} />
                  <button type="button" onClick={() => setShowPw((v) => !v)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', cursor: 'pointer', color: '#9AA8A1', display: 'flex', padding: 5 }}><span className="material-symbols-rounded" style={{ fontSize: 19 }}>{showPw ? 'visibility_off' : 'visibility'}</span></button>
                </div>
                {isRegister && (<>
                  <div style={{ display: 'flex', gap: 5, marginTop: 9 }}>
                    {sColors.map((c, i) => <div key={i} style={{ flex: 1, height: 4, borderRadius: 99, background: c }} />)}
                  </div>
                  <span style={{ display: 'block', fontSize: 11, color: '#5A6B64', marginTop: 6 }}>{strengthLabel}</span>
                </>)}
              </label>

              {isLogin && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer', userSelect: 'none', fontSize: 12.5, color: '#5A6B64', marginTop: -2 }}>
                  <span onClick={() => setRemember((v) => !v)} style={{ width: 19, height: 19, borderRadius: 6, border: `1.5px solid ${remember ? '#3B5BDB' : '#CFDAD4'}`, background: remember ? '#3B5BDB' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', transition: 'all .15s' }}><span className="material-symbols-rounded" style={{ fontSize: 15, color: '#fff', opacity: remember ? 1 : 0 }}>check</span></span>
                  Ghi nhớ đăng nhập trong 30 ngày
                </label>
              )}
              {isRegister && (
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer', userSelect: 'none', fontSize: 12, color: '#5A6B64', lineHeight: 1.5, marginTop: -2 }}>
                  <span onClick={() => setTerms((v) => !v)} style={{ width: 19, height: 19, marginTop: 1, borderRadius: 6, border: `1.5px solid ${terms ? '#3B5BDB' : '#CFDAD4'}`, background: terms ? '#3B5BDB' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', transition: 'all .15s' }}><span className="material-symbols-rounded" style={{ fontSize: 15, color: '#fff', opacity: terms ? 1 : 0 }}>check</span></span>
                  <span>Tôi đồng ý với <a style={{ color: '#3B5BDB', fontWeight: 600, textDecoration: 'none' }}>Điều khoản dịch vụ</a> và <a style={{ color: '#3B5BDB', fontWeight: 600, textDecoration: 'none' }}>Chính sách bảo mật</a> của AgentAIOS.</span>
                </label>
              )}

              <Hover as="button" type="submit" style={{ width: '100%', border: 'none', cursor: 'pointer', font: 'inherit', fontSize: 14.5, fontWeight: 700, color: '#fff', background: '#3B5BDB', borderRadius: 12, padding: 13, marginTop: 4, boxShadow: '0 6px 18px rgba(59,91,219,.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background .15s' }} hover={{ background: '#28409E' }}>
                {isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}<span className="material-symbols-rounded" style={{ fontSize: 19 }}>arrow_forward</span>
              </Hover>
            </form>

            <p style={{ textAlign: 'center', fontSize: 13, color: '#5A6B64', margin: '24px 0 0' }}>
              {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'} <a onClick={() => setMode(isLogin ? 'register' : 'login')} style={{ color: '#3B5BDB', fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }}>{isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}</a>
            </p>
          </div>
        </div>

        <div style={{ marginTop: 38, fontSize: 11.5, color: '#9AA8A1', display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>© 2026 AgentAIOS</span><span>·</span><a style={{ color: '#9AA8A1', textDecoration: 'none' }}>Bảo mật</a><span>·</span><a style={{ color: '#9AA8A1', textDecoration: 'none' }}>Hỗ trợ</a>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)', background: '#16201C', color: '#fff', padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 10px 30px rgba(0,0,0,.22)', zIndex: 50, display: 'flex', alignItems: 'center', gap: 9, animation: 'authFade .25s ease forwards' }}><span className="material-symbols-rounded" style={{ fontSize: 18, color: '#7FE6B0' }}>check_circle</span>{toast}</div>
      )}
    </div>
  )
}
