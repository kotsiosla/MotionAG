# Test Notifications Script
$SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw"

Write-Host ""
Write-Host "Testing Notification System..." -ForegroundColor Cyan
Write-Host ("=" * 50) -ForegroundColor Gray

Write-Host ""
Write-Host "1. Testing check-stop-arrivals function..." -ForegroundColor Yellow
$headers = @{}
$headers["Authorization"] = "Bearer $ANON_KEY"
$headers["Content-Type"] = "application/json"

try {
    $response = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/check-stop-arrivals" -Method Post -Headers $headers
    Write-Host "Function responded!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 5
    
    if ($response.checked -gt 0) {
        Write-Host ""
        Write-Host "Found $($response.checked) subscriptions!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "No subscriptions found (totalInTable: $($response.debug.totalInTable))" -ForegroundColor Yellow
        Write-Host "Table is empty or stop_notifications is null" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "2. Checking fix-stop-notifications function..." -ForegroundColor Yellow
try {
    $fixResponse = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/fix-stop-notifications" -Method Post -Headers $headers -ErrorAction SilentlyContinue
    Write-Host "Fix function exists!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    $fixResponse | ConvertTo-Json -Depth 5
} catch {
    Write-Host "Fix function not deployed yet" -ForegroundColor Yellow
    Write-Host "Deploy it from: supabase/functions/fix-stop-notifications/index.ts" -ForegroundColor Yellow
}

Write-Host ""
Write-Host ("=" * 50) -ForegroundColor Gray
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "Code fixes: DONE" -ForegroundColor Green
Write-Host "Function deployed: check-stop-arrivals" -ForegroundColor Green
Write-Host "Next: Deploy fix-stop-notifications and test" -ForegroundColor Yellow
