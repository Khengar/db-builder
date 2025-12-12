param(
    [string]$Path = ".",
    [int]$Depth = 4,
    [string[]]$ExcludeFolders = @("node_modules", ".git"),
    [string[]]$ExcludeFiles = @("")
)

function Show-Tree {
    param(
        [string]$Path,
        [int]$Depth,
        [int]$Level = 0,
        [string[]]$ExcludeFolders,
        [string[]]$ExcludeFiles
    )

    if ($Level -ge $Depth) { return }

    Get-ChildItem $Path | ForEach-Object {

        # Skip excluded folders
        if ($_.PSIsContainer -and $ExcludeFolders -contains $_.Name) {
            return
        }

        # Skip excluded file names
        if (-not $_.PSIsContainer -and $ExcludeFiles -contains $_.Name) {
            return
        }

        $prefix = " " * ($Level * 4) + "|-- "
        Write-Output "$prefix$($_.Name)"

        # Recurse into folders
        if ($_.PSIsContainer) {
            Show-Tree -Path $_.FullName -Depth $Depth -Level ($Level + 1) `
                -ExcludeFolders $ExcludeFolders -ExcludeFiles $ExcludeFiles
        }
    }
}

# Run the tree generator but DO NOT show output on console.
$tree = Show-Tree -Path $Path -Depth $Depth `
    -ExcludeFolders $ExcludeFolders -ExcludeFiles $ExcludeFiles

# Save to file silently
$tree | Out-File -FilePath "dir-tree.txt" -Encoding utf8
