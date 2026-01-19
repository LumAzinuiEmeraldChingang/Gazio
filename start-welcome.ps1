# Start the Node server (server.js) and open the welcome page in the default browser.
# This script is intended for Windows PowerShell. It will stop any existing node processes,
# start a new node process running server.js in the repo root, then open http://localhost:3000/.

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $projectDir

Write-Output "Starting server from $projectDir"

# Stop existing node processes to avoid port conflicts (silently continue if none)
Get-Process node -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue }

# Start server.js in a new process
Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $projectDir

# Give server a moment to start, then open the welcome page
Start-Sleep -Seconds 1
Start-Process "http://localhost:3000/"

Write-Output "Server started and browser opened (http://localhost:3000/)"
