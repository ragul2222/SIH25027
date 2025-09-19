const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Import services
const CollectorService = require('./services/collector-service');
const ProcessingService = require('./services/processing-service');
const BlockchainAPIClient = require('./services/blockchain-api-client');
const SMSService = require('./services/sms-service');
const database = require('./models/database');
const logger = require('./utils/logger');

/**
 * Person 3 Backend Integration Test Server
 * Simple test server to verify API connections and integration
 */
class TestServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 4001; // Different port to avoid conflicts
        this.smsService = new SMSService(); // Initialize SMS service
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Basic middleware
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(morgan('combined'));
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', async (req, res) => {
            try {
                const dbHealth = await database.healthCheck();
                const blockchainClient = new BlockchainAPIClient();
                const blockchainHealth = await blockchainClient.healthCheck();
                const smsHealth = this.smsService.getStatus();

                res.json({
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    services: {
                        database: dbHealth,
                        blockchain: blockchainHealth,
                        sms: smsHealth,
                        server: {
                            status: 'healthy',
                            port: this.port,
                            environment: process.env.NODE_ENV || 'development'
                        }
                    }
                });
            } catch (error) {
                res.status(500).json({
                    status: 'unhealthy',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // API Documentation endpoint
        this.app.get('/api-docs', (req, res) => {
            res.json({
                title: 'Person 3 Backend Integration API',
                version: '1.0.0',
                description: 'API endpoints for Ayurvedic herb traceability backend integration',
                endpoints: {
                    '/health': 'GET - Health check for all services',
                    '/api/test': 'GET - Test API connectivity',
                    '/api/collector/*': 'Farmer and harvest management endpoints',
                    '/api/processing/*': 'Processing facility and processing step endpoints',
                    '/api/lab/*': 'Laboratory and test result endpoints',
                    '/api/provenance/*': 'QR code and provenance tracking endpoints',
                    '/api/sms/status': 'GET - SMS Gateway status',
                    '/api/sms/test': 'POST - Test SMS connectivity',
                    '/api/sms/send': 'POST - Send test SMS',
                    '/api/sms/webhook/harvest': 'POST - Twilio webhook for harvest SMS',
                    '/api/sms/parse-harvest': 'POST - Parse harvest SMS message',
                    '/api/sms/confirm-harvest': 'POST - Send harvest confirmation SMS'
                },
                documentation: 'See PERSON3_BACKEND_INTEGRATION_GUIDE.md for detailed API documentation'
            });
        });

        // Test endpoint for basic connectivity
        this.app.get('/api/test', async (req, res) => {
            try {
                const tests = await this.runConnectivityTests();
                res.json({
                    success: true,
                    message: 'API connectivity test completed',
                    results: tests
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: 'Connectivity test failed',
                    message: error.message
                });
            }
        });

        // Mount service routers
        const collectorService = new CollectorService();
        const processingService = new ProcessingService();
        
        this.app.use('/api/collector', collectorService.getRouter());
        this.app.use('/api/processing', processingService.getRouter());

        // Sample test endpoints for each service
        this.app.post('/api/test/farmer', async (req, res) => {
            try {
                const sampleFarmer = {
                    name: 'Test Farmer',
                    contactNumber: '9876543210',
                    email: 'test@example.com',
                    address: {
                        street: '123 Farm Road',
                        village: 'Test Village',
                        district: 'Test District',
                        state: 'Karnataka',
                        pincode: '560001',
                        coordinates: {
                            latitude: 12.9716,
                            longitude: 77.5946
                        }
                    },
                    certifications: ['ORGANIC'],
                    approvedHerbs: [{
                        herbType: 'ASHWAGANDHA',
                        herbVariety: 'PREMIUM',
                        certificationLevel: 'ORGANIC'
                    }],
                    bankDetails: {
                        accountNumber: '1234567890',
                        ifscCode: 'SBIN0001234',
                        bankName: 'State Bank of India',
                        accountHolderName: 'Test Farmer'
                    }
                };

                // Merge with any request data
                const farmerData = { ...sampleFarmer, ...req.body };

                res.json({
                    success: true,
                    message: 'Sample farmer registration data prepared',
                    data: farmerData,
                    instructions: 'Send this data to POST /api/collector/farmers/register to test farmer registration'
                });

            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        this.app.post('/api/test/harvest', async (req, res) => {
            try {
                const sampleHarvest = {
                    farmerId: req.body.farmerId || 'FARMER_KA_1726737600000_ABC123',
                    herbType: 'ASHWAGANDHA',
                    herbVariety: 'PREMIUM',
                    quantityKg: 100,
                    collectionDate: new Date().toISOString(),
                    harvestSeason: 'WINTER',
                    gpsCoordinates: {
                        latitude: 12.9716,
                        longitude: 77.5946
                    },
                    weatherConditions: {
                        temperature: 25,
                        humidity: 65,
                        rainfall: 0,
                        description: 'Clear sky'
                    },
                    soilConditions: {
                        ph: 6.5,
                        moisture: 40,
                        nitrogen: 2.5,
                        phosphorus: 1.8,
                        potassium: 3.2,
                        organicMatter: 4.5
                    },
                    certificationType: 'ORGANIC',
                    notes: 'Test harvest record'
                };

                const harvestData = { ...sampleHarvest, ...req.body };

                res.json({
                    success: true,
                    message: 'Sample harvest recording data prepared',
                    data: harvestData,
                    instructions: 'Send this data to POST /api/collector/harvest/record to test harvest recording'
                });

            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // SMS Gateway endpoints
        this.app.get('/api/sms/status', (req, res) => {
            try {
                const status = this.smsService.getStatus();
                res.json({
                    success: true,
                    smsGateway: status,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Test SMS connectivity
        this.app.post('/api/sms/test', async (req, res) => {
            try {
                const testNumber = req.body.phoneNumber || '+1234567890';
                const result = await this.smsService.testSMSConnectivity(testNumber);
                
                res.json({
                    success: true,
                    message: 'SMS connectivity test completed',
                    result
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Send test SMS
        this.app.post('/api/sms/send', async (req, res) => {
            try {
                const { phoneNumber, message } = req.body;
                
                if (!phoneNumber || !message) {
                    return res.status(400).json({
                        success: false,
                        error: 'phoneNumber and message are required'
                    });
                }

                const result = await this.smsService.sendSMS(phoneNumber, message);
                
                res.json({
                    success: true,
                    message: 'SMS sent successfully',
                    result
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Harvest SMS webhook (Twilio webhook endpoint)
        this.app.post('/api/sms/webhook/harvest', async (req, res) => {
            await this.smsService.handleIncomingSMS(req, res);
        });

        // Test harvest SMS parsing
        this.app.post('/api/sms/parse-harvest', async (req, res) => {
            try {
                const { message, phoneNumber } = req.body;
                
                if (!message) {
                    return res.status(400).json({
                        success: false,
                        error: 'message is required'
                    });
                }

                const harvestData = await this.smsService.parseHarvestSMS(
                    message, 
                    phoneNumber || '+1234567890'
                );
                
                res.json({
                    success: true,
                    message: 'SMS parsed successfully',
                    harvestData,
                    example: 'HARVEST ASHWA 50KG LAT:23.2599 LNG:77.4126 ORGANIC'
                });
            } catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message,
                    example: 'HARVEST ASHWA 50KG LAT:23.2599 LNG:77.4126 ORGANIC'
                });
            }
        });

        // Send harvest confirmation SMS
        this.app.post('/api/sms/confirm-harvest', async (req, res) => {
            try {
                const { phoneNumber, batchId, transactionId } = req.body;
                
                if (!phoneNumber || !batchId) {
                    return res.status(400).json({
                        success: false,
                        error: 'phoneNumber and batchId are required'
                    });
                }

                const result = await this.smsService.sendConfirmationSMS(
                    phoneNumber, 
                    batchId, 
                    transactionId || `TXN_${Date.now()}`
                );
                
                res.json({
                    success: true,
                    message: 'Confirmation SMS sent',
                    result
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Catch-all route
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                availableEndpoints: ['/health', '/api-docs', '/api/test']
            });
        });
    }

    setupErrorHandling() {
        // Global error handler
        this.app.use((error, req, res, next) => {
            logger.error('Global error handler:', error);
            
            res.status(error.status || 500).json({
                success: false,
                error: 'Internal server error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            process.exit(1);
        });
    }

    async runConnectivityTests() {
        const results = {
            database: null,
            blockchain: null,
            sms: null,
            services: {
                collector: false,
                processing: false
            }
        };

        try {
            // Test database connection
            results.database = await database.healthCheck();
        } catch (error) {
            results.database = { status: 'failed', error: error.message };
        }

        try {
            // Test blockchain API connection
            const blockchainClient = new BlockchainAPIClient();
            results.blockchain = await blockchainClient.healthCheck();
        } catch (error) {
            results.blockchain = { status: 'failed', error: error.message };
        }

        try {
            // Test SMS Gateway connection
            results.sms = await this.smsService.testSMSConnectivity();
        } catch (error) {
            results.sms = { status: 'failed', error: error.message };
        }

        // Test service initialization
        try {
            new CollectorService();
            results.services.collector = true;
        } catch (error) {
            results.services.collector = { error: error.message };
        }

        try {
            new ProcessingService();
            results.services.processing = true;
        } catch (error) {
            results.services.processing = { error: error.message };
        }

        return results;
    }

    async start() {
        try {
            // Connect to database
            await database.connect();
            logger.info('Database connected successfully');

            // Create database indexes
            await database.createIndexes();
            logger.info('Database indexes created');

            // Start server
            this.server = this.app.listen(this.port, () => {
                logger.info(`Person 3 Backend Integration Test Server running on port ${this.port}`);
                logger.info(`Health check: http://localhost:${this.port}/health`);
                logger.info(`API docs: http://localhost:${this.port}/api-docs`);
                logger.info(`Test endpoint: http://localhost:${this.port}/api/test`);
            });

        } catch (error) {
            logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    async stop() {
        try {
            if (this.server) {
                this.server.close();
                logger.info('Server stopped');
            }
            await database.disconnect();
            logger.info('Database disconnected');
        } catch (error) {
            logger.error('Error stopping server:', error);
        }
    }
}

// Start server if this file is run directly
if (require.main === module) {
    const server = new TestServer();
    server.start();
}

module.exports = TestServer;