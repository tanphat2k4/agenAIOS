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
    def do_GET(self):
        if self.path.startswith("/stats"):
            body = json.dumps(_stats).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, *a):  # quiet
        pass


if __name__ == "__main__":
    threading.Thread(target=_loop, daemon=True).start()
    time.sleep(2.5)  # let the first sample populate before serving
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), Handler) as srv:
        print(f"AgentAIOS stats agent listening on 0.0.0.0:{PORT} (GET /stats)")
        srv.serve_forever()
