"""
Local web server for the X-Ray Comparison tool.

- Serves the ./web folder (next to this file) on 127.0.0.1 only
- Sends "no-store" headers so sales always see the latest data after an update
- Stops an earlier copy of itself first, so the app keeps the same address (port 8080)
  and the hidden rows saved in the browser are kept
- Picks the next free port if 8080 is used by another program
- Opens the app in its own window (Edge/Chrome "app mode": no address bar or tabs);
  set XRAY_USE_BROWSER=1 to open a normal browser tab instead
- Stops by itself once every app page has been closed (pages send a heartbeat)
- Reports its progress to the splash launcher through the file named in XRAY_STATUS
"""
import http.server
import os
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import uuid
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, "web")
START_PORT = 8080
PORT_TRIES = 20
DATA_DIR = os.path.join(os.environ.get("LOCALAPPDATA") or tempfile.gettempdir(),
                        "WIPOTEC X-Ray Comparison")
PORT_FILE = os.path.join(DATA_DIR, "server.port")   # port of the running copy (for stop_old_copies)
QUIT_HEADER = "X-XRay-Quit"          # custom header: a web page cannot send it without CORS approval

CLIENT_STALE_SECONDS = 150   # no heartbeat for this long = page is gone (browser crashed, PC off...)
EMPTY_GRACE_SECONDS = 10     # wait after the last page closed (covers reloads)


def set_status(line):
    """Tell the splash launcher (Launcher.ps1) how far we are."""
    path = os.environ.get("XRAY_STATUS")
    if not path:
        return
    try:
        with open(path, "w", encoding="ascii", errors="replace") as f:
            f.write(line + "\n")
    except OSError:
        pass


def read_version():
    try:
        with open(os.path.join(WEB, "version.txt"), encoding="utf-8") as f:
            return f.read().strip()
    except OSError:
        return ""


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


# ------------------------------------------------------------
# Auto-exit: stop when every app page has been closed
# ------------------------------------------------------------
_AUTO = {"armed": False, "clients": {}, "empty_since": None}
_AUTO_LOCK = threading.Lock()


def _quit_soon(delay=0.3):
    def _go():
        time.sleep(delay)
        _remove_port_file()
        os._exit(0)
    threading.Thread(target=_go, daemon=True).start()


def _auto_exit_watchdog():
    last_loop = time.monotonic()
    while True:
        time.sleep(5)
        now = time.monotonic()
        with _AUTO_LOCK:
            if now - last_loop > 30:
                # The PC was asleep: give open pages a fresh start instead of shutting down.
                for k in _AUTO["clients"]:
                    _AUTO["clients"][k] = now
                _AUTO["empty_since"] = None
            last_loop = now
            if not _AUTO["armed"]:
                continue
            for k, seen in list(_AUTO["clients"].items()):
                if now - seen > CLIENT_STALE_SECONDS:
                    del _AUTO["clients"][k]
            if _AUTO["clients"]:
                _AUTO["empty_since"] = None
                continue
            if _AUTO["empty_since"] is None:
                _AUTO["empty_since"] = now
                continue
            if now - _AUTO["empty_since"] < EMPTY_GRACE_SECONDS:
                continue
        print("All app windows are closed - stopping the server.")
        _remove_port_file()
        os._exit(0)


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def _read_body(self, limit):
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length < 0 or length > limit:
            return None
        return self.rfile.read(length) if length else b""

    def _ok(self):
        self.send_response(204)
        self.end_headers()

    def do_POST(self):
        path = self.path.split("?", 1)[0]
        if path == "/heartbeat":
            body = self._read_body(256)
            cid = (body or b"").decode("utf-8", "ignore")[:64] or "anon"
            with _AUTO_LOCK:
                _AUTO["clients"][cid] = time.monotonic()
                _AUTO["armed"] = True
                _AUTO["empty_since"] = None
            self._ok()
            return
        if path == "/bye":
            body = self._read_body(256)
            cid = (body or b"").decode("utf-8", "ignore")[:64]
            with _AUTO_LOCK:
                _AUTO["clients"].pop(cid, None)
            self._ok()
            return
        if path == "/api/quit":
            if self.headers.get(QUIT_HEADER) != "1":
                self.send_error(403)
                return
            self._ok()
            _quit_soon()
            return
        if path == "/api/pdf":
            self._make_pdf()
            return
        self.send_error(404)

    def _make_pdf(self):
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


