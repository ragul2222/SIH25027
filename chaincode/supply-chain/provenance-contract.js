const { Contract } = require('fabric-contract-api');
const TraceabilityUtils = require('./utils');
const { 
    collectionEventSchema, 
    processingStepSchema, 
    qualityTestSchema, 
    provenanceRecordSchema 
} = require('./schemas');

/**
 * Provenance Smart Contract for Ayurvedic Herb Traceability
 * Links all steps (collection → processing → testing → packaging)
 */
class ProvenanceContract extends Contract {

    constructor() {
        super('ProvenanceContract');
    }

    /**
     * Initialize contract
     * @param {Context} ctx - Transaction context
     */
    async initLedger(ctx) {
        console.info('============= START : Initialize Provenance Ledger ===========');
        
        // Initialize provenance tracking system
        const systemConfig = {
            version: '1.0.0',
            initialized: new Date().toISOString(),
            totalBatches: 0,
            activeStatuses: [
                'Collected', 'In-Processing', 'Quality-Testing', 
                'Tested-Pass', 'Tested-Fail', 'Packaged', 'Distributed', 'Recalled'
            ]
        };

        await ctx.stub.putState('PROVENANCE_CONFIG', Buffer.from(JSON.stringify(systemConfig)));
        console.info('============= END : Initialize Provenance Ledger ===========');
    }

    /**
     * Create a new provenance record from collection event
     * @param {Context} ctx - Transaction context
     * @param {string} collectionData - JSON string containing collection event data
     * @returns {Object} Created provenance record
     */
    async createProvenanceRecord(ctx, collectionData) {
        console.info('============= START : Create Provenance Record ===========');

        const collectionEvent = JSON.parse(collectionData);

        // Validate collection event schema
        const { error, value } = collectionEventSchema.validate(collectionEvent);
        if (error) {
            throw new Error(`Invalid collection data: ${error.details[0].message}`);
        }

        // Check if batch already exists
        const existingRecord = await ctx.stub.getState(value.batchId);
        if (existingRecord && existingRecord.length > 0) {
            throw new Error(`Batch ${value.batchId} already exists`);
        }

        // Create initial provenance record
        const provenanceRecord = {
            batchId: value.batchId,
            currentStatus: 'Collected',
            collectionEvent: value,
            processingSteps: [],
            qualityTests: [],
            distributionInfo: null,
            compliance: {
                organicCertified: value.certificationType === 'Organic',
                gmpCertified: false,
                isoCertified: false,
                ayushCompliant: false,
                fssaiApproved: false
            },
            sustainability: {
                sustainabilityScore: value.sustainabilityScore || 0
            },
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            version: 1
        };

        // Validate the complete provenance record
        const { error: provError } = provenanceRecordSchema.validate(provenanceRecord);
        if (provError) {
            throw new Error(`Invalid provenance record: ${provError.details[0].message}`);
        }

        await ctx.stub.putState(value.batchId, Buffer.from(JSON.stringify(provenanceRecord)));

        // Update system statistics
        await this.updateSystemStats(ctx, 'batch_created');

        console.info('============= END : Create Provenance Record ===========');
        return {
            success: true,
            batchId: value.batchId,
            status: provenanceRecord.currentStatus,
            message: `Provenance record created for batch ${value.batchId}`
        };
    }

