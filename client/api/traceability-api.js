const FabricService = require('../fabric-service');
const APIUtils = require('../utils/api-utils');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Traceability API Service
 * Implements blockchain transaction APIs using Fabric SDK
 */
class TraceabilityAPI {
    constructor() {
        this.fabricService = new FabricService();
        this.isInitialized = false;
    }

    /**
     * Initialize API service with user identity
     * @param {string} org - Organization (farmer, processor, lab, distributor, regulator)
     * @param {string} userId - User identifier
     */
    async initialize(org, userId) {
        try {
            await this.fabricService.initialize(org, userId);
            this.currentOrg = org;
            this.currentUser = userId;
            this.isInitialized = true;
            logger.info(`TraceabilityAPI initialized for ${org}/${userId}`);
        } catch (error) {
            logger.error(`Failed to initialize TraceabilityAPI: ${error.message}`);
            throw error;
        }
    }

    /**
     * Record harvest (collection) event
     * @param {Object} harvestData - Harvest information
     * @returns {Object} Transaction result with batch ID
     */
    async recordHarvest(harvestData) {
        try {
            // Check permissions - only farmers can record harvest
            if (this.currentOrg !== 'farmer') {
                throw new Error('Only farmers can record harvest events');
            }

            // Generate batch ID if not provided
            if (!harvestData.batchId) {
                harvestData.batchId = APIUtils.generateBatchId(
                    harvestData.herbType,
                    harvestData.farmerId,
                    new Date(harvestData.collectionDate)
                );
            }

            // Validate GPS coordinates
            if (!APIUtils.validateGPSCoordinates(
                harvestData.gpsCoordinates.latitude,
                harvestData.gpsCoordinates.longitude
            )) {
                throw new Error('Invalid GPS coordinates provided');
            }

            // Add timestamp and digital signature placeholder
            harvestData.createdAt = new Date().toISOString();
            harvestData.digitalSignature = `SIG_${APIUtils.generateDataHash(harvestData)}`;

            logger.info(`Recording harvest for batch ${harvestData.batchId}`);

            // Step 1: Validate GPS coordinates against geofencing zones
            const gpsValidation = await this.fabricService.evaluateTransaction(
                'GeoFencingContract',
                'validateGPSCoordinates',
                harvestData.herbType,
                JSON.stringify(harvestData.gpsCoordinates)
            );

            if (!gpsValidation.result.isValid) {
                throw new Error(`GPS validation failed: ${gpsValidation.result.message}`);
            }

            // Step 2: Validate harvest season
            const seasonValidation = await this.fabricService.evaluateTransaction(
                'HarvestValidationContract',
                'validateHarvestSeason',
                harvestData.herbType,
                harvestData.collectionDate,
                JSON.stringify(harvestData.gpsCoordinates)
            );

            if (!seasonValidation.result.isValid) {
                throw new Error(`Season validation failed: ${seasonValidation.result.message}`);
            }

            // Step 3: Validate sustainability quota
            const quotaValidation = await this.fabricService.evaluateTransaction(
                'HarvestValidationContract',
                'validateSustainabilityQuota',
                harvestData.herbType,
                harvestData.quantityKg.toString(),
                harvestData.farmerId,
                harvestData.collectionDate
            );

            if (!quotaValidation.result.isValid) {
                throw new Error(`Sustainability quota validation failed: ${quotaValidation.result.message}`);
            }

            // Step 4: Create provenance record with collection event
            const provenanceResult = await this.fabricService.submitTransaction(
                'ProvenanceContract',
                'createProvenanceRecord',
                JSON.stringify(harvestData)
            );

            // Step 5: Update quota usage
            await this.fabricService.submitTransaction(
                'HarvestValidationContract',
                'updateQuotaUsage',
                harvestData.herbType,
                harvestData.quantityKg.toString(),
                harvestData.farmerId,
                harvestData.collectionDate
            );

            logger.info(`Harvest recorded successfully for batch ${harvestData.batchId}`);

            return APIUtils.formatSuccessResponse(
                {
                    batchId: harvestData.batchId,
                    status: 'Collected',
                    gpsValidation: gpsValidation.result,
                    seasonValidation: seasonValidation.result,
                    quotaValidation: quotaValidation.result
                },
                `Harvest recorded successfully for batch ${harvestData.batchId}`,
                {
                    transactionType: 'recordHarvest',
                    organization: this.currentOrg,
                    user: this.currentUser
                }
            );

        } catch (error) {
            logger.error(`recordHarvest failed: ${error.message}`);
            return APIUtils.formatErrorResponse(error, 'recordHarvest');
        }
    }

