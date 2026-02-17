# Clean Docker environment
Write-Host "Stopping all containers..." -ForegroundColor Cyan
docker compose down -v --remove-orphans

Write-Host "Removing nexus images..." -ForegroundColor Cyan  
docker rmi nexus-frontend 2>$null
docker rmi nexus-gateway 2>$null
docker rmi nexus-worker 2>$null

Write-Host "Waiting 3 seconds..." -ForegroundColor Cyan
Start-Sleep -Seconds 3

Write-Host "Starting fresh..." -ForegroundColor Green
docker compose up -d

Write-Host "Waiting for services..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "Status:" -ForegroundColor Green
docker compose ps