    /**
     * Add processing step to provenance record
     * @param {Context} ctx - Transaction context
     * @param {string} batchId - Batch identifier
     * @param {string} processingData - JSON string containing processing step data
     * @returns {Object} Updated provenance record
     */
    async addProcessingStep(ctx, batchId, processingData) {
        console.info('============= START : Add Processing Step ===========');

        const processingStep = JSON.parse(processingData);

        // Validate processing step schema
        const { error, value } = processingStepSchema.validate(processingStep);
        if (error) {
            throw new Error(`Invalid processing data: ${error.details[0].message}`);
        }

        // Ensure batch ID consistency
        if (value.batchId !== batchId) {
            throw new Error('Batch ID mismatch between parameters and processing data');
        }

        // Get existing provenance record
        const recordBuffer = await ctx.stub.getState(batchId);
        if (!recordBuffer || recordBuffer.length === 0) {
            throw new Error(`Batch ${batchId} not found`);
        }

        const provenanceRecord = JSON.parse(recordBuffer.toString());

        // Check if step already exists
        const existingStep = provenanceRecord.processingSteps.find(step => step.stepId === value.stepId);
        if (existingStep) {
            throw new Error(`Processing step ${value.stepId} already exists for batch ${batchId}`);
        }

        // Add processing step
        provenanceRecord.processingSteps.push(value);
        provenanceRecord.currentStatus = 'In-Processing';
        provenanceRecord.lastUpdated = new Date().toISOString();
        provenanceRecord.version += 1;

        // Calculate sustainability metrics
        await this.updateSustainabilityMetrics(ctx, provenanceRecord, value);

        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(provenanceRecord)));

        console.info('============= END : Add Processing Step ===========');
        return {
            success: true,
            batchId,
            stepId: value.stepId,
            status: provenanceRecord.currentStatus,
            totalSteps: provenanceRecord.processingSteps.length,
            message: `Processing step ${value.stepId} added to batch ${batchId}`
        };
    }

    /**
     * Add quality test result to provenance record
     * @param {Context} ctx - Transaction context
     * @param {string} batchId - Batch identifier
     * @param {string} testData - JSON string containing test result data
     * @returns {Object} Updated provenance record
     */
    async addQualityTestResult(ctx, batchId, testData) {
        console.info('============= START : Add Quality Test Result ===========');

        const testResult = JSON.parse(testData);

        // Validate test result schema
        const { error, value } = qualityTestSchema.validate(testResult);
        if (error) {
            throw new Error(`Invalid test data: ${error.details[0].message}`);
        }

        // Ensure batch ID consistency
        if (value.batchId !== batchId) {
            throw new Error('Batch ID mismatch between parameters and test data');
        }

        // Get existing provenance record
        const recordBuffer = await ctx.stub.getState(batchId);
        if (!recordBuffer || recordBuffer.length === 0) {
            throw new Error(`Batch ${batchId} not found`);
        }

        const provenanceRecord = JSON.parse(recordBuffer.toString());

        // Check if test already exists
        const existingTest = provenanceRecord.qualityTests.find(test => test.testId === value.testId);
        if (existingTest) {
            throw new Error(`Test ${value.testId} already exists for batch ${batchId}`);
        }

        // Add quality test
        provenanceRecord.qualityTests.push(value);
        
        // Update status based on test result
        if (value.overallResult === 'Pass') {
            provenanceRecord.currentStatus = 'Tested-Pass';
        } else if (value.overallResult === 'Fail') {
            provenanceRecord.currentStatus = 'Tested-Fail';
        } else {
            provenanceRecord.currentStatus = 'Quality-Testing';
        }

        provenanceRecord.lastUpdated = new Date().toISOString();
        provenanceRecord.version += 1;

        // Update compliance based on test results
        await this.updateComplianceStatus(ctx, provenanceRecord, value);

        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(provenanceRecord)));

        console.info('============= END : Add Quality Test Result ===========');
        return {
            success: true,
            batchId,
            testId: value.testId,
            testResult: value.overallResult,
            status: provenanceRecord.currentStatus,
            totalTests: provenanceRecord.qualityTests.length,
            message: `Quality test ${value.testId} added to batch ${batchId}`
        };
    }

    /**
     * Finalize packaging and prepare for distribution
     * @param {Context} ctx - Transaction context
     * @param {string} batchId - Batch identifier
     * @param {string} distributionData - JSON string containing distribution information
     * @returns {Object} Updated provenance record with QR code
     */
    async finalizePackaging(ctx, batchId, distributionData) {
        console.info('============= START : Finalize Packaging ===========');

        const distributionInfo = JSON.parse(distributionData);

        // Get existing provenance record
        const recordBuffer = await ctx.stub.getState(batchId);
        if (!recordBuffer || recordBuffer.length === 0) {
            throw new Error(`Batch ${batchId} not found`);
        }

        const provenanceRecord = JSON.parse(recordBuffer.toString());

        // Check if batch is ready for packaging (must have passed quality tests)
        if (provenanceRecord.currentStatus !== 'Tested-Pass') {
            throw new Error(`Batch ${batchId} must pass quality tests before packaging. Current status: ${provenanceRecord.currentStatus}`);
        }

        // Generate QR code for traceability
        const qrCodeData = TraceabilityUtils.generateQRCodeData(batchId);
        
        // Update distribution information
        provenanceRecord.distributionInfo = {
            ...distributionInfo,
            packageDate: new Date().toISOString(),
            qrCodeId: qrCodeData.qrCodeId,
            qrCodeUrl: qrCodeData.url
        };

        provenanceRecord.currentStatus = 'Packaged';
        provenanceRecord.lastUpdated = new Date().toISOString();
        provenanceRecord.version += 1;

        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(provenanceRecord)));

        // Store QR code mapping
        const qrMapping = {
            qrCodeId: qrCodeData.qrCodeId,
            batchId,
            url: qrCodeData.url,
            generatedAt: new Date().toISOString()
        };
        await ctx.stub.putState(`QR_${qrCodeData.qrCodeId}`, Buffer.from(JSON.stringify(qrMapping)));

        console.info('============= END : Finalize Packaging ===========');
        return {
            success: true,
            batchId,
            status: provenanceRecord.currentStatus,
            qrCode: qrCodeData,
            distributionInfo: provenanceRecord.distributionInfo,
            message: `Batch ${batchId} packaged and ready for distribution`
        };
    }

    /**
     * Update distribution status
     * @param {Context} ctx - Transaction context
     * @param {string} batchId - Batch identifier
     * @param {string} newStatus - New distribution status
     * @returns {Object} Updated status
     */
    async updateDistributionStatus(ctx, batchId, newStatus) {
        const validStatuses = ['Packaged', 'Distributed', 'Recalled'];
        if (!validStatuses.includes(newStatus)) {
            throw new Error(`Invalid status. Valid statuses: ${validStatuses.join(', ')}`);
        }

        const recordBuffer = await ctx.stub.getState(batchId);
        if (!recordBuffer || recordBuffer.length === 0) {
            throw new Error(`Batch ${batchId} not found`);
        }

        const provenanceRecord = JSON.parse(recordBuffer.toString());
        provenanceRecord.currentStatus = newStatus;
        provenanceRecord.lastUpdated = new Date().toISOString();
        provenanceRecord.version += 1;

        await ctx.stub.putState(batchId, Buffer.from(JSON.stringify(provenanceRecord)));

        return {
            success: true,
            batchId,
            status: newStatus,
            message: `Batch ${batchId} status updated to ${newStatus}`
        };
    }

    /**
     * Get complete provenance record
     * @param {Context} ctx - Transaction context
     * @param {string} batchId - Batch identifier
     * @returns {Object} Complete provenance record
     */
    async getProvenanceRecord(ctx, batchId) {
        const recordBuffer = await ctx.stub.getState(batchId);
        if (!recordBuffer || recordBuffer.length === 0) {
            throw new Error(`Batch ${batchId} not found`);
        }

        const provenanceRecord = JSON.parse(recordBuffer.toString());
        
        // Add computed fields for better presentation
        provenanceRecord.timeline = this.generateTimeline(provenanceRecord);
        provenanceRecord.completionScore = this.calculateCompletionScore(provenanceRecord);
        
        return provenanceRecord;
    }

    /**
     * Get provenance history by QR code
     * @param {Context} ctx - Transaction context
     * @param {string} qrCodeId - QR code identifier
     * @returns {Object} Provenance record accessed via QR code
     */
    async getProvenanceByQRCode(ctx, qrCodeId) {
        const qrBuffer = await ctx.stub.getState(`QR_${qrCodeId}`);
        if (!qrBuffer || qrBuffer.length === 0) {
            throw new Error(`QR code ${qrCodeId} not found`);
        }

        const qrMapping = JSON.parse(qrBuffer.toString());
        return await this.getProvenanceRecord(ctx, qrMapping.batchId);
    }

    /**
     * Get batches by farmer
     * @param {Context} ctx - Transaction context
     * @param {string} farmerId - Farmer identifier
     * @returns {Array} Array of batch records for the farmer
     */
    async getBatchesByFarmer(ctx, farmerId) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const batches = [];
        
        while (true) {
            const res = await iterator.next();
            if (res.value && res.value.value.toString()) {
                const record = JSON.parse(res.value.value.toString());
                if (record.collectionEvent && record.collectionEvent.farmerId === farmerId) {
                    batches.push({
                        batchId: record.batchId,
                        herbType: record.collectionEvent.herbType,
                        status: record.currentStatus,
                        collectionDate: record.collectionEvent.collectionDate,
                        quantity: record.collectionEvent.quantityKg
                    });
                }
            }
            if (res.done) {
                await iterator.close();
                break;
            }
        }

        return batches.sort((a, b) => new Date(b.collectionDate) - new Date(a.collectionDate));
    }

    /**
     * Get batches by status
     * @param {Context} ctx - Transaction context
     * @param {string} status - Batch status
     * @returns {Array} Array of batch records with the specified status
     */
    async getBatchesByStatus(ctx, status) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const batches = [];
        
        while (true) {
            const res = await iterator.next();
            if (res.value && res.value.value.toString()) {
                const record = JSON.parse(res.value.value.toString());
                if (record.currentStatus === status) {
                    batches.push({
                        batchId: record.batchId,
                        status: record.currentStatus,
                        herbType: record.collectionEvent ? record.collectionEvent.herbType : 'Unknown',
                        lastUpdated: record.lastUpdated,
                        version: record.version
                    });
                }
            }
            if (res.done) {
                await iterator.close();
                break;
            }
        }

        return batches.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
    }

    /**
     * Generate timeline from provenance record
     * @param {Object} record - Provenance record
     * @returns {Array} Timeline of events
     */
    generateTimeline(record) {
        const timeline = [];

        // Collection event
        if (record.collectionEvent) {
            timeline.push({
                stage: 'Collection',
                date: record.collectionEvent.collectionDate,
                description: `${record.collectionEvent.quantityKg}kg of ${record.collectionEvent.herbType} collected by ${record.collectionEvent.farmerName}`,
                location: record.collectionEvent.gpsCoordinates,
                actor: record.collectionEvent.farmerName
            });
        }

        // Processing steps
        if (record.processingSteps) {
            record.processingSteps.forEach(step => {
                timeline.push({
                    stage: 'Processing',
                    date: step.processStartTime,
                    description: `${step.processType} at ${step.facilityName}`,
                    details: `${step.inputQuantityKg}kg → ${step.outputQuantityKg}kg (${step.yieldPercentage?.toFixed(1)}% yield)`,
                    actor: step.facilityName
                });
            });
        }

        // Quality tests
        if (record.qualityTests) {
            record.qualityTests.forEach(test => {
                timeline.push({
                    stage: 'Quality Testing',
                    date: test.testDate,
                    description: `${test.testType} testing at ${test.labName}`,
                    result: test.overallResult,
                    actor: test.labName
                });
            });
        }

        // Packaging
        if (record.distributionInfo) {
            timeline.push({
                stage: 'Packaging',
                date: record.distributionInfo.packageDate,
                description: `Packaged for distribution`,
                details: `Package type: ${record.distributionInfo.packageType}`,
                actor: record.distributionInfo.distributorName
            });
        }

        return timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    /**
     * Calculate completion score based on available data
     * @param {Object} record - Provenance record
     * @returns {number} Completion score (0-100)
     */
    calculateCompletionScore(record) {
        let score = 0;

        // Collection data (25 points)
        if (record.collectionEvent) score += 25;

        // Processing data (25 points)
        if (record.processingSteps && record.processingSteps.length > 0) {
            score += 25;
        }

        // Quality testing (30 points)
        if (record.qualityTests && record.qualityTests.length > 0) {
            score += 20;
            // Bonus for passing tests
            const passedTests = record.qualityTests.filter(test => test.overallResult === 'Pass');
            if (passedTests.length > 0) score += 10;
        }

        // Distribution/packaging (20 points)
        if (record.distributionInfo) score += 20;

        return Math.min(100, score);
    }

    /**
     * Update sustainability metrics based on processing data
     * @param {Context} ctx - Transaction context
     * @param {Object} record - Provenance record
     * @param {Object} processingStep - Processing step data
     */
    async updateSustainabilityMetrics(ctx, record, processingStep) {
        if (!record.sustainability) {
            record.sustainability = {};
        }

        // Update energy consumption (example calculation)
        if (processingStep.duration && processingStep.temperature) {
            const energyUsed = (processingStep.duration / 60) * (processingStep.temperature / 100) * 10; // kWh estimate
            record.sustainability.energyConsumption = (record.sustainability.energyConsumption || 0) + energyUsed;
        }

        // Update carbon footprint based on energy use
        if (record.sustainability.energyConsumption) {
            record.sustainability.carbonFootprint = record.sustainability.energyConsumption * 0.5; // kg CO2 per kWh
        }

        // Calculate overall sustainability score
        const baseScore = record.collectionEvent?.sustainabilityScore || 70;
        const processingPenalty = record.processingSteps.length * 2; // Each processing step reduces sustainability
        record.sustainability.overallScore = Math.max(0, baseScore - processingPenalty);
    }

    /**
     * Update compliance status based on test results
     * @param {Context} ctx - Transaction context
     * @param {Object} record - Provenance record
     * @param {Object} testResult - Test result data
     */
    async updateComplianceStatus(ctx, record, testResult) {
        if (!record.compliance) {
            record.compliance = {};
        }

        // Check FSSAI compliance based on test results
        if (testResult.overallResult === 'Pass') {
            record.compliance.fssaiApproved = true;
        }

        // Check AYUSH compliance (specific to Ayurvedic herbs)
        if (testResult.dnaAuthenticity && testResult.dnaAuthenticity.speciesConfirmed) {
            record.compliance.ayushCompliant = true;
        }

        // ISO compliance based on lab certification
        if (testResult.labCertification && testResult.labCertification.includes('ISO')) {
            record.compliance.isoCertified = true;
        }
    }

    /**
     * Update system statistics
     * @param {Context} ctx - Transaction context
     * @param {string} event - Event type
     */
    async updateSystemStats(ctx, event) {
        const configBuffer = await ctx.stub.getState('PROVENANCE_CONFIG');
        const config = JSON.parse(configBuffer.toString());

        if (event === 'batch_created') {
            config.totalBatches = (config.totalBatches || 0) + 1;
        }

        config.lastUpdated = new Date().toISOString();
        await ctx.stub.putState('PROVENANCE_CONFIG', Buffer.from(JSON.stringify(config)));
    }

    /**
     * Get system statistics
     * @param {Context} ctx - Transaction context
     * @returns {Object} System statistics
     */
    async getSystemStats(ctx) {
        const configBuffer = await ctx.stub.getState('PROVENANCE_CONFIG');
        const config = JSON.parse(configBuffer.toString());

        // Count batches by status
        const iterator = await ctx.stub.getStateByRange('', '');
        const statusCounts = {};
        let totalBatches = 0;
        
        while (true) {
            const res = await iterator.next();
            if (res.value && res.value.value.toString()) {
                const record = JSON.parse(res.value.value.toString());
                if (record.currentStatus) {
                    statusCounts[record.currentStatus] = (statusCounts[record.currentStatus] || 0) + 1;
                    totalBatches++;
                }
            }
            if (res.done) {
                await iterator.close();
                break;
            }
        }

        return {
            ...config,
            totalBatches,
            batchesByStatus: statusCounts
        };
    }
}

module.exports = ProvenanceContract;