# 🌿 Ayurvedic Herb Traceability System - SIH25027

A comprehensive blockchain-based traceability system for Ayurvedic herbs, ensuring authenticity, quality, and transparency throughout the supply chain.

## 🎯 Project Overview

This system provides end-to-end traceability for Ayurvedic herbs from farm to consumer, leveraging blockchain technology, IoT integration, and SMS-based communication for farmers.

### 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Blockchain    │
│   Apps/Web      │◄──►│   Integration   │◄──►│   Core Layer    │
│  (Person 2)     │    │   & Services    │    │   (Person 1)    │
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

## ✨ Features

### 🔗 Blockchain Integration
- **Hyperledger Fabric** based supply chain tracking
- Smart contracts for harvest validation, quality testing, and provenance
- Immutable record keeping for all transactions
- Multi-party consensus and validation

### 📱 SMS Gateway Integration
- **Twilio SMS** integration for farmer communications
- Harvest recording via SMS: `HARVEST ASHWA 50KG LAT:23.2599 LNG:77.4126 ORGANIC`
- Automatic SMS confirmations with batch IDs and tracking links
- Error notifications and format validation

### 🗄️ Database Management
- **MongoDB** for off-chain metadata storage
- Comprehensive data models for farmers, labs, and processing facilities
- Geospatial indexing for location-based queries
- Performance metrics and sustainability tracking

### 🔐 Authentication & Security
- JWT-based authentication system
- Role-based access control (Farmers, Processors, Labs, Distributors, Regulators)
- Secure API endpoints with proper validation
- Environment-based configuration management

### 📊 Real-time Monitoring
- Health monitoring for all services
- Comprehensive logging with Winston
- API documentation with detailed endpoints
- Performance metrics and analytics

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (v5.0 or higher)
- Hyperledger Fabric network
- Twilio account (for SMS features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ragul2222/SIH25027.git
   cd SIH25027
   ```

2. **Install dependencies**
   ```bash
   cd client
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start the development server**
   ```bash
   npm start
   # or
   node test-server.js
   ```

5. **Access the API**
   - Health Check: http://localhost:4001/health
   - API Documentation: http://localhost:4001/api-docs
   - Test Endpoint: http://localhost:4001/api/test

## 📋 API Endpoints

### Core Services
- `GET /health` - Health check for all services
- `GET /api-docs` - API documentation
- `GET /api/test` - Connectivity testing

### Collector Services
- `POST /api/collector/farmers/register` - Register farmer
- `POST /api/collector/harvest/record` - Record harvest
- `GET /api/collector/farmers` - List farmers

### Processing Services
- `POST /api/processing/facilities/register` - Register processing facility
- `POST /api/processing/steps/record` - Record processing step

### SMS Services
- `GET /api/sms/status` - SMS service status
- `POST /api/sms/test` - Test SMS connectivity
- `POST /api/sms/send` - Send custom SMS
- `POST /api/sms/webhook/harvest` - Twilio webhook for harvest SMS
- `POST /api/sms/parse-harvest` - Parse harvest SMS
- `POST /api/sms/confirm-harvest` - Send harvest confirmation

## 🧪 Testing

### SMS Testing
Send SMS in the format:
```
HARVEST ASHWA 50KG LAT:23.2599 LNG:77.4126 ORGANIC
```

### API Testing
```bash
# Test farmer registration
curl -X POST http://localhost:4001/api/test/farmer

# Test harvest recording
curl -X POST http://localhost:4001/api/test/harvest

# Test SMS status
curl -X GET http://localhost:4001/api/sms/status
```

## 📁 Project Structure

```
SIH25027/
├── client/                 # Backend API & Integration Layer
│   ├── api/               # API route handlers
│   ├── middleware/        # Authentication & validation
│   ├── models/           # Database models (Farmer, Lab, ProcessingFacility)
│   ├── services/         # Business logic services
│   │   ├── blockchain-api-client.js  # Blockchain integration
│   │   ├── collector-service.js      # Farmer & harvest management
│   │   ├── processing-service.js     # Processing facility management
│   │   └── sms-service.js           # SMS gateway integration
│   ├── utils/            # Utility functions
│   ├── config.js         # Configuration management
│   ├── server.js         # Main server file
│   └── test-server.js    # Test server with sample endpoints
├── chaincode/            # Hyperledger Fabric smart contracts
├── network/              # Blockchain network configuration
├── scripts/              # Deployment and utility scripts
├── tests/                # Test suites
└── docs/                 # Documentation
```

## 🔧 Configuration

### Environment Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/ayurveda-traceability
NODE_ENV=development
PORT=4001

# Blockchain
BLOCKCHAIN_API_URL=http://localhost:3000
BLOCKCHAIN_API_KEY=your-api-key

# Twilio SMS Gateway
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone

# JWT Authentication
JWT_SECRET=your-jwt-secret
JWT_EXPIRY=24h

# External Services
CONSUMER_APP_URL=https://your-consumer-app.com
```

## 🎯 SMS Integration

### Farmer SMS Commands
```
HARVEST [HERB] [QUANTITY]KG LAT:[LATITUDE] LNG:[LONGITUDE] [CERTIFICATION]

Examples:
HARVEST ASHWA 50KG LAT:23.2599 LNG:77.4126 ORGANIC
HARVEST BRAHMI 25KG LAT:12.9716 LNG:77.5946 CONVENTIONAL
HARVEST NEEM 100KG LAT:28.6139 LNG:77.2090 ORGANIC
```

### Supported Herbs
- **ASHWA** → Ashwagandha
- **BRAHMI** → Brahmi
- **NEEM** → Neem
- **TULSI** → Tulsi
- **GILOY** → Giloy
- **AMLA** → Amla
- **TURMERIC** → Turmeric
- **GINGER** → Ginger

## 📊 Monitoring & Health

### Service Health Check
```json
{
  "status": "healthy",
  "timestamp": "2025-09-19T16:49:20.000Z",
  "services": {
    "database": {
      "status": "connected",
      "collections": ["farmers", "labs", "processingfacilities"]
    },
    "blockchain": {
      "status": "connected",
      "network": "herb-traceability"
    },
    "sms": {
      "enabled": true,
      "provider": "Twilio",
      "phoneNumber": "+18153964385"
    }
  }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **SIH 2025** - Smart India Hackathon 2025
- **Hyperledger Fabric** - Blockchain framework
- **Twilio** - SMS gateway services
- **MongoDB** - Database services

## 📞 Support

For support and queries:
- Create an issue in this repository
- Email: support@ayurveda-traceability.com
- Documentation: See `/docs` folder

---

🌿 **Building trust in Ayurvedic herbs through technology** 🌿