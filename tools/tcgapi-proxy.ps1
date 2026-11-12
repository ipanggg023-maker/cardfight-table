# Local relay for TCG API (https://tcgapi.dev).
# The API does not allow calls straight from web pages, so the editor talks to this
# relay on your own computer, and the relay forwards the request to api.tcgapi.dev.
# Only listens on localhost and only forwards /v1/... paths. Close the window to stop.

$ErrorActionPreference = "Stop"
$port = 8787
Add-Type -AssemblyName System.Net.Http
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try { $listener.Start() } catch {
  Write-Host "Could not start on port $port. Is the relay already running in another window?" -ForegroundColor Red
  Read-Host "Press Enter to close"; exit 1
}
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(30)

Write-Host ""
Write-Host "  TCG API relay is running at http://localhost:$port" -ForegroundColor Green
Write-Host "  Keep this window open while you import cards. Close it to stop."
Write-Host ""

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $req = $ctx.Request
  $res = $ctx.Response
  $res.Headers.Add("Access-Control-Allow-Origin", "*")
  $res.Headers.Add("Access-Control-Allow-Headers", "X-API-Key, Content-Type")
  $res.Headers.Add("Access-Control-Allow-Methods", "GET, OPTIONS")
  $res.Headers.Add("Access-Control-Allow-Private-Network", "true")
  try {
    if ($req.HttpMethod -eq "OPTIONS") { $res.StatusCode = 204; $res.Close(); continue }
    $path = $req.Url.PathAndQuery
    if ($req.HttpMethod -ne "GET" -or -not $path.StartsWith("/v1/")) {
      $res.StatusCode = 404; $res.Close(); continue
    }
    $msg = New-Object System.Net.Http.HttpRequestMessage([System.Net.Http.HttpMethod]::Get, "https://api.tcgapi.dev$path")
    $key = $req.Headers["X-API-Key"]
    if ($key) { [void]$msg.Headers.TryAddWithoutValidation("X-API-Key", $key) }
    $up = $client.SendAsync($msg).GetAwaiter().GetResult()
    $bytes = $up.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
    $res.StatusCode = [int]$up.StatusCode
    $res.ContentType = "application/json; charset=utf-8"
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
    Write-Host ("{0}  {1}  {2}" -f (Get-Date -Format "HH:mm:ss"), [int]$up.StatusCode, ($path -replace "\?.*$", ""))
  } catch {
    $res.StatusCode = 502
    $text = '{"error":"Relay could not reach tcgapi.dev: ' + ($_.Exception.Message -replace '"', "'") + '"}'
    $b = [Text.Encoding]::UTF8.GetBytes($text)
    $res.OutputStream.Write($b, 0, $b.Length)
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
  }
  $res.Close()
}
