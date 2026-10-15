"""
Local web server for the X-Ray Comparison tool.

- Serves the ./web folder (next to this file) on 127.0.0.1 only
- Sends "no-store" headers so sales always see the latest data after an update
- Picks the next free port if 8080 is already in use
- Opens the default browser
"""
import http.server
import os
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import uuid
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, "web")
START_PORT = 8080
PORT_TRIES = 20


def find_browser():
    """Return path of Edge / Chrome (Windows) or chromium (other), else None."""
    cands = []
    for var in ("ProgramFiles(x86)", "ProgramFiles", "LocalAppData"):
        base = os.environ.get(var)
        if not base:
            continue
        cands.append(os.path.join(base, "Microsoft", "Edge", "Application", "msedge.exe"))
        cands.append(os.path.join(base, "Google", "Chrome", "Application", "chrome.exe"))
    for name in ("msedge", "google-chrome", "chromium", "chromium-browser", "chrome"):
        w = shutil.which(name)
        if w:
            cands.append(w)
    for c in cands:
        if os.path.isfile(c):
            return c
    return None


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/api/pdf":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 5 * 1024 * 1024:
                self.send_error(400)
                return
            body = self.rfile.read(length)
            browser = find_browser()
            if not browser:
                self.send_error(501, "No Edge/Chrome found")
                return
            tmp_dir = os.path.join(WEB, "_tmp")
            os.makedirs(tmp_dir, exist_ok=True)
            job = uuid.uuid4().hex
            html_path = os.path.join(tmp_dir, job + ".html")
            pdf_path = os.path.join(tmp_dir, job + ".pdf")
            profile = tempfile.mkdtemp(prefix="xray_pdf_")
            try:
                with open(html_path, "wb") as f:
                    f.write(body)
                port = self.server.server_address[1]
                cmd = [browser, "--headless=new", "--disable-gpu", "--no-sandbox",
                       "--no-first-run", "--disable-extensions",
                       "--no-pdf-header-footer", "--virtual-time-budget=10000",
                       "--user-data-dir=" + profile,
                       "--print-to-pdf=" + pdf_path,
                       "http://127.0.0.1:%d/_tmp/%s.html" % (port, job)]
                try:
                    subprocess.run(cmd, timeout=60, stdout=subprocess.DEVNULL,
                                   stderr=subprocess.DEVNULL)
                except Exception:
                    pass
                if not os.path.isfile(pdf_path) or os.path.getsize(pdf_path) < 500:
                    self.send_error(500, "PDF not created")
                    return
                with open(pdf_path, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/pdf")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            finally:
                shutil.rmtree(profile, ignore_errors=True)
                for pth in (html_path, pdf_path):
                    try:
                        os.remove(pth)
                    except OSError:
                        pass
        except Exception:
            try:
                self.send_error(500)
            except Exception:
                pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # keep the console quiet


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    # On Windows, SO_REUSEADDR lets two programs share one port - keep it off
    allow_reuse_address = False
    daemon_threads = True


def main():
    if not os.path.isdir(WEB):
        sys.exit("[Error] web folder not found: " + WEB)
    shutil.rmtree(os.path.join(WEB, "_tmp"), ignore_errors=True)
    os.chdir(WEB)

    httpd = None
    port = START_PORT
    for port in range(START_PORT, START_PORT + PORT_TRIES):
        try:
            httpd = Server(("127.0.0.1", port), NoCacheHandler)
            break
        except OSError:
            continue
    if httpd is None:
        sys.exit("[Error] No free port between %d and %d" % (START_PORT, START_PORT + PORT_TRIES - 1))

    url = "http://localhost:%d" % port
    print("Serving: " + WEB)
    print("Address: " + url)
    print("To STOP the server: close this window.")
    threading.Timer(1.0, lambda: webbrowser.open(url)).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()