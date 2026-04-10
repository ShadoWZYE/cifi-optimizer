Option Explicit

Dim shell, fso, scriptDir, batchPath, launchUrl, healthUrl
Dim startedServer

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
batchPath = fso.BuildPath(scriptDir, "launch-cifi.bat")
launchUrl = "http://localhost:4173/?launch=1"
healthUrl = "http://localhost:4173/api/healthz"
startedServer = False

If Not fso.FileExists(batchPath) Then
  MsgBox "launch-cifi.bat could not be found." & vbCrLf & vbCrLf & _
    "Expected path:" & vbCrLf & batchPath, vbExclamation, "CIFI Launcher"
  WScript.Quit 1
End If

If Not IsServerRunning(healthUrl) Then
  shell.Run "%ComSpec% /c """ & batchPath & """", 0, False
  startedServer = True
End If

If startedServer Then
  If Not WaitForServer(healthUrl, 30, 500) Then
    MsgBox "CIFI local server did not start within the expected time." & vbCrLf & vbCrLf & _
      "Launcher script:" & vbCrLf & batchPath & vbCrLf & vbCrLf & _
      "Try launch-cifi.bat to see debug output.", vbExclamation, "CIFI Launcher"
    WScript.Quit 1
  End If
End If

shell.Run launchUrl, 1, False

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
