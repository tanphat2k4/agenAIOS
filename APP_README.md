# AgentAIOS

A faithful React implementation of the **AgentAIOS** workspace — a Slack-style team/agent
collaboration app (Vietnamese UI) built on the *Trợ Lý* design system: light canvas,
Be Vietnam Pro, indigo `#3B5BDB` accent.

Recreated 1:1 from the HTML/CSS prototype in [`project/ZyAgents.dc.html`](project/ZyAgents.dc.html)
(the original Claude Design export; kept for reference, not used at runtime).

## Stack
- **React 18 + Vite + TypeScript** (strict)
- **Zustand** for state (one store mirroring the prototype's state + handlers)
- No CSS framework — design tokens as CSS variables, styles ported inline / via small UI primitives
- **Real backend**: FastAPI + PostgreSQL + 9Router (see [`backend/README.md`](backend/README.md)). The
  store now hydrates from the API and persists every mutation; agent chat in DMs is real (9Router).
  Set `VITE_API_URL` to point at the API (default `http://localhost:8000`). Start the backend first.

## Run
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle → dist/
npm run preview    # serve the built bundle
node scripts/smoke.mjs   # SSR smoke test: render every screen + modal
```

## Project layout
```
src/
  main.tsx, App.tsx            # entry + shell (NavRail + ViewRouter + Tweaks + global toast + person card)
  theme.ts                     # applyTheme() — accent / light·dark / nav tone (the Tweaks panel)
  store.ts                     # Zustand store: all state + actions (the app's brain)
  types.ts                     # domain types
  styles/global.css            # design tokens, fonts, keyframes
  data/                        # seed.ts (mock data), richText.ts, langs.ts, channelsExtra.ts
  lib/                         # markdown.tsx, richtext.tsx (render helpers)
  components/
    NavRail.tsx, Tweaks.tsx, PersonCardPopover.tsx
    ui/                        # Hover, Modal, Drawer, Avatar, Toast, screen.tsx (StatCards, FilterChips, …)
  screens/
    ViewRouter.tsx             # switches the active view
    Channels.tsx + channels/  # chat (channel list · messages · composer · detail panel) + 12 modals
    Rooms, Cron, Knowledge, Editor, Workflow, Overview, Agents, Mcp, Tasks,
    Devices, Logs, Perms, Billing, Users, Notifs, Language, Profile
```

## Screens (18)
Workspace: **Kênh** (chat), **Kiến thức** (+ markdown editor), **Cron**, **Agent Workflow** ·
Lead: **Tổng quan** (dashboard), **Phòng**, **Agents**, **MCP** ·
Owner: **Tác vụ** (Kanban), **Thiết bị**, **Phiên & nhật ký**, **Phân quyền**, **Sử dụng** (billing),
**Người dùng & vai trò** · plus **Thông báo**, **Ngôn ngữ & khu vực**, **Tài khoản**.

All data is in-memory (mock), and interactions update local state — cross-screen effects work
(e.g. creating a task updates the dashboard KPI + activity feed; creating a room creates its channel).

## Theming (Tweaks)
The floating 🎨 button (bottom-right) reshapes the whole app via CSS variables:
**accent** (Indigo / Ngọc bích / Tím / Hồng / Hổ phách), **theme** (Sáng / Tối), and
**nav tone** (Theo nhấn / Than chì / Mực).

## Auth page
Ported to [`src/screens/Auth.tsx`](src/screens/Auth.tsx). The app boots to the login/register
screen; a successful login or register enters the workspace, and "Đăng xuất" (in Tài khoản)
returns to it. (Auth is mock — any valid-looking email submits.)
