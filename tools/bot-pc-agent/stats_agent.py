"""AgentAIOS stats agent — run this ON a remote machine (e.g. the Bot PC 192.168.1.3) so the
AgentAIOS Devices page can show that machine's real CPU / RAM / GPU.

It serves GET /stats -> {"cpu": <0-100>, "ram": <0-100>, "gpu": {"util": <0-100>, "vram_pct": <0-100>}}.
Zero manual setup: auto-installs psutil on first run; GPU via nvidia-smi if present (else null).
Metrics are sampled in the background and served instantly (no per-request lag).

Run:   python stats_agent.py            (listens on 0.0.0.0:9998)
Then on the Bot PC allow inbound TCP 9998 (LAN) so AgentAIOS can reach it.
"""
import http.server
import json
import os
import platform
import socketserver
import subprocess
import sys
import threading
import time

try:
    import psutil
except ImportError:
    print("psutil not found — installing…")
    subprocess.run([sys.executable, "-m", "pip", "install", "psutil"])
    import psutil

PORT = 9998
_stats = {"cpu": None, "ram": None, "gpu": None}

# --- remote power control (reboot / shutdown) --------------------------------
# Guarded: only works when AGENTAIOS_POWER_TOKEN is set AND the caller sends the
# same token in the X-Power-Token header. Empty token = power endpoint disabled
# (fail-safe). Set AGENTAIOS_ALLOW_POWER=0 as a hard kill-switch. "start" is NOT
# handled here (an off machine can't start itself — the backend uses Wake-on-LAN).
_POWER_TOKEN = os.environ.get("AGENTAIOS_POWER_TOKEN", "")
_ALLOW_POWER = os.environ.get("AGENTAIOS_ALLOW_POWER", "1") != "0"


def _do_power(action: str) -> None:
    """Reboot/shutdown THIS machine after a short delay (so the HTTP reply is
    sent first). Windows uses shutdown.exe; POSIX uses shutdown too."""
    if platform.system() == "Windows":
        flag = "/r" if action == "reboot" else "/s"
        subprocess.Popen(["shutdown", flag, "/t", "5", "/c", f"AgentAIOS remote {action}"])
    else:
        flag = "-r" if action == "reboot" else "-h"
        subprocess.Popen(["shutdown", flag, "+1", f"AgentAIOS remote {action}"])


def _gpu():
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total",
             "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=4,
        ).stdout.strip().splitlines()
        if not out:
            return None
        u, used, tot = [x.strip() for x in out[0].split(",")]
        return {"util": int(u), "vram_pct": round(100 * int(used) / int(tot)) if int(tot) else 0}
    except Exception:
        return None  # no NVIDIA GPU / nvidia-smi → null


def _loop():
    while True:
        try:
            _stats["cpu"] = round(psutil.cpu_percent(interval=2))  # blocks 2s → real interval %
            _stats["ram"] = round(psutil.virtual_memory().percent)
            _stats["gpu"] = _gpu()
        except Exception:
            pass
        time.sleep(1)


class Handler(http.server.BaseHTTPRequestHandler):
    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith("/stats"):
            self._json(200, _stats)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        # POST /power {"action":"reboot"|"shutdown"} with header X-Power-Token
        if not self.path.startswith("/power"):
            self.send_response(404)
            self.end_headers()
            return
        if not _ALLOW_POWER:
            return self._json(403, {"error": "power control disabled (AGENTAIOS_ALLOW_POWER=0)"})
        if not _POWER_TOKEN or self.headers.get("X-Power-Token", "") != _POWER_TOKEN:
            return self._json(403, {"error": "bad or missing X-Power-Token"})
        try:
            n = int(self.headers.get("Content-Length", 0) or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            body = {}
        action = (body.get("action") or "").strip()
        if action not in ("reboot", "shutdown"):
            return self._json(400, {"error": "action must be reboot|shutdown"})
        try:
            _do_power(action)
        except Exception as e:  # noqa: BLE001
            return self._json(500, {"error": str(e)})
        return self._json(200, {"detail": f"{action} scheduled (t-5s)"})

    def log_message(self, *a):  # quiet
        pass


if __name__ == "__main__":
    threading.Thread(target=_loop, daemon=True).start()
    time.sleep(2.5)  # let the first sample populate before serving
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as srv:
        _pwr = "ON" if (_ALLOW_POWER and _POWER_TOKEN) else "OFF (set AGENTAIOS_POWER_TOKEN)"
        print(f"AgentAIOS agent on 0.0.0.0:{PORT} — GET /stats | POST /power [{_pwr}]")
        srv.serve_forever()
