$ErrorActionPreference = 'Stop'
$studioRoot = $PSScriptRoot
$studioUrl = 'http://127.0.0.1:5173'
$studioVite = Join-Path $studioRoot 'node_modules\vite\bin\vite.js'
if (-not (Test-Path -LiteralPath $studioVite)) {
    throw 'Please run npm install in this folder before starting the studio.'
}
$studioReady = $false
try {
    $studioResponse = Invoke-WebRequest -Uri $studioUrl -TimeoutSec 2
    if ($studioResponse.Content -match 'REBEL 500') { $studioReady = $true }
    else { throw 'Port 5173 is already in use by another application.' }
} catch {
    if ($_.Exception.Message -like '*already in use*') { throw }
}
if (-not $studioReady) {
    $studioNode = (Get-Command node -ErrorAction Stop).Source
    Start-Process -FilePath $studioNode -ArgumentList @(('"' + $studioVite + '"'),'--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory $studioRoot -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $studioResponse = Invoke-WebRequest -Uri $studioUrl -TimeoutSec 1
            if ($studioResponse.Content -match 'REBEL 500') { $studioReady = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 300
    }
}
if (-not $studioReady) { throw 'Studio did not start. Run npm run dev to inspect startup errors.' }
Start-Process $studioUrl
