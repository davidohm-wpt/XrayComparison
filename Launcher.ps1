# WIPOTEC X-Ray Comparison - splash launcher.
# Shows a small branded window while Run_Comparison.bat runs hidden in the background,
# and follows its progress through %TEMP%\xray_launch_status.txt ("step:...", "ready",
# "error:..."). Run_Comparison.bat and serve.py do all the real work, so the program
# still works on its own (double-click Run_Comparison.bat) if this window cannot be used.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$dir    = Split-Path -Parent $MyInvocation.MyCommand.Path
$bat    = Join-Path $dir 'Run_Comparison.bat'
$log    = Join-Path $dir 'launcher.log'
$status = Join-Path $env:TEMP 'xray_launch_status.txt'

# Web files live in .\repo\web on sales PCs and in .\web on the developer PC
function Find-WebFile([string]$name) {
    foreach ($p in @((Join-Path $dir "repo\web\$name"), (Join-Path $dir "web\$name"))) {
        if (Test-Path $p) { return $p }
    }
    return $null
}
$version = ''
try { $v = Find-WebFile 'version.txt'; if ($v) { $version = (Get-Content $v -TotalCount 1).Trim() } } catch { }

$teal     = [System.Drawing.Color]::FromArgb(0, 153, 153)
$tealDark = [System.Drawing.Color]::FromArgb(0, 110, 110)
$ink      = [System.Drawing.Color]::FromArgb(26, 26, 26)
$muted    = [System.Drawing.Color]::FromArgb(140, 140, 140)
$track    = [System.Drawing.Color]::FromArgb(230, 238, 238)
$okGreen  = [System.Drawing.Color]::FromArgb(30, 126, 52)
$errRed   = [System.Drawing.Color]::FromArgb(176, 42, 55)
$font     = New-Object System.Drawing.Font('Segoe UI', 10)
$fontBold = New-Object System.Drawing.Font('Segoe UI Semibold', 10)

# ---------- window ----------
$form = New-Object System.Windows.Forms.Form
$form.Text = 'X-Ray Comparison'
$form.FormBorderStyle = 'None'
$form.StartPosition = 'CenterScreen'
$form.ClientSize = New-Object System.Drawing.Size(480, 280)
$form.BackColor = [System.Drawing.Color]::White
$form.ShowInTaskbar = $true
# Started from a hidden process, Windows will not bring the window to the front on its own;
# keep it on top while loading (released again on error or when it closes).
$form.TopMost = $true
try { $form.Icon = New-Object System.Drawing.Icon (Join-Path $dir 'wipotec.ico') } catch { }
$form.Add_Paint({ param($s, $e)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 214, 214), 1)
    $e.Graphics.DrawRectangle($pen, 0, 0, $s.ClientSize.Width - 1, $s.ClientSize.Height - 1)
})
# drag the window by any empty area
$script:drag = $null
$form.Add_MouseDown({ param($s, $e) $script:drag = $e.Location })
$form.Add_MouseMove({ param($s, $e) if ($script:drag) { $form.Location = New-Object System.Drawing.Point(($form.Left + $e.X - $script:drag.X), ($form.Top + $e.Y - $script:drag.Y)) } })
$form.Add_MouseUp({ $script:drag = $null })

$bar = New-Object System.Windows.Forms.Panel
$bar.SetBounds(0, 0, 480, 5); $bar.BackColor = $teal
$form.Controls.Add($bar)

# logo (the same picture the web page uses) or a text fallback
$logo = New-Object System.Windows.Forms.PictureBox
$logo.SetBounds(28, 26, 170, 38); $logo.SizeMode = 'Zoom'
try {
    $lp = Find-WebFile 'wipotec-logo.png'
    if (-not $lp) { throw 'no logo' }
    $bytes = [System.IO.File]::ReadAllBytes($lp)
    $logo.Image = [System.Drawing.Image]::FromStream((New-Object System.IO.MemoryStream(, $bytes)))
} catch {
    $logo.Visible = $false
    $t = New-Object System.Windows.Forms.Label
    $t.Text = 'WIPOTEC'; $t.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 18); $t.ForeColor = $ink
    $t.SetBounds(26, 24, 200, 40); $form.Controls.Add($t)
}
$form.Controls.Add($logo)

$ver = New-Object System.Windows.Forms.Label
$ver.Text = $(if ($version) { "v$version" } else { '' }); $ver.Font = $font; $ver.ForeColor = $tealDark; $ver.TextAlign = 'MiddleRight'
$ver.SetBounds(330, 30, 122, 24)
$form.Controls.Add($ver)

$sub = New-Object System.Windows.Forms.Label
$sub.Text = 'X-Ray Comparison'; $sub.Font = New-Object System.Drawing.Font('Segoe UI', 11); $sub.ForeColor = $muted
$sub.SetBounds(28, 70, 300, 24)
$form.Controls.Add($sub)

# ---------- steps ----------
$steps = @(
    @{ key = 'update'; text = 'Checking for updates' },
    @{ key = 'python'; text = 'Checking Python' },
    @{ key = 'server'; text = 'Starting the server' },
    @{ key = 'open';   text = 'Opening the app' }
)
$rows = @()
for ($i = 0; $i -lt $steps.Count; $i++) {
    $icon = New-Object System.Windows.Forms.Label
    $icon.SetBounds(30, (108 + $i * 26), 22, 24); $icon.Font = $fontBold; $icon.ForeColor = $muted; $icon.Text = [string][char]0x25CB
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.SetBounds(54, (108 + $i * 26), 400, 24); $lbl.Font = $font; $lbl.ForeColor = $muted; $lbl.Text = $steps[$i].text
    $form.Controls.Add($icon); $form.Controls.Add($lbl)
    $rows += @{ icon = $icon; label = $lbl }
}

