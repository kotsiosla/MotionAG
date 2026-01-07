# Check Cron Job Status and Subscriptions
$SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co"
$ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmdHRoZm5pd2Zhcnh5aXNzempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MDkzMjEsImV4cCI6MjA4MzI4NTMyMX0.gPUAizcb955wy6-c_krSAx00_0VNsZc4J3C0I2tmrnw"

$headers = @{
    "Authorization" = "Bearer $ANON_KEY"
    "apikey" = $ANON_KEY
    "Content-Type" = "application/json"
}

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  CRON JOB & SUBSCRIPTIONS STATUS CHECK" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# 1. Check stop_notification_subscriptions
Write-Host "1. Checking stop_notification_subscriptions..." -ForegroundColor Yellow
try {
    $subsResponse = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/stop_notification_subscriptions?select=*" -Method Get -Headers $headers
    Write-Host "   Found $($subsResponse.Count) subscription(s)" -ForegroundColor Cyan
    
    if ($subsResponse.Count -gt 0) {
        $enabledCount = 0
        foreach ($sub in $subsResponse) {
            if ($sub.stop_notifications -and $sub.stop_notifications.Count -gt 0) {
                $enabled = $sub.stop_notifications | Where-Object { $_.enabled -eq $true -and $_.push -eq $true }
                if ($enabled.Count -gt 0) {
                    $enabledCount++
                    Write-Host "   ✅ Subscription has $($enabled.Count) enabled stop notification(s)" -ForegroundColor Green
                    foreach ($notif in $enabled) {
                        Write-Host "      - Stop: $($notif.stopName) ($($notif.stopId)), Before: $($notif.beforeMinutes) min" -ForegroundColor White
                    }
                }
            }
        }
        if ($enabledCount -eq 0) {
            Write-Host "   ⚠️ No enabled stop notifications found" -ForegroundColor Yellow
        }
    } else {
        Write-Host "   ⚠️ No subscriptions found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 2. Test check-stop-arrivals function
Write-Host "2. Testing check-stop-arrivals function..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/check-stop-arrivals" -Method Post -Headers $headers
    Write-Host "   Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 5 | Write-Host
    
    if ($response.sent -gt 0) {
        Write-Host "   ✅ Sent $($response.sent) notification(s)!" -ForegroundColor Green
    } elseif ($response.reason -eq "no_trips") {
        Write-Host "   ⚠️ No trips found (this is normal if no buses are running)" -ForegroundColor Yellow
    } else {
        Write-Host "   ⚠️ No notifications sent" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# 3. Check if cron job exists (requires SQL query)
Write-Host "3. Cron Job Status:" -ForegroundColor Yellow
Write-Host "   ⚠️ Cannot check cron job status via API" -ForegroundColor Yellow
Write-Host "   → Go to Supabase Dashboard > Database > SQL Editor" -ForegroundColor White
Write-Host "   → Run: SELECT * FROM cron.job WHERE jobname = 'check-stop-arrivals';" -ForegroundColor White
Write-Host ""

# 4. Summary
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  SUMMARY" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "To enable background notifications:" -ForegroundColor Green
Write-Host "1. Ensure cron job is scheduled (see migration file)" -ForegroundColor White
Write-Host "2. Ensure subscriptions have enabled stop notifications" -ForegroundColor White
Write-Host "3. Ensure gtfs-proxy returns trip data" -ForegroundColor White
Write-Host ""


