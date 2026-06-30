' Launch start_backend.bat with NO console window (window style 0, don't wait).
' Used by the Task Scheduler task "AgentAIOS Backend" at user logon.
CreateObject("WScript.Shell").Run "D:\agenAIOS\tools\autostart\start_backend.bat", 0, False
