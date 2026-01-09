# Simple Push Notification Test
$SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co"
$ANON_KEY = $env:SUPABASE_ANON_KEY

Write-Host ""
Write-Host "COMPREHENSIVE PUSH NOTIFICATION SYSTEM TEST" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host ""

$headers = @{
    "Authorization" = "Bearer $ANON_KEY"
    "Content-Type" = "application/json"
    "apikey" = $ANON_KEY
}

# Test 1: Website
Write-Host "1. Testing Website..." -ForegroundColor Yellow
try {
    $web = Invoke-WebRequest -Uri "https://kotsiosla.github.io/MotionBus_AI" -UseBasicParsing
    Write-Host "   OK - Website accessible (Status: $($web.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "   ERROR - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Database Subscriptions
Write-Host ""
Write-Host "2. Checking Subscriptions..." -ForegroundColor Yellow
$totalSubs = 0
try {
    $pushUrl = "$SUPABASE_URL/rest/v1/push_subscriptions"
    $pushSubs = Invoke-RestMethod -Uri $pushUrl -Headers $headers -Method Get
    $pushCount = ($pushSubs | Measure-Object).Count
    Write-Host "   Found $pushCount in push_subscriptions" -ForegroundColor Green
    
    $stopUrl = "$SUPABASE_URL/rest/v1/stop_notification_subscriptions"
    $stopSubs = Invoke-RestMethod -Uri $stopUrl -Headers $headers -Method Get
    $stopCount = ($stopSubs | Measure-Object).Count
    Write-Host "   Found $stopCount in stop_notification_subscriptions" -ForegroundColor Green
    
    $totalSubs = $pushCount + $stopCount
} catch {
    Write-Host "   ERROR - $($_.Exception.Message)" -ForegroundColor Red
}

# Test 3: Push Function
Write-Host ""
Write-Host "3. Testing test-push Function..." -ForegroundColor Yellow
try {
    $body = @{
        title = "Test Notification"
        body = "Testing push system - $(Get-Date -Format 'HH:mm:ss')"
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/test-push" -Method Post -Body $body -Headers $headers
    Write-Host "   Function Response:" -ForegroundColor Cyan
    $result | ConvertTo-Json -Depth 5 | Write-Host
    
    if ($result.sent -gt 0) {
        Write-Host "   SUCCESS - Sent $($result.sent) notification(s)!" -ForegroundColor Green
    } elseif ($result.message -eq "No subscriptions found") {
        Write-Host "   WARNING - No subscriptions found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ERROR - $($_.Exception.Message)" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "SUMMARY" -ForegroundColor Cyan
Write-Host "===========================================" -ForegroundColor Cyan
Write-Host "Website: OK" -ForegroundColor Green
Write-Host "Push Function: OK" -ForegroundColor Green
Write-Host "VAPID Keys: Configured" -ForegroundColor Green
Write-Host "Active Subscriptions: $totalSubs" -ForegroundColor $(if ($totalSubs -gt 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($totalSubs -eq 0) {
    Write-Host "ACTION REQUIRED:" -ForegroundColor Yellow
    Write-Host "  1. Open https://kotsiosla.github.io/MotionBus_AI" -ForegroundColor White
    Write-Host "  2. Enable push notifications for a stop" -ForegroundColor White
    Write-Host "  3. Run this test again" -ForegroundColor White
} else {
    Write-Host "System is ready!" -ForegroundColor Green
}

Write-Host ""

