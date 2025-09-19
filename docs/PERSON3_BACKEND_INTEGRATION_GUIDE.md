# Person 3 - Backend Developer Integration Guide
## Application & Integration Layer Documentation

---

## 🎯 Role Overview

**Person 3 - Backend Developer** is responsible for building the **Application & Integration Layer** that connects various external systems, services, and data sources with the blockchain core. This layer handles APIs, microservices, off-chain storage, IoT/SMS integration, ERP connectors, and reporting & analytics.

### 🔗 Your Integration Points

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    YOUR LAYER   │    │   Blockchain    │
│   Apps/Web      │◄──►│   Integration   │◄──►│   (Person 1)    │
│  (Person 2)     │    │   & APIs        │    │   Core Layer    │
└─────────────────┘    │   (Person 3)    │    └─────────────────┘
                       └─────────────────┘
                              ▲ ▼
                    ┌─────────────────┐
                    │   External      │
                    │   Systems       │
                    │ • IoT Devices   │
                    │ • SMS Gateway   │
                    │ • ERP Systems   │
                    │ • File Storage  │
                    │ • Analytics DB  │
                    └─────────────────┘
```

## 🏗️ Architecture Overview

### Your Technology Stack
- **Backend Framework**: Node.js with Express/GraphQL
- **Database**: MongoDB/PostgreSQL for metadata
- **File Storage**: IPFS or AWS S3
- **Message Queue**: Redis/Kafka for event streaming  
- **SMS Gateway**: Twilio/MSG91
- **IoT Protocol**: MQTT/HTTP
- **Authentication**: JWT/OAuth2
- **Caching**: Redis
- **Monitoring**: Winston logging + analytics

## 🔌 Blockchain API Connection Layer

### Available Blockchain APIs

You will connect to these existing blockchain APIs provided by Person 1:

#### Base Configuration
```javascript
const BLOCKCHAIN_API_BASE = 'http://localhost:3000/api';
const API_HEADERS = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${JWT_TOKEN}`
};
```

### 1. Authentication APIs

#### Login & Token Management
```javascript
// POST /api/auth/login
const loginUser = async (userId, organization, password) => {
  const response = await fetch(`${BLOCKCHAIN_API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, organization, password })
  });
  
  const result = await response.json();
  if (result.success) {
    // Store token for subsequent API calls
    localStorage.setItem('auth_token', result.data.token);
    return result.data.token;
  }
  throw new Error(result.error);
};

