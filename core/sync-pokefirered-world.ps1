# sync-pokefirered-world.ps1
[CmdletBinding()]
param(
  [string]$ProjectRoot = "C:\Users\igorl\OneDrive\Desktop\mapa-mundi\kanton\kanton",
  [string]$SourceRoot = "$ProjectRoot\pokefirered-master\pokefirered-master",
  [string]$DestRoot = "$ProjectRoot",
  [switch]$DryRun,
  [switch]$NoMirror,
  [switch]$SkipVerify
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-Dir([string]$path) {
  (Resolve-Path $path).Path.TrimEnd("\")
}

function Invoke-RoboCopy([string]$src, [string]$dst, [string[]]$flags) {
  & robocopy $src $dst @flags | Out-Null
  if ($LASTEXITCODE -ge 8) {
    throw "Robocopy failed for: $src -> $dst (exit $LASTEXITCODE)"
  }
}

$IsDryRun = [bool]$DryRun
if ($IsDryRun) {
  $SkipVerify = $true
}

if (-not (Test-Path $SourceRoot -PathType Container)) {
  throw "SourceRoot not found: $SourceRoot"
}

$SourceRoot = Resolve-Dir $SourceRoot
$DestRoot = Resolve-Dir $DestRoot

if ($SourceRoot -eq $DestRoot) {
  throw "SourceRoot and DestRoot cannot be the same path."
}

$DirsToMirror = @(
  "data\layouts",
  "data\maps",
  "data\scripts",
  "data\tilesets",
  "data\text",
  "graphics\object_events",
  "graphics\field_effects",
  "graphics\field_specials",
  "graphics\door_anims",
  "graphics\region_map",
  "graphics\weather"
)

$FilesToCopy = @(
  "data\maps.s",
  "data\map_events.s",
  "data\event_scripts.s",
  "data\field_effect_scripts.s",
  "data\script_cmd_table.inc",
  "data\specials.inc",
  "include\fieldmap.h",
  "include\global.fieldmap.h",
  "include\constants\metatile_behaviors.h",
  "include\constants\metatile_labels.h",
  "include\constants\maps.h",
  "include\constants\map_types.h",
  "include\constants\map_scripts.h",
  "include\constants\event_objects.h",
  "include\constants\field_effects.h",
  "include\tileset_anims.h",
  "src\fieldmap.c",
  "src\metatile_behavior.c",
  "src\tileset_anims.c",
  "src\data\tilesets\headers.h",
  "src\data\tilesets\graphics.h",
  "src\data\tilesets\metatiles.h"
)

$roboFlags = @("/MIR", "/COPY:DAT", "/DCOPY:T", "/R:2", "/W:2", "/XJ", "/NFL", "/NDL", "/NJH", "/NJS", "/NP")
if ($NoMirror) { $roboFlags[0] = "/E" }
if ($IsDryRun) { $roboFlags += "/L" }

foreach ($dir in $DirsToMirror) {
  $src = Join-Path $SourceRoot $dir
  if (-not (Test-Path $src -PathType Container)) {
    throw "Missing dir: $src"
  }
  $dst = Join-Path $DestRoot $dir
  if ($IsDryRun) {
    Write-Host "DryRun: mirror $src -> $dst"
    continue
  }
  New-Item -ItemType Directory -Force -Path $dst | Out-Null
  Invoke-RoboCopy $src $dst $roboFlags
}

foreach ($file in $FilesToCopy) {
  $src = Join-Path $SourceRoot $file
  if (-not (Test-Path $src -PathType Leaf)) {
    throw "Missing file: $src"
  }
  $dst = Join-Path $DestRoot $file
  if ($IsDryRun) {
    Write-Host "DryRun: copy $src -> $dst"
    continue
  }
  $dstDir = Split-Path -Parent $dst
  New-Item -ItemType Directory -Force -Path $dstDir | Out-Null
  Copy-Item -Path $src -Destination $dst -Force
}

if (-not $SkipVerify -and -not $IsDryRun) {
  $allSrcFiles = New-Object System.Collections.Generic.List[string]
  foreach ($dir in $DirsToMirror) {
    Get-ChildItem -Path (Join-Path $SourceRoot $dir) -Recurse -File | ForEach-Object {
      $allSrcFiles.Add($_.FullName)
    }
  }
  foreach ($file in $FilesToCopy) {
    $allSrcFiles.Add((Join-Path $SourceRoot $file))
  }

  $mismatches = @()
  foreach ($src in $allSrcFiles) {
    $rel = $src.Substring($SourceRoot.Length).TrimStart("\")
    $dst = Join-Path $DestRoot $rel
    if (-not (Test-Path $dst -PathType Leaf)) {
      $mismatches += "Missing: $rel"
      continue
    }
    $h1 = (Get-FileHash -Path $src -Algorithm SHA256).Hash
    $h2 = (Get-FileHash -Path $dst -Algorithm SHA256).Hash
    if ($h1 -ne $h2) {
      $mismatches += "HashMismatch: $rel"
    }
  }
  if ($mismatches.Count -gt 0) {
    $mismatches | ForEach-Object { Write-Host $_ }
    throw "Verification failed: $($mismatches.Count) file(s)."
  }
}

Write-Host "Done."
