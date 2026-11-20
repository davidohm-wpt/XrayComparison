' WIPOTEC X-Ray Comparison - opens the splash launcher without a console window.
' If PowerShell cannot be used, it falls back to Run_Comparison.bat (the classic console start).
Option Explicit
Dim sh, fso, dir, ps, rc
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
' A newer Run_Comparison.bat downloaded by serve.py waits as .bat.new until the old one is
' no longer running; nothing runs it now, so put it in place.
If fso.FileExists(dir & "\Run_Comparison.bat.new") Then
    On Error Resume Next
    fso.CopyFile dir & "\Run_Comparison.bat.new", dir & "\Run_Comparison.bat", True
    If Err.Number = 0 Then fso.DeleteFile dir & "\Run_Comparison.bat.new", True
    Err.Clear
    On Error GoTo 0
End If
ps = sh.ExpandEnvironmentStrings("%WINDIR%") & "\System32\WindowsPowerShell\v1.0\powershell.exe"
If fso.FileExists(ps) And fso.FileExists(dir & "\Launcher.ps1") Then
    On Error Resume Next
    rc = sh.Run("""" & ps & """ -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\Launcher.ps1""", 0, False)
    If Err.Number <> 0 Then
        Err.Clear
        sh.Run """" & dir & "\Run_Comparison.bat""", 1, False
    End If
Else
    sh.Run """" & dir & "\Run_Comparison.bat""", 1, False
End If
