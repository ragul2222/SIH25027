const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Blockchain API Client for Person 3 Backend Integration
 * Implements all blockchain API calls as specified in Person 3 Backend Integration Guide
 */
class BlockchainAPIClient {
    constructor(config = {}) {
        this.baseURL = config.baseURL || process.env.BLOCKCHAIN_API_BASE || 'http://localhost:3000/api';
        this.timeout = config.timeout || 30000; // 30 seconds
        this.defaultHeaders = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
        
        // Create axios instance
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: this.timeout,
            headers: this.defaultHeaders
        });

        // Add request interceptor for logging
        this.client.interceptors.request.use(
            (config) => {
                logger.info(`Blockchain API Request: ${config.method.toUpperCase()} ${config.url}`);
                return config;
            },
            (error) => {
                logger.error('Blockchain API Request Error:', error);
                return Promise.reject(error);
            }
        );

        // Add response interceptor for logging
        this.client.interceptors.response.use(
            (response) => {
                logger.info(`Blockchain API Response: ${response.status} ${response.config.url}`);
                return response;
            },
            (error) => {
                logger.error('Blockchain API Response Error:', error.response?.data || error.message);
                return Promise.reject(error);
            }
        );
    }

    /**
     * Authentication API - Login and get JWT token
     */
    async loginUser(userId, organization, password) {
        try {
            const response = await this.client.post('/auth/login', {
                userId,
                organization,
                password
            });

            if (response.data.success) {
                logger.info(`User ${userId} logged in successfully`);
                return {
                    token: response.data.data.token,
                    user: response.data.data.user,
                    organization: response.data.data.organization
                };
            }
            throw new Error(response.data.error || 'Login failed');
        } catch (error) {
            logger.error(`Login failed for user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Register new user in blockchain network
     */
    async registerUser(userData) {
        try {
            const response = await this.client.post('/auth/register', userData);
            if (response.data.success) {
                logger.info(`User ${userData.userId} registered successfully`);
                return response.data.data;
            }
            throw new Error(response.data.error || 'Registration failed');
        } catch (error) {
            logger.error('User registration failed:', error.message);
            throw error;
        }
    }

    /**
     * Core Transaction APIs
     */

    /**
     * Record harvest (Farmers Only)
     */
    async recordHarvest(harvestData, farmerToken) {
        try {
            const response = await this.client.post('/harvest', harvestData, {
                headers: {
                    'Authorization': `Bearer ${farmerToken}`
                }
            });

            if (response.data.success) {
                logger.info(`Harvest recorded successfully for batch ${response.data.data.batchId}`);
                return {
                    batchId: response.data.data.batchId,
                    transactionId: response.data.data.transactionId,
                    timestamp: response.data.data.timestamp
                };
            }
            throw new Error(response.data.error || 'Harvest recording failed');
        } catch (error) {
            logger.error('Harvest recording failed:', error.message);
            throw error;
        }
    }

    /**
     * Add processing step (Processors Only)
     */
    async addProcessingStep(batchId, processingData, processorToken) {
        try {
            const response = await this.client.post(`/batch/${batchId}/processing`, processingData, {
                headers: {
                    'Authorization': `Bearer ${processorToken}`
                }
            });

            if (response.data.success) {
                logger.info(`Processing step added for batch ${batchId}`);
                return response.data.data;
            }
            throw new Error(response.data.error || 'Processing step addition failed');
        } catch (error) {
            logger.error(`Processing step addition failed for batch ${batchId}:`, error.message);
            throw error;
        }
    }

    /**
     * Upload lab result (Labs Only)
     */
    async uploadLabResult(batchId, testData, labToken) {
        try {
            const response = await this.client.post(`/batch/${batchId}/test`, testData, {
                headers: {
                    'Authorization': `Bearer ${labToken}`
                }
            });

            if (response.data.success) {
                logger.info(`Lab result uploaded for batch ${batchId}`);
                return response.data.data;
            }
            throw new Error(response.data.error || 'Lab result upload failed');
        } catch (error) {
            logger.error(`Lab result upload failed for batch ${batchId}:`, error.message);
            throw error;
        }
    }

    /**
     * Finalize packaging (Distributors Only)
     */
    async finalizePackaging(batchId, packageData, distributorToken) {
        try {
            const response = await this.client.post(`/batch/${batchId}/package`, packageData, {
                headers: {
                    'Authorization': `Bearer ${distributorToken}`
                }
            });

            if (response.data.success) {
                logger.info(`Packaging finalized for batch ${batchId}`);
                return response.data.data;
            }
            throw new Error(response.data.error || 'Package finalization failed');
        } catch (error) {
            logger.error(`Package finalization failed for batch ${batchId}:`, error.message);
            throw error;
        }
    }

    /**
     * Query APIs
     */

    /**
     * Get complete provenance for a batch
     */
    async getProvenance(batchId, token) {
        try {
            const response = await this.client.get(`/batch/${batchId}/provenance`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                logger.info(`Provenance retrieved for batch ${batchId}`);
                return response.data.data;
            }
            throw new Error(response.data.error || 'Provenance retrieval failed');
        } catch (error) {
            logger.error(`Provenance retrieval failed for batch ${batchId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get provenance by QR code (Public API)
     */
    async getProvenanceByQR(qrCodeId) {
        try {
            const response = await this.client.get(`/trace/${qrCodeId}`);

            if (response.data.success) {
                logger.info(`Provenance retrieved for QR code ${qrCodeId}`);
                return response.data.data;
            }
            throw new Error(response.data.error || 'QR provenance retrieval failed');
        } catch (error) {
            logger.error(`QR provenance retrieval failed for code ${qrCodeId}:`, error.message);
            throw error;
        }
    }

    /**
     * Validate GPS coordinates for herb type
     */
    async validateGPS(herbType, coordinates, token) {
        try {
            const response = await this.client.post('/validate/gps', {
                herbType,
                coordinates: {
                    latitude: coordinates.lat || coordinates.latitude,
                    longitude: coordinates.lng || coordinates.longitude
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                logger.info(`GPS validation successful for herb ${herbType}`);
                return response.data.data;
            }
            throw new Error(response.data.error || 'GPS validation failed');
        } catch (error) {
            logger.error(`GPS validation failed for herb ${herbType}:`, error.message);
            throw error;
        }
    }

    /**
     * Get batch status
     */
    async getBatchStatus(batchId, token) {
        try {
            const response = await this.client.get(`/batch/${batchId}/status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                logger.info(`Batch status retrieved for ${batchId}`);
                return response.data.data;
            }
            throw new Error(response.data.error || 'Batch status retrieval failed');
        } catch (error) {
            logger.error(`Batch status retrieval failed for ${batchId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get all batches for a user
     */
    async getUserBatches(userId, organization, token) {
        try {
            const response = await this.client.get(`/user/${userId}/batches`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                params: { organization }
            });

            if (response.data.success) {
                logger.info(`Batches retrieved for user ${userId}`);
                return response.data.data;
            }
            throw new Error(response.data.error || 'User batches retrieval failed');
        } catch (error) {
            logger.error(`User batches retrieval failed for ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Search batches by criteria
     */
    async searchBatches(searchCriteria, token) {
        try {
            const response = await this.client.post('/batch/search', searchCriteria, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.success) {
                logger.info('Batch search completed successfully');
                return response.data.data;
            }
            throw new Error(response.data.error || 'Batch search failed');
        } catch (error) {
            logger.error('Batch search failed:', error.message);
            throw error;
        }
    }

    /**
     * Utility Methods
     */

    /**
     * Generate batch ID for harvest
     */
    generateBatchId(harvestData) {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${harvestData.herbType}_${harvestData.farmerId}_${date}_${random}`;
    }

    /**
     * Validate harvest data before submitting
     */
    validateHarvestData(harvestData) {
        const required = ['farmerId', 'farmerName', 'herbType', 'quantityKg', 'collectionDate'];
        const missing = required.filter(field => !harvestData[field]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        if (harvestData.quantityKg <= 0) {
            throw new Error('Quantity must be greater than 0');
        }

        if (new Date(harvestData.collectionDate) > new Date()) {
            throw new Error('Collection date cannot be in the future');
        }

        return true;
    }

    /**
     * Health check for blockchain API
     */
    async healthCheck() {
        try {
            const response = await this.client.get('/health');
            return {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                apiVersion: response.data.version,
                responseTime: response.headers['x-response-time']
            };
        } catch (error) {
            logger.error('Blockchain API health check failed:', error.message);
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }
}

module.exports = BlockchainAPIClient;