def stop_old_copies():
    """Ask an earlier copy of this server (left running) to stop, so we can reuse its port.
    Only the port written in PORT_FILE is tried: on Windows each closed port takes ~2 s."""
    try:
        with open(PORT_FILE, encoding="ascii") as f:
            port = int(f.read().strip())
    except (OSError, ValueError):
        return
    req = urllib.request.Request("http://127.0.0.1:%d/api/quit" % port, data=b"",
                                 method="POST", headers={QUIT_HEADER: "1"})
    try:
        with urllib.request.urlopen(req, timeout=3) as r:
            if r.status == 204:
                print("Stopped an earlier copy of the server on port %d" % port)
                time.sleep(1.0)
    except Exception:
        pass
    _remove_port_file()


def _write_port_file(port):
    try:
        os.makedirs(os.path.dirname(PORT_FILE), exist_ok=True)
        with open(PORT_FILE, "w", encoding="ascii") as f:
            f.write(str(port))
    except OSError:
        pass


def _remove_port_file():
    try:
        os.remove(PORT_FILE)
    except OSError:
        pass


# ------------------------------------------------------------
# Self-install: keeps the program folder of sales PCs up to date.
# Sales PCs run Run_Comparison.bat from their program folder, which downloads this
# repository into <program folder>\repo and runs repo\serve.py. Because serve.py always
# comes fresh from GitHub, it copies the newest launcher files next to the .bat and
# refreshes the Desktop icon - so nobody has to send new files by hand.
# ------------------------------------------------------------
LAUNCHER_FILES = ("Launch.vbs", "Launcher.ps1", "wipotec.ico")
BAT_NAME = "Run_Comparison.bat"
SHORTCUT_NAME = "X-Ray Comparison.lnk"


def _program_dir():
    """(folder the user starts the program from, True if it is a sales PC)."""
    parent = os.path.dirname(ROOT)
    if os.path.basename(ROOT).lower() == "repo" and os.path.isfile(os.path.join(parent, BAT_NAME)):
        return parent, True
    return ROOT, False


def _same_file(a, b):
    try:
        with open(a, "rb") as fa, open(b, "rb") as fb:
            return fa.read() == fb.read()
    except OSError:
        return False


def _hidden_flags():
    return getattr(subprocess, "CREATE_NO_WINDOW", 0)


