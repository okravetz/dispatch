# Test Claude API access via Netlify function
$body = @{
    model = "claude-3-haiku-20240307"
    max_tokens = 100
    messages = @(
        @{
            role = "user"
            content = "Hello, Claude! Please respond with just the word 'test'."
        }
    )
} | ConvertTo-Json

Write-Host "KEY PREFIX: $($env:ANTHROPIC_API_KEY.Substring(0, 10))"

try {
    $response = Invoke-WebRequest -Uri "http://localhost:8888/.netlify/functions/claude" -Method POST -Body $body -ContentType "application/json"
    Write-Host "Status Code: $($response.StatusCode)"
    Write-Host "Response:"
    Write-Host $response.Content
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        Write-Host "Status Code: $($_.Exception.Response.StatusCode)"
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody"
    }
}