$trackPanel = New-Object System.Windows.Forms.Panel
$trackPanel.SetBounds(30, 222, 420, 6); $trackPanel.BackColor = $track
$fill = New-Object System.Windows.Forms.Panel
$fill.SetBounds(0, 0, 0, 6); $fill.BackColor = $teal
$trackPanel.Controls.Add($fill)
$form.Controls.Add($trackPanel)

$note = New-Object System.Windows.Forms.Label
$note.SetBounds(28, 234, 424, 36); $note.Font = New-Object System.Drawing.Font('Segoe UI', 9); $note.ForeColor = $muted
$form.Controls.Add($note)

$btnLog = New-Object System.Windows.Forms.Button
$btnLog.Text = 'Show details'; $btnLog.SetBounds(250, 240, 100, 28); $btnLog.Visible = $false
$btnLog.Add_Click({ if (Test-Path $log) { Start-Process notepad.exe -ArgumentList ('"' + $log + '"') } })
$btnClose = New-Object System.Windows.Forms.Button
$btnClose.Text = 'Close'; $btnClose.SetBounds(356, 240, 94, 28); $btnClose.Visible = $false
$btnClose.Add_Click({ $form.Close() })
$form.Controls.Add($btnLog); $form.Controls.Add($btnClose)

# ---------- state ----------
$spin = @([char]0x25D0, [char]0x25D3, [char]0x25D1, [char]0x25D2)
$script:spinIdx = 0
$script:active = 0
$script:done = $false
$script:updateSince = Get-Date
$script:proc = $null

function Set-Active([int]$n) {
    for ($i = 0; $i -lt $rows.Count; $i++) {
        if ($i -lt $n) {
            $rows[$i].icon.Text = [string][char]0x2713; $rows[$i].icon.ForeColor = $okGreen
            $rows[$i].label.ForeColor = $ink; $rows[$i].label.Font = $font
        } elseif ($i -eq $n) {
            $rows[$i].icon.ForeColor = $teal
            $rows[$i].label.ForeColor = $ink; $rows[$i].label.Font = $fontBold
        } else {
            $rows[$i].icon.Text = [string][char]0x25CB; $rows[$i].icon.ForeColor = $muted
            $rows[$i].label.ForeColor = $muted; $rows[$i].label.Font = $font
        }
    }
    $script:active = $n
    $fill.Width = [int](420 * [Math]::Min($n, $rows.Count) / $rows.Count)
}

function Show-Error([string]$msg) {
    $script:done = $true
    if ($script:active -lt $rows.Count) {
        $rows[$script:active].icon.Text = [string][char]0x2715; $rows[$script:active].icon.ForeColor = $errRed
        $rows[$script:active].label.ForeColor = $errRed
    }
    $fill.BackColor = $errRed
    $note.SetBounds(28, 234, 216, 40); $note.ForeColor = $errRed; $note.Text = $msg
    $btnLog.Visible = $true; $btnClose.Visible = $true
    $form.TopMost = $false
}

# ---------- start Run_Comparison.bat hidden ----------
try { Remove-Item $status -Force -ErrorAction SilentlyContinue } catch { }
$env:XRAY_SPLASH = '1'
$env:XRAY_STATUS = $status
Set-Active 0
try {
    $script:proc = Start-Process -FilePath $env:ComSpec -ArgumentList ('/c ""' + $bat + '" > "' + $log + '" 2>&1"') `
        -WorkingDirectory $dir -WindowStyle Hidden -PassThru
} catch {
    Show-Error 'Could not start Run_Comparison.bat. Open the program folder and double-click it instead.'
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 250
$timer.Add_Tick({
    if ($script:done) { return }
    $script:spinIdx = ($script:spinIdx + 1) % 4
    if ($script:active -lt $rows.Count) { $rows[$script:active].icon.Text = [string]$spin[$script:spinIdx] }

    $line = $null
    try { if (Test-Path $status) { $line = (Get-Content $status -TotalCount 1 -ErrorAction Stop).Trim() } } catch { }
    if ($line) {
        switch -Regex ($line) {
            '^step:clone$'  { $rows[0].label.Text = 'Downloading the program (first time, needs internet)' }
            '^step:python$' { if ($script:active -lt 1) { Set-Active 1 } }
            '^step:server$' { if ($script:active -lt 2) { Set-Active 2 } }
            '^step:open$'   { if ($script:active -lt 3) { Set-Active 3 } }
            '^ready$'       {
                Set-Active 4
                $script:done = $true
                $note.ForeColor = $okGreen; $note.Text = 'Ready - the app window is opening.'
                $closer = New-Object System.Windows.Forms.Timer
                $closer.Interval = 1500
                $closer.Add_Tick({ $this.Stop(); $form.Close() })
                $closer.Start()
                return
            }
            '^error:(.*)$'  { Show-Error $Matches[1]; return }
        }
    }
    if ($script:active -eq 0 -and ((Get-Date) - $script:updateSince).TotalSeconds -gt 10) {
        $note.Text = 'Still checking GitHub... a slow network can take a little longer.'
    } elseif ($script:active -gt 0) {
        $note.Text = ''
    }
    if ($script:proc -and $script:proc.HasExited -and -not $script:done) {
        Start-Sleep -Milliseconds 300
        $last = $null
        try { $last = (Get-Content $status -TotalCount 1 -ErrorAction Stop).Trim() } catch { }
        if ($last -like 'error:*') {
            Show-Error $last.Substring(6)
        } elseif ($last -ne 'ready') {
            Show-Error 'The launcher stopped before the app was ready. Click "Show details" to see what happened.'
        }
    }
})
$timer.Start()
$form.Add_Shown({ $form.Activate() })
[void]$form.ShowDialog()
$timer.Stop()
