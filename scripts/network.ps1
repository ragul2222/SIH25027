# Hyperledger Fabric Network Management Script for Ayurvedic Herb Traceability
# This script manages the complete network lifecycle

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("up", "down", "restart", "status")]
    [string]$Action
)

# Configuration
$NETWORK_NAME = "ayurveda-network"
$CHANNEL_NAME = "ayurveda-channel"
$CHAINCODE_NAME = "supply-chain"
$COMPOSE_FILE = "network/docker-compose.yml"

# Color functions for output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Error { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Step { param($msg) Write-Host "`n[STEP] $msg" -ForegroundColor Cyan }

function Show-NetworkStatus {
    Write-Step "Checking network status..."
    
    # Check if containers are running
    $containers = docker ps --filter "name=peer0" --filter "name=orderer" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    if ($containers) {
        Write-Success "[SUCCESS] Network containers running:"
        Write-Host $containers
        
        # Check network connectivity
        Write-Step "Testing network connectivity..."
        $networkExists = docker network ls --filter "name=$NETWORK_NAME" --format "{{.Name}}"
        if ($networkExists -eq $NETWORK_NAME) {
            Write-Success "[OK] Docker network '$NETWORK_NAME' exists"
        } else {
            Write-Error "[FAIL] Docker network '$NETWORK_NAME' not found"
        }
    } else {
        Write-Error "[FAIL] No network containers running"
    }
}

function Start-Network {
    Write-Step "Starting Hyperledger Fabric network..."
    
    # Navigate to project root
    Set-Location $PSScriptRoot\..
    
    # Check if Docker is running
    try {
        docker version | Out-Null
    } catch {
        Write-Error "[FAIL] Docker is not running. Please start Docker Desktop first."
        return
    }
    
    # Clean up any existing containers
    Write-Info "Cleaning up existing containers..."
    docker-compose -f $COMPOSE_FILE down -v --remove-orphans 2>$null
    
    # Start the network
    Write-Step "Starting containers..."
    try {
        docker-compose -f $COMPOSE_FILE up -d
        
        # Wait for containers to be ready
        Write-Info "Waiting for containers to initialize..."
        Start-Sleep -Seconds 10
        
        # Verify all containers are running
        $expectedContainers = @(
            "orderer.ayurveda-network.com",
            "peer0.farmer.ayurveda-network.com", 
            "peer0.processor.ayurveda-network.com",
            "peer0.lab.ayurveda-network.com",
            "peer0.distributor.ayurveda-network.com",
            "peer0.regulator.ayurveda-network.com",
            "cli"
        )
        
        $runningContainers = docker ps --format "{{.Names}}"
        $allRunning = $true
        
        foreach ($container in $expectedContainers) {
            if ($runningContainers -contains $container) {
                Write-Success "[OK] $container is running"
            } else {
                Write-Error "[FAIL] $container is not running"
                $allRunning = $false
            }
        }
        
        if ($allRunning) {
            Write-Success "`n[SUCCESS] All network containers started successfully!"
            Write-Info "Network is ready for channel creation and chaincode deployment."
        } else {
            Write-Error "`n[ERROR] Some containers failed to start. Check Docker logs."
        }
        
    } catch {
        Write-Error "[FAIL] Failed to start network: $($_.Exception.Message)"
    }
}

function Stop-Network {
    Write-Step "Stopping Hyperledger Fabric network..."
    
    Set-Location $PSScriptRoot\..
    
    try {
        docker-compose -f $COMPOSE_FILE down -v --remove-orphans
        
        # Clean up volumes and networks
        Write-Info "Cleaning up volumes and networks..."
        docker volume prune -f 2>$null
        docker network prune -f 2>$null
        
        Write-Success "[OK] Network stopped and cleaned up"
    } catch {
        Write-Error "[FAIL] Failed to stop network: $($_.Exception.Message)"
    }
}

function Restart-Network {
    Write-Step "Restarting network..."
    Stop-Network
    Start-Sleep -Seconds 5
    Start-Network
}

# Main execution
Write-Host "`nAyurvedic Herb Traceability - Network Management" -ForegroundColor Magenta
Write-Host "=================================================" -ForegroundColor Magenta

switch ($Action.ToLower()) {
    "up" { Start-Network }
    "down" { Stop-Network }  
    "restart" { Restart-Network }
    "status" { Show-NetworkStatus }
}

Write-Host "`nScript completed." -ForegroundColor Magenta