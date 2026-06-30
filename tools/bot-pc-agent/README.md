# Bot PC stats agent

Lets the AgentAIOS **Devices** page show the **real CPU / RAM / GPU** of a remote machine
(the Bot PC `192.168.1.3`, or any other host). AgentAIOS can only TCP-probe a remote host
(online/offline) — to see *inside* it (resource usage) something must run **on** that host and
report out. That's this agent.

## Cài trên Bot PC (192.168.1.3)
1. Copy **`stats_agent.py`** sang máy Bot PC (vd `C:\agentaios\stats_agent.py`).
2. Chạy: `python stats_agent.py`
   - Tự cài `psutil` lần đầu; GPU lấy qua `nvidia-smi` (có NVIDIA thì hiện, không thì để trống).
   - Phục vụ `GET http://0.0.0.0:9998/stats` → `{"cpu":..,"ram":..,"gpu":{"util":..,"vram_pct":..}}`.
3. **Mở firewall** cho TCP **9998** (LAN) để máy chạy AgentAIOS gọi sang. PowerShell (admin) trên Bot PC:
   ```
   New-NetFirewallRule -DisplayName "AgentAIOS stats 9998" -Direction Inbound -Protocol TCP -LocalPort 9998 -Action Allow
   ```
4. (Tuỳ chọn) **tự chạy khi logon**: bỏ 1 file `.vbs` vào Startup của Bot PC:
   ```vbs
   CreateObject("WScript.Shell").Run "python C:\agentaios\stats_agent.py", 0, False
   ```

## AgentAIOS phía này
Đã cấu hình `dev-sunobot.stats_url = http://192.168.1.3:9998/stats` (devices.py `_INFRA`).
Khi agent chạy + firewall mở → card **Bot PC** hiện CPU/RAM/GPU thật mỗi 3s. Agent chưa chạy →
card vẫn **online** nhưng metrics để trống (0/—). Đổi IP/port thì sửa `stats_url` cho khớp.
