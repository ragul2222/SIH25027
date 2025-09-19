const express = require('express');
const Joi = require('joi');
const Farmer = require('../models/Farmer');
const BlockchainAPIClient = require('./blockchain-api-client');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Collector Service - Farmer registration and harvest logging
 * As specified in Person 3 Backend Integration Guide
 */
class CollectorService {
    constructor() {
        this.router = express.Router();
        this.blockchainClient = new BlockchainAPIClient();
        this.setupRoutes();
        this.setupValidation();
    }

    setupValidation() {
        // Farmer registration validation schema
        this.farmerRegistrationSchema = Joi.object({
            farmerId: Joi.string().optional(),
            name: Joi.string().required().min(2).max(100),
            contactNumber: Joi.string().required().pattern(/^[6-9]\d{9}$/),
            email: Joi.string().email().optional(),
            address: Joi.object({
                street: Joi.string().required(),
                village: Joi.string().required(),
                district: Joi.string().required(),
                state: Joi.string().required(),
                pincode: Joi.string().required().pattern(/^\d{6}$/),
                coordinates: Joi.object({
                    latitude: Joi.number().min(-90).max(90).required(),
                    longitude: Joi.number().min(-180).max(180).required()
                }).optional()
            }).required(),
            certifications: Joi.array().items(
                Joi.string().valid('ORGANIC', 'FAIR_TRADE', 'GOOD_AGRICULTURAL_PRACTICES', 'AYUSH_PREMIUM')
            ).optional(),
            approvedHerbs: Joi.array().items(
                Joi.object({
                    herbType: Joi.string().required(),
                    herbVariety: Joi.string().required(),
                    certificationLevel: Joi.string().valid('BASIC', 'PREMIUM', 'ORGANIC').default('BASIC')
                })
            ).required(),
            bankDetails: Joi.object({
                accountNumber: Joi.string().required(),
                ifscCode: Joi.string().required().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/),
                bankName: Joi.string().required(),
                accountHolderName: Joi.string().required()
            }).optional()
        });

