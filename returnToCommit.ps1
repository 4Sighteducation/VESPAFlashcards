# VESPA Flashcards - Return to Specific Git Commit
# This script helps you safely return to a specific git commit
# and updates your local directory to match that state

# Configuration
$targetCommit = "0b025cbbca74772e2661a48006332354655b4f5b"
$backupFolder = "backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

# Display header
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "VESPA Flashcards - Return to Specific Commit" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Target commit: $targetCommit" -ForegroundColor Yellow
Write-Host ""

# Step 1: Verify we're in a git repository
Write-Host "Step 1: Verifying git repository..." -ForegroundColor Green
if (-not (Test-Path ".git")) {
    Write-Host "ERROR: This doesn't appear to be a git repository (.git folder not found)." -ForegroundColor Red
    Write-Host "Please run this script from the root of your VESPA Flashcards repository." -ForegroundColor Red
    exit 1
}

# Step 2: Check for uncommitted changes
Write-Host "Step 2: Checking for uncommitted changes..." -ForegroundColor Green
$status = git status --porcelain
if ($status) {
    Write-Host "You have uncommitted changes in your repository:" -ForegroundColor Yellow
    git status --short
    
    Write-Host ""
    Write-Host "Would you like to create a backup of these changes before proceeding? (Y/N)" -ForegroundColor Yellow
    $backup = Read-Host
    
    if ($backup.ToLower() -eq "y") {
        # Create a backup folder and copy all files
        Write-Host "Creating backup in folder: $backupFolder" -ForegroundColor Green
        New-Item -ItemType Directory -Path $backupFolder | Out-Null
        Copy-Item -Path * -Destination $backupFolder -Recurse -Force
        Write-Host "Backup created successfully." -ForegroundColor Green
        
        # Proceed with reset
        Write-Host "Resetting local changes..." -ForegroundColor Yellow
        git reset --hard
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Failed to reset changes." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "WARNING: Continuing without backup. All uncommitted changes will be lost!" -ForegroundColor Red
        $confirm = Read-Host "Are you sure you want to proceed? (Type 'yes' to confirm)"
        if ($confirm -ne "yes") {
            Write-Host "Operation cancelled." -ForegroundColor Yellow
            exit 0
        }
        
        # Reset without backup
        git reset --hard
        if ($LASTEXITCODE -ne 0) {
            Write-Host "ERROR: Failed to reset changes." -ForegroundColor Red
            exit 1
        }
    }
}

# Step 3: Fetch all remote changes
Write-Host "Step 3: Fetching all updates from remote..." -ForegroundColor Green
git fetch --all
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to fetch from remote. Check your network connection." -ForegroundColor Red
    Write-Host "Continuing with local repository state only..." -ForegroundColor Yellow
}

# Step 4: Check if commit exists
Write-Host "Step 4: Checking if target commit exists..." -ForegroundColor Green
$commitExists = git rev-parse --verify "$targetCommit^{commit}" 2>$null
if (-not $commitExists) {
    Write-Host "ERROR: The specified commit does not exist in this repository." -ForegroundColor Red
    exit 1
}

# Step 5: Get the current branch name
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Current branch: $currentBranch" -ForegroundColor Yellow

# Step 6: Create a recovery branch at current position
Write-Host "Step 5: Creating recovery branch from current position..." -ForegroundColor Green
$recoveryBranch = "recovery-branch-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
git branch $recoveryBranch
Write-Host "Recovery branch '$recoveryBranch' created. You can return to this point with:" -ForegroundColor Yellow
Write-Host "  git checkout $recoveryBranch" -ForegroundColor Yellow
Write-Host ""

# Step 7: Checkout the target commit
Write-Host "Step 6: Checking out target commit..." -ForegroundColor Green
git checkout $targetCommit
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to checkout target commit." -ForegroundColor Red
    Write-Host "You can return to your original state with: git checkout $currentBranch" -ForegroundColor Yellow
    exit 1
}

# Success
Write-Host ""
Write-Host "===========================================" -ForegroundColor Green
Write-Host "SUCCESS: Repository restored to target commit!" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""
Write-Host "You are now in 'detached HEAD' state at commit: $targetCommit" -ForegroundColor Yellow
Write-Host ""
Write-Host "Options for what to do next:" -ForegroundColor Cyan
Write-Host "1. Stay in this state to examine the code (current status)" -ForegroundColor White
Write-Host "2. Create a new branch from this point:" -ForegroundColor White
Write-Host "   git checkout -b new-branch-name" -ForegroundColor White
Write-Host "3. Return to your previous state:" -ForegroundColor White
Write-Host "   git checkout $currentBranch" -ForegroundColor White
Write-Host "4. Return to recovery branch:" -ForegroundColor White
Write-Host "   git checkout $recoveryBranch" -ForegroundColor White
Write-Host ""
Write-Host "NOTE: If you make any changes while in 'detached HEAD' state," -ForegroundColor Yellow
Write-Host "      create a new branch before committing them." -ForegroundColor Yellow
Write-Host ""
