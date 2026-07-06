import { create } from 'zustand'
import { api, getToken, setToken } from './api/client'
import * as seed from './data/seed'
import type { ChatMessage } from './data/richText'
import type {
  Agent, TaskItem, Device, McpServer, Workflow, CronJob, KnowledgeEntry,
  RoleDef, SessionLog, UserRow, Invite, Signup, Notif, Channel, RoomDef,
  RoomMember, PersonCard, ViewName, Film,
} from './types'
import type { RoomFile } from './data/channelsExtra'

export type { RoomFile }

const cloudModels = ['Claude Sonnet', 'DeepSeek V3']
const roleColors = ['#0E7490', '#7C3AED', '#0A7B52', '#9A6A1B', '#C2410C', '#BE185D']
const uid = (p: string) => p + Math.random().toString(36).slice(2, 9)
const nowTime = () => {
  const d = new Date()
  return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
}

// Fire an API mutation in the background; surface failures as a toast.
// Local state is updated optimistically; hydrate() reconciles ids on reload.
function persist<T>(p: Promise<T>): Promise<T> {
  p.catch((e: unknown) => {
    console.error('[api] mutation failed', e)
    try { useStore.getState().fireToast('Không đồng bộ được với máy chủ') } catch { /* noop */ }
  })
  return p
}

// ----- cron expression helpers (ported) -----
function cronExprFrom(f: CronForm): string {
  const p = (f.time || '08:00').split(':')
  const hh = parseInt(p[0], 10) || 0
  const mm = parseInt(p[1], 10) || 0
  if (f.freq === 'daily') return `${mm} ${hh} * * *`
  if (f.freq === 'weekly') return `${mm} ${hh} * * ${f.dow}`
  if (f.freq === 'hourly') return `${mm} * * * *`
  if (f.freq === 'interval') return `*/${f.interval} * * * *`
  return `${mm} ${hh} * * *`
}
export function cronSummary(f: CronForm): string {
  const dows = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']
  if (f.freq === 'daily') return 'Mỗi ngày lúc ' + f.time
  if (f.freq === 'weekly') return dows[f.dow] + ' hằng tuần lúc ' + f.time
  if (f.freq === 'hourly') return 'Mỗi giờ (phút ' + (f.time || '08:00').split(':')[1] + ')'
  if (f.freq === 'interval') return 'Mỗi ' + f.interval + ' phút'
  return ''
}
function cronParse(expr: string) {
  const p = (expr || '').trim().split(/\s+/)
  if (p.length < 5) return { freq: 'daily' as const, time: '08:00', dow: 1, interval: 30 }
  const mm = p[0], hh = p[1], dow = p[4]
  const pad = (n: number) => ('0' + n).slice(-2)
  if (mm.indexOf('*/') === 0) return { freq: 'interval' as const, interval: parseInt(mm.slice(2), 10) || 30, time: '08:00', dow: 1 }
  if (hh === '*') return { freq: 'hourly' as const, time: '00:' + pad(parseInt(mm, 10) || 0), dow: 1, interval: 30 }
  const h = parseInt((hh + '').split(',')[0], 10) || 0
  const m = parseInt(mm, 10) || 0
  if (dow !== '*' && dow !== '?') return { freq: 'weekly' as const, dow: parseInt(dow, 10) || 1, time: pad(h) + ':' + pad(m), interval: 30 }
  return { freq: 'daily' as const, time: pad(h) + ':' + pad(m), dow: 1, interval: 30 }
}

export interface CronForm { name: string; target: string; freq: string; time: string; dow: number; interval: number; enabled: boolean }
export interface WfFormStep { agent: string; title: string; io: string }
export interface WfForm { name: string; desc: string; trigger: 'cron' | 'event' | 'manual'; triggerLabel: string; steps: WfFormStep[] }
export interface Attach { icon: string; name: string; label: string; url?: string; mime?: string; fileKind?: string }

export const AUTO_DELETE_OPTIONS = [
  { seconds: 0, label: 'Tắt' },
  { seconds: 3600, label: '1 giờ' },
  { seconds: 86400, label: '1 ngày' },
  { seconds: 604800, label: '1 tuần' },
  { seconds: 2592000, label: '1 tháng' },
]
export const autoDeleteLabel = (s?: number): string =>
  AUTO_DELETE_OPTIONS.find((o) => o.seconds === (s || 0))?.label || `${s}s`

export interface AppState {
  // navigation
  authed: boolean
  view: ViewName
  toast: string | null
  // overlay = single-modal slot; some screens use dedicated fields
  overlay: string | null

  // ----- language / region -----
  activeLang: string
  agentLang: string
  timeFormat: string
  dateFormat: string
  weekStart: string
  timezone: string
  currency: string
  langPicker: string | null

  // ----- profile / account -----
  profileTab: string
  personCard: PersonCard | null
  profileData: { name: string; email: string; phone: string; title: string; bio: string; location: string }
  profileForm: Record<string, string>
  twoFA: boolean
  profileSessions: { id: string; device: string; where: string; time: string; current: boolean; icon: string }[]
  pwForm: { cur: string; next: string; confirm: string }

  // ----- users & roles -----
  usersTab: string
  usersRole: string
  usersQuery: string
  signupMenu: string | null
  usersData: UserRow[]
  invitesData: Invite[]
  signupsData: Signup[]
  userMenu: string | null
  editUser: (UserRow & Record<string, unknown>) | null
  inviteForm: { email: string; role: string }

  // ----- notifications / billing -----
  notifFilter: string
  notifsData: Notif[]
  planCycle: string
  billRange: string
  billMonths: { m: string; v: number }[]

  // ----- permissions -----
  activeRole: string
  showCreateRole: boolean
  roleForm: { name: string; icon: string; desc: string }
  showAssignMember: boolean
  assignForm: { name: string; sub: string }
  rolePerms: Record<string, Record<string, boolean>>
  rolesData: RoleDef[]

  // ----- logs -----
  logsTab: string
  activeSession: string
  sessionsData: SessionLog[]
  auditLog: { actor: string; action: string; target: string; lvl: string; time: string }[]

  // ----- devices -----
  devicesFilter: string
  devicesQuery: string
  deviceDrawer: string | null
  showAddDevice: boolean
  devDeleteConfirm: boolean
  devForm: { name: string; type: string; addr: string; role: string }
  devicesData: Device[]

  // ----- tasks -----
  tasksRoom: string
  tasksQuery: string
  taskDrawer: string | null
  taskForm: { title: string; desc: string; assignee: string; room: string; priority: string; status: string }
  showCreateTask: boolean
  editingTaskId: string | null
  taskDeleteConfirm: boolean
  taskSaveConfirm: boolean
  recentActivity: { initial: string; color: string; actor: string; action: string; time: string; tag: string; tagFg: string; tagBg: string }[]
  tasksData: TaskItem[]

  // ----- mcp -----
  mcpFilter: string
  mcpQuery: string
  mcpDrawer: string | null
  mcpDeleteConfirm: boolean
  mcpForm: { name: string; transport: string; endpoint: string; desc: string; tools: string }
  mcpData: McpServer[]

  // ----- agents -----
  agentsFilter: string
  agentsQuery: string
  agentDrawer: string | null
  agentForm: { name: string; role: string; model: string; modelType: string; status: string; desc?: string; skills?: string; rooms?: string[] }
  agentCfg: { id: string | null; model: string; status: string }
  agentsData: Agent[]

  // ----- workflows -----
  activeWorkflow: string
  stepDetail: number | null
  wfForm: WfForm
  workflows: Workflow[]

  // ----- channels / chat -----
  activeRoom: string
  roomTab: string
  activeId: string
  draft: string
  chatSearchOpen: boolean
  chatSearch: string
  attachMenuOpen: boolean
  pendingAttach: Attach | null
  deleteTarget: string | null
  channelTaskDetail: Channel['tasks'][number] | null
  fileDetail: RoomFile | null
  renameTarget: string | null
  renameValue: string
  composerFocused: boolean
  createForm: { name: string; type: string; desc: string }
  createFocused: boolean
  switchQuery: string
  unread: Record<string, number>
  unreadJump: { id: string; count: number } | null  // set on opening a channel with unread → chat scrolls to the first new message
  messages: Record<string, ChatMessage[]>
  publicData: Channel[]
  privateData: Channel[]
  directData: Channel[]

  // ----- cron -----
  cronFilter: string
  cronForm: CronForm
  editingCronId: string | null
  cronDeleteTarget: string | null
  cronJobsData: CronJob[]

  // ----- knowledge / editor -----
  knowledgeTab: string
  knowledgeFilter: string
  knowledgeCategory: string
  knowCatOpen: boolean
  knowDeleteTarget: string | null
  knowContent: { title: string; body: string } | null
  knowledgeQuery: string
  editorMode: string
  editorConfirm: string | null
  editorType: string
  editorTitle: string
  editorCategory: string
  editorTags: string
  editorLoadMode: string
  editorVisibility: string
  editorAgentsChecked: Record<string, boolean>
  editorAgents: { id: string; name: string; sub?: string; initial: string; color: string }[]
  editorText: string
  knowledgeData: KnowledgeEntry[]

  // ----- rooms -----
  rooms: RoomDef[]
  roomForm: { name: string; channel: string; visibility: string }
  roomMembersById: Record<string, RoomMember[]>

  // ----- films (ArcReel) -----
  filmsData: Film[]
  filmForm: { title: string; novel: string; aspectRatio: string; contentMode: string }
  activeFilm: string | null
  showCreateFilm: boolean
}

