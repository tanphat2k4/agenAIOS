import { useStore } from '@/store'
import type { ViewName } from '@/types'
import type { ComponentType } from 'react'

import { Channels } from './Channels'
import { Rooms } from './Rooms'
import { Cron } from './Cron'
import { Knowledge } from './Knowledge'
import { Editor } from './Editor'
import { WorkflowView } from './Workflow'
import { Trading } from './Trading'
import { Overview } from './Overview'
import { Agents } from './Agents'
import { Mcp } from './Mcp'
import { Tasks } from './Tasks'
import { Devices } from './Devices'
import { Logs } from './Logs'
import { Perms } from './Perms'
import { Users } from './Users'
import { Notifs } from './Notifs'
import { Language } from './Language'
import { Profile } from './Profile'

const screens: Partial<Record<ViewName, ComponentType>> = {
  channels: Channels,
  rooms: Rooms,
  cron: Cron,
  knowledge: Knowledge,
  editor: Editor,
  workflow: WorkflowView,
  trading: Trading,
  overview: Overview,
  agents: Agents,
  mcp: Mcp,
  tasks: Tasks,
  devices: Devices,
  logs: Logs,
  perms: Perms,
  users: Users,
  notifs: Notifs,
  language: Language,
  profile: Profile,
}

export function ViewRouter() {
  const view = useStore((s) => s.view)
  const Screen = screens[view]
  if (!Screen) return <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--placeholder)' }}>…</div>
  return <Screen />
}
