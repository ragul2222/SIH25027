const express = require('express');
const Joi = require('joi');
const ProcessingFacility = require('../models/ProcessingFacility');
const BlockchainAPIClient = require('./blockchain-api-client');
const logger = require('../utils/logger');

/**
 * Processing Service - Processing facility registration and processing step tracking
 * As specified in Person 3 Backend Integration Guide
 */
class ProcessingService {
    constructor() {
        this.router = express.Router();
        this.blockchainClient = new BlockchainAPIClient();
        this.setupRoutes();
        this.setupValidation();
    }

    setupValidation() {
        // Processing facility registration schema
        this.facilityRegistrationSchema = Joi.object({
            facilityId: Joi.string().optional(),
            facilityName: Joi.string().required().min(2).max(100),
            registrationNumber: Joi.string().required(),
            contactInfo: Joi.object({
                phone: Joi.string().required().pattern(/^[6-9]\d{9}$/),
                email: Joi.string().email().required(),
                website: Joi.string().uri().optional(),
                contactPerson: Joi.object({
                    name: Joi.string().required(),
                    designation: Joi.string().required(),
                    phone: Joi.string().required(),
                    email: Joi.string().email().required()
                }).required()
            }).required(),
            location: Joi.object({
                address: Joi.string().required(),
                city: Joi.string().required(),
                state: Joi.string().required(),
                pincode: Joi.string().required().pattern(/^\d{6}$/),
                coordinates: Joi.object({
                    latitude: Joi.number().min(-90).max(90).required(),
                    longitude: Joi.number().min(-180).max(180).required()
                }).optional()
            }).required(),
            capabilities: Joi.array().items(
                Joi.string().valid('DRYING', 'GRINDING', 'PACKAGING', 'SORTING', 'CLEANING', 
                                  'STERILIZATION', 'EXTRACTION', 'FORMULATION', 'QUALITY_CONTROL')
            ).required().min(1),
            certifications: Joi.array().items(
                Joi.string().valid('GMP', 'ISO_9001', 'ISO_22000', 'HACCP', 'ORGANIC', 'AYUSH_GMP', 'FSSAI')
            ).optional(),
            licenseInfo: Joi.object({
                licenseNumber: Joi.string().required(),
                licenseType: Joi.string().required(),
                issuingAuthority: Joi.string().required(),
                issueDate: Joi.date().required(),
                expiryDate: Joi.date().min(Joi.ref('issueDate')).required()
            }).required()
        });

        // Processing step schema
        this.processingStepSchema = Joi.object({
            facilityId: Joi.string().required(),
            batchId: Joi.string().required(),
            processType: Joi.string().valid('DRYING', 'GRINDING', 'PACKAGING', 'SORTING', 'CLEANING', 
                                          'STERILIZATION', 'EXTRACTION', 'FORMULATION', 'QUALITY_CONTROL').required(),
            inputQuantityKg: Joi.number().positive().required(),
            outputQuantityKg: Joi.number().positive().max(Joi.ref('inputQuantityKg')).required(),
            processStartTime: Joi.date().required(),
            processEndTime: Joi.date().min(Joi.ref('processStartTime')).required(),
            temperature: Joi.object({
                min: Joi.number().required(),
                max: Joi.number().min(Joi.ref('min')).required(),
                average: Joi.number().min(Joi.ref('min')).max(Joi.ref('max')).required()
            }).optional(),
            humidity: Joi.object({
                min: Joi.number().min(0).max(100).required(),
                max: Joi.number().min(Joi.ref('min')).max(100).required(),
                average: Joi.number().min(Joi.ref('min')).max(Joi.ref('max')).required()
            }).optional(),
            equipmentUsed: Joi.array().items(
                Joi.object({
                    equipmentId: Joi.string().required(),
                    name: Joi.string().required(),
                    operationTime: Joi.number().positive().required()
                })
            ).required().min(1),
            operatorId: Joi.string().required(),
            qualityParameters: Joi.object({
                moistureContent: Joi.number().min(0).max(100).optional(),
                particleSize: Joi.string().optional(),
                color: Joi.string().optional(),
                aroma: Joi.string().optional(),
                contaminants: Joi.array().items(Joi.string()).optional()
            }).optional(),
            notes: Joi.string().max(500).optional()
        });
    }

