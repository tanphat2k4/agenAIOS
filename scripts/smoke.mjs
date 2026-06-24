import { createServer } from 'vite'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
let fail = 0
try {
  const { useStore } = await vite.ssrLoadModule('/src/store.ts')
  const { ViewRouter } = await vite.ssrLoadModule('/src/screens/ViewRouter.tsx')
  const { NavRail } = await vite.ssrLoadModule('/src/components/NavRail.tsx')
  const { PersonCardPopover } = await vite.ssrLoadModule('/src/components/PersonCardPopover.tsx')
  const { Auth } = await vite.ssrLoadModule('/src/screens/Auth.tsx')
  try { renderToStaticMarkup(React.createElement(Auth)); console.log('ok   auth') } catch (e) { fail++; console.error('FAIL auth', e.message) }

  const views = ['channels', 'rooms', 'cron', 'knowledge', 'editor', 'workflow', 'overview', 'agents', 'mcp', 'tasks', 'devices', 'logs', 'perms', 'billing', 'users', 'notifs', 'language', 'profile']
  // overlays to exercise per view to render modal code paths
  const overlays = { channels: ['create', 'switch', 'db', 'workflow', 'leave', 'renameChannel', 'deleteChannel', 'files', 'members', 'addMember'], cron: ['newCron', 'cronApply', 'cronDelete'], knowledge: ['knowExport', 'knowImport', 'knowDelete'], workflow: ['newWorkflow', 'wfImport', 'wfDelete', 'stepDetail'], agents: ['newAgent', 'agentImport', 'agentConfig', 'agentDelete'], mcp: ['newMcp'], rooms: ['newRoom', 'roomEdit', 'roomAddMember', 'roomDelete'], users: ['invite'], profile: ['editProfile', 'changePw', 'logout'] }

  const renderAll = (label) => {
    renderToStaticMarkup(React.createElement(NavRail))
    renderToStaticMarkup(React.createElement(ViewRouter))
    renderToStaticMarkup(React.createElement(PersonCardPopover))
  }

  for (const v of views) {
    try {
      useStore.setState({ view: v, overlay: null })
      renderAll(v)
      // exercise overlays
      for (const ov of (overlays[v] || [])) {
        useStore.setState({ overlay: ov, fileDetail: useStore.getState().fileDetail, channelTaskDetail: { id: 'T-1', status: 'X', assignee: '@a', text: 'x', time: '1m' }, stepDetail: 0, deleteTarget: 'room-zy-novel', knowDeleteTarget: 'x', cronDeleteTarget: 'j1' })
        renderToStaticMarkup(React.createElement(ViewRouter))
      }
      // dedicated-flag modals
      useStore.setState({ overlay: null, showCreateTask: true, taskDrawer: 'T-2593', deviceDrawer: 'mn01', showAddDevice: true, mcpDrawer: 'fb', agentDrawer: 'dragon', editUser: useStore.getState().usersData[1], langPicker: 'timezone', showCreateRole: true, showAssignMember: true, editorConfirm: 'cancel', taskDeleteConfirm: true, taskSaveConfirm: true, devDeleteConfirm: true, mcpDeleteConfirm: true })
      renderToStaticMarkup(React.createElement(ViewRouter))
      useStore.setState({ showCreateTask: false, taskDrawer: null, deviceDrawer: null, showAddDevice: false, mcpDrawer: null, agentDrawer: null, editUser: null, langPicker: null, showCreateRole: false, showAssignMember: false, editorConfirm: null, taskDeleteConfirm: false, taskSaveConfirm: false, devDeleteConfirm: false, mcpDeleteConfirm: false })
      console.log('ok  ', v)
    } catch (e) {
      fail++
      console.error('FAIL', v, '→', e.message?.split('\n')[0])
    }
  }
  // person card
  try { useStore.setState({ personCard: { name: 'Dragon - CEO', initial: 'D', color: '#C0392B', isAgent: true } }); renderToStaticMarkup(React.createElement(PersonCardPopover)); console.log('ok   personCard') } catch (e) { fail++; console.error('FAIL personCard', e.message) }
} catch (e) {
  console.error('SETUP FAIL', e)
  fail++
} finally {
  await vite.close()
}
console.log(fail ? `\n❌ ${fail} screen(s) failed` : '\n✅ all screens render')
process.exit(fail ? 1 : 0)
