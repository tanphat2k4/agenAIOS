# Register a sturdier autostart for the AgentAIOS backend via Task Scheduler.
# Unlike the Startup-folder .vbs, this ALSO auto-restarts uvicorn if it crashes.
#
# Run ONCE in an ELEVATED PowerShell (Run as administrator):
#     powershell -ExecutionPolicy Bypass -File D:\agenAIOS\tools\autostart\install-autostart-task.ps1
#
# After it succeeds, delete the Startup .vbs so the backend isn't launched twice:
#     del "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\agentaios-backend.vbs"
$ErrorActionPreference = "Stop"

$vbs = "D:\agenAIOS\tools\autostart\run_hidden.vbs"   # launches start_backend.bat hidden
$action    = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbs`""
$trigger   = New-ScheduledTaskTrigger -AtLogOn
$settings  = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) `
              -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
              -ExecutionTimeLimit (New-TimeSpan -Seconds 0)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName "AgentAIOS Backend" -Action $action -Trigger $trigger `
  -Settings $settings -Principal $principal -Force `
  -Description "Auto-start + auto-restart AgentAIOS FastAPI backend on :8000"

Write-Host ""
Write-Host "OK Registered task 'AgentAIOS Backend' (runs at logon, restarts on failure)."
Write-Host "Now disable the Startup launcher to avoid a double start:"
Write-Host "  del `"$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\agentaios-backend.vbs`""
Write-Host "To remove later (elevated):  Unregister-ScheduledTask -TaskName 'AgentAIOS Backend' -Confirm:`$false"