def _swap_bat_when_done(new_path, bat_path):
    """Run_Comparison.bat is running right now (it started us), and cmd keeps reading a
    .bat file while it runs - overwriting it now would make the old copy run random lines.
    So a small hidden helper waits until that cmd has ended, then puts the new file in place."""
    env = dict(os.environ, XRAY_SWAP_NEW=new_path, XRAY_SWAP_DST=bat_path,
               XRAY_SWAP_PID=str(os.getppid()))
    script = ("try { Wait-Process -Id ([int]$env:XRAY_SWAP_PID) -ErrorAction Stop } catch { }; "
              "Start-Sleep -Seconds 1; "
              "try { Move-Item -LiteralPath $env:XRAY_SWAP_NEW -Destination $env:XRAY_SWAP_DST -Force } catch { }")
    # CREATE_NO_WINDOW: its own hidden console, so closing the .bat window does not end it
    # (DETACHED_PROCESS would not work: powershell.exe quits at once without a console).
    flags = _hidden_flags() | getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
    subprocess.Popen(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass",
                      "-WindowStyle", "Hidden", "-Command", script],
                     env=env, creationflags=flags, close_fds=True,
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def _make_shortcut(prog_dir):
    vbs = os.path.join(prog_dir, "Launch.vbs")
    ico = os.path.join(prog_dir, "wipotec.ico")
    if not (os.path.isfile(vbs) and os.path.isfile(ico)):
        return
    env = dict(os.environ, XRAY_LNK_VBS=vbs, XRAY_LNK_ICO=ico, XRAY_LNK_DIR=prog_dir,
               XRAY_LNK_NAME=SHORTCUT_NAME)
    script = ("$p = Join-Path ([Environment]::GetFolderPath('Desktop')) $env:XRAY_LNK_NAME; "
              "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($p); "
              "$s.TargetPath = (Join-Path $env:WINDIR 'System32\\wscript.exe'); "
              "$s.Arguments = [char]34 + $env:XRAY_LNK_VBS + [char]34; "
              "$s.WorkingDirectory = $env:XRAY_LNK_DIR; $s.IconLocation = $env:XRAY_LNK_ICO; "
              "$s.WindowStyle = 1; $s.Description = 'WIPOTEC X-Ray Comparison'; $s.Save()")
    subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
                   env=env, creationflags=_hidden_flags(), timeout=30,
                   stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def self_install():
    if os.name != "nt" or os.environ.get("XRAY_NO_INSTALL") == "1":
        return
    prog_dir, sales = _program_dir()
    try:
        if sales:
            for name in LAUNCHER_FILES:
                src, dst = os.path.join(ROOT, name), os.path.join(prog_dir, name)
                if os.path.isfile(src) and not _same_file(src, dst):
                    shutil.copyfile(src, dst)
                    print("Updated " + name)
            src, dst = os.path.join(ROOT, BAT_NAME), os.path.join(prog_dir, BAT_NAME)
            if os.path.isfile(src) and not _same_file(src, dst):
                new = dst + ".new"
                shutil.copyfile(src, new)
                _swap_bat_when_done(new, dst)
                print(BAT_NAME + " will be updated after this run.")
        _make_shortcut(prog_dir)
    except Exception as e:  # never let this stop the app
        print("Self-install skipped: %s" % e)


def open_app_window(url):
    """Open the app in its own window (Edge/Chrome app mode), else in the normal browser."""
    if os.environ.get("XRAY_NO_WINDOW") == "1":   # automated tests
        return
    browser =None if os.environ.get("XRAY_USE_BROWSER") == "1" else find_browser()
    if browser:
        profile = os.path.join(DATA_DIR, "AppWindow")
        try:
            subprocess.Popen([browser, "--app=" + url, "--user-data-dir=" + profile,
                              "--no-first-run", "--no-default-browser-check",
                              "--disable-extensions", "--disable-sync",
                              "--window-size=1300,900"],
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return
        except OSError:
            pass
    webbrowser.open(url)


# ------------------------------------------------------------
# Hand-over: X-Ray Comparison now lives in WIPOTEC AIO Software (Tools section).
# When that program is installed on this PC, open it (at its menu, where X-Ray
# Comparison is under Tools) instead, remove this program's Desktop icon and stop. Otherwise carry on as before
# (the page shows a notice asking for the WIPOTEC AIO Software installer).
# Set XRAY_NO_HANDOVER=1 to keep using this program (e.g. for testing).
# ------------------------------------------------------------
AIO_SHORTCUTS = ("WIPOTEC AIO Software.lnk", "WIPOTEC Certificates.lnk")


def _ps(script, env_extra=None, timeout=30):
    env = dict(os.environ, **(env_extra or {}))
    r = subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script],
                       env=env, creationflags=_hidden_flags(), timeout=timeout,
                       stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    return r.stdout.decode("utf-8", "replace")


