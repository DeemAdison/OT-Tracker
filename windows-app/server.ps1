param(
    [int]$Port = 53123,
    [string]$DistPath = "dist"
)

$listener = New-Object System.Net.HttpListener
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    $random = New-Object System.Random
    $Port = $random.Next(51000, 59000)
    $prefix = "http://127.0.0.1:$Port/"
    $listener.Prefixes.Clear()
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8";
    ".js"   = "application/javascript; charset=utf-8";
    ".mjs"  = "application/javascript; charset=utf-8";
    ".css"  = "text/css; charset=utf-8";
    ".json" = "application/json";
    ".png"  = "image/png";
    ".jpg"  = "image/jpeg";
    ".svg"  = "image/svg+xml";
    ".wasm" = "application/wasm";
    ".docx" = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    ".xlsx" = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}

$fullDist = (Resolve-Path $DistPath).Path

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        if ($request.RawUrl -eq "/__exit__") {
            $response.StatusCode = 200
            $response.Close()
            break
        }

        $relPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($relPath) -or $relPath -eq "/") {
            $relPath = "index.html"
        }

        $filePath = Join-Path $fullDist $relPath
        if (-not (Test-Path $filePath -PathType Leaf)) {
            $filePath = Join-Path $fullDist "index.html"
        }

        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }

        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentType = $mime
        $response.ContentLength64 = $bytes.Length
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Cache-Control", "no-cache")
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.OutputStream.Close()
    } catch {
        # continue loop
    }
}
$listener.Stop()
