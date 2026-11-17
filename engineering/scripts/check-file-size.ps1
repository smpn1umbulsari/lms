# Skrip Validasi Batas Ukuran File (Coding Standards LMS SITURI)
# Menegakkan batas ukuran baris sesuai engineering/coding-standards.md

$ErrorActionPreference = "Stop"

$limits = @{
    '.js'   = 400
    '.css'  = 300
    '.html' = 300
}

$exceptionsFile = Join-Path $PSScriptRoot "..\size-exceptions.txt"
$exceptions = @()
if (Test-Path $exceptionsFile) {
    $exceptions = Get-Content $exceptionsFile |
        Where-Object { $_ -and -not $_.Trim().StartsWith("#") } |
        ForEach-Object { ($_ -split '#')[0].Trim().Replace('/', '\') } |
        Where-Object { $_ }
}

$scanDir = Join-Path $PSScriptRoot "..\..\docs"
$files = Get-ChildItem -Path $scanDir -Recurse -File | Where-Object {
    $limits.ContainsKey($_.Extension.ToLower())
}

$violations = @()
$passedCount = 0

foreach ($file in $files) {
    $relPath = $file.FullName.Replace((Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path + '\', '')
    
    # Check if file is in size-exceptions.txt
    $isExcepted = $false
    foreach ($exc in $exceptions) {
        if ($relPath -like "*$exc*") {
            $isExcepted = $true
            break
        }
    }

    $lines = (Get-Content $file.FullName | Measure-Object -Line).Lines
    $limit = $limits[$file.Extension.ToLower()]

    if ($lines -gt $limit) {
        # Check inline exception header
        $firstLine = Get-Content $file.FullName -First 1
        if ($firstLine -match "size-exception:") {
            $isExcepted = $true
        }

        if (-not $isExcepted) {
            $violations += [pscustomobject]@{
                Path   = $relPath
                Lines  = $lines
                Limit  = $limit
                Excess = $lines - $limit
            }
        }
    } else {
        $passedCount++
    }
}

Write-Host "=== LMS File Size Audit ===" -ForegroundColor Cyan
Write-Host "Files checked: $($files.Count)"
Write-Host "Passing: $passedCount"

if ($violations.Count -gt 0) {
    Write-Host "`nVIOLATIONS FOUND ($($violations.Count) files exceed limits):" -ForegroundColor Red
    $violations | Format-Table -AutoSize | Out-String | Write-Host -ForegroundColor Red
    exit 1
} else {
    Write-Host "All files comply with size limits!" -ForegroundColor Green
    exit 0
}