        // Harvest recording validation schema
        this.harvestSchema = Joi.object({
            farmerId: Joi.string().required(),
            herbType: Joi.string().required(),
            herbVariety: Joi.string().required(),
            quantityKg: Joi.number().positive().required(),
            collectionDate: Joi.date().max('now').required(),
            harvestSeason: Joi.string().valid('WINTER', 'SUMMER', 'MONSOON', 'POST_MONSOON').required(),
            gpsCoordinates: Joi.object({
                latitude: Joi.number().min(-90).max(90).required(),
                longitude: Joi.number().min(-180).max(180).required()
            }).required(),
            weatherConditions: Joi.object({
                temperature: Joi.number().optional(),
                humidity: Joi.number().min(0).max(100).optional(),
                rainfall: Joi.number().min(0).optional(),
                description: Joi.string().optional()
            }).optional(),
            soilConditions: Joi.object({
                ph: Joi.number().min(0).max(14).optional(),
                moisture: Joi.number().min(0).max(100).optional(),
                nitrogen: Joi.number().min(0).optional(),
                phosphorus: Joi.number().min(0).optional(),
                potassium: Joi.number().min(0).optional(),
                organicMatter: Joi.number().min(0).optional()
            }).optional(),
            certificationType: Joi.string().valid('ORGANIC', 'CONVENTIONAL', 'TRANSITIONAL').default('CONVENTIONAL'),
            notes: Joi.string().max(500).optional()
        });
    }

    setupRoutes() {
        // Register farmer
        this.router.post('/farmers/register', this.registerFarmer.bind(this));
        
        // Get farmer details
        this.router.get('/farmers/:farmerId', this.getFarmer.bind(this));
        
        // Update farmer information
        this.router.put('/farmers/:farmerId', this.updateFarmer.bind(this));
        
        // Record harvest
        this.router.post('/harvest/record', this.recordHarvest.bind(this));
        
        // Get farmer's harvests
        this.router.get('/farmers/:farmerId/harvests', this.getFarmerHarvests.bind(this));
        
        // Validate harvest location
        this.router.post('/harvest/validate-location', this.validateHarvestLocation.bind(this));
        
        // Get all farmers (for admin)
        this.router.get('/farmers', this.getAllFarmers.bind(this));
    }

    /**
     * Register new farmer
     */
    async registerFarmer(req, res) {
        try {
            // Validate request data
            const { error, value } = this.farmerRegistrationSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: error.details.map(d => d.message)
                });
            }

            // Generate farmer ID if not provided
            if (!value.farmerId) {
                value.farmerId = `FARMER_${value.address.state.substring(0, 2).toUpperCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            }

            // Check if farmer already exists
            const existingFarmer = await Farmer.findOne({ 
                $or: [
                    { farmerId: value.farmerId },
                    { contactNumber: value.contactNumber }
                ]
            });

            if (existingFarmer) {
                return res.status(409).json({
                    success: false,
                    error: 'Farmer already exists with this ID or contact number'
                });
            }

            // Create farmer in database
            const farmer = new Farmer(value);
            await farmer.save();

            // Generate password for blockchain identity
            const blockchainPassword = this.generateSecurePassword();
            
            // Register farmer in blockchain network
            try {
                const blockchainResult = await this.blockchainClient.registerUser({
                    userId: farmer.farmerId,
                    organization: 'farmer',
                    password: blockchainPassword,
                    role: 'farmer',
                    attributes: {
                        name: farmer.name,
                        district: farmer.address.district,
                        state: farmer.address.state,
                        certifications: farmer.certifications.join(',')
                    }
                });

                // Update farmer with blockchain identity
                farmer.blockchainIdentity = {
                    publicKey: blockchainResult.publicKey,
                    enrollmentId: blockchainResult.enrollmentId,
                    mspId: 'FarmerMSP'
                };
                await farmer.save();

                // Store password securely (in production, use proper secret management)
                await this.storeUserCredentials(farmer.farmerId, blockchainPassword);

                logger.info(`Farmer ${farmer.farmerId} registered successfully`);

                res.status(201).json({
                    success: true,
                    data: {
                        farmerId: farmer.farmerId,
                        name: farmer.name,
                        status: farmer.status,
                        blockchainEnrollment: !!blockchainResult.enrollmentId
                    },
                    message: 'Farmer registered successfully'
                });

            } catch (blockchainError) {
                logger.error('Blockchain registration failed:', blockchainError);
                // Keep farmer in database but mark blockchain identity as pending
                farmer.status = 'INACTIVE';
                await farmer.save();

                res.status(201).json({
                    success: true,
                    data: {
                        farmerId: farmer.farmerId,
                        name: farmer.name,
                        status: farmer.status,
                        blockchainEnrollment: false
                    },
                    warning: 'Farmer registered but blockchain enrollment pending',
                    error: blockchainError.message
                });
            }

        } catch (error) {
            logger.error('Farmer registration error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    }

    /**
     * Record harvest
     */
    async recordHarvest(req, res) {
        try {
            // Validate request data
            const { error, value } = this.harvestSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: error.details.map(d => d.message)
                });
            }

            // Find farmer
            const farmer = await Farmer.findOne({ farmerId: value.farmerId });
            if (!farmer) {
                return res.status(404).json({
                    success: false,
                    error: 'Farmer not found'
                });
            }

            // Check if farmer is active
            if (farmer.status !== 'ACTIVE') {
                return res.status(403).json({
                    success: false,
                    error: 'Farmer account is not active'
                });
            }

            // Validate herb authorization
            if (!farmer.canHarvestHerb(value.herbType, value.herbVariety)) {
                return res.status(403).json({
                    success: false,
                    error: `Farmer is not authorized to harvest ${value.herbType} - ${value.herbVariety}`
                });
            }

            // Get farmer's blockchain credentials
            const farmerCredentials = await this.getUserCredentials(farmer.farmerId);
            if (!farmerCredentials) {
                return res.status(500).json({
                    success: false,
                    error: 'Farmer blockchain credentials not found'
                });
            }

            // Login to blockchain
            const loginResult = await this.blockchainClient.loginUser(
                farmer.farmerId,
                'farmer',
                farmerCredentials.password
            );

            // Validate GPS coordinates
            const gpsValidation = await this.blockchainClient.validateGPS(
                value.herbType,
                value.gpsCoordinates,
                loginResult.token
            );

            if (!gpsValidation.isValid) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid GPS coordinates for this herb type',
                    details: gpsValidation.reason
                });
            }

            // Generate batch ID
            const batchId = this.blockchainClient.generateBatchId(value);

            // Prepare harvest data for blockchain
            const harvestData = {
                batchId,
                farmerId: farmer.farmerId,
                farmerName: farmer.name,
                herbType: value.herbType,
                herbVariety: value.herbVariety,
                quantityKg: value.quantityKg,
                collectionDate: value.collectionDate,
                harvestSeason: value.harvestSeason,
                gpsCoordinates: value.gpsCoordinates,
                weatherConditions: value.weatherConditions,
                soilConditions: value.soilConditions,
                certificationType: value.certificationType,
                sustainabilityScore: this.calculateSustainabilityScore(farmer, value)
            };

            // Record harvest on blockchain
            const blockchainResult = await this.blockchainClient.recordHarvest(harvestData, loginResult.token);

            // Store metadata in off-chain database
            await this.storeHarvestMetadata(farmer.farmerId, value, blockchainResult);

            logger.info(`Harvest recorded successfully for batch ${blockchainResult.batchId}`);

            res.status(201).json({
                success: true,
                data: {
                    batchId: blockchainResult.batchId,
                    transactionId: blockchainResult.transactionId,
                    timestamp: blockchainResult.timestamp,
                    farmerName: farmer.name,
                    herbType: value.herbType,
                    quantityKg: value.quantityKg
                },
                message: 'Harvest recorded successfully'
            });

        } catch (error) {
            logger.error('Harvest recording error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    }

    /**
     * Get farmer details
     */
    async getFarmer(req, res) {
        try {
            const { farmerId } = req.params;
            
            const farmer = await Farmer.findOne({ farmerId }).select('-blockchainIdentity.privateKey');
            if (!farmer) {
                return res.status(404).json({
                    success: false,
                    error: 'Farmer not found'
                });
            }

            res.json({
                success: true,
                data: farmer
            });

        } catch (error) {
            logger.error('Get farmer error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Update farmer information
     */
    async updateFarmer(req, res) {
        try {
            const { farmerId } = req.params;
            
            const farmer = await Farmer.findOne({ farmerId });
            if (!farmer) {
                return res.status(404).json({
                    success: false,
                    error: 'Farmer not found'
                });
            }

            // Update farmer data
            Object.assign(farmer, req.body);
            await farmer.save();

            res.json({
                success: true,
                data: farmer,
                message: 'Farmer updated successfully'
            });

        } catch (error) {
            logger.error('Update farmer error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Get farmer's harvests
     */
    async getFarmerHarvests(req, res) {
        try {
            const { farmerId } = req.params;
            
            const farmer = await Farmer.findOne({ farmerId });
            if (!farmer) {
                return res.status(404).json({
                    success: false,
                    error: 'Farmer not found'
                });
            }

            // Get farmer's blockchain credentials and fetch harvests
            const farmerCredentials = await this.getUserCredentials(farmerId);
            if (farmerCredentials) {
                const loginResult = await this.blockchainClient.loginUser(farmerId, 'farmer', farmerCredentials.password);
                const harvests = await this.blockchainClient.getUserBatches(farmerId, 'farmer', loginResult.token);
                
                res.json({
                    success: true,
                    data: harvests
                });
            } else {
                res.json({
                    success: true,
                    data: [],
                    message: 'No blockchain credentials found'
                });
            }

        } catch (error) {
            logger.error('Get farmer harvests error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Validate harvest location
     */
    async validateHarvestLocation(req, res) {
        try {
            const { herbType, coordinates } = req.body;
            
            if (!herbType || !coordinates) {
                return res.status(400).json({
                    success: false,
                    error: 'herbType and coordinates are required'
                });
            }

            // For testing without authentication, use a system token
            const validation = await this.blockchainClient.validateGPS(herbType, coordinates, 'system_token');
            
            res.json({
                success: true,
                data: validation
            });

        } catch (error) {
            logger.error('GPS validation error:', error);
            res.status(500).json({
                success: false,
                error: 'GPS validation failed',
                message: error.message
            });
        }
    }

    /**
     * Get all farmers (for admin)
     */
    async getAllFarmers(req, res) {
        try {
            const { page = 1, limit = 10, state, district } = req.query;
            
            const query = {};
            if (state) query['address.state'] = state;
            if (district) query['address.district'] = district;

            const farmers = await Farmer.find(query)
                .select('-blockchainIdentity.privateKey')
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ createdAt: -1 });

            const total = await Farmer.countDocuments(query);

            res.json({
                success: true,
                data: farmers,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            logger.error('Get all farmers error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Utility methods
     */
    generateSecurePassword() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 16; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    async storeUserCredentials(userId, password) {
        // In production, use proper secret management like AWS Secrets Manager or HashiCorp Vault
        // For now, store in environment or encrypted file
        logger.info(`Storing credentials for user ${userId}`);
        // Implementation depends on chosen secret management solution
    }

    async getUserCredentials(userId) {
        // Retrieve stored credentials
        // This is a placeholder - implement based on chosen secret management
        return {
            password: 'stored_password' // Replace with actual implementation
        };
    }

    calculateSustainabilityScore(farmer, harvestData) {
        let score = 50; // Base score

        // Organic certification bonus
        if (farmer.certifications.includes('ORGANIC')) score += 20;
        if (farmer.certifications.includes('FAIR_TRADE')) score += 10;

        // Soil health bonus
        if (harvestData.soilConditions && harvestData.soilConditions.organicMatter > 3) score += 10;

        // Weather conditions consideration
        if (harvestData.weatherConditions && harvestData.weatherConditions.rainfall > 0) score += 5;

        return Math.min(score, 100);
    }

    async storeHarvestMetadata(farmerId, harvestData, blockchainResult) {
        // Store additional metadata that doesn't go on blockchain
        logger.info(`Storing harvest metadata for farmer ${farmerId}, batch ${blockchainResult.batchId}`);
        // Implementation for storing in MongoDB collections for analytics
    }

    getRouter() {
        return this.router;
    }
}

module.exports = CollectorService;