    /**
     * Add processing step to batch
     * @param {string} batchId - Batch identifier
     * @param {Object} processingData - Processing step information
     * @returns {Object} Transaction result
     */
    async addProcessingStep(batchId, processingData) {
        try {
            // Check permissions - only processors can add processing steps
            if (this.currentOrg !== 'processor') {
                throw new Error('Only processing facilities can add processing steps');
            }

            // Generate step ID if not provided
            if (!processingData.stepId) {
                processingData.stepId = APIUtils.generateStepId(
                    processingData.facilityId,
                    processingData.processType
                );
            }

            // Ensure batch ID consistency
            processingData.batchId = batchId;

            // Calculate yield percentage
            if (processingData.inputQuantityKg && processingData.outputQuantityKg) {
                processingData.yieldPercentage = APIUtils.calculateYield(
                    processingData.inputQuantityKg,
                    processingData.outputQuantityKg
                );
            }

            // Add timestamp and digital signature placeholder
            processingData.createdAt = new Date().toISOString();
            processingData.digitalSignature = `SIG_${APIUtils.generateDataHash(processingData)}`;

            logger.info(`Adding processing step ${processingData.stepId} to batch ${batchId}`);

            // Submit processing step to provenance contract
            const result = await this.fabricService.submitTransaction(
                'ProvenanceContract',
                'addProcessingStep',
                batchId,
                JSON.stringify(processingData)
            );

            logger.info(`Processing step added successfully: ${processingData.stepId}`);

            return APIUtils.formatSuccessResponse(
                result.result,
                `Processing step ${processingData.stepId} added successfully`,
                {
                    transactionType: 'addProcessingStep',
                    organization: this.currentOrg,
                    user: this.currentUser,
                    batchId,
                    stepId: processingData.stepId
                }
            );

        } catch (error) {
            logger.error(`addProcessingStep failed: ${error.message}`);
            return APIUtils.formatErrorResponse(error, 'addProcessingStep');
        }
    }

    /**
     * Upload lab test results
     * @param {string} batchId - Batch identifier
     * @param {Object} testData - Lab test results
     * @returns {Object} Transaction result
     */
    async uploadLabResult(batchId, testData) {
        try {
            // Check permissions - only labs can upload test results
            if (this.currentOrg !== 'lab') {
                throw new Error('Only certified laboratories can upload test results');
            }

            // Generate test ID if not provided
            if (!testData.testId) {
                testData.testId = APIUtils.generateTestId(
                    testData.labId,
                    testData.testType
                );
            }

            // Ensure batch ID consistency
            testData.batchId = batchId;

            // Add timestamp and digital signature placeholder
            testData.createdAt = new Date().toISOString();
            testData.digitalSignature = `SIG_${APIUtils.generateDataHash(testData)}`;

            logger.info(`Uploading lab result ${testData.testId} for batch ${batchId}`);

            // Step 1: Submit test results to quality test contract for validation
            const qualityTestResult = await this.fabricService.submitTransaction(
                'QualityTestContract',
                'submitTestResults',
                JSON.stringify(testData)
            );

            // Step 2: Add test result to provenance record
            const provenanceResult = await this.fabricService.submitTransaction(
                'ProvenanceContract',
                'addQualityTestResult',
                batchId,
                JSON.stringify(testData)
            );

            logger.info(`Lab result uploaded successfully: ${testData.testId}`);

            return APIUtils.formatSuccessResponse(
                {
                    testResult: qualityTestResult.result,
                    provenanceUpdate: provenanceResult.result
                },
                `Lab result ${testData.testId} uploaded successfully`,
                {
                    transactionType: 'uploadLabResult',
                    organization: this.currentOrg,
                    user: this.currentUser,
                    batchId,
                    testId: testData.testId
                }
            );

        } catch (error) {
            logger.error(`uploadLabResult failed: ${error.message}`);
            return APIUtils.formatErrorResponse(error, 'uploadLabResult');
        }
    }