// Usage examples for different roles:
const farmerToken = await loginUser('farmer001', 'farmer', 'password123');
const labToken = await loginUser('lab001', 'lab', 'password123'); 
const regulatorToken = await loginUser('regulator001', 'regulator', 'password123');
```

### 2. Core Transaction APIs

#### Harvest Recording (Farmers Only)
```javascript
// POST /api/harvest
const recordHarvest = async (harvestData, farmerToken) => {
  const response = await fetch(`${BLOCKCHAIN_API_BASE}/harvest`, {
    method: 'POST',
    headers: { 
      ...API_HEADERS,
      'Authorization': `Bearer ${farmerToken}`
    },
    body: JSON.stringify({
      batchId: harvestData.batchId || generateBatchId(harvestData),
      farmerId: harvestData.farmerId,
      farmerName: harvestData.farmerName,
      herbType: harvestData.herbType,
      herbVariety: harvestData.herbVariety,
      quantityKg: harvestData.quantityKg,
      collectionDate: harvestData.collectionDate,
      harvestSeason: harvestData.harvestSeason,
      gpsCoordinates: {
        latitude: harvestData.latitude,
        longitude: harvestData.longitude
      },
      weatherConditions: harvestData.weather,
      soilConditions: harvestData.soil,
      certificationType: harvestData.certification
    })
  });
  
  const result = await response.json();
  if (result.success) {
    return {
      batchId: result.data.batchId,
      transactionId: result.data.transactionId,
      timestamp: result.data.timestamp
    };
  }
  throw new Error(result.error);
};
```

#### Processing Step Addition (Processors Only)
```javascript
// POST /api/batch/{batchId}/processing  
const addProcessingStep = async (batchId, processingData, processorToken) => {
  const response = await fetch(`${BLOCKCHAIN_API_BASE}/batch/${batchId}/processing`, {
    method: 'POST',
    headers: {
      ...API_HEADERS,
      'Authorization': `Bearer ${processorToken}`
    },
    body: JSON.stringify({
      processType: processingData.processType,
      facilityId: processingData.facilityId,
      facilityName: processingData.facilityName,
      inputQuantityKg: processingData.inputQuantityKg,
      outputQuantityKg: processingData.outputQuantityKg,
      processStartTime: processingData.startTime,
      processEndTime: processingData.endTime,
      temperature: processingData.temperature,
      equipmentUsed: processingData.equipment,
      operatorId: processingData.operatorId
    })
  });
  
  return await response.json();
};
```

#### Lab Result Upload (Labs Only)
```javascript
// POST /api/batch/{batchId}/test
const uploadLabResult = async (batchId, testData, labToken) => {
  const response = await fetch(`${BLOCKCHAIN_API_BASE}/batch/${batchId}/test`, {
    method: 'POST',
    headers: {
      ...API_HEADERS,
      'Authorization': `Bearer ${labToken}`
    },
    body: JSON.stringify({
      testId: testData.testId,
      labId: testData.labId,
      labName: testData.labName,
      testType: testData.testType,
      sampleId: testData.sampleId,
      sampleQuantity: testData.sampleQuantity,
      testDate: testData.testDate,
      testMethodology: testData.methodology,
      moistureContent: testData.moisture,
      ashContent: testData.ash,
      foreignMatter: testData.foreignMatter,
      activePrinciples: testData.activePrinciples,
      heavyMetals: testData.heavyMetals,
      pesticideResidues: testData.pesticides || [],
      microbialCount: testData.microbial,
      overallResult: testData.result
    })
  });
  
  return await response.json();
};
```

#### Package Finalization (Distributors Only)
```javascript
// POST /api/batch/{batchId}/package
const finalizePackaging = async (batchId, packageData, distributorToken) => {
  const response = await fetch(`${BLOCKCHAIN_API_BASE}/batch/${batchId}/package`, {
    method: 'POST',
    headers: {
      ...API_HEADERS,
      'Authorization': `Bearer ${distributorToken}`
    },
    body: JSON.stringify({
      distributorId: packageData.distributorId,
      distributorName: packageData.distributorName,
      packageType: packageData.packageType,
      packageWeight: packageData.packageWeight,
      batchLotNumber: packageData.lotNumber,
      expiryDate: packageData.expiryDate,
      destinationAddress: packageData.destination
    })
  });
  
  return await response.json();
};
```

### 3. Query APIs

#### Get Complete Provenance
```javascript
// GET /api/batch/{batchId}/provenance
const getProvenance = async (batchId, token) => {
  const response = await fetch(`${BLOCKCHAIN_API_BASE}/batch/${batchId}/provenance`, {
    method: 'GET',
    headers: {
      ...API_HEADERS,
      'Authorization': `Bearer ${token}`
    }
  });
  
  const result = await response.json();
  if (result.success) {
    return result.data; // Complete provenance record
  }
  throw new Error(result.error);
};
```

#### Get Provenance by QR Code (Public)
```javascript
// GET /api/trace/{qrCodeId}
const getProvenanceByQR = async (qrCodeId) => {
  const response = await fetch(`${BLOCKCHAIN_API_BASE}/trace/${qrCodeId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  });
  
  return await response.json();
};
```

#### GPS Validation
```javascript  
// POST /api/validate/gps
const validateGPS = async (herbType, coordinates, token) => {
  const response = await fetch(`${BLOCKCHAIN_API_BASE}/validate/gps`, {
    method: 'POST',
    headers: {
      ...API_HEADERS,
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      herbType: herbType,
      coordinates: {
        latitude: coordinates.lat,
        longitude: coordinates.lng
      }
    })
  });
  
  return await response.json();
};
```

## 🏗️ Microservices Architecture

Build these microservices that integrate with the blockchain APIs:

### 1. Collector Service
**Purpose**: Farmer registration, harvest logging

```javascript
// collector-service/index.js
const express = require('express');
const mongoose = require('mongoose');
const app = express();

// MongoDB models
const FarmerSchema = new mongoose.Schema({
  farmerId: { type: String, unique: true },
  name: String,
  contactNumber: String,
  address: Object,
  certifications: [String],
  approvedHerbs: [String],
  registrationDate: { type: Date, default: Date.now }
});

const Farmer = mongoose.model('Farmer', FarmerSchema);

// API endpoints
app.post('/farmers/register', async (req, res) => {
  try {
    const farmer = new Farmer(req.body);
    await farmer.save();
    
    // Create blockchain identity for farmer
    const farmerToken = await loginUser(farmer.farmerId, 'farmer', generatePassword());
    
    res.json({ 
      success: true, 
      farmerId: farmer.farmerId,
      blockchainToken: farmerToken 
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/harvest/record', async (req, res) => {
  try {
    const { farmerId, harvestData } = req.body;
    
    // Validate farmer exists
    const farmer = await Farmer.findOne({ farmerId });
    if (!farmer) {
      throw new Error('Farmer not registered');
    }
    
    // Get farmer's blockchain token
    const farmerToken = await loginUser(farmerId, 'farmer', getStoredPassword(farmerId));
    
    // Record harvest on blockchain
    const blockchainResult = await recordHarvest({
      ...harvestData,
      farmerId,
      farmerName: farmer.name
    }, farmerToken);
    
    // Store metadata in off-chain DB
    await storeHarvestMetadata(farmerId, harvestData, blockchainResult);
    
    res.json({
      success: true,
      batchId: blockchainResult.batchId,
      transactionId: blockchainResult.transactionId
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});
```

### 2. Processing Service
**Purpose**: Track drying, grinding, packaging

```javascript
// processing-service/index.js  
const ProcessingFacilitySchema = new mongoose.Schema({
  facilityId: { type: String, unique: true },
  facilityName: String,
  location: Object,
  capabilities: [String], // ['drying', 'grinding', 'packaging']
  certifications: [String],
  equipment: [{
    equipmentId: String,
    type: String,
    specifications: Object
  }]
});

const ProcessingFacility = mongoose.model('ProcessingFacility', ProcessingFacilitySchema);

app.post('/processing/add-step', async (req, res) => {
  try {
    const { facilityId, batchId, processingData } = req.body;
    
    // Validate facility
    const facility = await ProcessingFacility.findOne({ facilityId });
    if (!facility) {
      throw new Error('Processing facility not registered');
    }
    
    // Get processor token
    const processorToken = await loginUser(facilityId, 'processor', getStoredPassword(facilityId));
    
    // Add processing step to blockchain
    const blockchainResult = await addProcessingStep(batchId, {
      ...processingData,
      facilityId,
      facilityName: facility.facilityName
    }, processorToken);
    
    res.json(blockchainResult);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});
```

### 3. Lab Service
**Purpose**: Upload & validate test results

```javascript
// lab-service/index.js
const LabSchema = new mongoose.Schema({
  labId: { type: String, unique: true },
  labName: String,
  accreditation: [String], // ['NABL', 'ISO', etc.]
  testCapabilities: [String],
  equipment: [Object],
  location: Object
});

const Lab = mongoose.model('Lab', LabSchema);

app.post('/lab/upload-result', async (req, res) => {
  try {
    const { labId, batchId, testData } = req.body;
    
    // Validate lab
    const lab = await Lab.findOne({ labId });
    if (!lab) {
      throw new Error('Lab not registered');
    }
    
    // Validate test parameters
    const validationResult = await validateTestParameters(testData);
    if (!validationResult.valid) {
      throw new Error(`Test validation failed: ${validationResult.errors.join(', ')}`);
    }
    
    // Get lab token
    const labToken = await loginUser(labId, 'lab', getStoredPassword(labId));
    
    // Upload to blockchain
    const blockchainResult = await uploadLabResult(batchId, {
      ...testData,
      labId,
      labName: lab.labName,
      labCertification: lab.accreditation.join(',')
    }, labToken);
    
    // Store test certificate in IPFS
    if (testData.certificateFile) {
      const ipfsHash = await uploadToIPFS(testData.certificateFile);
      await updateTestCertificate(blockchainResult.testId, ipfsHash);
    }
    
    res.json(blockchainResult);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});
```

### 4. Provenance Service  
**Purpose**: Generate QR codes + link blockchain transactions

```javascript
// provenance-service/index.js
const QRCode = require('qrcode');

app.get('/provenance/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    // Get complete provenance from blockchain
    const provenance = await getProvenance(batchId, getSystemToken());
    
    // Generate QR code
    const qrCodeUrl = `${process.env.CONSUMER_APP_URL}/trace/${provenance.distributionInfo?.qrCodeId}`;
    const qrCodeImage = await QRCode.toDataURL(qrCodeUrl);
    
    // Generate consumer-friendly report
    const consumerReport = {
      herbType: provenance.collectionEvent.herbType,
      origin: `${provenance.collectionEvent.farmerName}, ${getLocationName(provenance.collectionEvent.gpsCoordinates)}`,
      harvestDate: provenance.collectionEvent.collectionDate,
      qualityGrade: calculateQualityGrade(provenance.qualityTests),
      certificates: extractCertifications(provenance),
      journey: {
        farm: '✓ Harvested by certified organic farmer',
        processing: '✓ Processed in GMP certified facility',
        testing: '✓ Lab tested for purity and potency', 
        packaging: '✓ Sealed in food-grade containers'
      },
      safetyScore: calculateSafetyScore(provenance.qualityTests),
      sustainabilityScore: provenance.collectionEvent.sustainabilityScore,
      qrCode: qrCodeImage,
      verificationUrl: qrCodeUrl
    };
    
    res.json({
      success: true,
      data: {
        provenance,
        consumerReport,
        qrCode: qrCodeImage
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});
```

### 5. Analytics Service
**Purpose**: Fraud detection, sustainability metrics, dashboards

```javascript
// analytics-service/index.js
const AnalyticsSchema = new mongoose.Schema({
  batchId: String,
  farmerId: String,
  herbType: String,
  metrics: {
    yieldEfficiency: Number,
    qualityScore: Number,
    sustainabilityScore: Number,
    timeToMarket: Number // in days
  },
  alerts: [{
    type: String, // 'fraud', 'quality', 'sustainability'
    severity: String,
    message: String,
    timestamp: Date
  }],
  createdAt: { type: Date, default: Date.now }
});

const Analytics = mongoose.model('Analytics', AnalyticsSchema);

app.get('/analytics/dashboard', async (req, res) => {
  try {
    const { timeframe = '30d', herbType, region } = req.query;
    
    // Get aggregated data
    const pipeline = [
      { $match: buildMatchQuery(timeframe, herbType, region) },
      { $group: {
        _id: null,
        totalBatches: { $sum: 1 },
        avgQualityScore: { $avg: '$metrics.qualityScore' },
        avgSustainabilityScore: { $avg: '$metrics.sustainabilityScore' },
        avgTimeToMarket: { $avg: '$metrics.timeToMarket' },
        fraudAlerts: { $sum: { $cond: [{ $eq: ['$alerts.type', 'fraud'] }, 1, 0] } }
      }}
    ];
    
    const analytics = await Analytics.aggregate(pipeline);
    
    res.json({
      success: true,
      data: {
        summary: analytics[0],
        trends: await calculateTrends(timeframe),
        alerts: await getActiveAlerts(),
        topPerformers: await getTopPerformingFarms(timeframe)
      }
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/analytics/fraud-detection', async (req, res) => {
  try {
    const { batchId } = req.body;
    
    // Get provenance data
    const provenance = await getProvenance(batchId, getSystemToken());
    
    // Run fraud detection algorithms
    const fraudIndicators = await runFraudDetection(provenance);
    
    if (fraudIndicators.length > 0) {
      // Alert regulators
      await sendAlertToRegulators({
        batchId,
        type: 'fraud_detected',
        indicators: fraudIndicators,
        severity: 'high'
      });
    }
    
    res.json({
      success: true,
      fraudScore: calculateFraudScore(fraudIndicators),
      indicators: fraudIndicators
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});
```

## 🗄️ Off-chain Storage Architecture

### 1. Metadata Database (MongoDB/PostgreSQL)

#### Farmer Management
```javascript
// models/farmer.js
const farmerSchema = {
  farmerId: String,
  personalInfo: {
    name: String,
    contactNumber: String,
    email: String,
    address: {
      street: String,
      district: String,
      state: String,
      pincode: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    }
  },
  farmDetails: {
    farmSize: Number, // in acres
    soilType: String,
    irrigationType: String,
    organicCertification: {
      certified: Boolean,
      certifyingBody: String,
      validUntil: Date
    }
  },
  cultivationInfo: {
    approvedHerbs: [String],
    currentSeason: String,
    annualQuota: Object // herbType -> quota in kg
  },
  blockchain: {
    walletAddress: String,
    mspId: String,
    enrollmentId: String
  },
  createdAt: Date,
  updatedAt: Date
};
```

#### Product Catalog
```javascript
// models/product-catalog.js
const herbCatalogSchema = {
  herbType: String, // 'Ashwagandha', 'Tulsi', etc.
  scientificName: String,
  commonNames: [String],
  approvedRegions: [{
    state: String,
    districts: [String],
    coordinates: {
      boundingBox: [[Number]] // [lat, lng] pairs
    },
    seasonality: {
      harvestMonths: [Number], // 1-12
      plantingMonths: [Number]
    }
  }],
  qualityStandards: {
    moistureContent: { min: Number, max: Number },
    ashContent: { min: Number, max: Number },
    foreignMatter: { max: Number },
    activePrinciples: [{
      compound: String,
      minPercentage: Number
    }]
  },
  sustainabilityQuota: {
    annualLimit: Number, // kg per year
    perFarmerLimit: Number // kg per farmer per year
  }
};
```

#### Transaction Sync
```javascript
// models/blockchain-sync.js
const transactionSyncSchema = {
  transactionId: String,
  blockNumber: Number,
  timestamp: Date,
  batchId: String,
  transactionType: String, // 'HARVEST', 'PROCESSING', 'TESTING', 'PACKAGING'
  organizationId: String,
  userId: String,
  dataHash: String,
  syncStatus: String, // 'PENDING', 'SYNCED', 'FAILED'
  retryCount: Number,
  lastAttempt: Date
};

// Sync service
class BlockchainSyncService {
  async syncTransaction(transactionId) {
    try {
      // Get transaction from blockchain
      const txData = await getTransactionFromBlockchain(transactionId);
      
      // Store in local DB for fast queries
      await TransactionSync.findOneAndUpdate(
        { transactionId },
        {
          ...txData,
          syncStatus: 'SYNCED',
          lastAttempt: new Date()
        },
        { upsert: true }
      );
      
      // Update related analytics
      await this.updateAnalytics(txData);
      
    } catch (error) {
      await this.handleSyncError(transactionId, error);
    }
  }
  
  async updateAnalytics(txData) {
    // Update real-time analytics based on transaction
    const analyticsUpdate = {
      batchId: txData.batchId,
      lastUpdate: new Date()
    };
    
    if (txData.transactionType === 'HARVEST') {
      analyticsUpdate['metrics.harvestQuantity'] = txData.data.quantityKg;
    }
    
    await Analytics.findOneAndUpdate(
      { batchId: txData.batchId },
      analyticsUpdate,
      { upsert: true }
    );
  }
}
```

### 2. File Storage (IPFS/Cloud)

#### IPFS Integration
```javascript
// services/ipfs-service.js
const ipfsClient = require('ipfs-http-client');
const ipfs = ipfsClient.create({ url: 'http://localhost:5001' });

class IPFSService {
  async uploadFile(fileBuffer, metadata) {
    try {
      // Add file to IPFS
      const result = await ipfs.add(fileBuffer);
      const ipfsHash = result.path;
      
      // Store metadata in database
      await FileMetadata.create({
        ipfsHash,
        originalName: metadata.originalName,
        mimeType: metadata.mimeType,
        size: metadata.size,
        uploadedBy: metadata.uploadedBy,
        category: metadata.category, // 'certificate', 'photo', 'document'
        relatedBatchId: metadata.batchId,
        uploadDate: new Date()
      });
      
      return {
        ipfsHash,
        url: `${process.env.IPFS_GATEWAY}/ipfs/${ipfsHash}`
      };
    } catch (error) {
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }
  
  async getFile(ipfsHash) {
    try {
      const chunks = [];
      for await (const chunk of ipfs.cat(ipfsHash)) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      throw new Error(`IPFS retrieval failed: ${error.message}`);
    }
  }
}

// Usage in lab service
app.post('/lab/upload-certificate', upload.single('certificate'), async (req, res) => {
  try {
    const { testId, batchId } = req.body;
    const certificateFile = req.file;
    
    // Upload to IPFS
    const ipfsResult = await ipfsService.uploadFile(certificateFile.buffer, {
      originalName: certificateFile.originalname,
      mimeType: certificateFile.mimetype,
      size: certificateFile.size,
      uploadedBy: req.user.labId,
      category: 'certificate',
      batchId: batchId
    });
    
    // Update test record with certificate link
    await TestResult.findOneAndUpdate(
      { testId },
      { certificateIPFS: ipfsResult.ipfsHash }
    );
    
    res.json({
      success: true,
      certificateUrl: ipfsResult.url,
      ipfsHash: ipfsResult.ipfsHash
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});
```

## 📱 Integration Layer Services

### 1. SMS Gateway Integration

#### Twilio/MSG91 Setup
```javascript
// services/sms-service.js
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

class SMSService {
  async parseHarvestSMS(message, fromNumber) {
    // Expected format: "HARVEST ASHWA 50KG LAT:23.2599 LNG:77.4126 ORGANIC"
    const parts = message.trim().toUpperCase().split(' ');
    
    if (parts[0] !== 'HARVEST') {
      throw new Error('Invalid SMS format. Start with HARVEST');
    }
    
    const herbType = parts[1];
    const quantity = parseFloat(parts[2].replace('KG', ''));
    const lat = parseFloat(parts[3].split(':')[1]);
    const lng = parseFloat(parts[4].split(':')[1]);
    const certification = parts[5] || 'CONVENTIONAL';
    
    // Get farmer info by phone number
    const farmer = await Farmer.findOne({ contactNumber: fromNumber });
    if (!farmer) {
      throw new Error('Phone number not registered');
    }
    
    return {
      farmerId: farmer.farmerId,
      farmerName: farmer.name,
      herbType: this.mapHerbCode(herbType),
      quantityKg: quantity,
      gpsCoordinates: { latitude: lat, longitude: lng },
      certificationType: certification,
      collectionDate: new Date().toISOString(),
      harvestSeason: this.getCurrentSeason()
    };
  }
  
  async handleIncomingSMS(req, res) {
    try {
      const { Body: message, From: fromNumber } = req.body;
      
      // Parse SMS data
      const harvestData = await this.parseHarvestSMS(message, fromNumber);
      
      // Get farmer's blockchain token
      const farmerToken = await loginUser(harvestData.farmerId, 'farmer', 
        getStoredPassword(harvestData.farmerId));
      
      // Record harvest on blockchain
      const result = await recordHarvest(harvestData, farmerToken);
      
      // Send confirmation SMS
      await this.sendConfirmationSMS(fromNumber, result.batchId, result.transactionId);
      
      res.json({ success: true, batchId: result.batchId });
    } catch (error) {
      // Send error SMS
      await this.sendErrorSMS(req.body.From, error.message);
      res.status(400).json({ success: false, error: error.message });
    }
  }
  
  async sendConfirmationSMS(phoneNumber, batchId, transactionId) {
    const message = `✅ Harvest recorded successfully!\nBatch ID: ${batchId}\nTransaction: ${transactionId}\nTrack: ${process.env.CONSUMER_APP_URL}/trace/${batchId}`;
    
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE,
      to: phoneNumber
    });
  }
}

// Express route
app.post('/sms/harvest', new SMSService().handleIncomingSMS);
```

### 2. IoT Integration

#### MQTT Integration for Sensors
```javascript
// services/iot-service.js
const mqtt = require('mqtt');
const client = mqtt.connect(process.env.MQTT_BROKER_URL);

class IoTService {
  constructor() {
    this.setupMQTTHandlers();
  }
  
  setupMQTTHandlers() {
    client.on('connect', () => {
      console.log('Connected to MQTT broker');
      
      // Subscribe to sensor topics
      client.subscribe('sensors/+/gps');      // GPS sensors
      client.subscribe('sensors/+/moisture'); // Moisture sensors  
      client.subscribe('sensors/+/temp');     // Temperature sensors
    });
    
    client.on('message', (topic, message) => {
      this.handleSensorData(topic, JSON.parse(message.toString()));
    });
  }
  
  async handleSensorData(topic, data) {
    const [_, sensorId, sensorType] = topic.split('/');
    
    // Store real-time sensor data
    await SensorReading.create({
      sensorId,
      sensorType,
      data,
      timestamp: new Date(),
      processed: false
    });
    
    // Process based on sensor type
    switch (sensorType) {
      case 'gps':
        await this.processGPSData(sensorId, data);
        break;
      case 'moisture':  
        await this.processMoistureData(sensorId, data);
        break;
      case 'temp':
        await this.processTemperatureData(sensorId, data);
        break;
    }
  }
  
  async processGPSData(sensorId, data) {
    // Find associated batch/farmer
    const sensor = await IoTSensor.findOne({ sensorId });
    if (!sensor || !sensor.assignedBatch) return;
    
    // Validate GPS coordinates
    const validation = await validateGPS(sensor.herbType, {
      lat: data.latitude,
      lng: data.longitude  
    }, getSystemToken());
    
    if (!validation.result.isValid) {
      // Send alert - farmer outside approved zone
      await this.sendLocationAlert(sensor.farmerId, data);
    }
  }
  
  async processMoistureData(sensorId, data) {
    // Check if moisture is within acceptable range during processing
    const sensor = await IoTSensor.findOne({ sensorId });
    if (!sensor) return;
    
    if (data.moisturePercentage > 12) {
      // Alert processor - moisture too high
      await this.sendMoistureAlert(sensor.facilityId, data);
    }
  }
}

// HTTP endpoint for IoT devices that can't use MQTT
app.post('/iot/sensor-data', async (req, res) => {
  try {
    const { sensorId, sensorType, data, timestamp } = req.body;
    
    // Authenticate IoT device
    const sensor = await IoTSensor.findOne({ sensorId });
    if (!sensor || !sensor.isActive) {
      return res.status(401).json({ error: 'Sensor not authorized' });
    }
    
    // Process sensor data
    await iotService.handleSensorData(`sensors/${sensorId}/${sensorType}`, data);
    
    res.json({ success: true, processed: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});
```

### 3. ERP Integration

#### ERP Connector Service
```javascript
// services/erp-service.js
class ERPService {
  async syncWithERP(batchId) {
    try {
      // Get complete provenance from blockchain
      const provenance = await getProvenance(batchId, getSystemToken());
      
      // Transform to ERP format
      const erpData = this.transformToERPFormat(provenance);
      
      // Send to ERP system
      const response = await fetch(process.env.ERP_API_URL + '/inventory/add', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ERP_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(erpData)
      });
      
      const result = await response.json();
      
      // Update sync status
      await ERPSync.create({
        batchId,
        erpRecordId: result.recordId,
        syncStatus: 'SUCCESS',
        syncDate: new Date()
      });
      
      return result;
    } catch (error) {
      await ERPSync.create({
        batchId,
        syncStatus: 'FAILED',
        error: error.message,
        syncDate: new Date()
      });
      throw error;
    }
  }
  
  transformToERPFormat(provenance) {
    return {
      productId: `HERB_${provenance.collectionEvent.herbType}_${provenance.batchId}`,
      productName: provenance.collectionEvent.herbType,
      variety: provenance.collectionEvent.herbVariety,
      quantity: this.getFinalQuantity(provenance),
      unit: 'KG',
      supplier: {
        farmerId: provenance.collectionEvent.farmerId,
        farmerName: provenance.collectionEvent.farmerName
      },
      qualityGrade: this.calculateQualityGrade(provenance.qualityTests),
      certificates: this.extractCertifications(provenance),
      expiryDate: provenance.distributionInfo?.expiryDate,
      batchLot: provenance.distributionInfo?.batchLotNumber,
      traceabilityUrl: `${process.env.CONSUMER_APP_URL}/trace/${provenance.distributionInfo?.qrCodeId}`,
      sustainability: {
        score: provenance.collectionEvent.sustainabilityScore,
        carbonFootprint: provenance.sustainabilityMetrics?.carbonFootprint
      }
    };
  }
}

// Webhook for ERP updates
app.post('/erp/webhook', async (req, res) => {
  try {
    const { event, data } = req.body;
    
    switch (event) {
      case 'stock_depleted':
        await handleStockDepletion(data.productId);
        break;
      case 'quality_alert':
        await handleQualityAlert(data.batchId, data.issue);
        break;
      case 'export_order':
        await generateExportDocuments(data.batchIds);
        break;
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});
```

## 📊 Reporting & Compliance Engine

### Automated Compliance Reports
```javascript
// services/compliance-service.js
class ComplianceService {
  async generateAYUSHReport(timeframe) {
    // Get all batches in timeframe
    const batches = await this.getBatchesInTimeframe(timeframe);
    
    const report = {
      reportPeriod: timeframe,
      totalBatches: batches.length,
      herbTypes: this.aggregateByHerbType(batches),
      qualityCompliance: await this.checkQualityCompliance(batches),
      traceabilityCompliance: await this.checkTraceabilityCompliance(batches),
      sustainabilityMetrics: await this.calculateSustainabilityMetrics(batches),
      nonCompliantBatches: await this.identifyNonCompliantBatches(batches),
      recommendations: await this.generateRecommendations(batches)
    };
    
    // Generate PDF report
    const pdfBuffer = await this.generatePDFReport(report, 'AYUSH_COMPLIANCE');
    
    // Store in IPFS
    const ipfsResult = await ipfsService.uploadFile(pdfBuffer, {
      originalName: `AYUSH_Report_${timeframe.start}_${timeframe.end}.pdf`,
      mimeType: 'application/pdf',
      category: 'compliance_report',
      uploadedBy: 'system'
    });
    
    return {
      report,
      pdfUrl: ipfsResult.url,
      ipfsHash: ipfsResult.ipfsHash
    };
  }
  
  async detectFraud(batchId) {
    const provenance = await getProvenance(batchId, getSystemToken());
    const fraudIndicators = [];
    
    // Check for GPS inconsistencies
    if (await this.hasGPSInconsistencies(provenance)) {
      fraudIndicators.push({
        type: 'gps_mismatch',
        severity: 'high',
        description: 'GPS coordinates inconsistent with claimed location'
      });
    }
    
    // Check for duplicate batch attempts
    if (await this.hasDuplicateBatchAttempts(provenance)) {
      fraudIndicators.push({
        type: 'duplicate_batch',
        severity: 'critical',  
        description: 'Multiple batches with same harvest details'
      });
    }
    
    // Check for impossible timelines
    if (await this.hasImpossibleTimeline(provenance)) {
      fraudIndicators.push({
        type: 'timeline_impossible',
        severity: 'medium',
        description: 'Processing timeline physically impossible'
      });
    }
    
    // Check for quantity inconsistencies
    if (await this.hasQuantityInconsistencies(provenance)) {
      fraudIndicators.push({
        type: 'quantity_mismatch',
        severity: 'high',
        description: 'Input/output quantities don\'t match with expected yield'
      });
    }
    
    return {
      batchId,
      fraudScore: this.calculateFraudScore(fraudIndicators),
      indicators: fraudIndicators,
      riskLevel: this.calculateRiskLevel(fraudIndicators)
    };
  }
}

// Scheduled compliance checks
const cron = require('node-cron');

// Daily compliance check
cron.schedule('0 2 * * *', async () => {
  console.log('Running daily compliance check...');
  
  const yesterday = {
    start: moment().subtract(1, 'day').startOf('day').toDate(),
    end: moment().subtract(1, 'day').endOf('day').toDate()
  };
  
  const batches = await getBatchesInTimeframe(yesterday);
  
  for (const batch of batches) {
    const fraudResult = await complianceService.detectFraud(batch.batchId);
    
    if (fraudResult.riskLevel === 'HIGH' || fraudResult.riskLevel === 'CRITICAL') {
      await alertRegulators(fraudResult);
    }
  }
});

// Monthly AYUSH report
cron.schedule('0 0 1 * *', async () => {
  console.log('Generating monthly AYUSH report...');
  
  const lastMonth = {
    start: moment().subtract(1, 'month').startOf('month').toDate(),
    end: moment().subtract(1, 'month').endOf('month').toDate()
  };
  
  const report = await complianceService.generateAYUSHReport(lastMonth);
  
  // Email to regulators
  await emailService.sendReport('AYUSH_MONTHLY', report);
});
```

## 🔐 Security & API Governance

### JWT/OAuth2 Implementation
```javascript
// middleware/security.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

class SecurityService {
  generateJWT(payload, expiresIn = '24h') {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
  }
  
  verifyJWT(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }
  
  async authenticateRequest(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
      }
      
      const token = authHeader.substring(7);
      const decoded = this.verifyJWT(token);
      
      // Verify token is not blacklisted
      const blacklisted = await TokenBlacklist.findOne({ token });
      if (blacklisted) {
        return res.status(401).json({ error: 'Token has been revoked' });
      }
      
      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  }
  
  authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: allowedRoles,
          current: req.user.role
        });
      }
      next();
    };
  }
  
  async auditLog(req, res, next) {
    // Log all API requests for audit trail
    await AuditLog.create({
      userId: req.user?.userId,
      organization: req.user?.organization,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date(),
      requestBody: req.method === 'POST' ? req.body : undefined
    });
    
    next();
  }
}

// Rate limiting by role
const rateLimit = require('express-rate-limit');

const createRoleBasedLimiter = (role, windowMs, max) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => `${req.user.role}_${req.user.userId}`,
    message: `Rate limit exceeded for ${role}`,
    standardHeaders: true
  });
};

// Apply different limits for different roles
const farmerLimiter = createRoleBasedLimiter('farmer', 15 * 60 * 1000, 100); // 100 requests per 15 minutes
const labLimiter = createRoleBasedLimiter('lab', 15 * 60 * 1000, 50);       // 50 requests per 15 minutes
const regulatorLimiter = createRoleBasedLimiter('regulator', 15 * 60 * 1000, 1000); // 1000 requests per 15 minutes
```

## 🚀 Deployment Guide for Person 3

### Docker Compose for Integration Layer
```yaml
# docker-compose.integration.yml
version: '3.8'
services:
  # MongoDB for metadata
  mongodb:
    image: mongo:5.0
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
    volumes:
      - mongodb_data:/data/db
      
  # Redis for caching and sessions
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
      
  # IPFS node
  ipfs:
    image: ipfs/go-ipfs:latest
    ports:
      - "4001:4001"
      - "5001:5001" 
      - "8080:8080"
    volumes:
      - ipfs_data:/data/ipfs
      
  # MQTT Broker for IoT
  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf
      
  # Integration API Server
  integration-api:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - MONGODB_URL=mongodb://admin:password123@mongodb:27017/ayurveda_integration?authSource=admin
      - REDIS_URL=redis://redis:6379
      - IPFS_URL=http://ipfs:5001
      - MQTT_BROKER_URL=mqtt://mosquitto:1883
      - BLOCKCHAIN_API_URL=http://blockchain-api:3000
    depends_on:
      - mongodb
      - redis
      - ipfs
      - mosquitto
      
volumes:
  mongodb_data:
  redis_data:
  ipfs_data:
```

### Environment Configuration
```bash
# .env file
NODE_ENV=production
PORT=4000

# Database
MONGODB_URL=mongodb://localhost:27017/ayurveda_integration
REDIS_URL=redis://localhost:6379

# Blockchain API
BLOCKCHAIN_API_URL=http://localhost:3000
BLOCKCHAIN_API_TIMEOUT=30000

# File Storage
IPFS_URL=http://localhost:5001
IPFS_GATEWAY=http://localhost:8080

# SMS Gateway
TWILIO_SID=your_twilio_sid
TWILIO_TOKEN=your_twilio_token  
TWILIO_PHONE=+1234567890

# IoT
MQTT_BROKER_URL=mqtt://localhost:1883
IOT_API_KEY=your_iot_api_key

# ERP Integration
ERP_API_URL=https://your-erp-system.com/api
ERP_API_TOKEN=your_erp_token

# Security
JWT_SECRET=your_jwt_secret_key
ENCRYPTION_KEY=your_encryption_key

# External URLs
CONSUMER_APP_URL=https://your-consumer-app.com
ADMIN_DASHBOARD_URL=https://your-admin-dashboard.com

# Email/Notifications
EMAIL_SERVICE_API_KEY=your_email_service_key
SLACK_WEBHOOK_URL=your_slack_webhook
```

### API Server Startup
```javascript
// app.js - Main application entry point
const express = require('express');
const mongoose = require('mongoose');
const redis = require('redis');
const cors = require('cors');
const helmet = require('helmet');

// Import services
const SecurityService = require('./services/security-service');
const CollectorService = require('./services/collector-service');
const ProcessingService = require('./services/processing-service');
const LabService = require('./services/lab-service');
const ProvenanceService = require('./services/provenance-service');
const AnalyticsService = require('./services/analytics-service');
const IoTService = require('./services/iot-service');
const ERPService = require('./services/erp-service');
const ComplianceService = require('./services/compliance-service');

const app = express();
const security = new SecurityService();

// Connect to databases
mongoose.connect(process.env.MONGODB_URL);
const redisClient = redis.createClient({ url: process.env.REDIS_URL });

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/collectors', security.authenticateRequest, require('./routes/collectors'));
app.use('/api/processing', security.authenticateRequest, require('./routes/processing'));
app.use('/api/lab', security.authenticateRequest, require('./routes/lab'));
app.use('/api/provenance', require('./routes/provenance')); // Public + authenticated
app.use('/api/analytics', security.authenticateRequest, require('./routes/analytics'));
app.use('/api/iot', require('./routes/iot'));
app.use('/api/erp', require('./routes/erp'));
app.use('/api/compliance', security.authenticateRequest, require('./routes/compliance'));

// SMS webhook (no auth needed)
app.use('/webhooks/sms', require('./routes/sms-webhook'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoose.connection.readyState === 1,
      redis: redisClient.isReady,
      blockchain: true // Check blockchain API connectivity
    }
  });
});

// Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Integration API Server running on port ${PORT}`);
  console.log(`📡 Ready to integrate with blockchain API at ${process.env.BLOCKCHAIN_API_URL}`);
});

