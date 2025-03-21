# Commit and push changes to GitHub (which will trigger Heroku deployment)
# This script helps commit all your changes with proper messages

# Display header
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  VESPA Flashcards Git Commit & Push Utility" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# First check current branch
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Current branch: $currentBranch" -ForegroundColor Yellow

# Show current status
Write-Host "`nCurrent git status:" -ForegroundColor Yellow
git status --short

# Get confirmation before proceeding
$confirm = Read-Host "`nDo you want to commit and push all changes? (Y/N)"
if ($confirm -ne "Y" -and $confirm -ne "y") {
    Write-Host "Operation cancelled" -ForegroundColor Red
    exit
}

# Stage all changes
Write-Host "`nStaging all changes..." -ForegroundColor Green
git add .

# Show what's being committed
Write-Host "`nChanges to be committed:" -ForegroundColor Yellow
git status --short

# Get commit message
$commitMsg = Read-Host "`nEnter commit message"
if ([string]::IsNullOrWhiteSpace($commitMsg)) {
    $commitMsg = "Updated flashcard app with bug fixes and improvements"
}

# Commit changes
Write-Host "`nCommitting changes with message: '$commitMsg'" -ForegroundColor Green
git commit -m $commitMsg

# Check if commit was successful
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit failed. Please check the error messages above." -ForegroundColor Red
    exit 1
}

# Push to GitHub
Write-Host "`nPushing to GitHub (this will trigger Heroku deployment)..." -ForegroundColor Yellow
git push origin $currentBranch

# Check if push was successful
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push failed. Please check the error messages above." -ForegroundColor Red
    Write-Host "You may need to pull changes from the remote repository first." -ForegroundColor Yellow
    
    $pullConfirm = Read-Host "Do you want to try pulling changes from remote first? (Y/N)"
    if ($pullConfirm -eq "Y" -or $pullConfirm -eq "y") {
        Write-Host "`nPulling latest changes..." -ForegroundColor Yellow
        git pull origin $currentBranch
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`nTrying to push again..." -ForegroundColor Yellow
            git push origin $currentBranch
        } else {
            Write-Host "Pull failed. You may need to resolve conflicts manually." -ForegroundColor Red
            exit 1
        }
    }
    
    exit 1
}

Write-Host "`n================================================" -ForegroundColor Green
Write-Host "  Changes successfully pushed to GitHub!" -ForegroundColor Green
Write-Host "  Heroku deployment should start automatically." -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