    setupRoutes() {
        // Register processing facility
        this.router.post('/facilities/register', this.registerFacility.bind(this));
        
        // Get facility details
        this.router.get('/facilities/:facilityId', this.getFacility.bind(this));
        
        // Update facility information
        this.router.put('/facilities/:facilityId', this.updateFacility.bind(this));
        
        // Add processing step
        this.router.post('/processing/add-step', this.addProcessingStep.bind(this));
        
        // Get facility's processing history
        this.router.get('/facilities/:facilityId/processing-history', this.getProcessingHistory.bind(this));
        
        // Get batch processing status
        this.router.get('/batch/:batchId/processing-status', this.getBatchProcessingStatus.bind(this));
        
        // Get all facilities (for admin)
        this.router.get('/facilities', this.getAllFacilities.bind(this));
        
        // Get facilities by capability
        this.router.get('/facilities/by-capability/:capability', this.getFacilitiesByCapability.bind(this));
    }

    /**
     * Register new processing facility
     */
    async registerFacility(req, res) {
        try {
            // Validate request data
            const { error, value } = this.facilityRegistrationSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: error.details.map(d => d.message)
                });
            }

            // Generate facility ID if not provided
            if (!value.facilityId) {
                value.facilityId = `FACILITY_${value.location.state.substring(0, 2).toUpperCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            }

            // Check if facility already exists
            const existingFacility = await ProcessingFacility.findOne({ 
                $or: [
                    { facilityId: value.facilityId },
                    { registrationNumber: value.registrationNumber }
                ]
            });

            if (existingFacility) {
                return res.status(409).json({
                    success: false,
                    error: 'Facility already exists with this ID or registration number'
                });
            }

            // Create facility in database
            const facility = new ProcessingFacility(value);
            await facility.save();

            // Generate password for blockchain identity
            const blockchainPassword = this.generateSecurePassword();
            
            // Register facility in blockchain network
            try {
                const blockchainResult = await this.blockchainClient.registerUser({
                    userId: facility.facilityId,
                    organization: 'processor',
                    password: blockchainPassword,
                    role: 'processor',
                    attributes: {
                        name: facility.facilityName,
                        city: facility.location.city,
                        state: facility.location.state,
                        capabilities: facility.capabilities.join(','),
                        certifications: facility.certifications.join(',')
                    }
                });

                // Update facility with blockchain identity
                facility.blockchainIdentity = {
                    publicKey: blockchainResult.publicKey,
                    enrollmentId: blockchainResult.enrollmentId,
                    mspId: 'ProcessorMSP'
                };
                await facility.save();

                // Store password securely
                await this.storeUserCredentials(facility.facilityId, blockchainPassword);

                logger.info(`Processing facility ${facility.facilityId} registered successfully`);

                res.status(201).json({
                    success: true,
                    data: {
                        facilityId: facility.facilityId,
                        facilityName: facility.facilityName,
                        status: facility.status,
                        blockchainEnrollment: !!blockchainResult.enrollmentId
                    },
                    message: 'Processing facility registered successfully'
                });

            } catch (blockchainError) {
                logger.error('Blockchain registration failed:', blockchainError);
                facility.status = 'INACTIVE';
                await facility.save();

                res.status(201).json({
                    success: true,
                    data: {
                        facilityId: facility.facilityId,
                        facilityName: facility.facilityName,
                        status: facility.status,
                        blockchainEnrollment: false
                    },
                    warning: 'Facility registered but blockchain enrollment pending',
                    error: blockchainError.message
                });
            }

        } catch (error) {
            logger.error('Facility registration error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    }

    /**
     * Add processing step to a batch
     */
    async addProcessingStep(req, res) {
        try {
            // Validate request data
            const { error, value } = this.processingStepSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: error.details.map(d => d.message)
                });
            }

            // Find facility
            const facility = await ProcessingFacility.findOne({ facilityId: value.facilityId });
            if (!facility) {
                return res.status(404).json({
                    success: false,
                    error: 'Processing facility not found'
                });
            }

            // Check if facility is operational
            if (!facility.isOperational()) {
                return res.status(403).json({
                    success: false,
                    error: 'Processing facility is not operational'
                });
            }

            // Validate processing capability
            if (!facility.canPerformProcessing(value.processType)) {
                return res.status(403).json({
                    success: false,
                    error: `Facility cannot perform ${value.processType} processing`
                });
            }

            // Validate equipment availability
            const availableEquipment = facility.getAvailableEquipment(value.processType);
            if (availableEquipment.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: `No operational equipment available for ${value.processType}`
                });
            }

            // Get facility's blockchain credentials
            const facilityCredentials = await this.getUserCredentials(facility.facilityId);
            if (!facilityCredentials) {
                return res.status(500).json({
                    success: false,
                    error: 'Facility blockchain credentials not found'
                });
            }

            // Login to blockchain
            const loginResult = await this.blockchainClient.loginUser(
                facility.facilityId,
                'processor',
                facilityCredentials.password
            );

            // Prepare processing data for blockchain
            const processingData = {
                processType: value.processType,
                facilityId: facility.facilityId,
                facilityName: facility.facilityName,
                inputQuantityKg: value.inputQuantityKg,
                outputQuantityKg: value.outputQuantityKg,
                processStartTime: value.processStartTime,
                processEndTime: value.processEndTime,
                temperature: value.temperature,
                humidity: value.humidity,
                equipmentUsed: value.equipmentUsed,
                operatorId: value.operatorId,
                qualityParameters: value.qualityParameters,
                sustainabilityMetrics: this.calculateProcessingSustainability(facility, value),
                certifications: facility.certifications
            };

            // Add processing step to blockchain
            const blockchainResult = await this.blockchainClient.addProcessingStep(
                value.batchId,
                processingData,
                loginResult.token
            );

            // Store metadata in off-chain database
            await this.storeProcessingMetadata(facility.facilityId, value, blockchainResult);

            // Update facility performance metrics
            await this.updateFacilityMetrics(facility, value);

            logger.info(`Processing step added successfully for batch ${value.batchId}`);

            res.status(201).json({
                success: true,
                data: {
                    batchId: value.batchId,
                    processType: value.processType,
                    facilityName: facility.facilityName,
                    transactionId: blockchainResult.transactionId,
                    timestamp: blockchainResult.timestamp,
                    yieldPercentage: (value.outputQuantityKg / value.inputQuantityKg * 100).toFixed(2)
                },
                message: 'Processing step added successfully'
            });

        } catch (error) {
            logger.error('Processing step addition error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error',
                message: error.message
            });
        }
    }

    /**
     * Get facility details
     */
    async getFacility(req, res) {
        try {
            const { facilityId } = req.params;
            
            const facility = await ProcessingFacility.findOne({ facilityId }).select('-blockchainIdentity.privateKey');
            if (!facility) {
                return res.status(404).json({
                    success: false,
                    error: 'Processing facility not found'
                });
            }

            res.json({
                success: true,
                data: facility
            });

        } catch (error) {
            logger.error('Get facility error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Get facilities by capability
     */
    async getFacilitiesByCapability(req, res) {
        try {
            const { capability } = req.params;
            const { state, city } = req.query;

            const query = {
                capabilities: capability,
                status: 'ACTIVE'
            };

            if (state) query['location.state'] = state;
            if (city) query['location.city'] = city;

            const facilities = await ProcessingFacility.find(query)
                .select('facilityId facilityName location capabilities certifications performanceMetrics')
                .sort({ 'performanceMetrics.capacityUtilization': 1 });

            res.json({
                success: true,
                data: facilities,
                count: facilities.length
            });

        } catch (error) {
            logger.error('Get facilities by capability error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Update facility information
     */
    async updateFacility(req, res) {
        try {
            const { facilityId } = req.params;
            
            const facility = await ProcessingFacility.findOne({ facilityId });
            if (!facility) {
                return res.status(404).json({
                    success: false,
                    error: 'Processing facility not found'
                });
            }

            // Update facility data
            Object.assign(facility, req.body);
            await facility.save();

            res.json({
                success: true,
                data: facility,
                message: 'Facility updated successfully'
            });

        } catch (error) {
            logger.error('Update facility error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Get facility's processing history
     */
    async getProcessingHistory(req, res) {
        try {
            const { facilityId } = req.params;
            
            const facility = await ProcessingFacility.findOne({ facilityId });
            if (!facility) {
                return res.status(404).json({
                    success: false,
                    error: 'Processing facility not found'
                });
            }

            // Get facility's processing history from blockchain
            res.json({
                success: true,
                data: [],
                message: 'Processing history retrieval not implemented yet'
            });

        } catch (error) {
            logger.error('Get processing history error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Get batch processing status
     */
    async getBatchProcessingStatus(req, res) {
        try {
            const { batchId } = req.params;
            
            // Get batch status from blockchain
            res.json({
                success: true,
                data: { batchId, status: 'processing' },
                message: 'Batch processing status retrieval not implemented yet'
            });

        } catch (error) {
            logger.error('Get batch processing status error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    /**
     * Get all facilities (for admin)
     */
    async getAllFacilities(req, res) {
        try {
            const { page = 1, limit = 10, state, city } = req.query;
            
            const query = {};
            if (state) query['location.state'] = state;
            if (city) query['location.city'] = city;

            const facilities = await ProcessingFacility.find(query)
                .select('-blockchainIdentity.privateKey')
                .limit(limit * 1)
                .skip((page - 1) * limit)
                .sort({ createdAt: -1 });

            const total = await ProcessingFacility.countDocuments(query);

            res.json({
                success: true,
                data: facilities,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            logger.error('Get all facilities error:', error);
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
        logger.info(`Storing credentials for facility ${userId}`);
        // Implementation depends on chosen secret management solution
    }

    async getUserCredentials(userId) {
        return {
            password: 'stored_password' // Replace with actual implementation
        };
    }

    calculateProcessingSustainability(facility, processingData) {
        const processingTime = (new Date(processingData.processEndTime) - new Date(processingData.processStartTime)) / (1000 * 60 * 60); // hours
        const yieldPercentage = processingData.outputQuantityKg / processingData.inputQuantityKg;
        
        return {
            energyEfficiency: facility.sustainabilityMetrics?.energyConsumption || 0,
            processingYield: yieldPercentage,
            processingTime: processingTime,
            wasteGeneration: processingData.inputQuantityKg - processingData.outputQuantityKg
        };
    }

    async storeProcessingMetadata(facilityId, processingData, blockchainResult) {
        logger.info(`Storing processing metadata for facility ${facilityId}, batch ${processingData.batchId}`);
        // Implementation for storing in MongoDB collections for analytics
    }

    async updateFacilityMetrics(facility, processingData) {
        const processingTime = (new Date(processingData.processEndTime) - new Date(processingData.processStartTime)) / (1000 * 60 * 60);
        
        facility.performanceMetrics.totalBatchesProcessed += 1;
        facility.performanceMetrics.averageProcessingTime = 
            ((facility.performanceMetrics.averageProcessingTime * (facility.performanceMetrics.totalBatchesProcessed - 1)) + processingTime) 
            / facility.performanceMetrics.totalBatchesProcessed;
        
        await facility.save();
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ProcessingService;