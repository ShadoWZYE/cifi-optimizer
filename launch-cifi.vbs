Option Explicit

Dim shell, fso, scriptDir, nodePath, scriptPath, appUrl, healthUrl
Dim startedServer

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
nodePath = shell.ExpandEnvironmentStrings("%ProgramFiles%") & "\nodejs\node.exe"
scriptPath = scriptDir & "\scripts\dev-server.mjs"
appUrl = "http://localhost:4173/?launch=1"
healthUrl = "http://localhost:4173/api/healthz"
startedServer = False

If Not fso.FileExists(nodePath) Then
  MsgBox "Node.js was not found at:" & vbCrLf & nodePath & vbCrLf & vbCrLf & "Install Node.js or use launch-cifi.bat for debugging.", vbExclamation, "CiFi Launcher"
  WScript.Quit 1
End If

If Not IsServerRunning(healthUrl) Then
  shell.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""Set-Location -LiteralPath '" & Replace(scriptDir, "'", "''") & "'; & '" & Replace(nodePath, "'", "''") & "' '.\scripts\dev-server.mjs'""", 0, False
  startedServer = True
End If

If startedServer Then
  If Not WaitForServer(healthUrl, 30, 500) Then
    MsgBox "CiFi local server did not start within the expected time." & vbCrLf & vbCrLf & "Try launch-cifi.bat to see debug output.", vbExclamation, "CiFi Launcher"
    WScript.Quit 1
  End If
End If

shell.Run appUrl, 1, False

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
