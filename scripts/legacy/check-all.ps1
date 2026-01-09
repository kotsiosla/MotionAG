# Comprehensive Check Script
Write-Host "`nCOMPREHENSIVE SYSTEM CHECK" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

# 1. Check dev server
Write-Host "`n1. Dev Server Status:" -ForegroundColor Yellow
$port = 8081
$listening = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($listening) {
    Write-Host "   [OK] Running on port $port" -ForegroundColor Green
} else {
    Write-Host "   [ERROR] NOT running" -ForegroundColor Red
}

# 2. Check .env file
Write-Host "`n2. Environment File:" -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "   [OK] .env exists" -ForegroundColor Green
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "VITE_SUPABASE_URL") {
        Write-Host "   [OK] VITE_SUPABASE_URL found" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] VITE_SUPABASE_URL missing" -ForegroundColor Red
    }
    if ($envContent -match "VITE_SUPABASE_PUBLISHABLE_KEY") {
        Write-Host "   [OK] VITE_SUPABASE_PUBLISHABLE_KEY found" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] VITE_SUPABASE_PUBLISHABLE_KEY missing" -ForegroundColor Red
    }
} else {
    Write-Host "   [ERROR] .env file NOT FOUND" -ForegroundColor Red
}

# 3. Test GTFS API
Write-Host "`n3. GTFS API Test:" -ForegroundColor Yellow
$SUPABASE_URL = "https://jftthfniwfarxyisszjh.supabase.co"
$ANON_KEY = $env:SUPABASE_ANON_KEY

try {
    $response = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/gtfs-proxy/vehicles?operator=all" -Headers @{"Authorization" = "Bearer $ANON_KEY"} -ErrorAction Stop
    $vehicleCount = if ($response.data) { $response.data.Count } else { 0 }
    Write-Host "   [OK] API responding: $vehicleCount vehicles" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] API error: $($_.Exception.Message)" -ForegroundColor Red
}

# 4. Test trips endpoint
Write-Host "`n4. Trips Endpoint:" -ForegroundColor Yellow
try {
    $trips = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/gtfs-proxy/trips?operator=all" -Headers @{"Authorization" = "Bearer $ANON_KEY"} -ErrorAction Stop
    $tripCount = if ($trips.data) { $trips.data.Count } else { 0 }
    Write-Host "   [OK] Trips: $tripCount" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 5. Test routes endpoint
Write-Host "`n5. Routes Endpoint:" -ForegroundColor Yellow
try {
    $routes = Invoke-RestMethod -Uri "$SUPABASE_URL/functions/v1/gtfs-proxy/routes?operator=all" -Headers @{"Authorization" = "Bearer $ANON_KEY"} -ErrorAction Stop
    $routeCount = if ($routes.data) { $routes.data.Count } else { 0 }
    Write-Host "   [OK] Routes: $routeCount" -ForegroundColor Green
} catch {
    Write-Host "   [ERROR] Error: $($_.Exception.Message)" -ForegroundColor Red
}

# 6. Open browser
Write-Host "`n6. Browser:" -ForegroundColor Yellow
Start-Process "http://localhost:8081/" | Out-Null
Write-Host "   [OK] Opened http://localhost:8081/" -ForegroundColor Green

Write-Host "`n" + ("=" * 50) -ForegroundColor Gray
Write-Host "`n[OK] CHECK COMPLETE" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "   1. Check browser at http://localhost:8081/" -ForegroundColor White
Write-Host "   2. Press F12 to open console" -ForegroundColor White
Write-Host "   3. Look for buses on the map" -ForegroundColor White
Write-Host "   4. Check for any red errors in console" -ForegroundColor White

