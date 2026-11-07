Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('android/app/build/outputs/apk/debug/app-debug.apk')
Write-Host "Total entries: $($zip.Entries.Count)"

$indexEntries = $zip.Entries | Where-Object { $_.FullName -like "*index.html*" }
Write-Host "index.html entries found: $(@($indexEntries).Count)"
foreach ($e in $indexEntries) {
    Write-Host " - $($e.FullName)"
}

$configEntry = $zip.Entries | Where-Object { $_.FullName -eq "assets/capacitor.config.json" }
if ($configEntry) {
    $stream = $configEntry.Open()
    $reader = New-Object System.IO.StreamReader($stream)
    $content = $reader.ReadToEnd()
    $reader.Close()
    $stream.Close()
    Write-Host "`nassets/capacitor.config.json content:"
    Write-Host $content
}

# Check for localhost or file:// in all assets
$textAssets = $zip.Entries | Where-Object { $_.FullName -like "assets/*.json" -or $_.FullName -like "assets/*.js" -or $_.FullName -like "assets/*.html" }
Write-Host "`nChecking text assets for localhost or file:// ..."
$foundBadRefs = 0
foreach ($asset in $textAssets) {
    $s = $asset.Open()
    $r = New-Object System.IO.StreamReader($s)
    $text = $r.ReadToEnd()
    $r.Close()
    $s.Close()
    if ($text -match "http://localhost|file://") {
        Write-Host "Warning: found ref in $($asset.FullName)"
        $foundBadRefs++
    }
}
if ($foundBadRefs -eq 0) {
    Write-Host "No localhost or file:// references found in text assets."
}

$zip.Dispose()

