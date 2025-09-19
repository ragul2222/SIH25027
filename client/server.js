const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const logger = require('./utils/logger');
const AuthMiddleware = require('./middleware/auth');
const TraceabilityAPI = require('./api/traceability-api');
const APIUtils = require('./utils/api-utils');

/**
 * Express server for Ayurvedic Herb Traceability API
 * Implements role-based access control and blockchain integration
 */
class TraceabilityServer {
    constructor() {
        this.app = express();
        this.api = new TraceabilityAPI();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    /**
     * Set up middleware
     */
    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"]
                }
            }
        }));

        // CORS configuration
        this.app.use(cors({
            origin: config.cors.origin,
            credentials: config.cors.credentials,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: config.rateLimiting.windowMs,
            max: config.rateLimiting.maxRequests,
            message: APIUtils.formatErrorResponse(
                new Error('Too many requests from this IP'),
                'rate_limiting'
            ),
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use('/api/', limiter);

        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Logging
        if (config.server.environment !== 'test') {
            this.app.use(morgan(config.logging.format, {
                stream: {
                    write: message => logger.info(message.trim())
                }
            }));
        }

        // Add request ID for tracking
        this.app.use((req, res, next) => {
            req.requestId = require('crypto').randomBytes(16).toString('hex');
            res.setHeader('X-Request-ID', req.requestId);
            next();
        });
    }

    /**
     * Set up API routes with role-based access control
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                uptime: process.uptime()
            });
        });

        // Authentication endpoint
        this.app.post('/api/auth/login', async (req, res) => {
            try {
                const { userId, organization, password } = req.body;
                
                // In a real implementation, this would validate credentials against a database
                // For demo purposes, we'll create a token for valid combinations
                const validCredentials = {
                    'farmer001': { org: 'farmer', role: config.roles.FARMER },
                    'processor001': { org: 'processor', role: config.roles.PROCESSOR },
                    'lab001': { org: 'lab', role: config.roles.LAB },
                    'distributor001': { org: 'distributor', role: config.roles.DISTRIBUTOR },
                    'regulator001': { org: 'regulator', role: config.roles.REGULATOR }
                };

                const userInfo = validCredentials[userId];
                if (!userInfo || userInfo.org !== organization) {
                    return res.status(401).json(
                        APIUtils.formatErrorResponse(
                            new Error('Invalid credentials'),
                            'authentication'
                        )
                    );
                }

                const token = AuthMiddleware.generateToken({
                    userId,
                    organization,
                    role: userInfo.role
                });

                res.json(APIUtils.formatSuccessResponse(
                    { token, expiresIn: config.jwt.expiresIn },
                    'Login successful'
                ));

            } catch (error) {
                logger.error(`Login failed: ${error.message}`);
                res.status(500).json(APIUtils.formatErrorResponse(error, 'authentication'));
            }
        });

        // Initialize API connection for authenticated user
        this.app.post('/api/init', 
            AuthMiddleware.authenticate,
            async (req, res) => {
                try {
                    await this.api.initialize(req.user.organization, req.user.userId);
                    res.json(APIUtils.formatSuccessResponse(
                        { initialized: true },
                        'API connection initialized'
                    ));
                } catch (error) {
                    logger.error(`API initialization failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'initialization'));
                }
            }
        );

        // FARMER ENDPOINTS
        
        // Record harvest (only farmers)
        this.app.post('/api/harvest',
            AuthMiddleware.authenticate,
            AuthMiddleware.authorize(config.roles.FARMER),
            AuthMiddleware.auditLog,
            async (req, res) => {
                try {
                    const result = await this.api.recordHarvest(req.body);
                    res.status(result.success ? 201 : 400).json(result);
                } catch (error) {
                    logger.error(`Record harvest failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'record_harvest'));
                }
            }
        );

        // Get farmer's batches
        this.app.get('/api/farmer/:farmerId/batches',
            AuthMiddleware.authenticate,
            AuthMiddleware.authorize(config.roles.FARMER, config.roles.REGULATOR),
            AuthMiddleware.validateOwnership('farmerId'),
            async (req, res) => {
                try {
                    const result = await this.api.getBatchesByFarmer(req.params.farmerId);
                    res.json(result);
                } catch (error) {
                    logger.error(`Get farmer batches failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'get_farmer_batches'));
                }
            }
        );

        // PROCESSOR ENDPOINTS

        // Add processing step (only processors)
        this.app.post('/api/batch/:batchId/processing',
            AuthMiddleware.authenticate,
            AuthMiddleware.authorize(config.roles.PROCESSOR),
            AuthMiddleware.validateBatchAccess,
            AuthMiddleware.auditLog,
            async (req, res) => {
                try {
                    const result = await this.api.addProcessingStep(req.params.batchId, req.body);
                    res.status(result.success ? 201 : 400).json(result);
                } catch (error) {
                    logger.error(`Add processing step failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'add_processing_step'));
                }
            }
        );

        // LAB ENDPOINTS

        // Upload lab result (only labs)
        this.app.post('/api/batch/:batchId/test',
            AuthMiddleware.authenticate,
            AuthMiddleware.authorize(config.roles.LAB),
            AuthMiddleware.validateBatchAccess,
            AuthMiddleware.auditLog,
            async (req, res) => {
                try {
                    const result = await this.api.uploadLabResult(req.params.batchId, req.body);
                    res.status(result.success ? 201 : 400).json(result);
                } catch (error) {
                    logger.error(`Upload lab result failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'upload_lab_result'));
                }
            }
        );

        // Get test results for a batch
        this.app.get('/api/batch/:batchId/tests',
            AuthMiddleware.authenticate,
            AuthMiddleware.authorize(config.roles.LAB, config.roles.REGULATOR),
            AuthMiddleware.validateBatchAccess,
            async (req, res) => {
                try {
                    const result = await this.api.getBatchTestResults(req.params.batchId);
                    res.json(result);
                } catch (error) {
                    logger.error(`Get test results failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'get_test_results'));
                }
            }
        );

        // DISTRIBUTOR ENDPOINTS

        // Finalize packaging (only distributors)
        this.app.post('/api/batch/:batchId/package',
            AuthMiddleware.authenticate,
            AuthMiddleware.authorize(config.roles.DISTRIBUTOR),
            AuthMiddleware.validateBatchAccess,
            AuthMiddleware.auditLog,
            async (req, res) => {
                try {
                    const result = await this.api.finalizePackaging(req.params.batchId, req.body);
                    res.status(result.success ? 201 : 400).json(result);
                } catch (error) {
                    logger.error(`Finalize packaging failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'finalize_packaging'));
                }
            }
        );

        // SHARED ENDPOINTS (accessible by multiple roles)

        // Get provenance history (all authenticated users)
        this.app.get('/api/batch/:batchId/provenance',
            AuthMiddleware.authenticate,
            AuthMiddleware.validateBatchAccess,
            async (req, res) => {
                try {
                    const result = await this.api.getProvenanceHistory(req.params.batchId);
                    res.json(result);
                } catch (error) {
                    logger.error(`Get provenance history failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'get_provenance_history'));
                }
            }
        );

        // Get provenance by QR code (public endpoint for consumers)
        this.app.get('/api/trace/:qrCodeId',
            async (req, res) => {
                try {
                    const result = await this.api.getProvenanceByQRCode(req.params.qrCodeId);
                    res.json(result);
                } catch (error) {
                    logger.error(`Get provenance by QR failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'get_provenance_by_qr'));
                }
            }
        );

        // Validate GPS coordinates (farmers and regulators)
        this.app.post('/api/validate/gps',
            AuthMiddleware.authenticate,
            AuthMiddleware.authorize(config.roles.FARMER, config.roles.REGULATOR),
            async (req, res) => {
                try {
                    const { herbType, coordinates } = req.body;
                    const result = await this.api.validateGPSCoordinates(herbType, coordinates);
                    res.json(result);
                } catch (error) {
                    logger.error(`GPS validation failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'validate_gps'));
                }
            }
        );

        // Get zones for herb type (all authenticated users)
        this.app.get('/api/zones/:herbType',
            AuthMiddleware.authenticate,
            async (req, res) => {
                try {
                    const result = await this.api.getZonesForHerbType(req.params.herbType);
                    res.json(result);
                } catch (error) {
                    logger.error(`Get zones failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'get_zones'));
                }
            }
        );

        // REGULATOR-ONLY ENDPOINTS

        // Get batches by status
        this.app.get('/api/batches/status/:status',
            AuthMiddleware.authenticate,
            AuthMiddleware.authorize(config.roles.REGULATOR),
            async (req, res) => {
                try {
                    const result = await this.api.getBatchesByStatus(req.params.status);
                    res.json(result);
                } catch (error) {
                    logger.error(`Get batches by status failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'get_batches_by_status'));
                }
            }
        );

        // Get quota status
        this.app.get('/api/quota/:year?',
            AuthMiddleware.authenticate,
            AuthMiddleware.authorize(config.roles.REGULATOR),
            async (req, res) => {
                try {
                    const result = await this.api.getQuotaStatus(req.params.year);
                    res.json(result);
                } catch (error) {
                    logger.error(`Get quota status failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'get_quota_status'));
                }
            }
        );

        // Get system statistics
        this.app.get('/api/stats',
            AuthMiddleware.authenticate,
            AuthMiddleware.authorize(config.roles.REGULATOR),
            async (req, res) => {
                try {
                    const result = await this.api.getSystemStats();
                    res.json(result);
                } catch (error) {
                    logger.error(`Get system stats failed: ${error.message}`);
                    res.status(500).json(APIUtils.formatErrorResponse(error, 'get_system_stats'));
                }
            }
        );

        // API documentation endpoint
        this.app.get('/api/docs', (req, res) => {
            res.json({
                title: 'Ayurvedic Herb Traceability API',
                version: '1.0.0',
                description: 'Blockchain-based traceability system for Ayurvedic herbs',
                endpoints: {
                    authentication: {
                        'POST /api/auth/login': 'Login and get JWT token',
                        'POST /api/init': 'Initialize API connection'
                    },
                    farmer: {
                        'POST /api/harvest': 'Record harvest event',
                        'GET /api/farmer/:farmerId/batches': 'Get farmer\'s batches'
                    },
                    processor: {
                        'POST /api/batch/:batchId/processing': 'Add processing step'
                    },
                    lab: {
                        'POST /api/batch/:batchId/test': 'Upload lab test results',
                        'GET /api/batch/:batchId/tests': 'Get test results'
                    },
                    distributor: {
                        'POST /api/batch/:batchId/package': 'Finalize packaging'
                    },
                    shared: {
                        'GET /api/batch/:batchId/provenance': 'Get provenance history',
                        'GET /api/trace/:qrCodeId': 'Get provenance by QR code',
                        'POST /api/validate/gps': 'Validate GPS coordinates',
                        'GET /api/zones/:herbType': 'Get zones for herb type'
                    },
                    regulator: {
                        'GET /api/batches/status/:status': 'Get batches by status',
                        'GET /api/quota/:year?': 'Get quota status',
                        'GET /api/stats': 'Get system statistics'
                    }
                },
                roles: config.roles
            });
        });

        // 404 handler
        this.app.use('/api/*', (req, res) => {
            res.status(404).json(
                APIUtils.formatErrorResponse(
                    new Error('Endpoint not found'),
                    'routing'
                )
            );
        });
    }

    /**
     * Set up error handling middleware
     */
    setupErrorHandling() {
        // Global error handler
        this.app.use((error, req, res, next) => {
            logger.error('Unhandled error:', {
                error: error.message,
                stack: error.stack,
                requestId: req.requestId,
                path: req.path,
                method: req.method
            });

            res.status(500).json(
                APIUtils.formatErrorResponse(
                    new Error('Internal server error'),
                    'server_error'
                )
            );
        });

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            process.exit(1);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });
    }

    /**
     * Start the server
     * @param {number} port - Port number
     * @returns {Promise} Server instance
     */
    async start(port = config.server.port) {
        return new Promise((resolve, reject) => {
            try {
                const server = this.app.listen(port, config.server.host, () => {
                    logger.info(`🚀 Ayurvedic Herb Traceability API Server running on http://${config.server.host}:${port}`);
                    logger.info(`📚 API Documentation available at http://${config.server.host}:${port}/api/docs`);
                    logger.info(`🏥 Health check available at http://${config.server.host}:${port}/health`);
                    resolve(server);
                });

                server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        logger.error(`Port ${port} is already in use`);
                    } else {
                        logger.error('Server error:', error);
                    }
                    reject(error);
                });

            } catch (error) {
                logger.error('Failed to start server:', error);
                reject(error);
            }
        });
    }

    /**
     * Stop the server gracefully
     * @param {Object} server - Server instance
     */
    async stop(server) {
        return new Promise((resolve) => {
            server.close(async () => {
                logger.info('Server stopped');
                await this.api.disconnect();
                resolve();
            });
        });
    }
}

module.exports = TraceabilityServer;

// Start server if this file is run directly
if (require.main === module) {
    const server = new TraceabilityServer();
    server.start().catch(error => {
        logger.error('Failed to start server:', error);
        process.exit(1);
    });
}