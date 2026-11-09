# Build script for Windows / PowerShell
# Generates: cpanel-public.zip, cpanel-private.zip, database_update_v2.0.0.sql, and SHA256SUMS in cpanel-release/
param(
    [string]$OutDir = "$PSScriptRoot/../../cpanel-release"
)

$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path "$PSScriptRoot/../..").Path
$OutDir = [System.IO.Path]::GetFullPath($OutDir)

Write-Host "==> Starting cPanel build for Windows..." -ForegroundColor Cyan
Write-Host "Root: $Root"
Write-Host "Output: $OutDir"

# Ensure output directory exists
if (Test-Path $OutDir) {
    Remove-Item -Recurse -Force $OutDir
}
New-Item -ItemType Directory -Path $OutDir | Out-Null

$StagingDir = Join-Path $env:TEMP "crm-cpanel-build-$(Get-Random)"
$StagingPublic = Join-Path $StagingDir "public"
$StagingPrivate = Join-Path $StagingDir "private"

New-Item -ItemType Directory -Path $StagingPublic | Out-Null
New-Item -ItemType Directory -Path $StagingPrivate | Out-Null

try {
    # -------------------------------------------------------------
    # Step 1: Ensure frontend is built
    # -------------------------------------------------------------
    Write-Host "==> 1/5 Verifying frontend build..." -ForegroundColor Cyan
    if (-not (Test-Path "$Root/frontend/dist/index.html")) {
        Write-Host "Compiling frontend..."
        Push-Location "$Root/frontend"
        npm run build
        Pop-Location
    }

    # -------------------------------------------------------------
    # Step 2: Prepare public staging
    # -------------------------------------------------------------
    Write-Host "==> 2/5 Staging public files..." -ForegroundColor Cyan
    Copy-Item -Recurse -Force "$Root/frontend/dist/*" $StagingPublic

    # Copy Filament compiled assets from backend/public
    if (Test-Path "$Root/backend/public/css") {
        Copy-Item -Recurse -Force "$Root/backend/public/css" $StagingPublic
    }
    if (Test-Path "$Root/backend/public/js") {
        Copy-Item -Recurse -Force "$Root/backend/public/js" $StagingPublic
    }
    if (Test-Path "$Root/backend/public/fonts") {
        Copy-Item -Recurse -Force "$Root/backend/public/fonts" $StagingPublic
    }

    # Public entry points & resolution scripts
    Copy-Item -Force "$Root/backend/public/index.php" $StagingPublic
    Copy-Item -Force "$Root/backend/public/resolve-private.php" $StagingPublic
    Copy-Item -Force "$Root/backend/public/robots.txt" $StagingPublic
    if (Test-Path "$Root/backend/public/favicon.ico") {
        Copy-Item -Force "$Root/backend/public/favicon.ico" $StagingPublic
    }

    # Use default relative/home path in private-path.php for public release
    $PrivatePathContent = "<?php`nreturn dirname(__DIR__) . '/laravel_project/crmpart';`n"
    Set-Content -Path "$StagingPublic/private-path.php" -Value $PrivatePathContent -Encoding UTF8

    # Copy htaccess
    Copy-Item -Force "$Root/deploy/cpanel/htaccess/public.htaccess" "$StagingPublic/.htaccess"

    # Copy cPanel utilities
    Copy-Item -Force "$Root/deploy/cpanel/update.php" $StagingPublic
    Copy-Item -Force "$Root/deploy/cpanel/install.php" $StagingPublic
    Copy-Item -Force "$Root/deploy/cpanel/setup-check.php" $StagingPublic

    # Ensure empty storage directory in public
    New-Item -ItemType Directory -Path "$StagingPublic/storage" -Force | Out-Null

    # -------------------------------------------------------------
    # Step 3: Prepare private staging
    # -------------------------------------------------------------
    Write-Host "==> 3/5 Staging private backend files..." -ForegroundColor Cyan

    $privateDirs = @('app', 'config', 'database', 'resources', 'routes', 'vendor')
    foreach ($dir in $privateDirs) {
        if (Test-Path "$Root/backend/$dir") {
            Copy-Item -Recurse -Force "$Root/backend/$dir" "$StagingPrivate/$dir"
        }
    }

    # Bootstrap folder (exclude cached config/routes)
    New-Item -ItemType Directory -Path "$StagingPrivate/bootstrap/cache" -Force | Out-Null
    Copy-Item -Force "$Root/backend/bootstrap/app.php" "$StagingPrivate/bootstrap/"
    if (Test-Path "$Root/backend/bootstrap/providers.php") {
        Copy-Item -Force "$Root/backend/bootstrap/providers.php" "$StagingPrivate/bootstrap/"
    }

    # Storage tree
    $storageDirs = @(
        'app/private',
        'app/public',
        'framework/cache/data',
        'framework/sessions',
        'framework/views',
        'logs'
    )
    foreach ($sDir in $storageDirs) {
        $p = "$StagingPrivate/storage/$sDir"
        New-Item -ItemType Directory -Path $p -Force | Out-Null
        Set-Content -Path "$p/.gitignore" -Value "*`n!.gitignore`n" -Encoding UTF8
    }

    # Root files of private
    Copy-Item -Force "$Root/backend/artisan" "$StagingPrivate/artisan"
    Copy-Item -Force "$Root/backend/composer.json" "$StagingPrivate/composer.json"
    Copy-Item -Force "$Root/backend/composer.lock" "$StagingPrivate/composer.lock"
    Set-Content -Path "$StagingPrivate/.htaccess" -Value "Require all denied`n" -Encoding UTF8
    Copy-Item -Force "$Root/deploy/cpanel/README.md" "$StagingPrivate/README-FIRST-cpanel.txt"
    Copy-Item -Force "$Root/deploy/cpanel/env.cpanel.example" "$StagingPrivate/.env.cpanel.example"

    # Remove any test/sqlite databases if copied into database folder
    Get-ChildItem -Path "$StagingPrivate/database" -Filter "*.sqlite*" | Remove-Item -Force

    # -------------------------------------------------------------
    # Step 4: Create ZIP archives
    # -------------------------------------------------------------
    Write-Host "==> 4/5 Compressing ZIP packages with tar..." -ForegroundColor Cyan
    $PublicZip = Join-Path $OutDir "cpanel-public.zip"
    $PrivateZip = Join-Path $OutDir "cpanel-private.zip"

    # Fast, multi-threaded native Windows bsdtar for optimal zip compression
    tar -a -cf "$PublicZip" -C "$StagingPublic" .
    tar -a -cf "$PrivateZip" -C "$StagingPrivate" .

    # Also copy database update SQL into release
    Copy-Item -Force "$Root/deploy/cpanel/database_update_v2.0.0.sql" "$OutDir/database_update_v2.0.0.sql"

    # -------------------------------------------------------------
    # Step 5: Checksums and summary
    # -------------------------------------------------------------
    Write-Host "==> 5/5 Generating SHA256 checksums..." -ForegroundColor Cyan
    $hashes = @()
    foreach ($f in (Get-ChildItem -Path $OutDir -File)) {
        $h = Get-FileHash -Path $f.FullName -Algorithm SHA256
        $hashes += "$($h.Hash.ToLower())  $($f.Name)"
    }
    Set-Content -Path "$OutDir/SHA256SUMS" -Value ($hashes -join "`n") -Encoding UTF8

    Write-Host "`n=======================================================" -ForegroundColor Green
    Write-Host "SUCCESS! cPanel Release packages created successfully:" -ForegroundColor Green
    Get-ChildItem -Path $OutDir | Format-Table Name, Length, LastWriteTime
    Write-Host "=======================================================`n" -ForegroundColor Green
}
finally {
    if (Test-Path $StagingDir) {
        Remove-Item -Recurse -Force $StagingDir -ErrorAction SilentlyContinue
    }
}