module.exports = app;
```

## 📝 Integration Checklist for Person 3

### ✅ Initial Setup
- [ ] Set up MongoDB/PostgreSQL for metadata storage
- [ ] Configure Redis for caching and sessions
- [ ] Set up IPFS node for file storage
- [ ] Configure MQTT broker for IoT devices
- [ ] Set up SMS gateway (Twilio/MSG91) account
- [ ] Obtain ERP system API credentials

### ✅ Blockchain Integration
- [ ] Test connection to blockchain API (`http://localhost:3000`)
- [ ] Verify JWT token authentication works
- [ ] Test all core APIs (harvest, processing, testing, packaging)
- [ ] Implement error handling for blockchain failures
- [ ] Set up transaction status monitoring

### ✅ Microservices Development
- [ ] Build Collector Service (farmer registration + harvest logging)
- [ ] Build Processing Service (facility management + processing steps)
- [ ] Build Lab Service (test result upload + certificate management)
- [ ] Build Provenance Service (QR code generation + consumer reports)
- [ ] Build Analytics Service (dashboard + fraud detection)

### ✅ External Integrations
- [ ] Implement SMS parsing and blockchain forwarding
- [ ] Set up IoT sensor data ingestion (MQTT + HTTP)
- [ ] Build ERP connector for inventory sync
- [ ] Implement file upload/storage system
- [ ] Set up email/notification services

