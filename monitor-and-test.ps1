# Monitor subscriptions and test push notifications
$SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw"

$headers = @{
    "Authorization" = "Bearer $ANON_KEY"
    "apikey" = $ANON_KEY
}

function Check-Subscriptions {
    try {
        $pushSubs = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/push_subscriptions" -Headers $headers -Method Get -ErrorAction SilentlyContinue
        $stopSubs = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/stop_notification_subscriptions" -Headers $headers -Method Get -ErrorAction SilentlyContinue
        $pushCount = ($pushSubs | Measure-Object).Count
        $stopCount = ($stopSubs | Measure-Object).Count
        return @{
            PushCount = $pushCount
            StopCount = $stopCount
            Total = $pushCount + $stopCount
        }
    } catch {
        return @{ PushCount = 0; StopCount = 0; Total = 0 }
    }
}

function Test-Push {
    param($Title = "Test Notification", $Body = "Testing push notifications!")
    
    $body = @{
        title = $Title
        body = $Body
    } | ConvertTo-Json
    
    $pushHeaders = $headers.Clone()
    $pushHeaders["Content-Type"] = "application/json"
    
    try {
        $result = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/test-push" -Method Post -Body $body -Headers $pushHeaders
        return $result
    } catch {
        return @{ sent = 0; failed = 1; error = $_.Exception.Message }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SUBSCRIPTION MONITOR & TEST" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Initial check
$stats = Check-Subscriptions
Write-Host "Current Status:" -ForegroundColor Yellow
Write-Host "  push_subscriptions: $($stats.PushCount)" -ForegroundColor White
Write-Host "  stop_notification_subscriptions: $($stats.StopCount)" -ForegroundColor White
Write-Host "  Total: $($stats.Total)" -ForegroundColor $(if ($stats.Total -gt 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($stats.Total -gt 0) {
    Write-Host "SUBSCRIPTIONS FOUND! Testing push notification..." -ForegroundColor Green
    Write-Host ""
    $result = Test-Push -Title "Test from Monitor" -Body "You should receive this notification!"
    Write-Host "Result:" -ForegroundColor Cyan
    $result | ConvertTo-Json -Depth 5 | Write-Host
    Write-Host ""
    if ($result.sent -gt 0) {
        Write-Host "SUCCESS! Sent $($result.sent) notification(s)!" -ForegroundColor Green
    } else {
        Write-Host "No notifications sent. Check errors above." -ForegroundColor Yellow
    }
} else {
    Write-Host "No subscriptions found." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To create a subscription:" -ForegroundColor Cyan
    Write-Host "1. Go to https://kotsiosla.github.io/MotionBus_AI" -ForegroundColor White
    Write-Host "2. Enable notifications for a stop" -ForegroundColor White
    Write-Host "3. Run this script again to check" -ForegroundColor White
    Write-Host ""
    Write-Host "Or run: .\monitor-and-test.ps1" -ForegroundColor Cyan
}

Write-Host ""

