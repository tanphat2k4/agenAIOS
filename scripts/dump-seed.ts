// Dump the prototype's mock data (src/data/seed.ts) to JSON so the Python
// backend can seed Postgres with the exact same data — no hand-transcription.
import { writeFileSync } from 'node:fs'
import * as seed from '../src/data/seed'

const out: Record<string, unknown> = {
  agentsData: seed.agentsData,
  mcpData: seed.mcpData,
  workflows: seed.workflows,
  cronJobsData: seed.cronJobsData,
  tasksData: seed.tasksData,
  devicesData: seed.devicesData,
  sessionsData: seed.sessionsData,
  auditLog: seed.auditLog,
  usersData: seed.usersData,
  invitesData: seed.invitesData,
  signupsData: seed.signupsData,
  notifsData: seed.notifsData,
  billMonths: seed.billMonths,
  rolesData: seed.rolesData,
  initialRolePerms: seed.initialRolePerms,
  knowledgeData: seed.knowledgeData,
  publicData: seed.publicData,
  privateData: seed.privateData,
  directData: seed.directData,
  messages: seed.messages,
  rooms: seed.rooms,
  roomMembersById: seed.roomMembersById,
  profileData: seed.profileData,
  profileSessions: seed.profileSessions,
  editorAgents: seed.editorAgents,
}

writeFileSync(new URL('../backend/seed_data.json', import.meta.url), JSON.stringify(out, null, 2))
console.log('dumped collections:', Object.keys(out).length)
for (const [k, v] of Object.entries(out)) {
  const n = Array.isArray(v) ? v.length : v && typeof v === 'object' ? Object.keys(v).length : 1
  console.log(`  ${k}: ${n}`)
}
