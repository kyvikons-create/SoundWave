Add-Type -AssemblyName System.Drawing
$dir = $PSScriptRoot

function Make-Icon([int]$s, [string]$outPath, [int]$c1r, [int]$c1g, [int]$c1b, [int]$c2r, [int]$c2g, [int]$c2b) {
    $bmp = New-Object System.Drawing.Bitmap($s, $s)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $rect = New-Object System.Drawing.Rectangle(0, 0, $s, $s)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,
        [System.Drawing.Color]::FromArgb(255, $c1r, $c1g, $c1b),
        [System.Drawing.Color]::FromArgb(255, $c2r, $c2g, $c2b), 45)
    $g.FillRectangle($brush, $rect)
    $white = [System.Drawing.Brushes]::White
    $k = $s / 256.0
    function Ell([single]$x, [single]$y, [single]$w, [single]$h) {
        $g.FillEllipse($white, ($x * $k), ($y * $k), ($w * $k), ($h * $k))
    }
    Ell 62 122 132 58
    Ell 78 84 74 74
    Ell 106 62 88 88
    Ell 148 94 62 62
    $g.Dispose()
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "иконка: $outPath"
}

foreach ($s in 120, 180) {
    Make-Icon $s (Join-Path $dir "icon$s.png") 232 58 0 255 149 0
    Make-Icon $s (Join-Path $dir "alt-blue-$s.png") 10 132 255 122 215 255
    Make-Icon $s (Join-Path $dir "alt-pink-$s.png") 255 55 95 255 143 163
    Make-Icon $s (Join-Path $dir "alt-green-$s.png") 48 209 88 138 255 181
}
