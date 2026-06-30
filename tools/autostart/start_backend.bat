@echo off
REM Auto-start the AgentAIOS FastAPI backend on :8000.
REM Launched hidden by run_hidden.vbs via Task Scheduler task "AgentAIOS Backend".
cd /d D:\agenAIOS
backend\.venv\Scripts\uvicorn.exe app.main:app --port 8000 --app-dir backend > "%LOCALAPPDATA%\agentaios-backend.log" 2>&1
