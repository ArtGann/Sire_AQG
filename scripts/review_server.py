from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
NOTES_FILE = ROOT / "review-notes.json"
LEADS_FILE = ROOT / "local-leads.json"


class ReviewHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        if self.path.endswith((".html", ".css", ".js")) or self.path in ("/", "/index.html"):
            self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def do_GET(self):
        if urlparse(self.path).path == "/__review-notes":
            self._send_json(self._read_notes())
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/lead":
            self._handle_local_lead()
            return
        if path != "/__review-notes":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self.send_error(400, "Invalid JSON")
            return

        notes = self._read_notes()
        note = {
            "id": f"note-{len(notes) + 1}",
            "createdAt": self.date_time_string(),
            "page": payload.get("page", ""),
            "x": payload.get("x"),
            "y": payload.get("y"),
            "viewport": payload.get("viewport", {}),
            "selector": payload.get("selector", ""),
            "elementText": payload.get("elementText", ""),
            "comment": payload.get("comment", "").strip(),
        }
        if not note["comment"]:
            self.send_error(400, "Comment is required")
            return

        notes.append(note)
        NOTES_FILE.write_text(json.dumps(notes, ensure_ascii=False, indent=2), encoding="utf-8")
        self._send_json({"ok": True, "note": note})

    def _handle_local_lead(self):
        """Accept local preview submissions without calling production services."""
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception:
            self._send_json({"ok": False, "message": "Please send a valid estimate request."}, 400)
            return

        leads = self._read_local_leads()
        lead = {
            "id": f"local-lead-{len(leads) + 1}",
            "createdAt": self.date_time_string(),
            "full_name": payload.get("full_name", ""),
            "email": payload.get("email", ""),
            "service_needed": payload.get("service_needed", []),
            "calculator_requested": payload.get("calculator_requested", False),
        }
        leads.append(lead)
        LEADS_FILE.write_text(json.dumps(leads, ensure_ascii=False, indent=2), encoding="utf-8")
        self._send_json({
            "ok": True,
            "local_preview": True,
            "estimate_status": "local_preview",
            "customer_display_estimate": 0,
            "estimate_requires_manual_review": True,
        })

    def _read_notes(self):
        if not NOTES_FILE.exists():
            return []
        try:
            return json.loads(NOTES_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []

    def _read_local_leads(self):
        if not LEADS_FILE.exists():
            return []
        try:
            return json.loads(LEADS_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []

    def _send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    host = os.environ.get("AQG_REVIEW_HOST", "127.0.0.1")
    port = int(os.environ.get("AQG_REVIEW_PORT", "8032"))
    server = ThreadingHTTPServer((host, port), ReviewHandler)
    print(f"Review server running at http://{host}:{port}/")
    print(f"Notes will be saved to {NOTES_FILE}")
    server.serve_forever()
