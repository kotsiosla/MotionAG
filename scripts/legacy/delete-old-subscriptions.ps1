# Delete old subscriptions that don't match current VAPID keys
$SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co"
$ANON_KEY = $env:SUPABASE_ANON_KEY

$headers = @{
    "Authorization" = "Bearer $ANON_KEY"
    "apikey" = $ANON_KEY
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host "  DELETING OLD SUBSCRIPTIONS" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""

# Get all subscriptions
try {
    $pushSubs = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/push_subscriptions" -Headers $headers -Method Get
    $stopSubs = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/stop_notification_subscriptions" -Headers $headers -Method Get
    
    $pushCount = ($pushSubs | Measure-Object).Count
    $stopCount = ($stopSubs | Measure-Object).Count
    
    Write-Host "Found $pushCount push subscriptions" -ForegroundColor Cyan
    Write-Host "Found $stopCount stop notification subscriptions" -ForegroundColor Cyan
    Write-Host ""
    
    # Delete all push subscriptions
    if ($pushCount -gt 0) {
        Write-Host "Deleting push subscriptions..." -ForegroundColor Yellow
        foreach ($sub in $pushSubs) {
            try {
                Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/push_subscriptions?id=eq.$($sub.id)" -Headers $headers -Method Delete | Out-Null
                Write-Host "  ✓ Deleted push subscription $($sub.id)" -ForegroundColor Green
            } catch {
                Write-Host "  ✗ Failed to delete $($sub.id): $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    
    # Delete all stop notification subscriptions
    if ($stopCount -gt 0) {
        Write-Host "Deleting stop notification subscriptions..." -ForegroundColor Yellow
        foreach ($sub in $stopSubs) {
            try {
                Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/stop_notification_subscriptions?id=eq.$($sub.id)" -Headers $headers -Method Delete | Out-Null
                Write-Host "  ✓ Deleted stop subscription $($sub.id)" -ForegroundColor Green
            } catch {
                Write-Host "  ✗ Failed to delete $($sub.id): $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  ✅ ALL OLD SUBSCRIPTIONS DELETED" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Make sure frontend is deployed with VAPID key:" -ForegroundColor White
    Write-Host "     BM5pROt5d4ceUeGjvlpk4SmlEEBbe4lKQ0B2xVcyjU1VbObEex87ohRSlOCxMQJEF6zJYonkbLOIrH0k04xNEAc" -ForegroundColor Gray
    Write-Host "  2. Go to https://kotsiosla.github.io/MotionBus_AI" -ForegroundColor White
    Write-Host "  3. Hard refresh (Ctrl+Shift+R) to get latest code" -ForegroundColor White
    Write-Host "  4. Enable notifications for a stop" -ForegroundColor White
    Write-Host "  5. Run: .\test-push-simple.ps1" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
}

