# AgentAIOS — autostart & dev run

The backend (`uvicorn` on **:8000**) does **not** survive being launched from a Claude Code session —
the agent harness reaps child processes when a turn/session ends. Use one of the options below to keep
it running on its own.

## Option 1 — Startup folder (active, no admin)
`…\Start Menu\Programs\Startup\agentaios-backend.vbs` runs `start_backend.bat` **hidden** at each logon.
- **Start now** (without re-login): double-click that `.vbs` (or `Win+R` → `shell:startup` → double-click it)
- **Disable:** delete that `.vbs`
- **Log:** `%LOCALAPPDATA%\agentaios-backend.log`
- **Limitation:** no auto-restart if uvicorn crashes.

## Option 2 — Task Scheduler (sturdier, needs admin, auto-restart)
Run once in an **elevated** PowerShell:
```
powershell -ExecutionPolicy Bypass -File D:\agenAIOS\tools\autostart\install-autostart-task.ps1
```
Registers task **"AgentAIOS Backend"** (logon trigger + restart-on-failure). Then delete the Startup
`.vbs` (Option 1) to avoid launching twice. Remove later (elevated):
`Unregister-ScheduledTask -TaskName "AgentAIOS Backend"`.

## Option 3 — Manual (one terminal, foreground)
```
cd D:\agenAIOS
backend\.venv\Scripts\uvicorn.exe app.main:app --port 8000 --app-dir backend
```
Frontend (Vite, :5173): `npm run dev`.

## Commit type-check gate (.githooks/pre-commit)
Bare `tsc --noEmit` is a **no-op** here (root `tsconfig.json` is references-only). Enable the real gate once:
```
git config core.hooksPath .githooks
```
Then every commit that touches `.ts/.tsx` runs `tsc -b --noEmit` and is blocked on type errors. Bypass: `git commit --no-verify`.