### ✅ Security & Compliance
- [ ] Implement JWT authentication and RBAC
- [ ] Set up audit logging for all API calls
- [ ] Build automated compliance reporting
- [ ] Implement fraud detection algorithms
- [ ] Set up data encryption at rest and in transit

### ✅ Monitoring & Analytics
- [ ] Implement real-time dashboards
- [ ] Set up alerts for system failures
- [ ] Build sustainability metrics tracking
- [ ] Implement performance monitoring
- [ ] Set up automated report generation

### ✅ Testing & Deployment
- [ ] Unit tests for all microservices
- [ ] Integration tests with blockchain APIs
- [ ] Load testing for high-volume scenarios
- [ ] Security penetration testing
- [ ] Production deployment with monitoring

---

## 🔗 API Connection Examples

### Quick Start Integration
```javascript
// Example: Complete farmer harvest workflow
const IntegrationAPI = require('./integration-api');

async function farmToBlockchainWorkflow() {
  // 1. Register farmer
  const farmer = await IntegrationAPI.registerFarmer({
    name: 'Suresh Kumar',
    contactNumber: '+919876543210',
    farmSize: 5.5,
    location: { state: 'Madhya Pradesh', district: 'Mandsaur' }
  });
  
  // 2. Record harvest via API
  const harvest = await IntegrationAPI.recordHarvest({
    farmerId: farmer.farmerId,
    herbType: 'Ashwagandha',
    quantityKg: 45.0,
    gpsCoordinates: { latitude: 23.2599, longitude: 77.4126 }
  });
  
  // 3. Process the batch
  const processing = await IntegrationAPI.addProcessingStep(harvest.batchId, {
    processType: 'Drying',
    facilityId: 'PROC_001',
    inputQuantityKg: 45.0,
    outputQuantityKg: 41.5
  });
  
  // 4. Upload lab results
  const labResult = await IntegrationAPI.uploadLabResult(harvest.batchId, {
    moistureContent: 9.8,
    ashContent: 4.2,
    overallResult: 'Pass'
  });
  
  // 5. Finalize packaging
  const packaging = await IntegrationAPI.finalizePackaging(harvest.batchId, {
    distributorId: 'DIST_001',
    packageType: '500g pouches'
  });
  
  // 6. Generate consumer QR code
  const qrCode = await IntegrationAPI.generateQRCode(harvest.batchId);
  
  console.log(`✅ Complete traceability established for batch ${harvest.batchId}`);
  console.log(`🔗 Consumer can scan: ${qrCode.url}`);
  
  return {
    batchId: harvest.batchId,
    qrCodeUrl: qrCode.url,
    consumerUrl: qrCode.consumerUrl
  };
}
```

**Your integration layer is the bridge between the real world and the blockchain. Focus on making it robust, scalable, and user-friendly for all stakeholders!**

---

*Person 3 Integration Guide v1.0*  
*Last Updated: September 19, 2025*  
*Status: Ready for Development* 🚀