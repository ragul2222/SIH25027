require('dotenv').config();

/**
 * Configuration settings for Ayurvedic Herb Traceability API
 */
module.exports = {
    // Server configuration
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost',
        environment: process.env.NODE_ENV || 'development'
    },

    // Hyperledger Fabric configuration
    fabric: {
        channelName: process.env.CHANNEL_NAME || 'ayurveda-channel',
        chaincodeName: process.env.CHAINCODE_NAME || 'ayurveda-traceability',
        mspId: process.env.MSP_ID || 'FarmerMSP',
        
        // Connection profiles for different organizations
        connectionProfiles: {
            farmer: {
                mspId: 'FarmerMSP',
                peerEndpoint: 'grpc://localhost:7051',
                peerHostAlias: 'peer0.farmer.ayurveda-network.com'
            },
            processor: {
                mspId: 'ProcessorMSP',
                peerEndpoint: 'grpc://localhost:9051',
                peerHostAlias: 'peer0.processor.ayurveda-network.com'
            },
            lab: {
                mspId: 'LabMSP',
                peerEndpoint: 'grpc://localhost:11051',
                peerHostAlias: 'peer0.lab.ayurveda-network.com'
            },
            distributor: {
                mspId: 'DistributorMSP',
                peerEndpoint: 'grpc://localhost:13051',
                peerHostAlias: 'peer0.distributor.ayurveda-network.com'
            },
            regulator: {
                mspId: 'RegulatorMSP',
                peerEndpoint: 'grpc://localhost:15051',
                peerHostAlias: 'peer0.regulator.ayurveda-network.com'
            }
        },

        // Orderer configuration
        orderer: {
            endpoint: 'grpc://localhost:7050',
            hostAlias: 'orderer.ayurveda-network.com'
        },

        // TLS configuration
        tls: {
            enabled: true,
            rootCertPath: './organizations/ordererOrganizations/ayurveda-network.com/orderers/orderer.ayurveda-network.com/tls/ca.crt'
        },

        // Wallet and identity configuration
        wallet: {
            type: 'FileSystemWallet',
            path: './wallet'
        },

        // Gateway timeout settings
        gateway: {
            discovery: {
                enabled: true,
                asLocalhost: true
            },
            timeout: 30000, // 30 seconds
            commitTimeout: 120000 // 2 minutes
        }
    },

    // JWT authentication
    jwt: {
        secret: process.env.JWT_SECRET || 'ayurveda-traceability-secret-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    },

    // Role-based access control
    roles: {
        FARMER: 'farmer',
        PROCESSOR: 'processor',
        LAB: 'lab',
        DISTRIBUTOR: 'distributor',
        REGULATOR: 'regulator'
    },

    // API rate limiting
    rateLimiting: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100 // limit each IP to 100 requests per windowMs
    },

    // Logging configuration
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'combined',
        file: {
            enabled: true,
            filename: './logs/api.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }
    },

    // CORS configuration
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: true
    },

    // File upload configuration
    upload: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedFileTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        uploadPath: './uploads'
    },

    // Blockchain query configuration
    blockchain: {
        retryAttempts: 3,
        retryDelay: 1000, // 1 second
        batchSize: 100 // for batch queries
    },

    // QR Code configuration
    qrCode: {
        baseUrl: process.env.QR_BASE_URL || 'https://traceability.ayurveda.com',
        size: 200,
        errorCorrectionLevel: 'M'
    }
};