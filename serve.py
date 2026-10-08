"""
Local web server for the X-Ray Comparison tool.

- Serves the ./web folder (next to this file) on 127.0.0.1 only
- Sends "no-store" headers so sales always see the latest data after an update
- Picks the next free port if 8080 is already in use
- Opens the default browser
"""
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, "web")
START_PORT = 8080
PORT_TRIES = 20


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
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
