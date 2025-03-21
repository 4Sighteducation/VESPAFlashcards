# PowerShell script to commit and push changes to GitHub with a descriptive message
# Usage: .\pushChanges.ps1 "Your commit message here"

param(
    [Parameter(Mandatory=$true)]
    [string]$commitMessage
)

# Show current status
Write-Host "Current Git Status:" -ForegroundColor Cyan
git status

# Add all changes
Write-Host "`nAdding all changes..." -ForegroundColor Yellow
git add .

# Commit with the provided message
Write-Host "`nCommitting changes with message: '$commitMessage'" -ForegroundColor Yellow
git commit -m "$commitMessage"

# Push to the remote repository
Write-Host "`nPushing changes to GitHub..." -ForegroundColor Yellow
git push

# Show the result
Write-Host "`nFinal Git Status:" -ForegroundColor Cyan
git status

Write-Host "`nChanges successfully committed and pushed to GitHub!" -ForegroundColor Green
