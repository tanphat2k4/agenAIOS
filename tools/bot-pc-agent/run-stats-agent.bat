@echo off
REM ============================================================================
REM  Run this ON the Bot PC (192.168.1.3) — double-click it.
REM  It self-elevates (UAC), opens firewall TCP 9998, then starts stats_agent.py.
REM  Keep this .bat in the SAME folder as stats_agent.py.
REM  Needs Python installed on the Bot PC (the Suno bot already uses Python).
REM ============================================================================
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting administrator (to open the firewall port)...
  powershell -Command "Start-Process -Verb RunAs -FilePath '%~f0'"
  exit /b
)
echo Opening firewall TCP 9998...
netsh advfirewall firewall add rule name="AgentAIOS stats 9998" dir=in action=allow protocol=TCP localport=9998 >nul 2>&1
cd /d "%~dp0"
echo Starting stats agent (leave this window open)...
python stats_agent.py
pause
