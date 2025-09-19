# Channel Management Script for Ayurvedic Herb Traceability Network
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("create", "join", "info", "test")]
    [string]$Action
)

# Configuration
$CHANNEL_NAME = "ayurveda-channel"
$ORDERER_URL = "orderer.ayurveda-network.com:7050"
$ORDERER_TLS_CA = "/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/ayurveda-network.com/orderers/orderer.ayurveda-network.com/msp/tlscacerts/tlsca.ayurveda-network.com-cert.pem"

# Organization configurations
$ORGANIZATIONS = @{
    "farmer" = @{
        "peer" = "peer0.farmer.ayurveda-network.com:7051"
        "mspid" = "FarmerMSP"
        "tlsca" = "/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/farmer.ayurveda-network.com/peers/peer0.farmer.ayurveda-network.com/tls/ca.crt"
    }
    "processor" = @{
        "peer" = "peer0.processor.ayurveda-network.com:9051"
        "mspid" = "ProcessorMSP"
        "tlsca" = "/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/processor.ayurveda-network.com/peers/peer0.processor.ayurveda-network.com/tls/ca.crt"
    }
    "lab" = @{
        "peer" = "peer0.lab.ayurveda-network.com:11051"
        "mspid" = "LabMSP"
        "tlsca" = "/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/lab.ayurveda-network.com/peers/peer0.lab.ayurveda-network.com/tls/ca.crt"
    }
    "distributor" = @{
        "peer" = "peer0.distributor.ayurveda-network.com:13051"
        "mspid" = "DistributorMSP"
        "tlsca" = "/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/distributor.ayurveda-network.com/peers/peer0.distributor.ayurveda-network.com/tls/ca.crt"
    }
    "regulator" = @{
        "peer" = "peer0.regulator.ayurveda-network.com:15051"
        "mspid" = "RegulatorMSP"
        "tlsca" = "/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/regulator.ayurveda-network.com/peers/peer0.regulator.ayurveda-network.com/tls/ca.crt"
    }
}

function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Error { param($msg) Write-Host $msg -ForegroundColor Red }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Step { param($msg) Write-Host "`n🔹 $msg" -ForegroundColor Cyan }

function Test-NetworkConnectivity {
    Write-Step "Testing network connectivity..."
    
    # Check if CLI container is running
    $cliRunning = docker ps --filter "name=cli" --format "{{.Names}}"
    if ($cliRunning -ne "cli") {
        Write-Error "❌ CLI container is not running. Please start the network first."
        return $false
    }
    
    Write-Success "✅ CLI container is running"
    return $true
}

function Invoke-DockerExec {
    param($Command)
    
    Write-Host "Executing: $Command" -ForegroundColor DarkGray
    $result = docker exec cli bash -c $Command 2>&1
    return $result
}

function Create-Channel {
    Write-Step "Creating channel '$CHANNEL_NAME'..."
    
    if (-not (Test-NetworkConnectivity)) { return }
    
    # Create channel configuration transaction
    $configtxCommand = @"
configtxgen -profile AyurvedaChannel -outputCreateChannelTx /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/$CHANNEL_NAME.tx -channelID $CHANNEL_NAME
"@
    
    Write-Info "Generating channel configuration transaction..."
    $configResult = Invoke-DockerExec $configtxCommand
    Write-Host $configResult
    
    # Create the channel
    $createChannelCommand = @"
peer channel create -o $ORDERER_URL --ordererTLSHostnameOverride orderer.ayurveda-network.com -c $CHANNEL_NAME -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/$CHANNEL_NAME.tx --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/$CHANNEL_NAME.block --tls --cafile $ORDERER_TLS_CA
"@
    
    Write-Info "Creating channel..."
    $createResult = Invoke-DockerExec $createChannelCommand
    Write-Host $createResult
    
    if ($createResult -like "*successfully*" -or $createResult -like "*created*") {
        Write-Success "✅ Channel '$CHANNEL_NAME' created successfully"
    } else {
        Write-Error "❌ Failed to create channel. Output: $createResult"
    }
}