def find_aio():
    """Folder of WIPOTEC AIO Software on this PC (from its Desktop icon or the usual
    install folder), or None."""
    script = (
        "[Console]::OutputEncoding = [Text.Encoding]::UTF8; "
        "$desk = [Environment]::GetFolderPath('Desktop'); $sh = New-Object -ComObject WScript.Shell; "
        "foreach ($n in $env:XRAY_AIO_LNK.Split('|')) { $p = Join-Path $desk $n; "
        "  if (Test-Path -LiteralPath $p) { try { $sh.CreateShortcut($p).WorkingDirectory } catch { } } }; "
        "Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'XRPV Generator'; "
        "Join-Path $env:USERPROFILE 'XRPV Generator'")
    try:
        out = _ps(script, {"XRAY_AIO_LNK": "|".join(AIO_SHORTCUTS)})
    except Exception:
        return None
    for line in out.splitlines():
        d = line.strip().rstrip("\\")
        if d and all(os.path.isfile(os.path.join(d, f)) for f in ("Launch.vbs", "Run_PV.bat", "main.py")):
            return d
    return None


def _remove_own_shortcut(prog_dir):
    script = ("$p = Join-Path ([Environment]::GetFolderPath('Desktop')) $env:XRAY_LNK_NAME; "
              "if (Test-Path -LiteralPath $p) { $s = (New-Object -ComObject WScript.Shell).CreateShortcut($p); "
              "  if ($s.WorkingDirectory.TrimEnd('\\') -eq $env:XRAY_LNK_DIR.TrimEnd('\\')) { Remove-Item -LiteralPath $p -Force } }")
    try:
        _ps(script, {"XRAY_LNK_NAME": SHORTCUT_NAME, "XRAY_LNK_DIR": prog_dir})
    except Exception as e:
        print("Could not remove the Desktop icon: %s" % e)


def hand_over_to_aio():
    """True when WIPOTEC AIO Software was started instead of this program."""
    if os.name != "nt" or os.environ.get("XRAY_NO_HANDOVER") == "1":
        return False
    aio = find_aio()
    if not aio:
        print("WIPOTEC AIO Software is not installed on this PC - starting X-Ray Comparison as before.")
        return False
    print("Opening WIPOTEC AIO Software instead (X-Ray Comparison is under Tools): " + aio)
    try:
        subprocess.Popen([os.path.join(os.environ.get("WINDIR", r"C:\Windows"), "System32", "wscript.exe"),
                          os.path.join(aio, "Launch.vbs")],
                         cwd=aio, close_fds=True, creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
                         stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError as e:
        print("Could not start WIPOTEC AIO Software (%s) - starting X-Ray Comparison as before." % e)
        return False
    prog_dir, _ = _program_dir()
    _remove_own_shortcut(prog_dir)
    return True


def main():
    try:
        sys.stdout.reconfigure(line_buffering=True)   # messages reach launcher.log right away
    except Exception:
        pass
    if not os.path.isdir(WEB):
        set_status("error:The web folder was not found - the download may have failed.")
        sys.exit("[Error] web folder not found: " + WEB)
    if hand_over_to_aio():
        set_status("ready")   # closes this program's splash; WIPOTEC AIO Software shows its own
        return
    set_status("step:server")
    stop_old_copies()
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
        set_status("error:No free port between %d and %d." % (START_PORT, START_PORT + PORT_TRIES - 1))
        sys.exit("[Error] No free port between %d and %d" % (START_PORT, START_PORT + PORT_TRIES - 1))

    _write_port_file(port)
    version = read_version()
    url = "http://localhost:%d/" % port + ("?v=" + version if version else "")
    print("Serving: " + WEB)
    print("Address: " + url)
    print("The server stops by itself when the app window is closed.")

    threading.Thread(target=_auto_exit_watchdog, daemon=True).start()
    threading.Thread(target=self_install, daemon=True).start()

    def _open():
        set_status("step:open")
        open_app_window(url)
        time.sleep(1.0)
        set_status("ready")
    threading.Timer(0.5, _open).start()

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        _remove_port_file()


if __name__ == "__main__":
    main()