    /**
     * Finalize packaging for distribution
     * @param {string} batchId - Batch identifier
     * @param {Object} distributionData - Distribution and packaging information
     * @returns {Object} Transaction result with QR code
     */
    async finalizePackaging(batchId, distributionData) {
        try {
            // Check permissions - only distributors can finalize packaging
            if (this.currentOrg !== 'distributor') {
                throw new Error('Only distributors can finalize packaging');
            }

            logger.info(`Finalizing packaging for batch ${batchId}`);

            // Submit packaging finalization to provenance contract
            const result = await this.fabricService.submitTransaction(
                'ProvenanceContract',
                'finalizePackaging',
                batchId,
                JSON.stringify(distributionData)
            );

            // Generate QR code for the batch
            const qrCodeData = await APIUtils.generateQRCode(
                batchId,
                result.result.qrCode.qrCodeId
            );

            logger.info(`Packaging finalized successfully for batch ${batchId}`);

            return APIUtils.formatSuccessResponse(
                {
                    ...result.result,
                    qrCode: {
                        ...result.result.qrCode,
                        image: qrCodeData.dataURL,
                        svg: qrCodeData.svg
                    }
                },
                `Packaging finalized successfully for batch ${batchId}`,
                {
                    transactionType: 'finalizePackaging',
                    organization: this.currentOrg,
                    user: this.currentUser,
                    batchId
                }
            );

        } catch (error) {
            logger.error(`finalizePackaging failed: ${error.message}`);
            return APIUtils.formatErrorResponse(error, 'finalizePackaging');
        }
    }

    /**
     * Get complete provenance history for a batch
     * @param {string} batchId - Batch identifier
     * @returns {Object} Complete provenance record
     */
    async getProvenanceHistory(batchId) {
        try {
            logger.info(`Retrieving provenance history for batch ${batchId}`);

            const result = await this.fabricService.evaluateTransaction(
                'ProvenanceContract',
                'getProvenanceRecord',
                batchId
            );

            return APIUtils.formatSuccessResponse(
                result.result,
                `Provenance history retrieved for batch ${batchId}`,
                {
                    queryType: 'getProvenanceHistory',
                    batchId
                }
            );

        } catch (error) {
            logger.error(`getProvenanceHistory failed: ${error.message}`);
            return APIUtils.formatErrorResponse(error, 'getProvenanceHistory');
        }
    }

    /**
     * Get provenance history by QR code
     * @param {string} qrCodeId - QR code identifier
     * @returns {Object} Provenance record
     */
    async getProvenanceByQRCode(qrCodeId) {
        try {
            logger.info(`Retrieving provenance history by QR code ${qrCodeId}`);

            const result = await this.fabricService.evaluateTransaction(
                'ProvenanceContract',
                'getProvenanceByQRCode',
                qrCodeId
            );

            return APIUtils.formatSuccessResponse(
                result.result,
                `Provenance history retrieved by QR code`,
                {
                    queryType: 'getProvenanceByQRCode',
                    qrCodeId
                }
            );

        } catch (error) {
            logger.error(`getProvenanceByQRCode failed: ${error.message}`);
            return APIUtils.formatErrorResponse(error, 'getProvenanceByQRCode');
        }
    }

    /**
     * Get batches by farmer
     * @param {string} farmerId - Farmer identifier
     * @returns {Object} Array of farmer's batches
     */
    async getBatchesByFarmer(farmerId) {
        try {
            // Check permissions - farmers can only see their own batches, regulators can see all
            if (this.currentOrg !== 'regulator' && this.currentUser !== farmerId) {
                throw new Error('Access denied: can only view own batches');
            }

            logger.info(`Retrieving batches for farmer ${farmerId}`);

            const result = await this.fabricService.evaluateTransaction(
                'ProvenanceContract',
                'getBatchesByFarmer',
                farmerId
            );

            return APIUtils.formatSuccessResponse(
                result.result,
                `Batches retrieved for farmer ${farmerId}`,
                {
                    queryType: 'getBatchesByFarmer',
                    farmerId
                }
            );

        } catch (error) {
            logger.error(`getBatchesByFarmer failed: ${error.message}`);
            return APIUtils.formatErrorResponse(error, 'getBatchesByFarmer');
        }
    }

    /**
     * Get batches by status
     * @param {string} status - Batch status
     * @returns {Object} Array of batches with specified status
     */
    async getBatchesByStatus(status) {
        try {
            // Check permissions - only regulators can query by status
            if (this.currentOrg !== 'regulator') {
                throw new Error('Only regulators can query batches by status');
            }

            logger.info(`Retrieving batches with status ${status}`);

            const result = await this.fabricService.evaluateTransaction(
                'ProvenanceContract',
                'getBatchesByStatus',
                status
            );

            return APIUtils.formatSuccessResponse(
                result.result,
                `Batches retrieved with status ${status}`,
                {
                    queryType: 'getBatchesByStatus',
                    status
                }
            );

        } catch (error) {
            logger.error(`getBatchesByStatus failed: ${error.message}`);
            return APIUtils.formatErrorResponse(error, 'getBatchesByStatus');
        }
    }

