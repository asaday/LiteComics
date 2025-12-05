# Generate 16x16 ICO format systray icon for Windows
param(
    [string]$InputPng = "icon.png"
)

Add-Type -AssemblyName System.Drawing

# Load source image
$sourceImage = [System.Drawing.Image]::FromFile((Resolve-Path $InputPng))

# Create 16x16 version for Windows systray
$bitmap = New-Object System.Drawing.Bitmap 16, 16
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.DrawImage($sourceImage, 0, 0, 16, 16)

# Save to temporary ICO (need to use Icon class)
$tempIco = [System.IO.Path]::GetTempFileName() + ".ico"

# Convert bitmap to icon
$ms = New-Object System.IO.MemoryStream
$bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$ms.Position = 0

# Create icon from bitmap (Windows native ICO format)
# We need to create a proper ICO file structure manually
$icoHeader = [byte[]]@(0x00, 0x00, 0x01, 0x00, 0x01, 0x00) # ICO header + 1 image
$icoEntry = [byte[]]@(
    0x10, # width (16)
    0x10, # height (16)
    0x00, # color palette (0 = no palette)
    0x00, # reserved
    0x01, 0x00, # color planes
    0x20, 0x00, # bits per pixel (32)
    0x00, 0x00, 0x00, 0x00, # image size (placeholder)
    0x16, 0x00, 0x00, 0x00  # image offset (22 bytes)
)

# Create BITMAPINFOHEADER + image data
$bih = [byte[]]@(
    0x28, 0x00, 0x00, 0x00, # header size (40)
    0x10, 0x00, 0x00, 0x00, # width (16)
    0x20, 0x00, 0x00, 0x00, # height (32, doubled for ICO)
    0x01, 0x00, # planes
    0x20, 0x00, # bits per pixel (32)
    0x00, 0x00, 0x00, 0x00, # compression (0 = none)
    0x00, 0x00, 0x00, 0x00, # image size (can be 0)
    0x00, 0x00, 0x00, 0x00, # X pixels per meter
    0x00, 0x00, 0x00, 0x00, # Y pixels per meter
    0x00, 0x00, 0x00, 0x00, # colors used
    0x00, 0x00, 0x00, 0x00  # important colors
)

# Get pixel data (BGRA format, bottom-up)
$pixelData = New-Object System.Collections.Generic.List[byte]
for ($y = 15; $y -ge 0; $y--) {
    for ($x = 0; $x -lt 16; $x++) {
        $pixel = $bitmap.GetPixel($x, $y)
        $pixelData.Add($pixel.B)
        $pixelData.Add($pixel.G)
        $pixelData.Add($pixel.R)
        $pixelData.Add($pixel.A)
    }
}

# AND mask (all zeros for 32-bit icons with alpha)
$andMask = [byte[]]@(0) * 64 # 16x16 / 8 = 32 bytes, padded to 64

# Combine all parts
$imageData = $bih + $pixelData.ToArray() + $andMask
$imageSize = $imageData.Length

# Update image size in ICO entry
$icoEntry[8] = [byte]($imageSize -band 0xFF)
$icoEntry[9] = [byte](($imageSize -shr 8) -band 0xFF)
$icoEntry[10] = [byte](($imageSize -shr 16) -band 0xFF)
$icoEntry[11] = [byte](($imageSize -shr 24) -band 0xFF)

# Write ICO file
$icoBytes = $icoHeader + $icoEntry + $imageData
$icoPath = Join-Path $PSScriptRoot "icon.ico"
[System.IO.File]::WriteAllBytes($icoPath, $icoBytes)

Write-Host "Generated icon.ico with $($icoBytes.Length) bytes (ICO format)"

# Generate platform-specific Go files
$darwinGoPath = Join-Path $PSScriptRoot "..\icon_darwin.go"
$darwinGoContent = @"
//go:build darwin && !cui

package main

import _ "embed"

//go:embed icons/icon.icns
var iconBytes []byte
"@
Set-Content -Path $darwinGoPath -Value $darwinGoContent -Encoding UTF8
Write-Host "Generated icon_darwin.go"

$windowsGoPath = Join-Path $PSScriptRoot "..\icon_windows.go"
$windowsGoContent = @"
//go:build windows && !cui

package main

import _ "embed"

//go:embed icons/icon.ico
var iconBytes []byte
"@
Set-Content -Path $windowsGoPath -Value $windowsGoContent -Encoding UTF8
Write-Host "Generated icon_windows.go"

Write-Host ""
Write-Host "Icons are now embedded via go:embed directives"
$graphics.Dispose()
$bitmap.Dispose()
$sourceImage.Dispose()
