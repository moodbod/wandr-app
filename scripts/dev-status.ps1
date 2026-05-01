$ErrorActionPreference = "SilentlyContinue"

Write-Host "--- .next-dev.lock ---"
if (Test-Path ".next-dev.lock") {
  Get-Content ".next-dev.lock"
} else {
  Write-Host "No lock file."
}

Write-Host ""
Write-Host "--- dev ports 3000-3002 ---"
$ports = netstat -ano | Select-String ":3000|:3001|:3002"
if ($ports) {
  $ports
} else {
  Write-Host "No listeners on 3000, 3001, or 3002."
}

Write-Host ""
Write-Host "--- bun/node processes ---"
$processes = Get-CimInstance Win32_Process |
  Where-Object { $_.Name -match "^(bun|node)(\.exe)?$" } |
  Select-Object ProcessId, ParentProcessId, Name, CommandLine

if ($processes) {
  $processes | Format-List
} else {
  Write-Host "No bun/node processes found."
}