type Set = (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void
type Get = () => AppState & AppActions

export interface AppActions {
  set: (p: Partial<AppState>) => void
  setAuthed: (v: boolean) => void
  setView: (v: ViewName) => void
  fireToast: (msg: string) => void
  closeOverlay: () => void

  // backend wiring
  login: (email: string, password: string, remember?: boolean) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  bootAuth: () => Promise<void>
  hydrate: () => Promise<void>

  // agents
  setAgentsFilter: (f: string) => void
  openAgent: (id: string) => void
  closeAgent: () => void
  openNewAgent: () => void
  onAgentField: (k: string, v: unknown) => void
  toggleAgentRoom: (id: string) => void
  setAgentModel: (m: string) => void
  createAgent: () => void
  agentAskDelete: () => void
  agentDoDelete: () => void
  openAgentConfig: () => void
  onAgentCfg: (k: string, v: unknown) => void
  saveAgentConfig: () => void

  // mcp
  setMcpFilter: (f: string) => void
  openMcp: (id: string) => void
  closeMcp: () => void
  syncMcp: () => void
  openNewMcp: () => void
  onMcpField: (k: string, v: unknown) => void
  setMcpTransport: (t: string) => void
  createMcp: () => void
  testMcp: () => void
  toggleMcp: () => void
  askDeleteMcp: () => void
  confirmDeleteMcp: () => void

  // tasks
  setTasksRoom: (r: string) => void
  openTask: (id: string) => void
  closeTask: () => void
  askDeleteTask: () => void
  confirmDeleteTask: () => void
  moveTask: (id: string, status: TaskItem['status']) => void
  openCreateTask: () => void
  openEditTask: () => void
  closeCreateTask: () => void
  onTaskField: (k: string, v: unknown) => void
  createTask: () => void
  confirmSaveTask: () => void

  // devices
  setDevicesFilter: (f: string) => void
  pollDevices: () => void
  pollUnread: () => void
  refreshDevices: () => void
  toggleDevicePower: () => void
  openDevSsh: () => void
  askDeleteDevice: () => void
  confirmDeleteDevice: () => void
  openAddDevice: () => void
  closeAddDevice: () => void
  onDevField: (k: string, v: unknown) => void
  createDevice: () => void
  openDevice: (id: string) => void
  closeDevice: () => void

  // films (ArcReel)
  loadFilms: () => Promise<void>
  openCreateFilm: () => void
  closeCreateFilm: () => void
  onFilmField: (k: string, v: unknown) => void
  createFilm: () => Promise<void>
  openFilm: (id: string) => void
  closeFilm: () => void
  refreshFilm: (id: string) => Promise<void>
  approveFilm: (id: string, selections?: Record<string, number>) => Promise<void>
  cancelFilm: (id: string) => Promise<void>

  // logs
  setLogsTab: (t: string) => void
  selectSession: (id: string) => void
  deleteSession: (id: string) => void
  clearSessions: () => void
  askClearLogs: () => void

  // perms
  selectRole: (id: string) => void
  togglePerm: (role: string, pid: string) => void
  openCreateRole: () => void
  closeCreateRole: () => void
  onRoleField: (k: string, v: unknown) => void
  createRole: () => void
  openAssignMember: () => void
  closeAssignMember: () => void
  onAssignField: (k: string, v: unknown) => void
  assignMember: () => void
  removeRoleMember: (name: string) => void

  // billing / notifs
  setBillRange: (r: string) => void
  openNotifs: () => void
  setNotifFilter: (f: string) => void
  markRead: (id: string) => void
  markAllRead: () => void
  deleteNotif: (id: string) => void
  clearNotifs: () => void
  setPlanCycle: (c: string) => void

  // language
  openLanguage: () => void
  setLang: (l: string) => void
  setAgentLang: (l: string) => void
  setTimeFormat: (f: string) => void
  setDateFormat: (f: string) => void
  setWeekStart: (w: string) => void
  openLangPicker: (kind: string) => void
  closeLangPicker: () => void
  setTimezone: (v: string) => void
  setCurrency: (v: string) => void
  resetLangDefaults: () => void
  saveLang: () => void

  // person card / profile
  openPersonCard: (p: PersonCard) => void
  closePersonCard: () => void
  personViewProfile: () => void
  openProfile: () => void
  setProfileTab: (t: string) => void
  openEditProfile: () => void
  onProfileField: (k: string, v: string) => void
  saveProfile: () => void
  toggle2FA: () => void
  openChangePw: () => void
  onPwField: (k: string, v: string) => void
  savePw: () => void
  revokeSession: (id: string) => void
  revokeAllSessions: () => void
  askLogout: () => void
  doLogout: () => void

  // users
  setUsersTab: (t: string) => void
  setUsersRole: (r: string) => void
  cycleRole: (id: string) => void
  openInvite: () => void
  onInviteEmail: (v: string) => void
  setInviteRole: (r: string) => void
  submitInvite: () => void
  resendInvite: (id: string) => void
  cancelInvite: (id: string) => void
  openUserMenu: (id: string) => void
  closeUserMenu: () => void
  openEditUser: (id: string) => void
  closeEditUser: () => void
  onEditUserField: (k: string, v: string) => void
  setEditUserRole: (role: string) => void
  setEditUserStatus: (status: string) => void
  saveEditUser: () => void
  toggleUserStatus: () => void
  removeUser: () => void
  approveSignup: (id: string) => void
  rejectSignup: (id: string) => void
  openSignupMenu: (id: string) => void
  setSignupRole: (id: string, role: string) => void

  // workflows
  selectWorkflow: (id: string) => void
  toggleWorkflow: (id: string) => void
  wfAskDelete: () => void
  wfDoDelete: () => void
  runWorkflow: () => void
  pauseWorkflow: () => void
  stopWorkflow: () => void
  openNewWorkflow: () => void
  onWfField: (k: string, v: unknown) => void
  setWfTrigger: (t: 'cron' | 'event' | 'manual') => void
  addWfStep: () => void
  removeWfStep: (i: number) => void
  onWfStep: (i: number, k: string, v: string) => void
  createWorkflow: () => void
  openWfImport: () => void
  openStepDetail: (i: number) => void
  closeStepDetail: () => void

  // rooms
  selectRoom: (id: string) => void
  openNewRoom: () => void
  onRoomField: (k: string, v: unknown) => void
  createRoom: () => void
  roomRemoveMember: (name: string) => void
  openRoomAddMember: () => void
  roomAddMember: (p: RoomMember) => void
  roomAskDelete: () => void
  roomDoDelete: () => void
  openRoomEdit: () => void
  saveRoomEdit: () => void
  selectRoomTab: (t: string) => void

  // cron
  setCronFilter: (f: string) => void
  toggleCron: (id: string) => void
  openNewCron: () => void
  editCron: (j: CronJob) => void
  askApplyCron: () => void
  openCronFromNotif: (cronId: string) => void
  applyCron: () => void
  backToCronForm: () => void
  cronAskDelete: (id: string, e?: React.MouseEvent) => void
  cronDoDelete: () => void
  cronRunNow: (id: string, e?: React.MouseEvent) => void
  onCronField: (k: string, v: unknown) => void
  toggleCronFormEnabled: () => void
  createCron: () => void

  // knowledge / editor
  setKnowTab: (t: string) => void
  setKnowFilter: (f: string) => void
  toggleKnowCat: () => void
  setKnowCategory: (c: string) => void
  openKnowExport: () => void
  openKnowImport: () => void
  knowEdit: (k: KnowledgeEntry, e?: React.MouseEvent) => void
  knowDuplicate: (title: string, e?: React.MouseEvent) => void
  knowAskDelete: (title: string, e?: React.MouseEvent) => void
  knowDoDelete: () => void
  onKnowQuery: (v: string) => void
  openEditor: (entry?: KnowledgeEntry) => void
  openKnowledgeContent: (entry: KnowledgeEntry) => void
  newEntry: () => void
  closeEditor: () => void
  askCancelEditor: () => void
  askSubmitEditor: () => void
  dismissEditorConfirm: () => void
  setEditorMode: (m: string) => void
  setEditorType: (t: string) => void
  setEditorLoadMode: (m: string) => void
  setEditorVisibility: (v: string) => void
  onEditorTitle: (v: string) => void
  onEditorCategory: (v: string) => void
  onEditorTags: (v: string) => void
  onEditorText: (v: string) => void
  toggleEditorAgent: (id: string) => void

  // channels / chat
  selectChannel: (id: string) => void
  openCreate: () => void
  openSwitch: () => void
  openDb: () => void
  openWorkflow: () => void
  onDraft: (v: string) => void
  onComposerFocus: () => void
  onComposerBlur: () => void
  insertMention: () => void
  replyTo: (name: string) => void
  sendMessage: () => void
  pollTradingAnalyze: (channelId: string, ticker: string) => void
  pollMetalsAnalyze: (channelId: string) => void
  pollComicsChat: (channelId: string) => void
  pollMusicChat: (channelId: string) => void
  pollReel: (channelId: string, filmId: string) => void
  refreshTradingOps: () => void
  pollWorkflows: () => void
  reloadWorkflows: () => void
  refreshAfterReport: () => void
  runMusicBatch: () => void
  toggleChatSearch: () => void
  onChatSearch: (v: string) => void
  confirmLeave: () => void
  doLeave: () => void
  askDeleteChannel: (id: string) => void
  askRename: (id: string) => void
  onRenameInput: (v: string) => void
  doRename: () => void
  doDeleteChannel: () => void
  toggleAttachMenu: () => void
  pickAttach: (kind: string) => void
  uploadAttach: (file: File) => Promise<void>
  clearAttach: () => void
  clearHistory: (id: string) => void
  setAutoDelete: (id: string, seconds: number) => void
  openFiles: () => void
  openFile: (f: RoomFile) => void
  openAddMember: () => void
  openMembers: () => void
  openChannelTask: (t: Channel['tasks'][number]) => void
  addMemberTo: (payload: { userId?: string; agentId?: string }) => void
  removeMember: (memberId: string) => void
  onCreateName: (v: string) => void
  onCreateDesc: (v: string) => void
  setTypePublic: () => void
  setTypePrivate: () => void
  onCreateNameFocus: () => void
  onCreateNameBlur: () => void
  createChannel: () => void
  onSwitchQuery: (v: string) => void

  allChannels: () => Channel[]
  findChannel: (id: string) => Channel | undefined
}

const initial: AppState = {
  authed: false,
  view: 'channels',
  toast: null,
  overlay: null,
  activeLang: 'vi', agentLang: 'user', timeFormat: '24h', dateFormat: 'dmy', weekStart: 'mon', timezone: 'hcm', currency: 'vnd', langPicker: null,
  profileTab: 'profile', personCard: null,
  profileData: seed.profileData,
  profileForm: {}, twoFA: true,
  profileSessions: seed.profileSessions,
  pwForm: { cur: '', next: '', confirm: '' },
  usersTab: 'members', usersRole: 'all', usersQuery: '', signupMenu: null,
  usersData: seed.usersData as UserRow[], invitesData: seed.invitesData as Invite[], signupsData: seed.signupsData as Signup[],
  userMenu: null, editUser: null, inviteForm: { email: '', role: 'staff' },
  notifFilter: 'all', notifsData: seed.notifsData as Notif[], planCycle: 'month',
  billRange: '6m', billMonths: seed.billMonths,
  activeRole: 'lead', showCreateRole: false, roleForm: { name: '', icon: '🛡', desc: '' },
  showAssignMember: false, assignForm: { name: '', sub: '' },
  rolePerms: seed.initialRolePerms, rolesData: seed.rolesData as RoleDef[],
  logsTab: 'sessions', activeSession: 'session_0171', sessionsData: seed.sessionsData as SessionLog[], auditLog: seed.auditLog,
  devicesFilter: 'all', devicesQuery: '', deviceDrawer: null, showAddDevice: false, devDeleteConfirm: false,
  devForm: { name: '', type: 'server', addr: '', role: '' }, devicesData: seed.devicesData as Device[],
  tasksRoom: 'all', tasksQuery: '', taskDrawer: null,
  taskForm: { title: '', desc: '', assignee: '', room: 'Zy Novel', priority: 'med', status: 'queued' },
  showCreateTask: false, editingTaskId: null, taskDeleteConfirm: false, taskSaveConfirm: false,
  recentActivity: [], tasksData: seed.tasksData as TaskItem[],
  mcpFilter: 'all', mcpQuery: '', mcpDrawer: null, mcpDeleteConfirm: false,
  mcpForm: { name: '', transport: 'HTTP', endpoint: '', desc: '', tools: '' }, mcpData: seed.mcpData as McpServer[],
  agentsFilter: 'all', agentsQuery: '', agentDrawer: null,
  agentForm: { name: '', role: 'Researcher', model: 'Qwen3 35B', modelType: 'local', status: 'online' },
  agentCfg: { id: null, model: '', status: '' }, agentsData: seed.agentsData as Agent[],
  activeWorkflow: 'wf1', stepDetail: null,
  wfForm: { name: '', desc: '', trigger: 'cron', triggerLabel: '*/30 * * * *', steps: [{ agent: 'Sabo - Facebook Research', title: '', io: '' }] },
  workflows: seed.workflows as Workflow[],
  activeRoom: 'zy-novel', roomTab: 'members', activeId: 'room-zy-novel', draft: '',
  chatSearchOpen: false, chatSearch: '', attachMenuOpen: false, pendingAttach: null,
  deleteTarget: null, channelTaskDetail: null, fileDetail: null, renameTarget: null, renameValue: '', composerFocused: false,
  createForm: { name: '', type: 'private', desc: '' }, createFocused: false, switchQuery: '',
  unread: { 'room-zy-novel': 4 },
  unreadJump: null,
  messages: seed.messages,
  publicData: seed.publicData as Channel[], privateData: seed.privateData as Channel[], directData: seed.directData as Channel[],
  cronFilter: 'all',
  cronForm: { name: '', target: 'Sabo - Facebook Research', freq: 'daily', time: '08:00', dow: 1, interval: 30, enabled: true },
  editingCronId: null, cronDeleteTarget: null, cronJobsData: seed.cronJobsData as CronJob[],
  knowledgeTab: 'library', knowledgeFilter: 'all', knowledgeCategory: 'all', knowCatOpen: false, knowDeleteTarget: null, knowContent: null, knowledgeQuery: '',
  editorMode: 'split', editorConfirm: null, editorType: 'knowledge', editorTitle: 'Chuẩn bị nội dung facebook',
  editorCategory: 'zy-novel', editorTags: 'php, slim4, backend', editorLoadMode: 'on_demand', editorVisibility: 'private',
  editorAgentsChecked: { lisa: true }, editorAgents: seed.editorAgents, editorText: seed.editorText,
  knowledgeData: seed.knowledgeData as KnowledgeEntry[],
  rooms: seed.rooms as RoomDef[], roomForm: { name: '', channel: '', visibility: 'private' },
  roomMembersById: seed.roomMembersById as Record<string, RoomMember[]>,
  filmsData: [], filmForm: { title: '', novel: '', aspectRatio: '9:16', contentMode: 'narration' }, activeFilm: null, showCreateFilm: false,
}

export const useStore = create<AppState & AppActions>((set: Set, get: Get) => ({
  ...initial,

  set: (p) => set(p),
  setAuthed: (v) => set({ authed: v }),
  setView: (v) => set({ view: v }),
  fireToast: (msg) => {
    set({ toast: msg })
    const w = window as unknown as { _tt?: ReturnType<typeof setTimeout> }
    if (w._tt) clearTimeout(w._tt)
    w._tt = setTimeout(() => set({ toast: null }), 2400)
  },
  closeOverlay: () => set({ overlay: null }),

  // ---------- backend wiring ----------
  login: async (email, password, remember = true) => {
    const r = await api.post('/auth/login', { email, password, remember })
    setToken(r.access_token)
    set({ authed: true })
    await get().hydrate()
  },
  register: async (name, email, password) => {
    const r = await api.post('/auth/register', { name, email, password })
    setToken(r.access_token)
    set({ authed: true })
    await get().hydrate()
  },
  bootAuth: async () => {
    if (!getToken()) return
    try {
      await api.get('/auth/me')
      set({ authed: true })
      await get().hydrate()
    } catch {
      setToken(null)
    }
  },
  hydrate: async () => {
    await Promise.all([
      api.post('/trading/channel/ensure').catch(() => {}),
      api.post('/music/ensure').catch(() => {}),
      api.post('/films/channel/ensure').catch(() => {}),
      api.post('/metals/ensure').catch(() => {}),
      api.post('/comics/ensure').catch(() => {}),
    ])
    const [channels, agents, mcp, workflows, cron, tasks, devices, sessions, audit, knowledge, rooms, roles, users, invites, signups, notifs, bill, profile, activity, settings] = await Promise.all([
      api.get('/channels'), api.get('/agents'), api.get('/mcp'), api.get('/workflows'), api.get('/cron'),
      api.get('/tasks'), api.get('/devices'), api.get('/sessions'), api.get('/audit'), api.get('/knowledge'),
      api.get('/rooms'), api.get('/roles'), api.get('/users'), api.get('/invites'), api.get('/signups'),
      api.get('/notifs'), api.get('/billing/months'), api.get('/profile'), api.get('/activity'), api.get('/settings'),
    ])
    const roomMembersById: Record<string, RoomMember[]> = {}
    rooms.forEach((r: { id: string; members?: RoomMember[] }) => { roomMembersById[r.id] = r.members || [] })
    const rolePerms: Record<string, Record<string, boolean>> = {}
    roles.forEach((r: { id: string; permissions?: Record<string, boolean> }) => { rolePerms[r.id] = r.permissions || {} })
    const unread: Record<string, number> = {}
    ;([...channels.public, ...channels.private, ...channels.direct] as { id: string; unread?: number }[]).forEach((c) => { if (c.unread) unread[c.id] = c.unread })
    set({
      publicData: channels.public, privateData: channels.private, directData: channels.direct,
      agentsData: agents, mcpData: mcp, workflows, cronJobsData: cron, tasksData: tasks,
      devicesData: devices, sessionsData: sessions, auditLog: audit, knowledgeData: knowledge,
      rooms, roomMembersById, activeRoom: rooms.find((r: { id: string }) => r.id === get().activeRoom) ? get().activeRoom : (rooms[0]?.id || ''),
      // activeId is a CHANNEL id (chat view). The seed default points at a room → 404 on hydrate; snap it to a real channel.
      activeId: [...channels.public, ...channels.private, ...channels.direct].find((c: { id: string }) => c.id === get().activeId) ? get().activeId : (channels.public[0]?.id || channels.private[0]?.id || channels.direct[0]?.id || ''),
      rolesData: roles, rolePerms, usersData: users, invitesData: invites,
      signupsData: signups, notifsData: notifs, billMonths: bill, recentActivity: activity, unread,
      profileData: { name: profile.name, email: profile.email, phone: profile.phone, title: profile.title, bio: profile.bio, location: profile.location },
      activeLang: settings.activeLang || 'vi', agentLang: settings.agentLang || 'user',
      timeFormat: settings.timeFormat || '24h', dateFormat: settings.dateFormat || 'dmy',
      weekStart: settings.weekStart || 'mon', timezone: settings.timezone || 'hcm', currency: settings.currency || 'vnd',
    })
    const id = get().activeId
    try {
      const msgs = await api.get(`/channels/${id}/messages`)
      set((s) => ({ messages: { ...s.messages, [id]: msgs } }))
    } catch { /* ignore */ }
  },

  // ---------- films (ArcReel) ----------
  loadFilms: async () => {
    try { const films = await api.get('/films'); set({ filmsData: films }) } catch { /* arcreel offline */ }
  },
  openCreateFilm: () => set({ showCreateFilm: true, filmForm: { title: '', novel: '', aspectRatio: '9:16', contentMode: 'narration' } }),
  closeCreateFilm: () => set({ showCreateFilm: false }),
  onFilmField: (k, v) => set((s) => ({ filmForm: { ...s.filmForm, [k]: v } })),
  createFilm: async () => {
    const f = get().filmForm
    if (!f.novel.trim()) return
    try {
      const film = await api.post('/films', { title: f.title, novel: f.novel, aspectRatio: f.aspectRatio, contentMode: f.contentMode })
      set((s) => ({ filmsData: [film, ...s.filmsData.filter((x) => x.id !== film.id)], showCreateFilm: false, activeFilm: film.id }))
      get().fireToast('Đã gửi phim cho ArcReel')
    } catch { get().fireToast('ArcReel không phản hồi — kiểm tra Thiết bị') }
  },
  openFilm: (id) => { set({ activeFilm: id }); get().refreshFilm(id) },
  closeFilm: () => set({ activeFilm: null }),
  refreshFilm: async (id) => {
    try { const film = await api.get('/films/' + id); set((s) => ({ filmsData: s.filmsData.map((x) => x.id === id ? { ...x, ...film } : x) })) } catch { /* ignore */ }
  },
  approveFilm: async (id, selections) => {
    try {
      const film = await api.post(`/films/${id}/approve`, selections ? { selections } : {})
      set((s) => ({ filmsData: s.filmsData.map((x) => x.id === id ? { ...x, ...film } : x) }))
      get().fireToast('Đã duyệt — pipeline tiếp tục')
    } catch { get().fireToast('Không duyệt được') }
  },
  cancelFilm: async (id) => {
    try {
      const film = await api.post(`/films/${id}/cancel`, {})
      set((s) => ({ filmsData: s.filmsData.map((x) => x.id === id ? { ...x, ...film } : x) }))
      get().fireToast('Đã hủy phim')
    } catch { /* ignore */ }
  },

  // ---------- agents ----------
  setAgentsFilter: (f) => set({ agentsFilter: f }),
  openAgent: (id) => set({ agentDrawer: id }),
  closeAgent: () => set({ agentDrawer: null }),
  openNewAgent: () => set({ agentForm: { name: '', role: 'Researcher', model: 'Qwen3 35B', modelType: 'local', status: 'online', desc: '', skills: '', rooms: [] }, overlay: 'newAgent' }),
  onAgentField: (k, v) => set((s) => ({ agentForm: { ...s.agentForm, [k]: v } })),
  toggleAgentRoom: (id) => set((s) => { const r = s.agentForm.rooms || []; return { agentForm: { ...s.agentForm, rooms: r.indexOf(id) >= 0 ? r.filter((x) => x !== id) : [...r, id] } } }),
  setAgentModel: (m) => set((s) => ({ agentForm: { ...s.agentForm, model: m, modelType: cloudModels.indexOf(m) >= 0 ? 'cloud' : 'local' } })),
  createAgent: () => {
    const f = get().agentForm, name = f.name.trim(); if (!name) return
    persist(api.post('/agents', { name, role: f.role, model: f.model, modelType: f.modelType, status: f.status, desc: f.desc, skills: f.skills, rooms: f.rooms || [] }))
    const colors = ['#C0392B', '#3B82C4', '#0EA5A0', '#E8A33D', '#8B5CF6', '#0E7490']
    const skills = (f.skills || '').split(',').map((x) => x.trim()).filter(Boolean)
    const rmSel = f.rooms || []
    const ag: Agent = {
      id: uid('ag'), name, handle: '@' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      role: f.role, roleType: 'research', initial: (name.replace(/^[^A-Za-zÀ-ỹ]+/, '')[0] || 'A').toUpperCase(),
      color: colors[Math.floor(Math.random() * colors.length)], status: f.status as Agent['status'],
      model: f.model, modelType: f.modelType as Agent['modelType'], tasks: 0, rooms: rmSel.length || 1, success: 100,
      skills: skills.length ? skills : ['Mới tạo'], lastActive: 'vừa xong', bio: (f.desc || '').trim() || 'Agent mới được tạo trong workspace.',
      roomsList: rmSel.length ? rmSel : ['general'], recentTasks: [],
    }
    set((s) => ({ agentsData: [ag, ...s.agentsData], overlay: null }))
  },
  agentAskDelete: () => set({ overlay: 'agentDelete' }),
  agentDoDelete: () => { const id = get().agentDrawer; if (id) persist(api.del('/agents/' + id)); set((s) => ({ agentsData: s.agentsData.filter((a) => a.id !== id), agentDrawer: null, overlay: null })) },
  openAgentConfig: () => { const a = get().agentsData.find((x) => x.id === get().agentDrawer); if (!a) return; set({ agentCfg: { id: a.id, model: a.model, status: a.status }, overlay: 'agentConfig' }) },
  onAgentCfg: (k, v) => set((s) => ({ agentCfg: { ...s.agentCfg, [k]: v } as AppState['agentCfg'] })),
  saveAgentConfig: () => { const c = get().agentCfg; if (c.id) persist(api.patch(`/agents/${c.id}/config`, { model: c.model, status: c.status })); set((s) => ({ agentsData: s.agentsData.map((a) => a.id === c.id ? { ...a, model: c.model, modelType: cloudModels.indexOf(c.model) >= 0 ? 'cloud' : 'local', status: c.status as Agent['status'] } : a), overlay: null })) },

  // ---------- mcp ----------
  setMcpFilter: (f) => set({ mcpFilter: f }),
  openMcp: (id) => set({ mcpDrawer: id }),
  closeMcp: () => set({ mcpDrawer: null }),
  syncMcp: () => { persist(api.post('/mcp/sync')); set((s) => ({ mcpData: s.mcpData.map((m) => m.status === 'error' ? m : { ...m, lastSync: 'vừa xong' }) })); get().fireToast('Đã đồng bộ MCP servers') },
  openNewMcp: () => set({ mcpForm: { name: '', transport: 'HTTP', endpoint: '', desc: '', tools: '' }, overlay: 'newMcp' }),
  onMcpField: (k, v) => set((s) => ({ mcpForm: { ...s.mcpForm, [k]: v } as AppState['mcpForm'] })),
  setMcpTransport: (t) => set((s) => ({ mcpForm: { ...s.mcpForm, transport: t } })),
  createMcp: () => {
    const f = get().mcpForm, name = (f.name || '').trim(); if (!name) return
    persist(api.post('/mcp', { name, transport: f.transport, endpoint: f.endpoint, desc: f.desc, tools: f.tools }))
    const icons = ['🔌', '🧩', '⚙️', '🛰', '📦', '🔗']
    const tools = (f.tools || '').split(',').map((x) => x.trim()).filter(Boolean)
    const m: McpServer = { id: uid('mcp'), name, icon: icons[Math.floor(Math.random() * icons.length)], desc: (f.desc || '').trim() || 'MCP server mới được kết nối vào workspace.', transport: f.transport, status: 'connected', tools: tools.length ? tools : ['ping'], agents: 0, calls24: 0, lastSync: 'vừa xong', endpoint: (f.endpoint || '').trim() || '—', recentCalls: [] }
    set((s) => ({ mcpData: [m, ...s.mcpData], overlay: null })); get().fireToast('Đã kết nối ' + name)
  },
  testMcp: () => { const m = get().mcpData.find((x) => x.id === get().mcpDrawer); if (!m) return; get().fireToast(m.status === 'error' ? '✕ Không kết nối được ' + m.name : '✓ Kết nối ' + m.name + ' OK') },
  toggleMcp: () => { const id = get().mcpDrawer; if (id) persist(api.post(`/mcp/${id}/toggle`)); set((s) => ({ mcpData: s.mcpData.map((m) => m.id === id ? { ...m, status: m.status === 'disabled' ? 'connected' : 'disabled' } : m) })); const m = get().mcpData.find((x) => x.id === id); if (m) get().fireToast(m.status === 'disabled' ? 'Đã tắt ' + m.name : 'Đã bật ' + m.name) },
  askDeleteMcp: () => set({ mcpDeleteConfirm: true }),
  confirmDeleteMcp: () => { const id = get().mcpDrawer; const m = get().mcpData.find((x) => x.id === id); if (id) persist(api.del('/mcp/' + id)); set((s) => ({ mcpData: s.mcpData.filter((x) => x.id !== id), mcpDrawer: null, mcpDeleteConfirm: false })); if (m) get().fireToast('Đã xóa MCP ' + m.name) },

  // ---------- tasks ----------
  setTasksRoom: (r) => set({ tasksRoom: r }),
  openTask: (id) => set({ taskDrawer: id }),
  closeTask: () => set({ taskDrawer: null }),
  askDeleteTask: () => set({ taskDeleteConfirm: true }),
  confirmDeleteTask: () => { const id = get().taskDrawer; if (id) persist(api.del('/tasks/' + id)); set((s) => ({ tasksData: s.tasksData.filter((t) => t.id !== id), taskDrawer: null, taskDeleteConfirm: false })); get().fireToast('Đã xóa tác vụ ' + id) },
  moveTask: (id, status) => { persist(api.post(`/tasks/${id}/move`, { status })); set((s) => ({ tasksData: s.tasksData.map((t) => t.id === id ? { ...t, status } : t) })) },
  openCreateTask: () => set({ showCreateTask: true, editingTaskId: null, taskForm: { title: '', desc: '', assignee: '', room: 'Zy Novel', priority: 'med', status: 'queued' } }),
  openEditTask: () => { const t = get().tasksData.find((x) => x.id === get().taskDrawer); if (!t) return; set({ showCreateTask: true, editingTaskId: t.id, taskDrawer: null, taskForm: { title: t.title, desc: (t.desc === 'Chưa có mô tả.' ? '' : t.desc) || '', assignee: (t.assignee === 'Chưa giao' ? '' : t.assignee) || '', room: t.room, priority: t.priority, status: t.status } }) },
  closeCreateTask: () => set({ showCreateTask: false, editingTaskId: null }),
  onTaskField: (k, v) => set((s) => ({ taskForm: { ...s.taskForm, [k]: v } as AppState['taskForm'] })),
  createTask: () => {
    const f = get().taskForm, title = (f.title || '').trim(); if (!title) return
    if (get().editingTaskId) { set({ taskSaveConfirm: true }); return }
    persist(api.post('/tasks', { title, desc: (f.desc || '').trim(), assignee: f.assignee, room: f.room, priority: f.priority, status: f.status }))
    const ag = get().agentsData.find((a) => a.name === f.assignee)
    const assignee = f.assignee || 'Chưa giao'
    const initial = ag ? ag.initial : '?'; const color = ag ? ag.color : '#9AA8A1'
    const n = get().tasksData.length; const id = 'T-' + (2600 + n)
    const nt: TaskItem = { id, title, status: f.status as TaskItem['status'], assignee, initial, color, room: f.room, priority: f.priority as TaskItem['priority'], time: 'vừa xong', desc: (f.desc || '').trim() || 'Chưa có mô tả.' }
    const act = { initial, color, actor: assignee, action: 'được giao tác vụ ' + id + ' · ' + title, time: 'vừa xong', tag: 'task', tagFg: '#0A7B52', tagBg: '#E2F3EC' }
    set((s) => ({ tasksData: [nt, ...s.tasksData], recentActivity: [act, ...s.recentActivity], showCreateTask: false })); get().fireToast('Đã tạo tác vụ ' + id)
  },
  confirmSaveTask: () => {
    const f = get().taskForm, title = (f.title || '').trim(); const id = get().editingTaskId; if (!title || !id) return
    persist(api.patch('/tasks/' + id, { title, desc: (f.desc || '').trim(), assignee: f.assignee, room: f.room, priority: f.priority, status: f.status }))
    const ag = get().agentsData.find((a) => a.name === f.assignee)
    const assignee = f.assignee || 'Chưa giao'; const initial = ag ? ag.initial : '?'; const color = ag ? ag.color : '#9AA8A1'
    set((s) => ({ tasksData: s.tasksData.map((t) => t.id === id ? { ...t, title, desc: (f.desc || '').trim() || 'Chưa có mô tả.', assignee, initial, color, room: f.room, priority: f.priority as TaskItem['priority'], status: f.status as TaskItem['status'] } : t), showCreateTask: false, editingTaskId: null, taskSaveConfirm: false })); get().fireToast('Đã cập nhật tác vụ ' + id)
  },

  // ---------- devices ----------
  setDevicesFilter: (f) => set({ devicesFilter: f }),
  // Real-time: pull the live device status the backend probes on each GET (no fake jitter, silent).
  pollDevices: () => { api.get('/devices').then((devices) => set({ devicesData: devices })).catch(() => {}) },
  pollUnread: () => {
    const a = get().activeId
    api.get('/channels/unread').then((u: Record<string, number>) => {
      // the channel you're looking at is always "read" — mark it on the server + never badge it
      if (a) { if (u[a]) api.post(`/channels/${a}/read`).catch(() => {}); delete u[a] }
      set({ unread: u })
    }).catch(() => {})
  },
  refreshDevices: () => { persist(api.post('/devices/refresh')); set((s) => ({ devicesData: s.devicesData.map((d) => { if (d.status !== 'online') return d; const j = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v + Math.round((Math.random() - 0.5) * 16))); return { ...d, cpuPct: j(d.cpuPct, 4, 97), ramPct: j(d.ramPct, 20, 95), gpuPct: d.gpu === '—' ? 0 : j(d.gpuPct, 5, 96), lastSeen: 'vừa xong' } }) })); get().fireToast('Đã làm mới trạng thái thiết bị') },
  toggleDevicePower: () => { const id = get().deviceDrawer; if (id) persist(api.post(`/devices/${id}/power`)); set((s) => ({ devicesData: s.devicesData.map((d) => { if (d.id !== id) return d; const on = d.status === 'online'; return on ? { ...d, status: 'offline' as const, cpuPct: 0, ramPct: 0, gpuPct: 0, uptime: '—', lastSeen: 'vừa xong' } : { ...d, status: 'online' as const, cpuPct: 18, ramPct: 42, gpuPct: d.gpu === '—' ? 0 : 20, uptime: 'vừa bật', lastSeen: 'vừa xong' } }) })); const dd = get().devicesData.find((d) => d.id === id); get().fireToast(dd && dd.status === 'online' ? 'Đã đánh thức ' + dd.name : 'Đã tắt ' + (dd ? dd.name : 'thiết bị')) },
  openDevSsh: () => { const dd = get().devicesData.find((d) => d.id === get().deviceDrawer); get().fireToast('Đang mở phiên SSH tới ' + (dd ? dd.name : 'thiết bị') + '…') },
  askDeleteDevice: () => set({ devDeleteConfirm: true }),
  confirmDeleteDevice: () => { const id = get().deviceDrawer; const dd = get().devicesData.find((d) => d.id === id); if (id) persist(api.del('/devices/' + id)); set((s) => ({ devicesData: s.devicesData.filter((d) => d.id !== id), deviceDrawer: null, devDeleteConfirm: false })); get().fireToast('Đã xóa thiết bị ' + (dd ? dd.name : '')) },
  openAddDevice: () => set({ showAddDevice: true, devForm: { name: '', type: 'server', addr: '', role: '' } }),
  closeAddDevice: () => set({ showAddDevice: false }),
  onDevField: (k, v) => set((s) => ({ devForm: { ...s.devForm, [k]: v } as AppState['devForm'] })),
  createDevice: () => { const f = get().devForm, name = (f.name || '').trim(); if (!name) return; persist(api.post('/devices', { name, type: f.type, addr: f.addr, role: f.role })); const icons: Record<string, string> = { server: '🖥', gateway: '🌐', desktop: '💻', phone: '📱' }; const nd: Device = { id: uid('dev'), name, type: f.type as Device['type'], icon: icons[f.type] || '🖥', status: 'online', addr: (f.addr || '').trim() || '100.84.0.0', os: '—', cpu: '—', cpuPct: 14, ram: '—', ramPct: 30, gpu: '—', gpuPct: 0, vram: '—', uptime: 'vừa bật', lastSeen: 'vừa xong', role: (f.role || '').trim() || 'Thiết bị mới', models: [] }; set((s) => ({ devicesData: [...s.devicesData, nd], showAddDevice: false })); get().fireToast('Đã thêm thiết bị ' + name) },
  openDevice: (id) => set({ deviceDrawer: id }),
  closeDevice: () => set({ deviceDrawer: null }),

  // ---------- logs ----------
  setLogsTab: (t) => set({ logsTab: t }),
  selectSession: (id) => set({ activeSession: id }),
  deleteSession: (id) => {
    persist(api.del('/sessions/' + id))
    set((s) => { const list = s.sessionsData.filter((x) => x.id !== id); return { sessionsData: list, activeSession: s.activeSession === id ? (list[0]?.id || '') : s.activeSession } })
    get().fireToast('Đã xóa phiên log ' + id)
  },
  clearSessions: () => { persist(api.del('/sessions')); set({ sessionsData: [], activeSession: '', overlay: null }); get().fireToast('Đã xóa tất cả phiên log') },
  askClearLogs: () => set({ overlay: 'clearLogs' }),

  // ---------- perms ----------
  selectRole: (id) => set({ activeRole: id }),
  togglePerm: (role, pid) => { persist(api.patch(`/roles/${role}/perms`, { permId: pid })); set((s) => ({ rolePerms: { ...s.rolePerms, [role]: { ...s.rolePerms[role], [pid]: !s.rolePerms[role][pid] } } })) },
  openCreateRole: () => set({ showCreateRole: true, roleForm: { name: '', icon: '🛡', desc: '' } }),
  closeCreateRole: () => set({ showCreateRole: false }),
  onRoleField: (k, v) => set((s) => ({ roleForm: { ...s.roleForm, [k]: v } as AppState['roleForm'] })),
  createRole: () => { const f = get().roleForm, name = (f.name || '').trim(); if (!name) return; persist(api.post('/roles', { name, icon: f.icon, desc: f.desc })); const id = uid('role'); const color = roleColors[get().rolesData.length % roleColors.length]; const nr: RoleDef = { id, name, icon: f.icon || '🛡', color, system: false, desc: (f.desc || '').trim() || 'Vai trò tùy chỉnh.', members: [] }; const np: Record<string, boolean> = {}; seed.PERMS.forEach((p) => { np[p.id] = ['ch_view', 'kn_view', 'ag_view', 'cron_view', 'sys_devices'].indexOf(p.id) >= 0 }); set((s) => ({ rolesData: [...s.rolesData, nr], rolePerms: { ...s.rolePerms, [id]: np }, activeRole: id, showCreateRole: false })); get().fireToast('Đã tạo vai trò ' + name) },
  openAssignMember: () => set({ showAssignMember: true, assignForm: { name: '', sub: '' } }),
  closeAssignMember: () => set({ showAssignMember: false }),
  onAssignField: (k, v) => set((s) => ({ assignForm: { ...s.assignForm, [k]: v } as AppState['assignForm'] })),
  assignMember: () => { const f = get().assignForm, name = (f.name || '').trim(); if (!name) return; const rid = get().activeRole; persist(api.post(`/roles/${rid}/members`, { name, sub: f.sub })); const initial = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); const color = roleColors[(name.length + rid.length) % roleColors.length]; const mm = { name, initial, color, sub: (f.sub || '').trim() || 'Thành viên' }; set((s) => ({ rolesData: s.rolesData.map((r) => r.id === rid ? { ...r, members: [...r.members, mm] } : r), showAssignMember: false })); get().fireToast('Đã gán ' + name + ' vào vai trò') },
  removeRoleMember: (name) => { const rid = get().activeRole; persist(api.del(`/roles/${rid}/members/${encodeURIComponent(name)}`)); set((s) => ({ rolesData: s.rolesData.map((r) => r.id === rid ? { ...r, members: r.members.filter((m) => m.name !== name) } : r) })); get().fireToast('Đã gỡ ' + name + ' khỏi vai trò') },

  // ---------- billing / notifs ----------
  setBillRange: (r) => set({ billRange: r }),
  openNotifs: () => set({ view: 'notifs' }),
  setNotifFilter: (f) => set({ notifFilter: f }),
  markRead: (id) => { persist(api.post(`/notifs/${id}/read`)); set((s) => ({ notifsData: s.notifsData.map((n) => n.id === id ? { ...n, unread: false } : n) })) },
  markAllRead: () => { persist(api.post('/notifs/read-all')); set((s) => ({ notifsData: s.notifsData.map((n) => ({ ...n, unread: false })) })) },
  deleteNotif: (id) => { persist(api.del('/notifs/' + id)); set((s) => ({ notifsData: s.notifsData.filter((n) => n.id !== id) })) },
  clearNotifs: () => { persist(api.del('/notifs')); set({ notifsData: [] }); get().fireToast('Đã xóa tất cả thông báo') },
  setPlanCycle: (c) => set({ planCycle: c }),

  // ---------- language ----------
  openLanguage: () => set({ view: 'language' }),
  setLang: (l) => set({ activeLang: l }),
  setAgentLang: (l) => set({ agentLang: l }),
  setTimeFormat: (f) => set({ timeFormat: f }),
  setDateFormat: (f) => set({ dateFormat: f }),
  setWeekStart: (w) => set({ weekStart: w }),
  openLangPicker: (kind) => set({ langPicker: kind }),
  closeLangPicker: () => set({ langPicker: null }),
  setTimezone: (v) => set({ timezone: v, langPicker: null }),
  setCurrency: (v) => set({ currency: v, langPicker: null }),
  resetLangDefaults: () => { persist(api.post('/settings/reset')); set({ activeLang: 'vi', agentLang: 'user', timeFormat: '24h', dateFormat: 'dmy', weekStart: 'mon', timezone: 'hcm', currency: 'vnd' }); get().fireToast('Đã khôi phục cài đặt mặc định') },
  saveLang: () => { persist(api.patch('/settings', { activeLang: get().activeLang, agentLang: get().agentLang, timeFormat: get().timeFormat, dateFormat: get().dateFormat, weekStart: get().weekStart, timezone: get().timezone, currency: get().currency })); get().fireToast('Đã lưu cài đặt ngôn ngữ & khu vực') },

  // ---------- person card / profile ----------
  openPersonCard: (p) => set({ personCard: p }),
  closePersonCard: () => set({ personCard: null }),
  personViewProfile: () => set({ personCard: null, view: 'profile' }),
  openProfile: () => set({ view: 'profile' }),
  setProfileTab: (t) => set({ profileTab: t }),
  openEditProfile: () => set((s) => ({ overlay: 'editProfile', profileForm: { ...s.profileData } })),
  onProfileField: (k, v) => set((s) => ({ profileForm: { ...s.profileForm, [k]: v } })),
  saveProfile: () => { const f = get().profileForm; if (!(f.name || '').trim()) return; persist(api.patch('/profile', { name: f.name, email: f.email, phone: f.phone, title: f.title, bio: f.bio, location: f.location })); set((s) => ({ profileData: { ...s.profileData, ...f }, overlay: null })); get().fireToast('Đã cập nhật hồ sơ') },
  toggle2FA: () => { persist(api.post('/profile/2fa/toggle')); set((s) => ({ twoFA: !s.twoFA })); get().fireToast(get().twoFA ? 'Đã bật xác thực 2 lớp' : 'Đã tắt xác thực 2 lớp') },
  openChangePw: () => set({ overlay: 'changePw', pwForm: { cur: '', next: '', confirm: '' } }),
  onPwField: (k, v) => set((s) => ({ pwForm: { ...s.pwForm, [k]: v } as AppState['pwForm'] })),
  savePw: () => { const f = get().pwForm; if (!f.cur || !f.next || f.next !== f.confirm) return; persist(api.post('/profile/password', { cur: f.cur, next: f.next, confirm: f.confirm })); set({ overlay: null }); get().fireToast('Đã đổi mật khẩu') },
  revokeSession: (id) => { persist(api.del('/profile/sessions/' + id)); set((s) => ({ profileSessions: s.profileSessions.filter((x) => x.id !== id) })); get().fireToast('Đã đăng xuất thiết bị') },
  revokeAllSessions: () => { persist(api.post('/profile/sessions/revoke-others')); set((s) => ({ profileSessions: s.profileSessions.filter((x) => x.current) })); get().fireToast('Đã đăng xuất tất cả thiết bị khác') },
  askLogout: () => set({ overlay: 'logout' }),
  doLogout: () => { setToken(null); set({ overlay: null, authed: false }); get().fireToast('Đã đăng xuất khỏi AgentAIOS') },

  // ---------- users ----------
  setUsersTab: (t) => set({ usersTab: t }),
  setUsersRole: (r) => set({ usersRole: r }),
  cycleRole: (id) => { persist(api.post(`/users/${id}/cycle-role`)); set((s) => ({ usersData: s.usersData.map((u) => { if (u.id !== id || u.role === 'owner') return u; const order: UserRow['role'][] = ['lead', 'staff', 'viewer']; const ni = (order.indexOf(u.role) + 1) % order.length; return { ...u, role: order[ni] } }) })) },
  openInvite: () => set({ overlay: 'invite', inviteForm: { email: '', role: 'staff' } }),
  onInviteEmail: (v) => set((s) => ({ inviteForm: { ...s.inviteForm, email: v } })),
  setInviteRole: (r) => set((s) => ({ inviteForm: { ...s.inviteForm, role: r } })),
  submitInvite: () => { const f = get().inviteForm; const email = (f.email || '').trim(); if (!email) return; persist(api.post('/invites', { email, role: f.role })); set((s) => ({ invitesData: [{ id: uid('i'), email, role: f.role, by: 'Nguyễn Thiện Giang', time: 'vừa xong' }, ...s.invitesData], overlay: null, usersTab: 'invites' })); get().fireToast('Đã gửi lời mời tới ' + email) },
  resendInvite: (id) => { persist(api.post(`/invites/${id}/resend`)); const iv = get().invitesData.find((x) => x.id === id); get().fireToast('Đã gửi lại lời mời tới ' + (iv ? iv.email : '')) },
  cancelInvite: (id) => { persist(api.del('/invites/' + id)); const iv = get().invitesData.find((x) => x.id === id); set((s) => ({ invitesData: s.invitesData.filter((x) => x.id !== id) })); get().fireToast('Đã hủy lời mời' + (iv ? ' ' + iv.email : '')) },
  openUserMenu: (id) => set((s) => ({ userMenu: s.userMenu === id ? null : id })),
  closeUserMenu: () => set({ userMenu: null }),
  openEditUser: (id) => set((s) => { const u = s.usersData.find((x) => x.id === id); return { userMenu: null, editUser: u ? { ...u } : null } }),
  closeEditUser: () => set({ editUser: null }),
  onEditUserField: (k, v) => set((s) => ({ editUser: s.editUser ? { ...s.editUser, [k]: v } : null })),
  setEditUserRole: (role) => set((s) => ({ editUser: s.editUser ? { ...s.editUser, role: role as UserRow['role'] } : null })),
  setEditUserStatus: (status) => set((s) => ({ editUser: s.editUser ? { ...s.editUser, status: status as UserRow['status'] } : null })),
  saveEditUser: () => { const _e = get().editUser; if (_e) persist(api.patch('/users/' + _e.id, { name: _e.name, email: _e.email, role: _e.role, status: _e.status })); set((s) => { const e = s.editUser; if (!e) return {}; const name = ((e.name as string) || '').trim() || '(chưa đặt tên)'; const initial = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase(); return { usersData: s.usersData.map((x) => x.id === e.id ? { ...x, name, email: ((e.email as string) || '').trim(), role: e.role, status: e.status, initial } : x), editUser: null } }); get().fireToast('Đã cập nhật hồ sơ thành viên') },
  toggleUserStatus: () => { const _id = get().userMenu; if (_id) persist(api.post(`/users/${_id}/toggle-status`)); set((s) => { const id = s.userMenu; const u = s.usersData.find((x) => x.id === id); const ns: UserRow['status'] = u && u.status === 'suspended' ? 'active' : 'suspended'; return { usersData: s.usersData.map((x) => x.id === id ? { ...x, status: ns } : x), userMenu: null } }); get().fireToast('Đã cập nhật trạng thái thành viên') },
  removeUser: () => { const _id = get().userMenu; const _u = get().usersData.find((x) => x.id === _id); if (_id) persist(api.del('/users/' + _id)); set((s) => ({ usersData: s.usersData.filter((x) => x.id !== _id), rolesData: _u ? s.rolesData.map((r) => ({ ...r, members: r.members.filter((m) => m.name !== _u.name) })) : s.rolesData, userMenu: null })); get().fireToast('Đã gỡ thành viên khỏi workspace') },
  approveSignup: (id) => { persist(api.post(`/signups/${id}/approve`)); set((s) => { const r = s.signupsData.find((x) => x.id === id); if (!r) return {}; const nu: UserRow = { id: uid('u'), name: r.name, email: r.email, initial: r.initial, color: r.color, role: r.role as UserRow['role'], status: 'active', last: 'vừa xong' }; return { signupsData: s.signupsData.filter((x) => x.id !== id), usersData: [...s.usersData, nu], signupMenu: null } }); get().fireToast('Đã duyệt — thành viên được thêm vào workspace') },
  rejectSignup: (id) => { persist(api.post(`/signups/${id}/reject`)); set((s) => ({ signupsData: s.signupsData.filter((x) => x.id !== id), signupMenu: null })); get().fireToast('Đã từ chối yêu cầu đăng ký') },
  openSignupMenu: (id) => set((s) => ({ signupMenu: s.signupMenu === id ? null : id })),
  setSignupRole: (id, role) => { persist(api.patch('/signups/' + id, { role })); set((s) => ({ signupsData: s.signupsData.map((x) => x.id === id ? { ...x, role } : x), signupMenu: null })); get().fireToast('Đã đổi vai trò đề xuất') },

  // ---------- workflows ----------
  selectWorkflow: (id) => set({ activeWorkflow: id }),
  toggleWorkflow: (id) => { persist(api.post(`/workflows/${id}/toggle`)); set((s) => ({ workflows: s.workflows.map((w) => w.id === id ? { ...w, enabled: !w.enabled } : w) })) },
  wfAskDelete: () => set({ overlay: 'wfDelete' }),
  wfDoDelete: () => { const id = get().activeWorkflow; if (id) persist(api.del('/workflows/' + id)); set((s) => { const list = s.workflows.filter((w) => w.id !== id); return { workflows: list, activeWorkflow: (list[0] || ({} as Workflow)).id || '', overlay: null } }) },
  runWorkflow: () => { const id = get().activeWorkflow; persist(api.post(`/workflows/${id}/run`)); set((s) => ({ workflows: s.workflows.map((w) => { if (w.id !== id) return w; const steps = w.steps.map((st, i) => ({ ...st, status: (i === 0 ? 'running' : 'idle') as typeof st.status })); const runs = [{ time: 'vừa xong', status: 'running', dur: '…' }, ...w.runs]; return { ...w, runState: 'running' as const, steps, runs, lastRun: 'vừa xong', runs24: w.runs24 + 1 } }) })) },
  pauseWorkflow: () => { const id = get().activeWorkflow; persist(api.post(`/workflows/${id}/pause`)); set((s) => ({ workflows: s.workflows.map((w) => { if (w.id !== id) return w; const ns = w.runState === 'running' ? 'paused' : 'running'; const steps = w.steps.map((st) => st.status === 'running' ? { ...st, status: (ns === 'paused' ? 'paused' : 'running') as typeof st.status } : (st.status === 'paused' && ns === 'running' ? { ...st, status: 'running' as const } : st)); const runs = w.runs.length ? [{ ...w.runs[0], status: ns === 'paused' ? 'paused' : 'running' }, ...w.runs.slice(1)] : w.runs; return { ...w, runState: ns as Workflow['runState'], steps, runs } }) })) },
  stopWorkflow: () => { const id = get().activeWorkflow; persist(api.post(`/workflows/${id}/stop`)); set((s) => ({ workflows: s.workflows.map((w) => { if (w.id !== id) return w; const steps = w.steps.map((st) => (st.status === 'running' || st.status === 'paused') ? { ...st, status: 'idle' as const } : st); const runs = w.runs.length ? [{ ...w.runs[0], status: 'stopped', dur: w.runs[0].dur === '…' ? 'đã dừng' : w.runs[0].dur }, ...w.runs.slice(1)] : w.runs; return { ...w, runState: 'idle' as const, steps, runs } }) })) },
  openNewWorkflow: () => set({ wfForm: { name: '', desc: '', trigger: 'cron', triggerLabel: '*/30 * * * *', steps: [{ agent: 'Sabo - Facebook Research', title: '', io: '' }] }, overlay: 'newWorkflow' }),
  onWfField: (k, v) => set((s) => ({ wfForm: { ...s.wfForm, [k]: v } as WfForm })),
  setWfTrigger: (t) => set((s) => ({ wfForm: { ...s.wfForm, trigger: t, triggerLabel: t === 'cron' ? '*/30 * * * *' : (t === 'event' ? 'on: dataset.insert' : 'Chạy thủ công') } })),
  addWfStep: () => set((s) => ({ wfForm: { ...s.wfForm, steps: [...s.wfForm.steps, { agent: 'Dragon - CEO', title: '', io: '' }] } })),
  removeWfStep: (i) => set((s) => ({ wfForm: { ...s.wfForm, steps: s.wfForm.steps.length > 1 ? s.wfForm.steps.filter((_, ix) => ix !== i) : s.wfForm.steps } })),
  onWfStep: (i, k, v) => set((s) => ({ wfForm: { ...s.wfForm, steps: s.wfForm.steps.map((st, ix) => ix === i ? { ...st, [k]: v } : st) } })),
  createWorkflow: () => {
    const f = get().wfForm, name = f.name.trim(); if (!name) return
    persist(api.post('/workflows', { name, desc: f.desc, trigger: f.trigger, triggerLabel: f.triggerLabel, steps: f.steps }))
    const palette: Record<string, string> = { 'Dragon - CEO': '#C0392B', 'Sabo - Facebook Research': '#3B82C4', 'Sanji - Xào nấu content': '#0EA5A0', 'Nami - Quản lý Fanpage': '#E8A33D', 'Morgans - Social Leader': '#8B5CF6', 'Brook - Báo Cáo Zy Novel': '#3B5BDB', 'Robin - Biên tập': '#8B5CF6', 'Usopp - Group Seeding': '#C94F3D', 'Franky - Thiết kế': '#0EA5A0', 'Tim - Trợ Lý Zypage': '#E8A33D' }
    const steps = f.steps.map((st) => ({ agent: st.agent, initial: (st.agent || 'A').replace(/^[^A-Za-zÀ-ỹ]+/, '').charAt(0).toUpperCase(), color: palette[st.agent] || '#3B5BDB', title: st.title.trim() || 'Bước chưa đặt tên', io: st.io.trim() || '→ output', status: 'idle' as const, dur: '—' }))
    const wf: Workflow = { id: uid('wf'), name, desc: f.desc.trim() || 'Workflow mới', trigger: f.trigger, triggerLabel: f.triggerLabel, enabled: true, lastRun: 'chưa chạy', runs24: 0, success: 100, steps, runs: [] }
    set((s) => ({ workflows: [wf, ...s.workflows], activeWorkflow: wf.id, overlay: null }))
  },
  openWfImport: () => set({ overlay: 'wfImport' }),
  openStepDetail: (i) => set({ stepDetail: i, overlay: 'stepDetail' }),
  closeStepDetail: () => set({ stepDetail: null, overlay: null }),

  // ---------- rooms ----------
  selectRoom: (id) => set({ activeRoom: id, roomTab: 'members' }),
  openNewRoom: () => set({ roomForm: { name: '', channel: '', visibility: 'private' }, overlay: 'newRoom' }),
  onRoomField: (k, v) => set((s) => ({ roomForm: { ...s.roomForm, [k]: v } as AppState['roomForm'] })),
  createRoom: () => {
    const f = get().roomForm, name = f.name.trim(); if (!name) return
    persist(api.post('/rooms', { name, channel: f.channel, visibility: f.visibility }))
    const ch = (f.channel.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    const id = ch || ('room-' + uid(''))
    const room: RoomDef = { id, name, slug: ch.toUpperCase() + ' · MAIN', channel: ch }
    const members: RoomMember[] = [{ name: 'Nguyễn Thiện Giang', handle: 'user #1', type: 'user', role: 'lead', initial: 'N', color: '#3B5BDB' }]
    const isPub = f.visibility === 'public'
    const channel: Channel = { id, name: ch, desc: 'Room channel cho ' + name, visibility: isPub ? 'PUBLIC' : 'PRIVATE', members: 1, files: ch + '/', database: ch, tasks: [], wfTotal: 0, wfNote: 'Chưa cấu hình workflow cho room này.' }
    set((s) => {
      const exists = get().allChannels().some((c) => c.id === id)
      const messages = s.messages[id] ? s.messages : { ...s.messages, [id]: [] }
      const pub = isPub && !exists ? [...s.publicData, channel] : s.publicData
      const pri = !isPub && !exists ? [...s.privateData, channel] : s.privateData
      return { rooms: [...s.rooms, room], roomMembersById: { ...s.roomMembersById, [id]: members }, publicData: pub, privateData: pri, messages, activeRoom: id, roomTab: 'members', overlay: null }
    })
  },
  roomRemoveMember: (name) => { persist(api.del(`/rooms/${get().activeRoom}/members/${encodeURIComponent(name)}`)); set((s) => ({ roomMembersById: { ...s.roomMembersById, [s.activeRoom]: (s.roomMembersById[s.activeRoom] || []).filter((m) => m.name !== name) } })) },
  openRoomAddMember: () => set({ overlay: 'roomAddMember' }),
  roomAddMember: (p) => { persist(api.post(`/rooms/${get().activeRoom}/members`, p)); set((s) => { const cur = s.roomMembersById[s.activeRoom] || []; if (cur.some((m) => m.name === p.name)) return {}; return { roomMembersById: { ...s.roomMembersById, [s.activeRoom]: [...cur, p] } } }) },
  roomAskDelete: () => set({ overlay: 'roomDelete' }),
  roomDoDelete: () => { const id = get().activeRoom; if (id) persist(api.del('/rooms/' + id)); set((s) => { const rooms = s.rooms.filter((r) => r.id !== id); const mm = { ...s.roomMembersById }; delete mm[id]; return { rooms, roomMembersById: mm, activeRoom: (rooms[0] || ({} as RoomDef)).id || '', overlay: null } }) },
  openRoomEdit: () => { const r = get().rooms.find((x) => x.id === get().activeRoom) || ({} as RoomDef); set({ roomForm: { name: r.name || '', channel: r.channel || '', visibility: 'private' }, overlay: 'roomEdit' }) },
  saveRoomEdit: () => { const f = get().roomForm, id = get().activeRoom, name = f.name.trim(); if (!name) return; persist(api.patch('/rooms/' + id, { name })); set((s) => ({ rooms: s.rooms.map((r) => r.id === id ? { ...r, name } : r), overlay: null })) },
  selectRoomTab: (t) => set({ roomTab: t }),

  // ---------- cron ----------
  setCronFilter: (f) => set({ cronFilter: f }),
  toggleCron: (id) => { persist(api.post(`/cron/${id}/toggle`)); set((s) => ({ cronJobsData: s.cronJobsData.map((j) => j.id === id ? { ...j, enabled: !j.enabled } : j) })) },
  openNewCron: () => set({ editingCronId: null, cronForm: { name: '', target: 'Sabo - Facebook Research', freq: 'daily', time: '08:00', dow: 1, interval: 30, enabled: true }, overlay: 'newCron' }),
  editCron: (j) => { const sc = cronParse(j.expr); set({ editingCronId: j.id, cronForm: { name: j.name, target: j.target, freq: sc.freq, time: sc.time, dow: sc.dow, interval: sc.interval, enabled: j.enabled }, overlay: 'newCron' }) },
  askApplyCron: () => { if (!get().cronForm.name.trim()) return; set({ overlay: 'cronApply' }) },
  openCronFromNotif: (cronId) => { const j = get().cronJobsData.find((x) => x.id === cronId); set({ view: 'cron' }); if (j) get().editCron(j) },
  applyCron: () => { const f = get().cronForm, id = get().editingCronId; if (id) persist(api.patch('/cron/' + id, { name: f.name, target: f.target, freq: f.freq, time: f.time, dow: f.dow, interval: f.interval, enabled: f.enabled })); set((s) => ({ cronJobsData: s.cronJobsData.map((j) => j.id === id ? { ...j, name: f.name.trim(), target: f.target, expr: cronExprFrom(f), enabled: f.enabled } : j), overlay: null, editingCronId: null })) },
  backToCronForm: () => set({ overlay: 'newCron' }),
  cronAskDelete: (id, e) => { e?.stopPropagation(); set({ cronDeleteTarget: id, overlay: 'cronDelete' }) },
  cronDoDelete: () => { const id = get().cronDeleteTarget; if (id) persist(api.del('/cron/' + id)); set((s) => ({ cronJobsData: s.cronJobsData.filter((j) => j.id !== id), overlay: null, cronDeleteTarget: null })) },
  cronRunNow: (id, e) => {
    e?.stopPropagation()
    if (id === 'cron-morning-ck') {
      get().fireToast('Đang chạy báo cáo sáng (OpenClaw → Telegram)…')
      set((s) => ({ cronJobsData: s.cronJobsData.map((j) => j.id === id ? { ...j, last: 'đang chạy…' } : j) }))
      api.post('/trading/morning-report').catch(() => {})
      const poll = () => {
        api.get('/trading/morning-report').then((r) => {
          if (r.status === 'done' || r.status === 'error') {
            get().fireToast(r.status === 'done' ? 'Báo cáo sáng đã gửi Telegram ✓' : 'Báo cáo sáng gặp lỗi')
            get().refreshAfterReport()
          } else { setTimeout(poll, 4000) }
        }).catch(() => {})
      }
      setTimeout(poll, 4000)
      return
    }
    if (id === 'cron-music-weekly') {
      get().fireToast('Đang chạy batch nhạc tuần (Beat)…')
      set((s) => ({ cronJobsData: s.cronJobsData.map((j) => j.id === id ? { ...j, last: 'đang chạy…' } : j) }))
      api.post('/music/batch').catch(() => {})
      const poll = () => {
        api.get('/music/batch').then((r) => {
          if (r.status === 'done' || r.status === 'error') {
            get().fireToast(r.status === 'done' ? 'Batch nhạc xong ✓' : 'Batch nhạc gặp lỗi')
            get().refreshAfterReport()
          } else { setTimeout(poll, 5000) }
        }).catch(() => {})
      }
      setTimeout(poll, 5000)
      return
    }
    persist(api.post(`/cron/${id}/run-now`))
    set((s) => ({ cronJobsData: s.cronJobsData.map((j) => j.id === id ? { ...j, last: 'vừa xong' } : j) }))
  },
  refreshAfterReport: () => {
    Promise.all([api.get('/notifs'), api.get('/cron'), api.get('/knowledge')])
      .then(([notifs, cron, knowledge]) => set({ notifsData: notifs, cronJobsData: cron, knowledgeData: knowledge })).catch(() => {})
    api.get('/channels/chung-khoan/messages').then((msgs) => set((s) => ({ messages: { ...s.messages, ['chung-khoan']: msgs } }))).catch(() => {})
  },
  onCronField: (k, v) => set((s) => ({ cronForm: { ...s.cronForm, [k]: v } as CronForm })),
  toggleCronFormEnabled: () => set((s) => ({ cronForm: { ...s.cronForm, enabled: !s.cronForm.enabled } })),
  createCron: () => { const f = get().cronForm; const name = f.name.trim(); if (!name) return; persist(api.post('/cron', { name, target: f.target, freq: f.freq, time: f.time, dow: f.dow, interval: f.interval, enabled: f.enabled })); const job: CronJob = { id: uid('j'), name, target: f.target, expr: cronExprFrom(f), last: 'chưa chạy', next: 'in 30m', creator: 'Nguyễn Thiện Giang', creatorInitial: 'N', creatorColor: '#3B5BDB', enabled: f.enabled, spark: [20, 30, 25, 35, 28, 32, 30] }; set((s) => ({ cronJobsData: [job, ...s.cronJobsData], overlay: null })) },

  // ---------- knowledge / editor ----------
  setKnowTab: (t) => set({ knowledgeTab: t }),
  setKnowFilter: (f) => set({ knowledgeFilter: f }),
  toggleKnowCat: () => set((s) => ({ knowCatOpen: !s.knowCatOpen })),
  setKnowCategory: (c) => set({ knowledgeCategory: c, knowCatOpen: false }),
  openKnowExport: () => set({ overlay: 'knowExport' }),
  openKnowImport: () => set({ overlay: 'knowImport' }),
  knowEdit: (k, e) => { e?.stopPropagation(); get().openEditor(k) },
  knowDuplicate: (title, e) => { e?.stopPropagation(); const _src = get().knowledgeData.find((x) => x.title === title); if (_src?.id) persist(api.post(`/knowledge/${_src.id}/duplicate`)); set((s) => { const src = s.knowledgeData.find((x) => x.title === title); if (!src) return {}; const copy = { ...src, title: src.title + ' (bản sao)', ver: 'v1', time: 'vừa xong' }; const i = s.knowledgeData.indexOf(src); const arr = s.knowledgeData.slice(); arr.splice(i + 1, 0, copy); return { knowledgeData: arr } }) },
  knowAskDelete: (title, e) => { e?.stopPropagation(); set({ knowDeleteTarget: title, overlay: 'knowDelete' }) },
  knowDoDelete: () => { const t = get().knowDeleteTarget; const _ent = get().knowledgeData.find((k) => k.title === t); if (_ent?.id) persist(api.del('/knowledge/' + _ent.id)); set((s) => ({ knowledgeData: s.knowledgeData.filter((k) => k.title !== t), overlay: null, knowDeleteTarget: null })) },
  onKnowQuery: (v) => set({ knowledgeQuery: v }),
  openEditor: (entry) => { if (entry) set({ view: 'editor', editorTitle: entry.title, editorType: entry.type, editorCategory: entry.repo }); else set({ view: 'editor' }) },
  openKnowledgeContent: (entry) => { if (!entry.id) return; set({ knowContent: { title: entry.title, body: 'Đang tải…' }, overlay: 'knowContent' }); api.get('/knowledge/' + entry.id).then((full) => set({ knowContent: { title: full.title, body: full.content || '(không có nội dung)' } })).catch(() => set({ knowContent: { title: entry.title, body: 'Lỗi khi tải nội dung.' } })) },
  newEntry: () => set({ view: 'editor', editorTitle: '', editorType: 'knowledge', editorText: '# Tiêu đề mới\n\nNội dung knowledge…' }),
  closeEditor: () => set({ view: 'knowledge', editorConfirm: null }),
  askCancelEditor: () => set({ editorConfirm: 'cancel' }),
  askSubmitEditor: () => set({ editorConfirm: 'submit' }),
  dismissEditorConfirm: () => set({ editorConfirm: null }),
  setEditorMode: (m) => set({ editorMode: m }),
  setEditorType: (t) => set({ editorType: t }),
  setEditorLoadMode: (m) => set({ editorLoadMode: m }),
  setEditorVisibility: (v) => set({ editorVisibility: v }),
  onEditorTitle: (v) => set({ editorTitle: v }),
  onEditorCategory: (v) => set({ editorCategory: v }),
  onEditorTags: (v) => set({ editorTags: v }),
  onEditorText: (v) => set({ editorText: v }),
  toggleEditorAgent: (id) => set((s) => ({ editorAgentsChecked: { ...s.editorAgentsChecked, [id]: !s.editorAgentsChecked[id] } })),

  // ---------- channels / chat ----------
  selectChannel: (id) => {
    const prev = get().activeId
    const count = get().unread[id] || 0
    const unread = { ...get().unread }; delete unread[id]
    // remember how many messages were new so the chat can scroll to the first one (— Tin mới — marker)
    set({ activeId: id, overlay: null, unread, unreadJump: count > 0 ? { id, count } : null })
    if (prev && prev !== id) api.post(`/channels/${prev}/read`).catch(() => {})  // mark the channel you left read
    api.post(`/channels/${id}/read`).catch(() => {})                              // and the one you opened
    // refetch so the jump target (the bot's reply) is actually in the list
    api.get(`/channels/${id}/messages`).then((msgs) => set((s) => ({ messages: { ...s.messages, [id]: msgs } }))).catch(() => {})
  },
  openCreate: () => set({ overlay: 'create', createForm: { name: '', type: 'private', desc: '' } }),
  openSwitch: () => set({ overlay: 'switch', switchQuery: '' }),
  openDb: () => set({ overlay: 'db' }),
  openWorkflow: () => set({ overlay: 'workflow' }),
  onDraft: (v) => set({ draft: v }),
  onComposerFocus: () => set({ composerFocused: true }),
  onComposerBlur: () => set({ composerFocused: false }),
  insertMention: () => set((s) => ({ draft: s.draft + '@' })),
  replyTo: (name) => set({ draft: '@' + name + ' ' }),
  sendMessage: () => {
    const text = get().draft.trim(); const att = get().pendingAttach
    if (!text && !att) return
    const id = get().activeId
    const raw: ChatMessage['raw'] = []
    if (text) raw.push({ kind: 'para', rich: [{ v: text, isText: true }] })
    const attachBlock = att ? { icon: att.icon, name: att.name, label: att.label, url: att.url, mime: att.mime, fileKind: att.fileKind } : null
    if (attachBlock) raw.push({ kind: 'attach', ...attachBlock })
    const me = get().profileData
    const meInitial = ((me.name || '').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('') || 'U').toUpperCase()
    const msg: ChatMessage = { authorName: me.name || 'Bạn', time: nowTime(), avatarInitial: meInitial, avatarColor: '#3B5BDB', isAgent: false, raw }
    set((s) => ({ messages: { ...s.messages, [id]: [...(s.messages[id] || []), msg] }, draft: '', pendingAttach: null }))
    const dm = get().directData.find((c) => c.id === id)
    persist(
      api.post(`/channels/${id}/messages`, { text, attach: attachBlock }).then(() => {
        // Trading channel: route to the TradingAgents tools / 9Router analyst
        if (id === 'chung-khoan' && text) {
          return api.post('/trading/chat', { channel_id: id, text }).then((res) => {
            const replies = (res && res.messages) || []
            set((s) => ({ messages: { ...s.messages, [id]: [...(s.messages[id] || []), ...replies] } }))
            if (res && res.analyzing) get().pollTradingAnalyze(id, res.analyzing)
          })
        }
        // Music channel: forward to Beat (music-orchestrator), reply arrives async
        if (id === 'am-nhac' && text) {
          return api.post('/music/chat', { text }).then(() => get().pollMusicChat(id))
        }
        // Comics channel: Họa — script gate + character sheets run async
        if (id === 'truyen-tranh' && text) {
          return api.post('/comics/chat', { channel_id: id, text }).then((res) => {
            const replies = (res && res.messages) || []
            set((s) => ({ messages: { ...s.messages, [id]: [...(s.messages[id] || []), ...replies] } }))
            if (res && res.job === 'running') get().pollComicsChat(id)
          })
        }
        // Metals channel: Aurum — price card sync, advice runs the async pipeline
        if (id === 'vang-bac' && text) {
          return api.post('/metals/chat', { channel_id: id, text }).then((res) => {
            const replies = (res && res.messages) || []
            set((s) => ({ messages: { ...s.messages, [id]: [...(s.messages[id] || []), ...replies] } }))
            if (res && res.analyzing) get().pollMetalsAnalyze(id)
          })
        }
        // Film channel: Reel — create/control films; replies + gate prompts arrive async
        if (id === 'phim' && text) {
          return api.post('/films/chat', { channel_id: id, text }).then((res) => {
            const replies = (res && res.messages) || []
            set((s) => ({ messages: { ...s.messages, [id]: [...(s.messages[id] || []), ...replies] } }))
            if (res && res.filmId) get().pollReel(id, res.filmId)
          })
        }
        // DM channels are 1:1 with an agent — auto-generate a real reply via 9Router
        if (dm && text) {
          return api.post(`/channels/${id}/agent-reply`, { agentName: dm.name }).then((reply) => {
            set((s) => ({ messages: { ...s.messages, [id]: [...(s.messages[id] || []), reply] } }))
          })
        }
      }),
    )
  },
  pollTradingAnalyze: (channelId, ticker) => {
    const tick = () => {
      api.get(`/trading/analyze?ticker=${encodeURIComponent(ticker)}`).then((r) => {
        if (r.status === 'done' || r.status === 'error') {
          api.get(`/channels/${channelId}/messages`).then((msgs) => set((s) => ({ messages: { ...s.messages, [channelId]: msgs } }))).catch(() => {})
          get().refreshTradingOps()
        } else {
          setTimeout(tick, 4000)
        }
      }).catch(() => {})
    }
    setTimeout(tick, 4000)
  },
  pollMetalsAnalyze: (channelId) => {
    const tick = () => {
      api.get('/metals/analyze').then((r) => {
        if (r.status === 'done' || r.status === 'error') {
          api.get(`/channels/${channelId}/messages`).then((msgs) => set((s) => ({ messages: { ...s.messages, [channelId]: msgs } }))).catch(() => {})
          get().pollWorkflows()  // the wf-metals card just recorded a run
        } else {
          setTimeout(tick, 4000)
        }
      }).catch(() => {})
    }
    setTimeout(tick, 4000)
  },
  pollComicsChat: (channelId) => {
    const tick = () => {
      api.get('/comics/chat').then((r) => {
        if (r.status === 'done' || r.status === 'error') {
          api.get(`/channels/${channelId}/messages`).then((msgs) => set((s) => ({ messages: { ...s.messages, [channelId]: msgs } }))).catch(() => {})
          get().pollWorkflows()
        } else {
          setTimeout(tick, 4000)
        }
      }).catch(() => {})
    }
    setTimeout(tick, 4000)
  },
  pollMusicChat: (channelId) => {
    const tick = () => {
      api.get('/music/chat').then((r) => {
        if (r.status === 'done' || r.status === 'error') {
          api.get(`/channels/${channelId}/messages`).then((msgs) => set((s) => ({ messages: { ...s.messages, [channelId]: msgs } }))).catch(() => {})
        } else {
          setTimeout(tick, 4000)
        }
      }).catch(() => {})
    }
    setTimeout(tick, 4000)
  },
  pollReel: (channelId, filmId) => {
    let n = 0
    const tick = () => {
      n++
      api.get('/films/' + filmId).then((f) => {
        api.get(`/channels/${channelId}/messages`).then((msgs) => set((s) => ({ messages: { ...s.messages, [channelId]: msgs } }))).catch(() => {})
        const done = f && (f.status === 'done' || f.status === 'error')
        if (!done && n < 200) setTimeout(tick, 6000)
      }).catch(() => { if (n < 200) setTimeout(tick, 6000) })
    }
    setTimeout(tick, 3000)
  },
  refreshTradingOps: () => {
    Promise.all([api.get('/mcp'), api.get('/workflows'), api.get('/sessions'), api.get('/knowledge')])
      .then(([mcp, workflows, sessions, knowledge]) => set({ mcpData: mcp, workflows, sessionsData: sessions, knowledgeData: knowledge }))
      .catch(() => {})
  },
  pollWorkflows: () => { api.get('/workflows').then((workflows) => set({ workflows })).catch(() => {}) },
  reloadWorkflows: () => {
    Promise.all([api.get('/workflows'), api.get('/sessions')])
      .then(([workflows, sessions]) => { set({ workflows, sessionsData: sessions }); get().fireToast('Đã tải lại workflow') })
      .catch(() => {})
  },
  runMusicBatch: () => {
    Promise.all([api.get('/workflows'), api.get('/knowledge'), api.get('/notifs'), api.get('/channels')])
      .then(([workflows, knowledge, notifs, channels]) => {
        const c = channels as { public?: unknown[]; private?: unknown[]; direct?: unknown[] }
        set({
          workflows, knowledgeData: knowledge, notifsData: notifs,
          publicData: c.public as never ?? get().publicData,
          privateData: c.private as never ?? get().privateData,
          directData: c.direct as never ?? get().directData,
        })
      })
      .catch(() => {})
  },
  toggleChatSearch: () => set((s) => ({ chatSearchOpen: !s.chatSearchOpen, chatSearch: '' })),
  onChatSearch: (v) => set({ chatSearch: v }),
  confirmLeave: () => set({ overlay: 'leave' }),
  doLeave: () => { const id = get().activeId; persist(api.post('/channels/' + id + '/leave')); const drop = (arr: Channel[]) => arr.filter((c) => c.id !== id); set((s) => { const pub = drop(s.publicData), pri = drop(s.privateData), dir = drop(s.directData); const next = (pub[0] || pri[0] || dir[0] || ({} as Channel)).id || ''; const messages = { ...s.messages }; delete messages[id]; return { publicData: pub, privateData: pri, directData: dir, messages, activeId: next, overlay: null } }) },
  askDeleteChannel: (id) => set({ deleteTarget: id, overlay: 'deleteChannel' }),
  askRename: (id) => { const c = get().findChannel(id) || ({} as Channel); set({ renameTarget: id, renameValue: c.name || '', overlay: 'renameChannel' }) },
  onRenameInput: (v) => set({ renameValue: v }),
  doRename: () => { const id = get().renameTarget, name = get().renameValue.trim(); if (!id || !name) return; persist(api.patch('/channels/' + id, { name })); const ren = (arr: Channel[]) => arr.map((c) => c.id === id ? { ...c, name } : c); set((s) => ({ publicData: ren(s.publicData), privateData: ren(s.privateData), directData: ren(s.directData), overlay: null, renameTarget: null })) },
  doDeleteChannel: () => { const id = get().deleteTarget; if (!id) return; persist(api.del('/channels/' + id)); const drop = (arr: Channel[]) => arr.filter((c) => c.id !== id); set((s) => { const pub = drop(s.publicData), pri = drop(s.privateData), dir = drop(s.directData); const messages = { ...s.messages }; delete messages[id]; const activeId = s.activeId === id ? ((pub[0] || pri[0] || dir[0] || ({} as Channel)).id || '') : s.activeId; return { publicData: pub, privateData: pri, directData: dir, messages, activeId, overlay: null, deleteTarget: null } }) },
  toggleAttachMenu: () => set((s) => ({ attachMenuOpen: !s.attachMenuOpen })),
  pickAttach: (kind) => {
    // file/image are handled by the composer's real <input type=file> → uploadAttach.
    // 'record' attaches a reference to the most recent real Knowledge entry.
    if (kind === 'record') {
      const k = get().knowledgeData[0]
      if (!k) { get().fireToast('Chưa có bản ghi nào trong Kiến thức'); set({ attachMenuOpen: false }); return }
      set({ pendingAttach: { icon: '🗄', name: k.title, label: 'Bản ghi · ' + (k.repo || 'knowledge'), fileKind: 'record' }, attachMenuOpen: false })
    } else {
      set({ attachMenuOpen: false })
    }
  },
  uploadAttach: async (file) => {
    set({ attachMenuOpen: false })
    try {
      const r = await api.upload('/upload', file)
      const isImg = r.kind === 'image'
      set({ pendingAttach: { icon: isImg ? '🖼' : '📎', name: r.name, label: isImg ? 'Hình ảnh' : 'Tệp đính kèm', url: r.url, mime: r.mime, fileKind: r.kind } })
    } catch (e) {
      get().fireToast('Tải tệp thất bại: ' + (e instanceof Error ? e.message : 'lỗi'))
    }
  },
  clearAttach: () => set({ pendingAttach: null }),
  clearHistory: (id) => {
    persist(api.del(`/channels/${id}/messages`))
    set((s) => ({ messages: { ...s.messages, [id]: [] } }))
    get().fireToast('Đã xóa lịch sử trò chuyện')
  },
  setAutoDelete: (id, seconds) => {
    persist(api.patch(`/channels/${id}/auto-delete`, { seconds }))
    const upd = (list: Channel[]) => list.map((c) => (c.id === id ? { ...c, autoDeleteSeconds: seconds } : c))
    set((s) => ({ publicData: upd(s.publicData), privateData: upd(s.privateData), directData: upd(s.directData) }))
    if (seconds > 0) api.get(`/channels/${id}/messages`).then((msgs) => set((st) => ({ messages: { ...st.messages, [id]: msgs } }))).catch(() => {})
    get().fireToast(seconds > 0 ? `Đã bật tự xóa sau ${autoDeleteLabel(seconds)}` : 'Đã tắt tự xóa')
  },
  openFiles: () => set({ overlay: 'files' }),
  openFile: (f) => set({ fileDetail: f, overlay: 'fileView' }),
  openAddMember: () => set({ overlay: 'addMember' }),
  openMembers: () => set({ overlay: 'members' }),
  openChannelTask: (t) => set({ channelTaskDetail: t, overlay: 'channelTask' }),
  addMemberTo: (payload) => {
    const id = get().activeId
    api.post(`/channels/${id}/members`, payload).then((m) => set((s) => {
      const upd = (arr: Channel[]) => arr.map((c) => (c.id === id && !(c.memberList || []).some((x) => x.id === m.id)) ? { ...c, memberList: [...(c.memberList || []), m], members: (c.memberList || []).length + 1 } : c)
      return { publicData: upd(s.publicData), privateData: upd(s.privateData), directData: upd(s.directData) }
    })).catch(() => get().fireToast('Không thêm được thành viên'))
  },
  removeMember: (memberId) => {
    const id = get().activeId
    persist(api.del(`/channels/${id}/members/${memberId}`))
    set((s) => {
      const upd = (arr: Channel[]) => arr.map((c) => c.id === id ? { ...c, memberList: (c.memberList || []).filter((x) => x.id !== memberId), members: Math.max(0, (c.memberList || []).length - 1) } : c)
      return { publicData: upd(s.publicData), privateData: upd(s.privateData), directData: upd(s.directData) }
    })
  },
  onCreateName: (v) => set((s) => ({ createForm: { ...s.createForm, name: v } })),
  onCreateDesc: (v) => set((s) => ({ createForm: { ...s.createForm, desc: v } })),
  setTypePublic: () => set((s) => ({ createForm: { ...s.createForm, type: 'public' } })),
  setTypePrivate: () => set((s) => ({ createForm: { ...s.createForm, type: 'private' } })),
  onCreateNameFocus: () => set({ createFocused: true }),
  onCreateNameBlur: () => set({ createFocused: false }),
  createChannel: () => { const f = get().createForm; const name = f.name.trim(); if (!name) return; persist(api.post('/channels', { name, type: f.type, desc: f.desc.trim() })); const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || ('room-' + uid('')); const ch: Channel = { id, name, desc: f.desc.trim() || 'Room channel mới', visibility: f.type === 'public' ? 'PUBLIC' : 'PRIVATE', members: 1, files: id + '/', database: id, tasks: [], wfTotal: 0, wfNote: 'Chưa cấu hình workflow cho room này.' }; const messages = { ...get().messages, [id]: [] }; if (f.type === 'public') set((s) => ({ publicData: [...s.publicData, ch], messages, activeId: id, overlay: null })); else set((s) => ({ privateData: [...s.privateData, ch], messages, activeId: id, overlay: null })) },
  onSwitchQuery: (v) => set({ switchQuery: v }),

  allChannels: () => [...get().publicData, ...get().privateData, ...get().directData],
  findChannel: (id) => get().allChannels().find((c) => c.id === id),
}))
