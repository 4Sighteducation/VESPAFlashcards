# Get all tracked files at the current commit
$trackedFiles = git ls-tree -r --name-only HEAD

# Get all files in the repository
$allFiles = Get-ChildItem -Recurse -Force | Where-Object { -not $_.PSIsContainer } | ForEach-Object { $_.FullName.Substring((Get-Location).Path.Length + 1).Replace('\', '/') }

# Find files that are not tracked
$untrackedFiles = $allFiles | Where-Object { $trackedFiles -notcontains $_ }

# Display the files that will be removed
Write-Host "The following files will be removed:"
$untrackedFiles | ForEach-Object { Write-Host "  $_" }

# Confirm before proceeding
$confirmation = Read-Host "Do you want to proceed? (y/n)"
if ($confirmation -eq 'y') {
    # Remove each untracked file
    $untrackedFiles | ForEach-Object {
        Remove-Item -Path $_ -Force
        Write-Host "Removed: $_"
    }
    Write-Host "Clean-up complete. Repository is now at commit a5634b3f58304b7c74c589dac662512a057fae07 with no additional files."
} else {
    Write-Host "Operation cancelled."
}