function Join-AllPeers {
    Write-Step "Joining all peers to channel '$CHANNEL_NAME'..."
    
    if (-not (Test-NetworkConnectivity)) { return }
    
    foreach ($org in $ORGANIZATIONS.Keys) {
        $orgConfig = $ORGANIZATIONS[$org]
        
        Write-Info "Joining $org peer to channel..."
        
        # Set environment variables for the organization
        $envVars = @"
export CORE_PEER_LOCALMSPID=$($orgConfig.mspid)
export CORE_PEER_TLS_ROOTCERT_FILE=$($orgConfig.tlsca)  
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/$org.ayurveda-network.com/users/Admin@$org.ayurveda-network.com/msp
export CORE_PEER_ADDRESS=$($orgConfig.peer)
"@
        
        $joinCommand = @"
$envVars
peer channel join -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/$CHANNEL_NAME.block
"@
        
        $joinResult = Invoke-DockerExec $joinCommand
        Write-Host $joinResult
        
        if ($joinResult -like "*successfully*" -or $joinResult -like "*joined*") {
            Write-Success "✅ $org peer joined channel successfully"
        } else {
            Write-Error "❌ Failed to join $org peer to channel"
        }
    }
}

function Show-ChannelInfo {
    Write-Step "Getting channel information..."
    
    if (-not (Test-NetworkConnectivity)) { return }
    
    # List channels
    $listChannelsCommand = @"
export CORE_PEER_LOCALMSPID=FarmerMSP
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/farmer.ayurveda-network.com/peers/peer0.farmer.ayurveda-network.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/farmer.ayurveda-network.com/users/Admin@farmer.ayurveda-network.com/msp
export CORE_PEER_ADDRESS=peer0.farmer.ayurveda-network.com:7051
peer channel list
"@
    
    Write-Info "Listing channels on farmer peer..."
    $listResult = Invoke-DockerExec $listChannelsCommand
    Write-Host $listResult
    
    # Get channel info
    $channelInfoCommand = @"
export CORE_PEER_LOCALMSPID=FarmerMSP
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/farmer.ayurveda-network.com/peers/peer0.farmer.ayurveda-network.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/farmer.ayurveda-network.com/users/Admin@farmer.ayurveda-network.com/msp
export CORE_PEER_ADDRESS=peer0.farmer.ayurveda-network.com:7051
peer channel getinfo -c $CHANNEL_NAME
"@
    
    Write-Info "Getting channel info..."
    $infoResult = Invoke-DockerExec $channelInfoCommand
    Write-Host $infoResult
}

function Test-PeerConnectivity {
    Write-Step "Testing peer connectivity and ledger access..."
    
    if (-not (Test-NetworkConnectivity)) { return }
    
    # Test farmer peer
    Write-Info "Testing Farmer Node connectivity..."
    $farmerTestCommand = @"
export CORE_PEER_LOCALMSPID=FarmerMSP
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/farmer.ayurveda-network.com/peers/peer0.farmer.ayurveda-network.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/farmer.ayurveda-network.com/users/Admin@farmer.ayurveda-network.com/msp
export CORE_PEER_ADDRESS=peer0.farmer.ayurveda-network.com:7051
peer channel getinfo -c $CHANNEL_NAME
"@
    
    $farmerResult = Invoke-DockerExec $farmerTestCommand
    if ($farmerResult -like "*height*") {
        Write-Success "✅ Farmer Node can query the ledger"
    } else {
        Write-Error "❌ Farmer Node cannot query the ledger"
    }
    
    # Test regulator peer  
    Write-Info "Testing Regulator Node connectivity..."
    $regulatorTestCommand = @"
export CORE_PEER_LOCALMSPID=RegulatorMSP
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/regulator.ayurveda-network.com/peers/peer0.regulator.ayurveda-network.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/regulator.ayurveda-network.com/users/Admin@regulator.ayurveda-network.com/msp
export CORE_PEER_ADDRESS=peer0.regulator.ayurveda-network.com:15051
peer channel getinfo -c $CHANNEL_NAME
"@
    
    $regulatorResult = Invoke-DockerExec $regulatorTestCommand
    if ($regulatorResult -like "*height*") {
        Write-Success "✅ Regulator Node can query the ledger"
    } else {
        Write-Error "❌ Regulator Node cannot query the ledger"
    }
    
    Write-Success "`n🎉 Peer connectivity tests completed!"
}

# Main execution
Write-Host "`n📡 Channel Management for Ayurvedic Herb Traceability" -ForegroundColor Magenta
Write-Host "=======================================================" -ForegroundColor Magenta

switch ($Action.ToLower()) {
    "create" { Create-Channel }
    "join" { Join-AllPeers }
    "info" { Show-ChannelInfo }
    "test" { Test-PeerConnectivity }
}