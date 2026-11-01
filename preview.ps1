# Local preview server — serves the site like GitHub Pages does,
# so clean URLs such as /events and /about work.
#
# Run from this folder:   powershell -ExecutionPolicy Bypass -File preview.ps1
# Then open:              http://localhost:8080/
# Stop with Ctrl+C.

param([int]$Port = 8080)

$root = $PSScriptRoot
$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.js' = 'application/javascript; charset=utf-8'; '.png' = 'image/png'
  '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'
  '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Previewing at http://localhost:$Port/  (Ctrl+C to stop)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/').Replace('/', '\')
      $status = 200

      # Resolve like GitHub Pages: exact file, then folder\index.html, then name.html
      $base = "$root\$path"
      $candidates = @($base, "$($base.TrimEnd('\'))\index.html", "$($base.TrimEnd('\')).html")
      $file = $candidates | Where-Object {
        (Test-Path -LiteralPath $_ -PathType Leaf) -and ([IO.Path]::GetFullPath($_)).StartsWith($root)
      } | Select-Object -First 1
      if (-not $file) { $file = "$root\404.html"; $status = 404 }

      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.StatusCode = $status
      $ctx.Response.ContentType = if ($types[$ext]) { $types[$ext] } else { 'application/octet-stream' }
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      Write-Host "$status /$path"
    } catch {
      $ctx.Response.StatusCode = 500
      Write-Host "500 $($ctx.Request.Url.AbsolutePath): $_"
    } finally {
      $ctx.Response.Close()
    }
  }
} finally {
  $listener.Stop()
}
