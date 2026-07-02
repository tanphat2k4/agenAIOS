// Shared domain types. Pragmatic/loose where the prototype data is inconsistent.
import type { ChatMessage } from './data/richText'

export type { ChatMessage }

export interface Agent {
  id: string
  name: string
  handle: string
  role: string
  roleType: string
  initial: string
  color: string
  status: 'online' | 'busy' | 'idle' | 'offline'
  model: string
  modelType: 'local' | 'cloud'
  tasks: number
  rooms: number
  success: number
  skills: string[]
  lastActive: string
  bio: string
  roomsList: string[]
  recentTasks: { id: string; text: string; status: string }[]
}

export interface TaskItem {
  id: string
  title: string
  status: 'queued' | 'running' | 'review' | 'done'
  assignee: string
  initial: string
  color: string
  room: string
  priority: 'high' | 'med' | 'low'
  time: string
  desc: string
}

export interface Device {
  id: string
  name: string
  type: 'server' | 'gateway' | 'desktop' | 'phone'
  icon: string
  status: 'online' | 'offline'
  addr: string
  os: string
  cpu: string
  cpuPct: number
  ram: string
  ramPct: number
  gpu: string
  gpuPct: number
  vram: string
  uptime: string
  lastSeen: string
  role: string
  models: { name: string; vram: string }[]
}

export interface Film {
  id: string
  title: string
  arcTaskId: string
  projectSlug: string
  stage: string
  status: 'queued' | 'running' | 'needs_review' | 'done' | 'error'
  publicUrl: string
  aspectRatio: string
  contentMode: string
  channelId: string
  createdBy: string
  errorMessage: string
  createdAt: string
  updatedAt: string
  // live fields from GET /films/:id (not persisted on the row)
  progress?: Record<string, unknown>[]
  subStage?: string | null
  review?: Record<string, unknown> | null
  scriptSegments?: unknown[] | null
  elapsedSeconds?: number
  offline?: boolean
}

export interface McpServer {
  id: string
  name: string
  icon: string
  desc: string
  transport: string
  status: 'connected' | 'disabled' | 'error'
  tools: string[]
  agents: number
  calls24: number
  lastSync: string
  endpoint: string
  recentCalls: { tool: string; time: string; ok: boolean }[]
}

export interface WorkflowStep {
  agent: string
  initial: string
  color: string
  title: string
  io: string
  status: 'done' | 'running' | 'idle' | 'paused'
  dur: string
}
export interface WorkflowRun {
  time: string
  date?: string  // YYYY-MM-DD — day grouping in the runs list (older entries lack it)
  exp?: string   // YYYY-MM-DD — retention deadline stamped on legacy dateless entries
  status: string
  dur: string
}
export interface Workflow {
  id: string
  name: string
  desc: string
  trigger: 'cron' | 'event' | 'manual'
  triggerLabel: string
  enabled: boolean
  lastRun: string
  runs24: number
  success: number
  steps: WorkflowStep[]
  runs: WorkflowRun[]
  runState?: 'running' | 'paused' | 'idle'
}

export interface CronJob {
  id: string
  name: string
  target: string
  expr: string
  last: string
  next: string
  creator: string
  creatorInitial: string
  creatorColor: string
  enabled: boolean
  spark: number[]
}

export interface KnowledgeEntry {
  id?: string
  type: 'knowledge' | 'agent' | 'rule' | 'skill' | 'note' | 'account'
  title: string
  repo: string
  ver: string
  time: string
  private?: boolean
  avatars: { i: string; c: string }[]
  extra?: number
  content?: string
  hasContent?: boolean
}

export interface RoleMember {
  name: string
  initial: string
  color: string
  sub: string
}
export interface RoleDef {
  id: string
  name: string
  icon: string
  color: string
  system: boolean
  desc: string
  members: RoleMember[]
}

export interface SessionLog {
  id: string
  agent: string
  initial: string
  color: string
  room: string
  model: string
  modelType: 'local' | 'cloud'
  status: 'running' | 'done' | 'failed'
  started: string
  duration: string
  tokens: string
  log: { t: string; lvl: 'info' | 'debug' | 'warn' | 'error'; msg: string }[]
}

export interface UserRow {
  id: string
  name: string
  email: string
  initial: string
  color: string
  role: 'owner' | 'lead' | 'staff' | 'viewer'
  status: 'active' | 'suspended'
  last: string
}
export interface Invite {
  id: string
  email: string
  role: string
  by: string
  time: string
}
export interface Signup {
  id: string
  name: string
  email: string
  initial: string
  color: string
  role: string
  via: string
  time: string
}

export interface Notif {
  id: string
  group: string
  type: string
  taskId?: string
  cronId?: string
  actor: string
  initial: string
  color: string
  action: string
  preview: string
  time: string
  unread: boolean
}

export interface ChannelMember {
  id: string
  userId?: string | null
  name: string
  initial: string
  color: string
  role: string
  isAgent: boolean
}

export interface Channel {
  id: string
  name: string
  desc: string
  visibility: string
  icon?: string
  color?: string
  initial?: string
  members: number
  memberList?: ChannelMember[]
  database: string | null
  files?: string
  tasks: { id: string; status: string; assignee: string; text: string; time: string }[]
  wfTotal: number
  wfNote: string
  autoDeleteSeconds?: number
}

export interface RoomDef {
  id: string
  name: string
  slug: string
  channel: string
}
export interface RoomMember {
  name: string
  handle: string
  type: 'user' | 'agent'
  role: 'lead' | 'staff'
  initial: string
  color: string
}

export interface PersonCard {
  name: string
  initial: string
  color: string
  role?: string
  bio?: string
  isAgent?: boolean
  isOwner?: boolean
}

export type ViewName =
  | 'channels' | 'rooms' | 'cron' | 'knowledge' | 'editor' | 'workflow' | 'trading' | 'music' | 'film'
  | 'overview' | 'agents' | 'mcp' | 'tasks' | 'devices' | 'logs'
  | 'perms' | 'billing' | 'plans' | 'users' | 'notifs' | 'language' | 'profile'
