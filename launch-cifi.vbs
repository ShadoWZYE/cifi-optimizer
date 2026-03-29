Option Explicit

Dim shell, fso, scriptDir, nodePath, appUrl, healthUrl, reopenUrl
Dim startedServer

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodePath = ResolveNodePath()
appUrl = "http://localhost:4173/"
healthUrl = "http://localhost:4173/api/healthz"
reopenUrl = "http://localhost:4173/api/launcher/reopen"
startedServer = False

If nodePath = "" Then
  MsgBox "Node.js could not be found." & vbCrLf & vbCrLf & _
    "CIFI needs Node.js 18+ installed." & vbCrLf & _
    "Install Node.js from https://nodejs.org/ and make sure the installer adds Node to PATH, then try again." & vbCrLf & vbCrLf & _
    "You can also use launch-cifi.bat to debug launcher startup.", vbExclamation, "CIFI Launcher"
  WScript.Quit 1
End If

If Not IsServerRunning(healthUrl) Then
  shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""Set-Location -LiteralPath '" & Replace(scriptDir, "'", "''") & "'; $env:CIFI_LAUNCH_MODE='1'; & '" & Replace(nodePath, "'", "''") & "' '.\scripts\dev-server.mjs'""", 0, False
  startedServer = True
End If

If startedServer Then
  If Not WaitForServer(healthUrl, 30, 500) Then
    MsgBox "CIFI local server did not start within the expected time." & vbCrLf & vbCrLf & _
      "Resolved Node.js path:" & vbCrLf & nodePath & vbCrLf & vbCrLf & _
      "Try launch-cifi.bat to see debug output.", vbExclamation, "CIFI Launcher"
    WScript.Quit 1
  End If
End If

If Not startedServer Then
  If NotifyExistingClient(reopenUrl) Then
    WScript.Quit 0
  End If
End If

shell.Run appUrl, 1, False

Function ResolveNodePath()
  Dim candidates, candidate, resolved

  resolved = ResolveFromWhere("node.exe")
  If resolved <> "" Then
    ResolveNodePath = resolved
    Exit Function
  End If

  candidates = Array( _
    shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe", _
    shell.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\nodejs\node.exe", _
    shell.ExpandEnvironmentStrings("%LocalAppData%") & "\Programs\nodejs\node.exe" _
  )

  For Each candidate In candidates
    If fso.FileExists(candidate) Then
      ResolveNodePath = candidate
      Exit Function
    End If
  Next

  ResolveNodePath = ""
End Function

Function ResolveFromWhere(executableName)
  On Error Resume Next
  Dim exec, line
  Set exec = shell.Exec("%ComSpec% /c where " & executableName)

  Do While exec.Status = 0
    WScript.Sleep 20
  Loop

  If exec.ExitCode = 0 Then
    line = Trim(exec.StdOut.ReadLine())
    If line <> "" And fso.FileExists(line) Then
      ResolveFromWhere = line
      Set exec = Nothing
      Err.Clear
      On Error GoTo 0
      Exit Function
    End If
  End If

  ResolveFromWhere = ""
  Set exec = Nothing
  Err.Clear
  On Error GoTo 0
End Function

Function IsServerRunning(url)
  On Error Resume Next
  Dim http
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.open "GET", url, False
  http.send
  IsServerRunning = (Err.Number = 0 And http.Status = 200)
  Set http = Nothing
  Err.Clear
  On Error GoTo 0
End Function

Function WaitForServer(url, attempts, delayMs)
  Dim index
  For index = 1 To attempts
    If IsServerRunning(url) Then
      WaitForServer = True
      Exit Function
    End If
    WScript.Sleep delayMs
  Next
  WaitForServer = False
End Function

Function NotifyExistingClient(url)
  On Error Resume Next
  Dim http
  Set http = CreateObject("MSXML2.XMLHTTP")
  http.open "POST", url, False
  http.setRequestHeader "Content-Type", "application/json"
  http.send "{}"
  NotifyExistingClient = (Err.Number = 0 And http.Status = 202)
  Set http = Nothing
  Err.Clear
  On Error GoTo 0
End Function
