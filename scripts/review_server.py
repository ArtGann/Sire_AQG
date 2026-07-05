from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
NOTES_FILE = ROOT / "review-notes.json"


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
        if urlparse(self.path).path != "/__review-notes":
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

    def _read_notes(self):
        if not NOTES_FILE.exists():
            return []
        try:
            return json.loads(NOTES_FILE.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []

    def _send_json(self, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
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