    /**
     * Get quality test results for a batch
     * @param {string} batchId - Batch identifier
     * @returns {Object} Test results
     */
    async getBatchTestResults(batchId) {
        try {
            logger.info(`Retrieving test results for batch ${batchId}`);

            const result = await this.fabricService.evaluateTransaction(
                'QualityTestContract',
                'getBatchTestResults',
                batchId
            );

            return APIUtils.formatSuccessResponse(
                result.result,
                `Test results retrieved for batch ${batchId}`,
                {
                    queryType: 'getBatchTestResults',
                    batchId
                }
            );

        } catch (error) {
            logger.error(`getBatchTestResults failed: ${error.message}`);
            return APIUtils.formatErrorResponse(error, 'getBatchTestResults');
        }
    }

    /**
     * Get quota status for sustainability tracking
     * @param {string} year - Year to check (optional)
     * @returns {Object} Quota status
     */
    async getQuotaStatus(year = null) {
        try {
            // Check permissions - only regulators can view quota status
            if (this.currentOrg !== 'regulator') {
                throw new Error('Only regulators can view quota status');
            }

            logger.info(`Retrieving quota status for year ${year || 'current'}`);

            const args = year ? [year] : [];
            const result = await this.fabricService.evaluateTransaction(
                'HarvestValidationContract',
                'getQuotaStatus',
                ...args
            );

            return APIUtils.formatSuccessResponse(
                result.result,
                `Quota status retrieved for year ${year || 'current'}`,
                {
                    queryType: 'getQuotaStatus',
                    year
                }
            );

        } catch (error) {
            logger.error(`getQuotaStatus failed: ${error.message}`);
            return APIUtils.formatErrorResponse(error, 'getQuotaStatus');
        }
    }

    /**
     * Get geofencing zones for a herb type
     * @param {string} herbType - Type of herb
     * @returns {Object} Applicable zones
     */
    async getZonesForHerbType(herbType) {
        try {
            logger.info(`Retrieving zones for herb type ${herbType}`);

            const result = await this.fabricService.evaluateTransaction(
                'GeoFencingContract',
                'getZonesForHerbType',
                herbType
            );

            return APIUtils.formatSuccessResponse(
                result.result,
                `Zones retrieved for herb type ${herbType}`,
                {
                    queryType: 'getZonesForHerbType',
                    herbType
                }
            );

        } catch (error) {
            logger.error(`getZonesForHerbType failed: ${error.message}`);
            return APIUtils.formatErrorResponse(error, 'getZonesForHerbType');
        }
    }

    /**
     * Validate GPS coordinates against geofencing zones
     * @param {string} herbType - Type of herb
     * @param {Object} gpsCoordinates - GPS coordinates
     * @returns {Object} Validation result
     */
    async validateGPSCoordinates(herbType, gpsCoordinates) {
        try {
            logger.info(`Validating GPS coordinates for herb type ${herbType}`);

            const result = await this.fabricService.evaluateTransaction(
                'GeoFencingContract',
                'validateGPSCoordinates',
                herbType,
                JSON.stringify(gpsCoordinates)
            );

            return APIUtils.formatSuccessResponse(
                result.result,
                `GPS coordinates validated for herb type ${herbType}`,
                {
                    queryType: 'validateGPSCoordinates',
                    herbType
                }
            );

        } catch (error) {
            logger.error(`validateGPSCoordinates failed: ${error.message}`);
            return APIUtils.formatErrorResponse(error, 'validateGPSCoordinates');
        }
    }

    /**
     * Get system statistics (for regulators)
     * @returns {Object} System statistics
     */
    async getSystemStats() {
        try {
            // Check permissions - only regulators can view system stats
            if (this.currentOrg !== 'regulator') {
                throw new Error('Only regulators can view system statistics');
            }

            logger.info('Retrieving system statistics');

            const result = await this.fabricService.evaluateTransaction(
                'ProvenanceContract',
                'getSystemStats'
            );

            return APIUtils.formatSuccessResponse(
                result.result,
                'System statistics retrieved successfully',
                {
                    queryType: 'getSystemStats'
                }
            );

        } catch (error) {
            logger.error(`getSystemStats failed: ${error.message}`);
            return APIUtils.formatErrorResponse(error, 'getSystemStats');
        }
    }

    /**
     * Disconnect from blockchain network
     */
    async disconnect() {
        try {
            await this.fabricService.disconnect();
            this.isInitialized = false;
            logger.info('TraceabilityAPI disconnected');
        } catch (error) {
            logger.error(`Error disconnecting TraceabilityAPI: ${error.message}`);
        }
    }
}

module.exports = TraceabilityAPI;