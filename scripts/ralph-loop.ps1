# Ralph Loop — Autonomous Iterative Coding & Self-Healing Pipeline
# Inspired by Claude Code / Ralph Loop architecture
param(
    [string]$TargetBranch = "main",
    [int]$MaxIterations = 5
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   SAGE BOT 2.0 — RALPH LOOP RUNNER       " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

$iteration = 1
$success = $false

while ($iteration -le $MaxIterations -and -not $success) {
    Write-Host "`n[Cycle $iteration/$MaxIterations] Starting verification pass..." -ForegroundColor Yellow

    # Step 1: Typecheck and Build
    Write-Host "1. Running production build check..." -NoNewline
    $buildOutput = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " [PASS]" -ForegroundColor Green
    } else {
        Write-Host " [FAIL]" -ForegroundColor Red
        Write-Host $buildOutput
        Write-Host "Halting: Build failed. Please correct syntax/types before continuing." -ForegroundColor Red
        exit 1
    }

    # Step 2: Git Status Check
    $status = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($status)) {
        Write-Host "2. Working tree clean. Ready for push." -ForegroundColor Green
        $success = $true
    } else {
        Write-Host "2. Detected pending code updates. Staging and committing..." -ForegroundColor Yellow
        git add .
        git commit -m "chore(ralph): autonomous iteration $iteration pass"
        $success = $true
    }

    $iteration++
}

if ($success) {
    Write-Host "`n[Ralph Loop] Verification successful. Pushing to origin/$TargetBranch..." -ForegroundColor Green
    git push origin $TargetBranch
    Write-Host "[Ralph Loop] Sync complete. CodeRabbit review will trigger automatically on PRs." -ForegroundColor Cyan
} else {
    Write-Host "`n[Ralph Loop] Max iterations reached without stable convergence." -ForegroundColor Red
}
