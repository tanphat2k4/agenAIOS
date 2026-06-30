@echo off
REM Auto-start the AgentAIOS frontend (Vite dev server, :5173).
REM Launched hidden by the Startup .vbs (agentaios-frontend.vbs).
cd /d D:\agenAIOS
npm run dev > "%LOCALAPPDATA%\agentaios-frontend.log" 2>&1
