Add-Type -AssemblyName System.Drawing

$iconDir = "docs/icons"
if (-not (Test-Path $iconDir)) {
    New-Item -ItemType Directory -Force -Path $iconDir | Out-Null
}

function Create-SituriIcon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

    $rect = New-Object System.Drawing.Rectangle 0, 0, $size, $size
    $color1 = [System.Drawing.ColorTranslator]::FromHtml('#195de6')
    $color2 = [System.Drawing.ColorTranslator]::FromHtml('#0d3ba8')
    $brushBg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $color1, $color2, 45.0)
    $g.FillRectangle($brushBg, $rect)

    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 255, 255, 255), [float]($size * 0.03))
    $innerPad = [int]($size * 0.08)
    $g.DrawEllipse($pen, $innerPad, $innerPad, ($size - 2 * $innerPad), ($size - 2 * $innerPad))

    $fontSize = [float]($size * 0.52)
    $font = New-Object System.Drawing.Font('Arial', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $brushText = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center

    $g.DrawString('S', $font, $brushText, ($size / 2.0), (($size / 2.0) - ($size * 0.02)), $sf)

    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created $path"
}

Create-SituriIcon 192 "docs/icons/icon-192.png"
Create-SituriIcon 512 "docs/icons/icon-512.png"
