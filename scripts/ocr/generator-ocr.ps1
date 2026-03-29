param(
    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$images
)

# Resolve script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pythonScript = Join-Path $scriptDir "generator-ocr.py"

# Resolve Python (important!)
$pythonExe = "python"

# Optional: force full path if needed
# $pythonExe = "C:\Users\YourUser\AppData\Local\Programs\Python\Python311\python.exe"

try {
    # Call Python and capture output
    $output = & $pythonExe $pythonScript @images 2>&1

    # Ensure ONLY JSON is returned
    if (-not $output) {
        throw "Python returned no output."
    }

    # Print raw output (Node expects JSON)
    Write-Output $output
}
catch {
    Write-Output (@{
        error = $_.Exception.Message
    } | ConvertTo-Json -Depth 5)
}