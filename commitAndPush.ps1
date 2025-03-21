# VESPA Flashcards - Commit and Push Changes
# This script helps you commit and push the data protection improvements to GitHub

# Display header
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "VESPA Flashcards - Commit and Push Changes" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify we're in a git repository
Write-Host "Step 1: Verifying git repository..." -ForegroundColor Green
if (-not (Test-Path ".git")) {
    Write-Host "ERROR: This doesn't appear to be a git repository (.git folder not found)." -ForegroundColor Red
    Write-Host "Please run this script from the root of your VESPA Flashcards repository." -ForegroundColor Red
    exit 1
}

# Step 2: Check status
Write-Host "Step 2: Checking current changes..." -ForegroundColor Green
git status
Write-Host ""

# Step 3: Add files to staging
Write-Host "Step 3: Adding files to staging..." -ForegroundColor Green
git add src/utils/DataUtils.js
git add src/App.js
git add returnToCommit.ps1
git add commitAndPush.ps1
Write-Host "Files added to staging." -ForegroundColor Green
Write-Host ""

# Step 4: Commit the changes
$commitMessage = "Add data protection and recovery features

- Created DataUtils.js with validation and automatic backup systems
- Enhanced localStorage functions with versioning and data recovery
- Updated App.js to use the new data protection features
- Added utilities to help with repository management"

Write-Host "Step 4: Committing changes with message:" -ForegroundColor Green
Write-Host $commitMessage -ForegroundColor Yellow
Write-Host ""

$proceed = Read-Host "Proceed with this commit message? (Y/N)"
if ($proceed.ToLower() -ne "y") {
    Write-Host "Please enter your custom commit message (multiple lines, end with a blank line):" -ForegroundColor Yellow
    $commitMessage = ""
    $line = " "
    while ($line -ne "") {
        $line = Read-Host
        if ($line -ne "") {
            $commitMessage = $commitMessage + $line + "`n"
        }
    }
}

git commit -m $commitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to commit changes." -ForegroundColor Red
    exit 1
}
Write-Host "Changes committed successfully." -ForegroundColor Green
Write-Host ""

# Step 5: Push to GitHub
Write-Host "Step 5: Push to GitHub repository..." -ForegroundColor Green
$push = Read-Host "Push changes to GitHub now? (Y/N)"
if ($push.ToLower() -eq "y") {
    # Get current branch
    $currentBranch = git rev-parse --abbrev-ref HEAD
    
    git push origin $currentBranch
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to push to GitHub." -ForegroundColor Red
        Write-Host "You might need to manually push with: git push origin $currentBranch" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "Changes successfully pushed to GitHub." -ForegroundColor Green
} else {
    Write-Host "Changes were committed but not pushed." -ForegroundColor Yellow
    $currentBranch = git rev-parse --abbrev-ref HEAD
    Write-Host "To push later, use: git push origin $currentBranch" -ForegroundColor Yellow
}

# Success
Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "SUCCESSFUL COMMIT: Data protection features added!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""
