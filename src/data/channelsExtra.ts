export interface DbRow { id: string; title: string; page: string; status: string; statusFg: string; statusBg: string }
export const dbRows: DbRow[] = [
  { id: 'POST-014', title: 'Bí kíp viết hook giữ chân 3 giây đầu', page: 'Zy Novel Hub', status: 'Đã dùng', statusFg: '#5A6B64', statusBg: '#EEF2F0' },
  { id: 'POST-015', title: 'Top 5 plot twist khiến độc giả nghiện', page: 'Vệ tinh 02', status: 'Chờ duyệt', statusFg: '#9A6A1B', statusBg: '#FBF1DE' },
  { id: 'POST-016', title: 'Cách xây dựng nhân vật phản diện', page: 'Vệ tinh 04', status: 'Mới', statusFg: '#28409E', statusBg: '#E8ECFB' },
  { id: 'POST-017', title: 'Lịch đăng truyện tuần này', page: 'Zy Novel Hub', status: 'Mới', statusFg: '#28409E', statusBg: '#E8ECFB' },
  { id: 'POST-018', title: 'Series review light novel hot', page: 'Vệ tinh 01', status: 'Chờ duyệt', statusFg: '#9A6A1B', statusBg: '#FBF1DE' },
  { id: 'POST-019', title: 'Trend nhạc nền cho reels truyện', page: 'Vệ tinh 03', status: 'Đã dùng', statusFg: '#5A6B64', statusBg: '#EEF2F0' },
]

export interface RoomFile {
  icon: string; name: string; meta: string; time: string
  kind: 'text' | 'image' | 'csv'
  lines?: string[]
  bg?: string
  head?: string[]
  rows?: string[][]
}
export const roomFiles: RoomFile[] = [
  { icon: '📄', name: 'SOP-chuan-bi-noi-dung.pdf', meta: 'PDF · 1,2 MB · Dragon - CEO', time: '2h', kind: 'text', lines: ['# SOP — Chuẩn bị nội dung facebook', '', '1. Lấy fanpage vệ tinh từ dataset `fanpage`.', '2. Chọn 5 bài chưa dùng từ `fanpage_post_source`, sort cũ → mới.', '3. Đánh giá hook, nội dung, độ phù hợp với fanpage vệ tinh.', '4. Thêm bài phù hợp vào `facebook_post_cho` (không tạo cột mới).', '5. Trả kết quả ngắn gọn: "Đã thêm xx bài viết vào danh sách chờ".'] },
  { icon: '🖼', name: 'cover-fanpage-03.png', meta: 'PNG · 840 KB · Franky', time: '1 ngày', kind: 'image', bg: '#3B5BDB' },
  { icon: '🗄', name: 'facebook_post_cho.csv', meta: 'CSV · 64 KB · Nami', time: '1 ngày', kind: 'csv', head: ['ID', 'Tiêu đề', 'Fanpage', 'Trạng thái'], rows: [['POST-014', 'Bí kíp viết hook 3 giây', 'Zy Novel Hub', 'Đã dùng'], ['POST-015', 'Top 5 plot twist', 'Vệ tinh 02', 'Chờ duyệt'], ['POST-016', 'Xây dựng nhân vật phản diện', 'Vệ tinh 04', 'Mới'], ['POST-017', 'Lịch đăng truyện tuần này', 'Zy Novel Hub', 'Mới']] },
  { icon: '📄', name: 'social-data-report-v13.pdf', meta: 'PDF · 2,1 MB · Brook', time: '2 ngày', kind: 'text', lines: ['# Social Data Report v13', '', 'Tổng tương tác tuần: 128,4k (+12%)', 'Bài tốt nhất: "Top 5 plot twist" — 18,2k reach', 'Fanpage dẫn đầu: Vệ tinh 02', 'Tỉ lệ chuyển đổi theo dõi: 3,1%', 'Khuyến nghị: tăng tần suất reels truyện vào 19–21h.'] },
  { icon: '🖼', name: 'hook-reference.jpg', meta: 'JPG · 1,5 MB · Sabo', time: '3 ngày', kind: 'image', bg: '#0EA5A0' },
]

export interface MemberPoolItem { name: string; initial: string; color: string; role: string; rFg: string; rBg: string }
export const membersPool: MemberPoolItem[] = [
  { name: 'Nguyễn Thiện Giang', initial: 'N', color: '#3B5BDB', role: 'Owner', rFg: '#28409E', rBg: '#E8ECFB' },
  { name: 'Dragon - CEO', initial: 'D', color: '#C0392B', role: 'Agent', rFg: '#0A7B52', rBg: '#E2F3EC' },
  { name: 'Sanji - Xào nấu content', initial: 'S', color: '#0EA5A0', role: 'Agent', rFg: '#0A7B52', rBg: '#E2F3EC' },
  { name: 'Morgans - Social Leader', initial: 'M', color: '#8B5CF6', role: 'Agent', rFg: '#0A7B52', rBg: '#E2F3EC' },
  { name: 'Nami - Quản lý Fanpage', initial: 'N', color: '#E8A33D', role: 'Agent', rFg: '#0A7B52', rBg: '#E2F3EC' },
  { name: 'Usopp - Group Seeding', initial: 'U', color: '#C94F3D', role: 'Agent', rFg: '#0A7B52', rBg: '#E2F3EC' },
  { name: 'Sabo - Facebook Research', initial: 'S', color: '#3B82C4', role: 'Agent', rFg: '#0A7B52', rBg: '#E2F3EC' },
  { name: 'Brook - Báo Cáo Zy Novel', initial: 'B', color: '#3B5BDB', role: 'Agent', rFg: '#0A7B52', rBg: '#E2F3EC' },
  { name: 'Robin - Biên tập', initial: 'R', color: '#8B5CF6', role: 'Agent', rFg: '#0A7B52', rBg: '#E2F3EC' },
  { name: 'Lý Minh Hùng', initial: 'LM', color: '#8B5CF6', role: 'Lead', rFg: '#0E7490', rBg: '#E0F2F4' },
  { name: 'Ngô Phi Kiên', initial: 'NP', color: '#3B82C4', role: 'Lead', rFg: '#0E7490', rBg: '#E0F2F4' },
  { name: 'Nguyễn Trần Thế Vỹ', initial: 'NV', color: '#E8A33D', role: 'Lead', rFg: '#0E7490', rBg: '#E0F2F4' },
  { name: 'Franky - Thiết kế', initial: 'F', color: '#0EA5A0', role: 'Agent', rFg: '#0A7B52', rBg: '#E2F3EC' },
  { name: 'Zoro - DevOps', initial: 'Z', color: '#0E7490', role: 'Agent', rFg: '#0A7B52', rBg: '#E2F3EC' },
]

export interface AddPerson { name: string; initial: string; color: string; sub: string; addArg: string }
export const addPeoplePool: AddPerson[] = [
  { name: 'Lý Minh Hùng', initial: 'LM', color: '#8B5CF6', sub: 'user · Lead', addArg: 'Lý Minh Hùng' },
  { name: 'Robin - Biên tập', initial: 'R', color: '#8B5CF6', sub: 'agent · Staff', addArg: 'Robin' },
  { name: 'Zoro - DevOps', initial: 'Z', color: '#0E7490', sub: 'agent · Staff', addArg: 'Zoro' },
  { name: 'Trần Quốc Bảo', initial: 'TB', color: '#0EA5A0', sub: 'user · Staff', addArg: 'Bảo' },
  { name: 'Franky - Thiết kế', initial: 'F', color: '#0EA5A0', sub: 'agent · Staff', addArg: 'Franky' },
]
