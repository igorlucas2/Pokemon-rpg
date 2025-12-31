# convert-pokefirered-maps.ps1
[CmdletBinding()]
param(
  [string]$ProjectRoot = "C:\Users\igorl\OneDrive\Desktop\mapa-mundi\kanton\kanton",
  [string]$SourceRoot = "$ProjectRoot\pokefirered-master\pokefirered-master",
  [string]$OutputDir = "$ProjectRoot\mapas",
  [string]$ImagesRoot = "$ProjectRoot\mapa\regioes",
  [string]$WorldScriptPath = "$ProjectRoot\world.pokefirered.js",
  [string]$DefaultImage = "mapa.png",
  [int]$TileSize = 16,
  [switch]$SkipImages,
  [switch]$SkipWorld
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Resolve-Dir([string]$path) {
  (Resolve-Path $path).Path.TrimEnd("\")
}

function Load-Json([string]$path) {
  Get-Content -Path $path -Raw | ConvertFrom-Json
}

function Load-TextFile([string]$path) {
  if (-not (Test-Path $path -PathType Leaf)) {
    return ""
  }
  try {
    return Get-Content -Path $path -Raw -Encoding UTF8
  } catch {
    return Get-Content -Path $path -Raw
  }
}

function Decode-TextLiteral([string]$raw) {
  if ($null -eq $raw) {
    return ""
  }
  $sb = New-Object System.Text.StringBuilder
  $i = 0
  while ($i -lt $raw.Length) {
    $ch = $raw[$i]
    if ($ch -eq '\') {
      if ($i + 1 -lt $raw.Length) {
        $next = $raw[$i + 1]
        switch ($next) {
          "n" { $sb.Append("`n") | Out-Null; $i += 2; continue }
          "p" { $sb.Append("`n`n") | Out-Null; $i += 2; continue }
          "l" { $sb.Append("`n") | Out-Null; $i += 2; continue }
          '"' { $sb.Append('"') | Out-Null; $i += 2; continue }
          '\' { $sb.Append('\') | Out-Null; $i += 2; continue }
          default {
            $sb.Append('\') | Out-Null
            $sb.Append($next) | Out-Null
            $i += 2
            continue
          }
        }
      }
    }
    $sb.Append($ch) | Out-Null
    $i++
  }
  return $sb.ToString()
}

function Parse-TextLabels([string]$text) {
  $labels = @{}
  if (-not $text) {
    return $labels
  }
  $lines = [regex]::Split($text, "\r?\n")
  $current = $null
  $parts = New-Object "System.Collections.Generic.List[string]"
  foreach ($line in $lines) {
    if ($line -match '^\s*([A-Za-z0-9_]+)::') {
      if ($current) {
        $labels[$current] = ($parts -join "")
      }
      $current = $Matches[1]
      $parts = New-Object "System.Collections.Generic.List[string]"
      continue
    }
    if (-not $current) {
      continue
    }
    if ($line -match '^\s*\.string\s+"(.*)"\s*$') {
      $raw = $Matches[1]
      $parts.Add((Decode-TextLiteral $raw)) | Out-Null
    }
  }
  if ($current) {
    $labels[$current] = ($parts -join "")
  }
  foreach ($key in @($labels.Keys)) {
    $value = $labels[$key]
    if ($value -and $value.EndsWith("$")) {
      $labels[$key] = $value.Substring(0, $value.Length - 1)
      $value = $labels[$key]
    }
    if ($value) {
      $labels[$key] = ($value -replace "(?m)^\\", "")
    }
  }
  return $labels
}

function Parse-ScriptTextLabels([string]$text) {
  $labels = @{}
  if (-not $text) {
    return $labels
  }
  $lines = [regex]::Split($text, "\r?\n")
  $current = $null
  $currentLabels = New-Object "System.Collections.Generic.List[string]"
  foreach ($line in $lines) {
    if ($line -match '^\s*([A-Za-z0-9_]+)::') {
      if ($current) {
        $labels[$current] = @($currentLabels)
      }
      $current = $Matches[1]
      $currentLabels = New-Object "System.Collections.Generic.List[string]"
      continue
    }
    if (-not $current) {
      continue
    }
    if ($line -match '^\s*msgbox\s+([A-Za-z0-9_]+)') {
      $label = $Matches[1]
      if (-not $currentLabels.Contains($label)) {
        $currentLabels.Add($label) | Out-Null
      }
      continue
    }
    if ($line -match '^\s*message\s+([A-Za-z0-9_]+)') {
      $label = $Matches[1]
      if (-not $currentLabels.Contains($label)) {
        $currentLabels.Add($label) | Out-Null
      }
      continue
    }
    if ($line -match '^\s*jumptextfaceplayer\s+([A-Za-z0-9_]+)') {
      $label = $Matches[1]
      if (-not $currentLabels.Contains($label)) {
        $currentLabels.Add($label) | Out-Null
      }
      continue
    }
    if ($line -match '^\s*jumptext\s+([A-Za-z0-9_]+)') {
      $label = $Matches[1]
      if (-not $currentLabels.Contains($label)) {
        $currentLabels.Add($label) | Out-Null
      }
      continue
    }
  }
  if ($current) {
    $labels[$current] = @($currentLabels)
  }
  return $labels
}

function Resolve-DialogTexts(
  [string]$dialogId,
  $scriptLabelMap,
  $mapTextMap,
  $globalTextMap
) {
  $labelList = New-Object "System.Collections.Generic.List[string]"
  if ($dialogId) {
    if ($mapTextMap -and $mapTextMap.ContainsKey($dialogId)) {
      $labelList.Add($dialogId) | Out-Null
    } elseif ($globalTextMap -and $globalTextMap.ContainsKey($dialogId)) {
      $labelList.Add($dialogId) | Out-Null
    }
  }
  if ($scriptLabelMap -and $dialogId -and $scriptLabelMap.ContainsKey($dialogId)) {
    foreach ($label in $scriptLabelMap[$dialogId]) {
      if (-not $labelList.Contains($label)) {
        $labelList.Add($label) | Out-Null
      }
    }
  }
  $texts = New-Object "System.Collections.Generic.List[string]"
  foreach ($label in $labelList) {
    $text = $null
    if ($mapTextMap -and $mapTextMap.ContainsKey($label)) {
      $text = $mapTextMap[$label]
    } elseif ($globalTextMap -and $globalTextMap.ContainsKey($label)) {
      $text = $globalTextMap[$label]
    }
    if ($text) {
      $texts.Add($text) | Out-Null
    }
  }
  return @{
    labels = @($labelList)
    texts = @($texts)
  }
}

function Get-DialogText(
  [string]$dialogId,
  $scriptLabelMap,
  $mapTextMap,
  $globalTextMap
) {
  if (-not $dialogId) {
    return $null
  }
  $resolved = Resolve-DialogTexts $dialogId $scriptLabelMap $mapTextMap $globalTextMap
  $texts = @($resolved.texts)
  if ($texts.Count -eq 0) {
    return $null
  }
  return ($texts -join "`n`n")
}

function Escape-NonAscii([string]$text) {
  if ($null -eq $text) {
    return ""
  }
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $text.ToCharArray()) {
    $code = [int][char]$ch
    if ($code -gt 127) {
      $sb.Append("\u" + $code.ToString("X4")) | Out-Null
    } else {
      $sb.Append($ch) | Out-Null
    }
  }
  return $sb.ToString()
}

function ConvertTo-AsciiJson([object]$data, [int]$depth = 6, [switch]$Compress) {
  $json = if ($Compress) {
    ConvertTo-Json -InputObject $data -Depth $depth -Compress
  } else {
    ConvertTo-Json -InputObject $data -Depth $depth
  }
  return Escape-NonAscii $json
}

function Get-Prop([object]$obj, [string]$name, $default = $null) {
  if ($null -eq $obj) {
    return $default
  }
  $prop = $obj.PSObject.Properties[$name]
  if ($null -ne $prop) {
    return $prop.Value
  }
  return $default
}

function Get-Int([object]$value, [int]$default = 0) {
  if ($null -eq $value) {
    return $default
  }
  if ($value -is [int]) {
    return $value
  }
  if ($value -is [long]) {
    return [int]$value
  }
  if ($value -is [string] -and $value -match '^[-]?\\d+$') {
    return [int]$value
  }
  return $default
}

function Get-Slug([string]$value) {
  if (-not $value) {
    return ""
  }
  $lower = $value.ToLowerInvariant()
  return ([regex]::Replace($lower, "[^a-z0-9]+", ""))
}

function Get-RouteSlugVariants([string]$value) {
  $variants = @()
  if (-not $value) {
    return $variants
  }
  if ($value -match "(?i)^route\s*([0-9]+)") {
    $num = [int]$Matches[1]
    if ($num -lt 10) {
      $variants += ("route0" + $num)
    }
  }
  return $variants
}

function Normalize-DialogId([object]$script) {
  if ($null -eq $script) {
    return $null
  }
  $value = $script.ToString().Trim()
  if ($value -eq "" -or $value -eq "0x0" -or $value -eq "0") {
    return $null
  }
  return $value
}

function Get-RelativeWebPath([string]$fullPath, [string]$root) {
  $root = Resolve-Dir $root
  $full = (Resolve-Path $fullPath).Path
  if ($full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
    $rel = $full.Substring($root.Length).TrimStart("\")
    return ($rel -replace "\\", "/")
  }
  return ($fullPath -replace "\\", "/")
}

function Build-ObjectEventGraphicsMap([string]$sourceRoot, [string]$projectRoot) {
  $map = @{}
  $infoPointersPath = Join-Path $sourceRoot "src\data\object_events\object_event_graphics_info_pointers.h"
  $infoPath = Join-Path $sourceRoot "src\data\object_events\object_event_graphics_info.h"
  $picTablesPath = Join-Path $sourceRoot "src\data\object_events\object_event_pic_tables.h"
  $graphicsPath = Join-Path $sourceRoot "src\data\object_events\object_event_graphics.h"
  if (-not (Test-Path $infoPointersPath) -or -not (Test-Path $infoPath) -or -not (Test-Path $picTablesPath) -or -not (Test-Path $graphicsPath)) {
    return $map
  }

  $idToInfo = @{}
  $lines = [regex]::Split((Load-TextFile $infoPointersPath), "\r?\n")
  foreach ($line in $lines) {
    if ($line -match '\[(OBJ_EVENT_GFX_[A-Z0-9_]+)\]\s*=\s*&([A-Za-z0-9_]+)') {
      $idToInfo[$Matches[1]] = $Matches[2]
    }
  }

  $infoByName = @{}
  $lines = [regex]::Split((Load-TextFile $infoPath), "\r?\n")
  $current = $null
  $width = $null
  $height = $null
  $images = $null
  foreach ($line in $lines) {
    if ($line -match 'const struct ObjectEventGraphicsInfo\s+([A-Za-z0-9_]+)\s*=\s*\{') {
      $current = $Matches[1]
      $width = $null
      $height = $null
      $images = $null
      continue
    }
    if (-not $current) {
      continue
    }
    if ($line -match '\.width\s*=\s*([0-9]+)') {
      $width = [int]$Matches[1]
    } elseif ($line -match '\.height\s*=\s*([0-9]+)') {
      $height = [int]$Matches[1]
    } elseif ($line -match '\.images\s*=\s*([A-Za-z0-9_]+)') {
      $images = $Matches[1]
    } elseif ($line -match '};') {
      $infoByName[$current] = @{
        width = $width
        height = $height
        images = $images
      }
      $current = $null
    }
  }

  $tableToPic = @{}
  $lines = [regex]::Split((Load-TextFile $picTablesPath), "\r?\n")
  $current = $null
  $picName = $null
  foreach ($line in $lines) {
    if ($line -match 'static const struct SpriteFrameImage\s+([A-Za-z0-9_]+)\[\]') {
      $current = $Matches[1]
      $picName = $null
      continue
    }
    if (-not $current) {
      continue
    }
    if (-not $picName -and $line -match 'overworld_frame\(([A-Za-z0-9_]+),') {
      $picName = $Matches[1]
      continue
    }
    if (-not $picName -and $line -match 'obj_event_frame\(([A-Za-z0-9_]+),') {
      $picName = $Matches[1]
      continue
    }
    if ($line -match '};') {
      if ($picName) {
        $tableToPic[$current] = $picName
      }
      $current = $null
    }
  }

  $picToPath = @{}
  $lines = [regex]::Split((Load-TextFile $graphicsPath), "\r?\n")
  foreach ($line in $lines) {
    if ($line -match 'const\s+u16\s+([A-Za-z0-9_]+)\s*\[\]\s*=\s*INCBIN_U16\(\"([^\"]+)\"') {
      $picToPath[$Matches[1]] = $Matches[2]
    }
  }

  $rootPrefix = "pokefirered-master/pokefirered-master/"
  foreach ($gfxId in $idToInfo.Keys) {
    $infoName = $idToInfo[$gfxId]
    if (-not $infoByName.ContainsKey($infoName)) {
      continue
    }
    $info = $infoByName[$infoName]
    $table = $info.images
    if (-not $table -or -not $tableToPic.ContainsKey($table)) {
      continue
    }
    $pic = $tableToPic[$table]
    if (-not $picToPath.ContainsKey($pic)) {
      continue
    }
    $relPath = ($picToPath[$pic] -replace "\\", "/") -replace "\.4bpp$", ".png"
    $fullPath = Join-Path $sourceRoot ($relPath -replace "/", "\")
    if (-not (Test-Path $fullPath -PathType Leaf)) {
      continue
    }
    $spritePath = $rootPrefix + $relPath
    $map[$gfxId] = @{
      sprite = $spritePath
      width = $info.width
      height = $info.height
    }
  }

  return $map
}

if (-not (Test-Path $SourceRoot -PathType Container)) {
  throw "SourceRoot not found: $SourceRoot"
}

$SourceRoot = Resolve-Dir $SourceRoot
$ProjectRoot = Resolve-Dir $ProjectRoot

$objectEventGraphicsMap = Build-ObjectEventGraphicsMap $SourceRoot $ProjectRoot

$globalTextMap = @{}
$textDir = Join-Path $SourceRoot "data\text"
if (Test-Path $textDir -PathType Container) {
  $textFiles = Get-ChildItem -Path $textDir -Filter "*.inc"
  foreach ($file in $textFiles) {
    $parsed = Parse-TextLabels (Load-TextFile $file.FullName)
    foreach ($key in $parsed.Keys) {
      if (-not $globalTextMap.ContainsKey($key)) {
        $globalTextMap[$key] = $parsed[$key]
      }
    }
  }
}

$layoutsJson = Load-Json (Join-Path $SourceRoot "data\layouts\layouts.json")
$layoutById = @{}
foreach ($layout in $layoutsJson.layouts) {
  $layoutId = Get-Prop $layout "id"
  if ($layoutId) {
    $layoutById[$layoutId] = $layout
  }
}

$metatileAttrMap = @{}
$metatileHeader = Join-Path $SourceRoot "src\data\tilesets\metatiles.h"
foreach ($line in Get-Content -Path $metatileHeader) {
  if ($line -match 'gMetatileAttributes_([A-Za-z0-9_]+)\[\].*"([^"]+)"') {
    $label = $Matches[1]
    $path = $Matches[2]
    if (-not $metatileAttrMap.ContainsKey($label)) {
      $metatileAttrMap[$label] = $path
    }
  }
}

$behaviorMap = @{}
$behaviorHeader = Join-Path $SourceRoot "include\constants\metatile_behaviors.h"
foreach ($line in Get-Content -Path $behaviorHeader) {
  if ($line -match "#define\s+(MB_[A-Z0-9_]+)\s+0x([0-9A-Fa-f]+)") {
    $behaviorMap[$Matches[1]] = [Convert]::ToInt32($Matches[2], 16)
  }
}

$blockedBehaviorNames = @(
  "MB_IMPASSABLE_EAST",
  "MB_IMPASSABLE_WEST",
  "MB_IMPASSABLE_NORTH",
  "MB_IMPASSABLE_SOUTH",
  "MB_IMPASSABLE_NORTHEAST",
  "MB_IMPASSABLE_NORTHWEST",
  "MB_IMPASSABLE_SOUTHEAST",
  "MB_IMPASSABLE_SOUTHWEST",
  "MB_POND_WATER",
  "MB_FAST_WATER",
  "MB_DEEP_WATER",
  "MB_WATERFALL",
  "MB_OCEAN_WATER",
  "MB_PUDDLE",
  "MB_UNUSED_WATER",
  "MB_CYCLING_ROAD_WATER",
  "MB_SHALLOW_WATER",
  "MB_UNDERWATER_BLOCKED_ABOVE",
  "MB_MOUNTAIN_TOP",
  "MB_COUNTER",
  "MB_BOOKSHELF",
  "MB_POKEMART_SHELF",
  "MB_PC",
  "MB_SIGNPOST",
  "MB_REGION_MAP",
  "MB_TELEVISION",
  "MB_POKEMON_CENTER_SIGN",
  "MB_POKEMART_SIGN",
  "MB_CABINET",
  "MB_KITCHEN",
  "MB_DRESSER",
  "MB_SNACKS",
  "MB_CABLE_CLUB_WIRELESS_MONITOR",
  "MB_BATTLE_RECORDS",
  "MB_QUESTIONNAIRE",
  "MB_FOOD",
  "MB_INDIGO_PLATEAU_SIGN_1",
  "MB_INDIGO_PLATEAU_SIGN_2",
  "MB_BLUEPRINTS",
  "MB_PAINTING",
  "MB_POWER_PLANT_MACHINE",
  "MB_TELEPHONE",
  "MB_COMPUTER",
  "MB_ADVERTISING_POSTER",
  "MB_FOOD_SMELLS_TASTY",
  "MB_TRASH_BIN",
  "MB_CUP",
  "MB_PORTHOLE",
  "MB_WINDOW",
  "MB_BLINKING_LIGHTS",
  "MB_NEATLY_LINED_UP_TOOLS",
  "MB_IMPRESSIVE_MACHINE",
  "MB_VIDEO_GAME",
  "MB_BURGLARY",
  "MB_TRAINER_TOWER_MONITOR"
)

$blockedIds = New-Object "System.Collections.Generic.HashSet[int]"
foreach ($name in $blockedBehaviorNames) {
  if ($behaviorMap.ContainsKey($name)) {
    $blockedIds.Add([int]$behaviorMap[$name]) | Out-Null
  } else {
    Write-Warning "Behavior not found: $name"
  }
}

$imageBySlug = @{}
if (-not $SkipImages -and (Test-Path $ImagesRoot -PathType Container)) {
  $images = Get-ChildItem -Path $ImagesRoot -Recurse -Filter "*.png"
  foreach ($img in $images) {
    $slug = Get-Slug $img.BaseName
    if (-not $slug) {
      continue
    }
    if (-not $imageBySlug.ContainsKey($slug)) {
      $imageBySlug[$slug] = @()
    }
    $rel = Get-RelativeWebPath $img.FullName $ProjectRoot
    $imageBySlug[$slug] += $rel
  }
}

function Get-ImageForMap([string]$mapId, [string]$mapName, [string]$mapConst) {
  if ($SkipImages -or $imageBySlug.Count -eq 0) {
    return $DefaultImage
  }
  $candidates = @()
  $candidates += Get-Slug $mapId
  $candidates += Get-Slug $mapName
  if ($mapConst) {
    $candidates += Get-Slug ($mapConst -replace "^MAP_", "")
  }
  $candidates += Get-RouteSlugVariants $mapId
  $candidates += Get-RouteSlugVariants $mapName
  foreach ($slug in $candidates) {
    if (-not $slug) {
      continue
    }
    if ($imageBySlug.ContainsKey($slug)) {
      return $imageBySlug[$slug][0]
    }
  }
  return $DefaultImage
}

$attrCache = @{}
function Get-AttrArray([string]$tilesetName) {
  if (-not $tilesetName) {
    return @()
  }
  if ($attrCache.ContainsKey($tilesetName)) {
    return $attrCache[$tilesetName]
  }
  $label = $tilesetName -replace "^gTileset_", ""
  if (-not $metatileAttrMap.ContainsKey($label)) {
    Write-Warning "Missing metatile attributes for tileset: $tilesetName"
    $attrCache[$tilesetName] = @()
    return @()
  }
  $relPath = $metatileAttrMap[$label]
  $path = Join-Path $SourceRoot $relPath
  if (-not (Test-Path $path -PathType Leaf)) {
    Write-Warning "Missing metatile attributes file: $path"
    $attrCache[$tilesetName] = @()
    return @()
  }
  $bytes = [IO.File]::ReadAllBytes($path)
  $count = [int]($bytes.Length / 4)
  $attrs = New-Object uint32[] $count
  for ($i = 0; $i -lt $count; $i++) {
    $attrs[$i] = [BitConverter]::ToUInt32($bytes, $i * 4)
  }
  $attrCache[$tilesetName] = $attrs
  return $attrs
}

$MapGridCollisionMask = 0x0C00
$MapGridCollisionShift = 10

function Get-BlockedGrid(
  [string]$mapBinPath,
  [int]$width,
  [int]$height,
  [uint32[]]$primaryAttrs,
  [uint32[]]$secondaryAttrs,
  $blockedSet
) {
  $tileCount = $width * $height
  $blocked = New-Object bool[] $tileCount
  if (-not (Test-Path $mapBinPath -PathType Leaf)) {
    return $blocked
  }
  $bytes = [IO.File]::ReadAllBytes($mapBinPath)
  $maxTiles = [Math]::Min($tileCount, [int]($bytes.Length / 2))
  for ($i = 0; $i -lt $maxTiles; $i++) {
    $block = [BitConverter]::ToUInt16($bytes, $i * 2)
    $collision = ($block -band $MapGridCollisionMask) -shr $MapGridCollisionShift
    if ($collision -ne 0) {
      $blocked[$i] = $true
      continue
    }
    $tileId = $block -band 0x03FF
    if ($tileId -lt 640) {
      $attrs = $primaryAttrs
      $idx = $tileId
    } else {
      $attrs = $secondaryAttrs
      $idx = $tileId - 640
    }
    if ($idx -lt 0 -or $idx -ge $attrs.Length) {
      continue
    }
    $behavior = $attrs[$idx] -band 0x01FF
    if ($blockedSet.Contains([int]$behavior)) {
      $blocked[$i] = $true
    }
  }
  return $blocked
}

function Compress-GridToRects([bool[]]$blocked, [int]$width, [int]$height) {
  $visited = New-Object bool[] ($width * $height)
  $rects = New-Object "System.Collections.Generic.List[object]"
  for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
      $idx = $y * $width + $x
      if (-not $blocked[$idx] -or $visited[$idx]) {
        continue
      }
      $maxW = 1
      while ($x + $maxW -lt $width) {
        $idx2 = $y * $width + ($x + $maxW)
        if (-not $blocked[$idx2] -or $visited[$idx2]) {
          break
        }
        $maxW++
      }
      $maxH = 1
      $canExpand = $true
      while ($y + $maxH -lt $height -and $canExpand) {
        for ($xx = 0; $xx -lt $maxW; $xx++) {
          $idx3 = ($y + $maxH) * $width + ($x + $xx)
          if (-not $blocked[$idx3] -or $visited[$idx3]) {
            $canExpand = $false
            break
          }
        }
        if ($canExpand) {
          $maxH++
        }
      }
      for ($yy = 0; $yy -lt $maxH; $yy++) {
        for ($xx = 0; $xx -lt $maxW; $xx++) {
          $visited[($y + $yy) * $width + ($x + $xx)] = $true
        }
      }
      $rects.Add(@{ x = $x; y = $y; w = $maxW; h = $maxH }) | Out-Null
    }
  }
  return $rects
}

function Find-Start([bool[]]$blocked, [int]$width, [int]$height) {
  for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
      if (-not $blocked[$y * $width + $x]) {
        return @{ x = $x; y = $y }
      }
    }
  }
  return @{ x = 0; y = 0 }
}

