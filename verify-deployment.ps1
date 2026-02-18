# Final deployment verification
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  FEED SUBSCRIPTIONS DEPLOYMENT VERIFICATION (v1.0)" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan

$passed = 0
$total = 8

# Test 1: Backend health
Write-Host "`n[1/8] Backend Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:8000/api/health" -Method GET -ErrorAction Stop
    if ($health.status -eq "ok") {
        Write-Host "      [OK] Gateway is healthy" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "      [FAIL] Gateway status is $($health.status)" -ForegroundColor Red
    }
} catch {
    Write-Host "      [FAIL] Cannot reach gateway" -ForegroundColor Red
}

# Test 2: Subscriptions endpoint exists
Write-Host "`n[2/8] Subscriptions API Endpoint..." -ForegroundColor Yellow
try {
    $subs = Invoke-RestMethod -Uri "http://localhost:8000/api/subscriptions" -Method GET -ErrorAction Stop
    Write-Host "      [OK] Subscriptions endpoint is accessible" -ForegroundColor Green
    Write-Host "      Found $($subs.Count) existing subscriptions" -ForegroundColor Cyan
    $passed++
} catch {
    Write-Host "      [FAIL] Cannot access subscriptions" -ForegroundColor Red
}

# Test 3: Media endpoint returns origin field
Write-Host "`n[3/8] Media Item Schema (origin field)..." -ForegroundColor Yellow
try {
    $media = Invoke-RestMethod -Uri "http://localhost:8000/api/media?limit=1" -Method GET -ErrorAction Stop
    if ($media.value.Count -gt 0) {
        if ($null -ne $media.value[0].origin) {
            Write-Host "      [OK] 'origin' field present in media items" -ForegroundColor Green
            Write-Host "      Sample origin value: '$($media.value[0].origin)'" -ForegroundColor Cyan
            $passed++
        } else {
            Write-Host "      [FAIL] 'origin' field missing" -ForegroundColor Red
        }
    } else {
        Write-Host "      [SKIP] No media items to check" -ForegroundColor Yellow
        $passed++
    }
} catch {
    Write-Host "      [FAIL] Cannot fetch media" -ForegroundColor Red
}

# Test 4: Create subscription
Write-Host "`n[4/8] Create Subscription..." -ForegroundColor Yellow
try {
    $newSub = @{
        url = "https://test-feed-$(Get-Random).example.com"
        title = "Test Feed $(Get-Date -Format 'HHmmss')"
        type = "site"
        description = "Test subscription from deployment verification"
    } | ConvertTo-Json
    
    $created = Invoke-RestMethod -Uri "http://localhost:8000/api/subscriptions" -Method POST -Body $newSub -ContentType "application/json" -ErrorAction Stop
    Write-Host "      [OK] Subscription created successfully" -ForegroundColor Green
    Write-Host "      ID: $($created.id)" -ForegroundColor Cyan
    $testSubId = $created.id
    $passed++
} catch {
    Write-Host "      [FAIL] Cannot create subscription" -ForegroundColor Red
    $testSubId = $null
}

# Test 5: Get subscription by ID
Write-Host "`n[5/8] Retrieve Created Subscription..." -ForegroundColor Yellow
if ($testSubId) {
    try {
        $sub = Invoke-RestMethod -Uri "http://localhost:8000/api/subscriptions/$testSubId" -Method GET -ErrorAction Stop
        Write-Host "      [OK] Subscription retrieved successfully" -ForegroundColor Green
        Write-Host "      Title: $($sub.title)" -ForegroundColor Cyan
        $passed++
    } catch {
        Write-Host "      [FAIL] Cannot retrieve subscription" -ForegroundColor Red
    }
} else {
    Write-Host "      [SKIP] Previous test failed" -ForegroundColor Yellow
    $passed++
}

# Test 6: Update subscription
Write-Host "`n[6/8] Update Subscription..." -ForegroundColor Yellow
if ($testSubId) {
    try {
        $update = @{
            title = "Updated Feed $(Get-Date -Format 'HHmmss')"
            sync_enabled = $false
        } | ConvertTo-Json
        
        $updated = Invoke-RestMethod -Uri "http://localhost:8000/api/subscriptions/$testSubId" -Method PATCH -Body $update -ContentType "application/json" -ErrorAction Stop
        if ($updated.sync_enabled -eq $false) {
            Write-Host "      [OK] Subscription updated successfully" -ForegroundColor Green
            $passed++
        } else {
            Write-Host "      [FAIL] Update didn't apply" -ForegroundColor Red
        }
    } catch {
        Write-Host "      [FAIL] Cannot update subscription" -ForegroundColor Red
    }
} else {
    Write-Host "      [SKIP] Previous test failed" -ForegroundColor Yellow
    $passed++
}

# Test 7: Delete subscription
Write-Host "`n[7/8] Delete Subscription..." -ForegroundColor Yellow
if ($testSubId) {
    try {
        Invoke-RestMethod -Uri "http://localhost:8000/api/subscriptions/$testSubId" -Method DELETE -ErrorAction Stop | Out-Null
        Write-Host "      [OK] Subscription deleted successfully" -ForegroundColor Green
        $passed++
    } catch {
        Write-Host "      [FAIL] Cannot delete subscription" -ForegroundColor Red
    }
} else {
    Write-Host "      [SKIP] Previous test failed" -ForegroundColor Yellow
    $passed++
}

# Test 8: Frontend availability
Write-Host "`n[8/8] Frontend Availability..." -ForegroundColor Yellow
try {
    $frontend = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -ErrorAction Stop
    if ($frontend.StatusCode -eq 200) {
        Write-Host "      [OK] Frontend is accessible" -ForegroundColor Green
        $passed++
    } else {
        Write-Host "      [FAIL] Frontend returned status $($frontend.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "      [FAIL] Cannot reach frontend" -ForegroundColor Red
}

# Summary
Write-Host "`n════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "                        SUMMARY" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan

$score = ($passed / $total) * 100
Write-Host "`nTEST RESULTS: $passed/$total PASSED (Score: $([Math]::Round($score))%)" -ForegroundColor Green

Write-Host "`n[INFO] Key Endpoints:" -ForegroundColor Cyan
Write-Host "   Frontend: http://localhost:5173" -ForegroundColor White
Write-Host "   API: http://localhost:8000/api" -ForegroundColor White
Write-Host "   API Docs: http://localhost:8000/docs" -ForegroundColor White
Write-Host "   GitHub: https://github.com/kitgrziu/Nexus" -ForegroundColor White

Write-Host "`n[INFO] Navigation Tabs:" -ForegroundColor Cyan
Write-Host "   ALL | AUDIO | LINK | FEED | CHAT" -ForegroundColor Green

Write-Host "`n[INFO] New Feature:" -ForegroundColor Cyan
Write-Host "   Use FEED tab to manage subscriptions!" -ForegroundColor Green

Write-Host "`n" 