$mapsRoot = Join-Path $SourceRoot "data\maps"
$mapDirs = Get-ChildItem -Path $mapsRoot -Directory
$mapEntries = @()
$mapConstToId = @{}
$warpByMap = @{}

foreach ($dir in $mapDirs) {
  $mapPath = Join-Path $dir.FullName "map.json"
  if (-not (Test-Path $mapPath -PathType Leaf)) {
    continue
  }
  $mapJson = Load-Json $mapPath
  $mapId = $dir.Name
  $mapConst = Get-Prop $mapJson "id"
  if ($mapConst) {
    $mapConstToId[$mapConst] = $mapId
  }
  $warps = @()
  $warpEvents = Get-Prop $mapJson "warp_events" @()
  if ($warpEvents) {
    $warps = @($warpEvents)
  }
  $warpByMap[$mapId] = $warps
  $mapEntries += @{ id = $mapId; json = $mapJson; path = $dir.FullName }
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

$summary = New-Object "System.Collections.Generic.List[object]"
$globalDialogById = @{}

foreach ($entry in $mapEntries) {
  $mapId = $entry.id
  $mapJson = $entry.json
  $mapDir = $entry.path
  $mapConst = Get-Prop $mapJson "id"
  $mapName = Get-Prop $mapJson "name" $mapId
  $mapTextMap = @{}
  if ($mapDir) {
    $textPath = Join-Path $mapDir "text.inc"
    $mapTextMap = Parse-TextLabels (Load-TextFile $textPath)
  }
  $scriptTextMap = @{}
  if ($mapDir) {
    $scriptPath = Join-Path $mapDir "scripts.inc"
    $scriptTextMap = Parse-ScriptTextLabels (Load-TextFile $scriptPath)
  }
  $layoutId = Get-Prop $mapJson "layout"
  if (-not $layoutId -or -not $layoutById.ContainsKey($layoutId)) {
    Write-Warning ("Layout not found for {0}: {1}" -f $mapId, $layoutId)
    continue
  }

  $layout = $layoutById[$layoutId]
  $width = Get-Int (Get-Prop $layout "width") 0
  $height = Get-Int (Get-Prop $layout "height") 0

  $primaryTileset = Get-Prop $layout "primary_tileset"
  $secondaryTileset = Get-Prop $layout "secondary_tileset"
  $primaryAttrs = Get-AttrArray $primaryTileset
  $secondaryAttrs = Get-AttrArray $secondaryTileset

  $blockPath = Get-Prop $layout "blockdata_filepath"
  $mapBin = if ($blockPath) { Join-Path $SourceRoot $blockPath } else { "" }
  $blocked = Get-BlockedGrid $mapBin $width $height $primaryAttrs $secondaryAttrs $blockedIds
  $colliders = Compress-GridToRects $blocked $width $height
  $start = Find-Start $blocked $width $height

  $npcs = @()
  $dialogIds = New-Object "System.Collections.Generic.HashSet[string]"
  $objectEvents = Get-Prop $mapJson "object_events" @()
  if ($objectEvents) {
    $idx = 0
    foreach ($obj in $objectEvents) {
      $idx++
      $localId = Get-Prop $obj "local_id"
      $graphicsId = Get-Prop $obj "graphics_id"
      $script = Get-Prop $obj "script"
      $npcId = if ($localId) { $localId } else { "npc-$idx" }
      $npcName = if ($graphicsId) { $graphicsId } else { $npcId }
      $dialogId = Normalize-DialogId $script
      $sprite = $null
      $spriteSize = $null
      if ($graphicsId -and $objectEventGraphicsMap.ContainsKey($graphicsId)) {
        $gfx = $objectEventGraphicsMap[$graphicsId]
        $sprite = $gfx.sprite
        $spriteSize = @{
          w = Get-Int $gfx.width $TileSize
          h = Get-Int $gfx.height $TileSize
        }
      }
      if ($dialogId) {
        $dialogIds.Add($dialogId) | Out-Null
      }
      $npc = @{
        id = $npcId
        name = $npcName
        x = Get-Int (Get-Prop $obj "x") 0
        y = Get-Int (Get-Prop $obj "y") 0
        dialogId = $dialogId
        trigger = "touch"
        solid = $true
        meta = @{
          graphicsId = $graphicsId
          movementType = Get-Prop $obj "movement_type"
          trainerType = Get-Prop $obj "trainer_type"
          script = $script
          flag = Get-Prop $obj "flag"
          elevation = Get-Prop $obj "elevation"
        }
      }
      if ($sprite) {
        $npc.sprite = $sprite
      }
      if ($spriteSize) {
        $npc.spriteSize = $spriteSize
      }
      $npcs += $npc
    }
  }

  $events = @()
  $warpEvents = Get-Prop $mapJson "warp_events" @()
  if ($warpEvents) {
    $wIdx = 0
    foreach ($warp in $warpEvents) {
      $wIdx++
      $destMapId = $null
      $destMapConst = Get-Prop $warp "dest_map"
      if ($destMapConst -and $mapConstToId.ContainsKey($destMapConst)) {
        $destMapId = $mapConstToId[$destMapConst]
      }
      $destWarpIdRaw = Get-Prop $warp "dest_warp_id"
      $destWarpIndex = Get-Int $destWarpIdRaw 0
      $targetX = 0
      $targetY = 0
      if ($destMapId -and $warpByMap.ContainsKey($destMapId)) {
        $destWarps = $warpByMap[$destMapId]
        if ($destWarpIndex -ge 0 -and $destWarpIndex -lt $destWarps.Count) {
          $targetX = Get-Int (Get-Prop $destWarps[$destWarpIndex] "x") 0
          $targetY = Get-Int (Get-Prop $destWarps[$destWarpIndex] "y") 0
        }
      }
      $events += @{
        id = "warp-$mapId-$wIdx"
        type = "door"
        rect = @{ x = Get-Int (Get-Prop $warp "x") 0; y = Get-Int (Get-Prop $warp "y") 0; w = 1; h = 1 }
        once = $false
        target = @{ mapId = $destMapId; x = $targetX; y = $targetY; facing = "down" }
        meta = @{
          source = "warp"
          destMap = $destMapConst
          destWarpId = $destWarpIdRaw
          elevation = Get-Prop $warp "elevation"
        }
      }
    }
  }

  $coordEvents = Get-Prop $mapJson "coord_events" @()
  if ($coordEvents) {
    $cIdx = 0
    foreach ($coord in $coordEvents) {
      $cIdx++
      $coordScript = Get-Prop $coord "script"
      $dialogId = Normalize-DialogId $coordScript
      if ($dialogId) {
        $dialogIds.Add($dialogId) | Out-Null
      }
      $events += @{
        id = "coord-$mapId-$cIdx"
        type = "dialog"
        rect = @{ x = Get-Int (Get-Prop $coord "x") 0; y = Get-Int (Get-Prop $coord "y") 0; w = 1; h = 1 }
        once = $false
        trigger = "enter"
        dialogId = $dialogId
        meta = @{
          source = "coord"
          var = Get-Prop $coord "var"
          varValue = Get-Prop $coord "var_value"
          elevation = Get-Prop $coord "elevation"
        }
      }
    }
  }

  $bgEvents = Get-Prop $mapJson "bg_events" @()
  if ($bgEvents) {
    $bIdx = 0
    foreach ($bg in $bgEvents) {
      $bIdx++
      $bgType = Get-Prop $bg "type" "bg"
      $bgScript = Get-Prop $bg "script"
      $dialogId = Normalize-DialogId $bgScript
      if ($bgType -eq "hidden_item") {
        $item = Get-Prop $bg "item"
        $quantity = Get-Int (Get-Prop $bg "quantity") 1
        $text = if ($item) { "Item escondido: $item" } else { "Item escondido" }
        if ($quantity -gt 1) {
          $text += " x$quantity"
        }
        $events += @{
          id = "bg-$mapId-$bIdx"
          type = "message"
          rect = @{ x = Get-Int (Get-Prop $bg "x") 0; y = Get-Int (Get-Prop $bg "y") 0; w = 1; h = 1 }
          once = $true
          trigger = "interact"
          text = $text
          meta = @{
            source = "bg"
            bgType = $bgType
            item = $item
            flag = Get-Prop $bg "flag"
            quantity = $quantity
            underfoot = Get-Prop $bg "underfoot"
            elevation = Get-Prop $bg "elevation"
          }
        }
      } elseif ($bgType -eq "sign") {
        if ($dialogId) {
          $dialogIds.Add($dialogId) | Out-Null
        }
        $events += @{
          id = "bg-$mapId-$bIdx"
          type = "dialog"
          rect = @{ x = Get-Int (Get-Prop $bg "x") 0; y = Get-Int (Get-Prop $bg "y") 0; w = 1; h = 1 }
          once = $false
          trigger = "interact"
          dialogId = $dialogId
          meta = @{ source = "bg"; bgType = $bgType; elevation = Get-Prop $bg "elevation" }
        }
      } else {
        $text = "Evento"
        if ($dialogId) {
          $resolvedText = Get-DialogText $dialogId $scriptTextMap $mapTextMap $globalTextMap
          $text = if ($resolvedText) { $resolvedText } else { "TODO: " + $dialogId }
        }
        $events += @{
          id = "bg-$mapId-$bIdx"
          type = "message"
          rect = @{ x = Get-Int (Get-Prop $bg "x") 0; y = Get-Int (Get-Prop $bg "y") 0; w = 1; h = 1 }
          once = $false
          trigger = "interact"
          text = $text
          meta = @{ source = "bg"; bgType = $bgType; elevation = Get-Prop $bg "elevation"; script = $bgScript }
        }
      }
    }
  }

  $dialogs = @()
  foreach ($id in ($dialogIds | Sort-Object)) {
    $resolved = Resolve-DialogTexts $id $scriptTextMap $mapTextMap $globalTextMap
    $labels = @($resolved.labels)
    $texts = @($resolved.texts)
    $text = if ($texts.Count -gt 0) { $texts -join "`n`n" } else { "TODO: " + $id }
    $title = if ($labels.Count -gt 0) { $labels[0] } else { $id }
    $dialogs += @{ id = $id; title = $title; text = $text }
  }

  $imagePath = Get-ImageForMap $mapId $mapName $mapConst

  $out = @{
    id = $mapId
    name = $mapName
    image = $imagePath
    tileSize = $TileSize
    start = $start
    colliders = $colliders
    npcs = $npcs
    events = $events
    dialogs = $dialogs
    meta = @{
      sourceMapId = $mapConst
      layoutId = $layoutId
      width = $width
      height = $height
      primaryTileset = $primaryTileset
      secondaryTileset = $secondaryTileset
    }
  }

  $outPath = Join-Path $OutputDir ("$mapId.json")
  $json = ConvertTo-AsciiJson $out 8
  $json | Set-Content -Path $outPath -Encoding ASCII

  $summary.Add(@{ id = $mapId; name = $out.name; image = $imagePath; width = $width; height = $height }) | Out-Null

  if (-not $SkipWorld) {
    foreach ($dialog in $dialogs) {
      $dialogId = $dialog.id
      if (-not $dialogId -and $dialog.ContainsKey("id")) {
        $dialogId = $dialog["id"]
      }
      if (-not $dialogId) {
        continue
      }
      $globalDialogById[$dialogId] = $dialog
    }
  }
}

$index = @{
  generatedAt = (Get-Date).ToString("s")
  count = $summary.Count
  maps = $summary
}
$indexJson = ConvertTo-AsciiJson $index 6
$indexJson | Set-Content -Path (Join-Path $OutputDir "index.json") -Encoding ASCII

if (-not $SkipWorld) {
  $mapFiles = @{}
  foreach ($entry in $summary) {
    $mapId = $entry.id
    if (-not $mapId -and $entry.ContainsKey("id")) {
      $mapId = $entry["id"]
    }
    if (-not $mapId) {
      continue
    }
    $mapFiles[$mapId] = "$mapId.json"
  }
  $mapIndex = @()
  foreach ($entry in $summary) {
    $mapIndex += @{
      id = $entry.id
      name = $entry.name
      image = $entry.image
      width = $entry.width
      height = $entry.height
      tileSize = $TileSize
    }
  }
  $dialogs = @()
  foreach ($key in ($globalDialogById.Keys | Sort-Object)) {
    $dialogs += $globalDialogById[$key]
  }
  $mapIndexJson = ConvertTo-AsciiJson $mapIndex 6 -Compress
  $dialogsJson = ConvertTo-AsciiJson $dialogs 8 -Compress
  $mapFilesJson = ConvertTo-AsciiJson $mapFiles 4 -Compress
  $defaultMapId = if ($mapFiles.ContainsKey("PalletTown")) { "PalletTown" } elseif ($summary.Count -gt 0) { $summary[0].id } else { "default" }
  $worldScript = @"
(() => {
  const base = window.WORLD || {};
  const mapIndex = $mapIndexJson;
  const dialogs = $dialogsJson;
  const mapFiles = $mapFilesJson;
  const defaultMapId = "$defaultMapId";

  base.mapsFolder = "mapas";
  base.mapFiles = Object.assign({}, base.mapFiles || {}, mapFiles);
  base.mapIndex = mapIndex;
  base.dialogs = mergeDialogs(base.dialogs, dialogs);
  const hasMap = base.activeMapId && Object.prototype.hasOwnProperty.call(mapFiles, base.activeMapId);
  if (!hasMap) {
    base.activeMapId = defaultMapId;
  }
  window.WORLD = base;

  function mergeDialogs(existing, incoming) {
    const list = Array.isArray(existing) ? existing.slice() : [];
    const byId = {};
    list.forEach((dialog) => {
      if (!dialog || !dialog.id) {
        return;
      }
      byId[dialog.id] = dialog;
    });
    incoming.forEach((dialog) => {
      if (!dialog || !dialog.id) {
        return;
      }
      if (byId[dialog.id]) {
        byId[dialog.id] = Object.assign({}, byId[dialog.id], dialog);
      } else {
        byId[dialog.id] = dialog;
      }
    });
    return Object.keys(byId).map((id) => byId[id]);
  }
})();
"@
  $worldDir = Split-Path -Parent $WorldScriptPath
  if ($worldDir -and -not (Test-Path $worldDir -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $worldDir | Out-Null
  }
  $worldScript | Set-Content -Path $WorldScriptPath -Encoding ASCII
}

Write-Host ("Done. Maps: " + $summary.Count)
