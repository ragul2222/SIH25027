const { Contract } = require('fabric-contract-api');
const TraceabilityUtils = require('./utils');
const { qualityTestSchema } = require('./schemas');

/**
 * Quality Test Smart Contract for Ayurvedic Herb Traceability
 * Validates lab test inputs (moisture, pesticide, DNA) and manages test results
 */
class QualityTestContract extends Contract {

    constructor() {
        super('QualityTestContract');
    }

    /**
     * Initialize contract with quality standards
     * @param {Context} ctx - Transaction context
     */
    async initLedger(ctx) {
        console.info('============= START : Initialize Quality Test Ledger ===========');

        // Initialize quality standards for different herbs
        const qualityStandards = {
            'Ashwagandha': {
                moisture: { max: 12, unit: '%' },
                ash: { max: 8, unit: '%' },
                foreignMatter: { max: 2, unit: '%' },
                withanolides: { min: 0.3, unit: '%' },
                heavyMetals: {
                    lead: { max: 10, unit: 'ppm' },
                    mercury: { max: 1, unit: 'ppm' },
                    cadmium: { max: 0.3, unit: 'ppm' },
                    arsenic: { max: 3, unit: 'ppm' }
                },
                microbialLimits: {
                    totalBacterialCount: { max: 100000, unit: 'CFU/g' },
                    yeastMoldCount: { max: 1000, unit: 'CFU/g' },
                    salmonella: 'Absent',
                    ecoli: { max: 10, unit: 'CFU/g' }
                }
            },
            'Turmeric': {
                moisture: { max: 10, unit: '%' },
                ash: { max: 9, unit: '%' },
                foreignMatter: { max: 1, unit: '%' },
                curcumin: { min: 2.0, unit: '%' },
                heavyMetals: {
                    lead: { max: 10, unit: 'ppm' },
                    mercury: { max: 1, unit: 'ppm' },
                    cadmium: { max: 0.3, unit: 'ppm' },
                    arsenic: { max: 3, unit: 'ppm' }
                },
                microbialLimits: {
                    totalBacterialCount: { max: 100000, unit: 'CFU/g' },
                    yeastMoldCount: { max: 1000, unit: 'CFU/g' },
                    salmonella: 'Absent',
                    ecoli: { max: 10, unit: 'CFU/g' }
                }
            },
            'default': {
                moisture: { max: 15, unit: '%' },
                ash: { max: 10, unit: '%' },
                foreignMatter: { max: 3, unit: '%' },
                heavyMetals: {
                    lead: { max: 10, unit: 'ppm' },
                    mercury: { max: 1, unit: 'ppm' },
                    cadmium: { max: 0.3, unit: 'ppm' },
                    arsenic: { max: 3, unit: 'ppm' }
                },
                microbialLimits: {
                    totalBacterialCount: { max: 100000, unit: 'CFU/g' },
                    yeastMoldCount: { max: 1000, unit: 'CFU/g' },
                    salmonella: 'Absent',
                    ecoli: { max: 10, unit: 'CFU/g' }
                }
            }
        };

        await ctx.stub.putState('QUALITY_STANDARDS', Buffer.from(JSON.stringify(qualityStandards)));

        // Initialize lab certifications
        const labCertifications = [
            {
                labId: 'LAB001',
                labName: 'Ayurveda Research Institute Lab',
                certification: 'NABL-ISO17025',
                accreditationNumber: 'TC-1234',
                validUntil: '2025-12-31',
                testCapabilities: ['Physical', 'Chemical', 'Microbiological', 'DNA', 'Pesticide-Residue'],
                isActive: true
            },
            {
                labId: 'LAB002',
                labName: 'Herbal Quality Control Lab',
                certification: 'NABL-ISO17025',
                accreditationNumber: 'TC-5678',
                validUntil: '2025-06-30',
                testCapabilities: ['Physical', 'Chemical', 'Pesticide-Residue'],
                isActive: true
            }
        ];

        for (const lab of labCertifications) {
            await ctx.stub.putState(`LAB_CERT_${lab.labId}`, Buffer.from(JSON.stringify(lab)));
        }

        console.info('============= END : Initialize Quality Test Ledger ===========');
    }

    /**
     * Submit quality test results
     * @param {Context} ctx - Transaction context
     * @param {string} testData - JSON string containing test results
     * @returns {Object} Test validation result
     */
    async submitTestResults(ctx, testData) {
        console.info('============= START : Submit Test Results ===========');

        // Check permissions - only labs can submit test results
        const clientMSPID = ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'LabMSP') {
            throw new Error('Only certified labs can submit test results');
        }

        const testResult = JSON.parse(testData);

        // Validate schema
        const { error, value } = qualityTestSchema.validate(testResult);
        if (error) {
            throw new Error(`Invalid test data: ${error.details[0].message}`);
        }

        // Check if test already exists
        const existingTest = await ctx.stub.getState(value.testId);
        if (existingTest && existingTest.length > 0) {
            throw new Error(`Test ${value.testId} already exists`);
        }

        // Verify lab certification
        const labCertBuffer = await ctx.stub.getState(`LAB_CERT_${value.labId}`);
        if (!labCertBuffer || labCertBuffer.length === 0) {
            throw new Error(`Lab ${value.labId} is not certified`);
        }

        const labCert = JSON.parse(labCertBuffer.toString());
        if (!labCert.isActive) {
            throw new Error(`Lab ${value.labId} certification is inactive`);
        }

        if (!labCert.testCapabilities.includes(value.testType)) {
            throw new Error(`Lab ${value.labId} is not certified for ${value.testType} testing`);
        }

        // Get herb type from batch (we need to query the ProvenanceContract)
        // For now, we'll validate against default standards if herb type is not provided
        let herbType = value.herbType || 'default';
        
        // Validate test results against quality standards
        const validationResult = await this.validateTestResults(ctx, value, herbType);
        value.validationResult = validationResult;

        // Set overall result based on validation
        if (!validationResult.isValid) {
            value.overallResult = 'Fail';
        } else if (validationResult.warnings && validationResult.warnings.length > 0) {
            value.overallResult = 'Conditional-Pass';
        } else {
            value.overallResult = 'Pass';
        }

        // Add timestamp and generate hash for integrity
        value.createdAt = new Date().toISOString();
        value.dataHash = TraceabilityUtils.generateDataHash(value);

        await ctx.stub.putState(value.testId, Buffer.from(JSON.stringify(value)));

        // Update batch test history
        await this.updateBatchTestHistory(ctx, value.batchId, value.testId, value.overallResult);

        console.info('============= END : Submit Test Results ===========');
        return {
            success: true,
            testId: value.testId,
            overallResult: value.overallResult,
            validationResult: validationResult,
            message: `Test results submitted successfully for batch ${value.batchId}`
        };
    }

    /**
     * Validate test results against quality standards
     * @param {Context} ctx - Transaction context
     * @param {Object} testResult - Test result data
     * @param {string} herbType - Type of herb
     * @returns {Object} Validation result
     */
    async validateTestResults(ctx, testResult, herbType) {
        const standardsBuffer = await ctx.stub.getState('QUALITY_STANDARDS');
        const allStandards = JSON.parse(standardsBuffer.toString());
        
        const standard = allStandards[herbType] || allStandards['default'];
        const violations = [];
        const warnings = [];
        const passedTests = [];

        // Validate physical parameters
        if (testResult.moistureContent !== undefined) {
            const moistureStd = standard.moisture;
            if (moistureStd && testResult.moistureContent > moistureStd.max) {
                violations.push(`Moisture content ${testResult.moistureContent}% exceeds maximum ${moistureStd.max}%`);
            } else {
                passedTests.push(`Moisture content: ${testResult.moistureContent}% (✓)`);
            }
        }

        if (testResult.ashContent !== undefined) {
            const ashStd = standard.ash;
            if (ashStd && testResult.ashContent > ashStd.max) {
                violations.push(`Ash content ${testResult.ashContent}% exceeds maximum ${ashStd.max}%`);
            } else {
                passedTests.push(`Ash content: ${testResult.ashContent}% (✓)`);
            }
        }

        if (testResult.foreignMatter !== undefined) {
            const fmStd = standard.foreignMatter;
            if (fmStd && testResult.foreignMatter > fmStd.max) {
                violations.push(`Foreign matter ${testResult.foreignMatter}% exceeds maximum ${fmStd.max}%`);
            } else {
                passedTests.push(`Foreign matter: ${testResult.foreignMatter}% (✓)`);
            }
        }

        // Validate active principles
        if (testResult.activePrinciples && standard.activePrinciples) {
            for (const [principle, concentration] of Object.entries(testResult.activePrinciples)) {
                const stdLimit = standard[principle.toLowerCase()];
                if (stdLimit && stdLimit.min && concentration < stdLimit.min) {
                    violations.push(`${principle} concentration ${concentration}% below minimum ${stdLimit.min}%`);
                } else if (stdLimit) {
                    passedTests.push(`${principle}: ${concentration}% (✓)`);
                }
            }
        }

        // Validate heavy metals
        if (testResult.heavyMetals && standard.heavyMetals) {
            for (const [metal, concentration] of Object.entries(testResult.heavyMetals)) {
                const metalStd = standard.heavyMetals[metal];
                if (metalStd && concentration > metalStd.max) {
                    violations.push(`${metal} concentration ${concentration}ppm exceeds maximum ${metalStd.max}ppm`);
                } else if (metalStd) {
                    passedTests.push(`${metal}: ${concentration}ppm (✓)`);
                }
            }
        }

        // Validate pesticide residues
        if (testResult.pesticideResidues) {
            for (const pesticide of testResult.pesticideResidues) {
                if (pesticide.status === 'Fail' || pesticide.concentration > pesticide.mrl) {
                    violations.push(`${pesticide.pesticideName}: ${pesticide.concentration}ppm exceeds MRL ${pesticide.mrl}ppm`);
                } else {
                    passedTests.push(`${pesticide.pesticideName}: ${pesticide.concentration}ppm (✓)`);
                }
            }
        }

        // Validate microbial parameters
        if (testResult.microbialCount && standard.microbialLimits) {
            for (const [microbe, count] of Object.entries(testResult.microbialCount)) {
                const microbialStd = standard.microbialLimits[microbe];
                if (microbialStd) {
                    if (typeof microbialStd === 'string' && microbialStd === 'Absent' && count !== 'Absent') {
                        violations.push(`${microbe} must be absent but found: ${count}`);
                    } else if (typeof microbialStd === 'object' && count > microbialStd.max) {
                        violations.push(`${microbe} count ${count} exceeds maximum ${microbialStd.max} ${microbialStd.unit}`);
                    } else {
                        passedTests.push(`${microbe}: ${count} (✓)`);
                    }
                }
            }
        }

        // Validate DNA authenticity
        if (testResult.dnaAuthenticity) {
            const dnaAuth = testResult.dnaAuthenticity;
            if (!dnaAuth.speciesConfirmed) {
                violations.push('Species not confirmed by DNA analysis');
            } else {
                passedTests.push('DNA species confirmation: Pass (✓)');
            }

            if (dnaAuth.dnaMatchPercentage && dnaAuth.dnaMatchPercentage < 95) {
                warnings.push(`DNA match percentage ${dnaAuth.dnaMatchPercentage}% is below optimal 95%`);
            }

            if (dnaAuth.contaminationDetected) {
                violations.push('DNA contamination detected');
            }
        }

        const isValid = violations.length === 0;

        return {
            isValid,
            violations,
            warnings,
            passedTests,
            standard: standard,
            herbType,
            overallScore: isValid ? (warnings.length > 0 ? 85 : 100) : 0
        };
    }

    /**
     * Update batch test history
     * @param {Context} ctx - Transaction context
     * @param {string} batchId - Batch identifier
     * @param {string} testId - Test identifier
     * @param {string} result - Test result
     * @returns {Object} Update result
     */
    async updateBatchTestHistory(ctx, batchId, testId, result) {
        const historyKey = `BATCH_TEST_HISTORY_${batchId}`;
        const historyBuffer = await ctx.stub.getState(historyKey);
        
        let history = historyBuffer && historyBuffer.length > 0 ? 
            JSON.parse(historyBuffer.toString()) : 
            { batchId, tests: [], lastUpdated: new Date().toISOString() };

        history.tests.push({
            testId,
            result,
            timestamp: new Date().toISOString()
        });
        history.lastUpdated = new Date().toISOString();

        await ctx.stub.putState(historyKey, Buffer.from(JSON.stringify(history)));
        return { success: true, historyKey };
    }

    /**
     * Get test results by test ID
     * @param {Context} ctx - Transaction context
     * @param {string} testId - Test identifier
     * @returns {Object} Test results
     */
    async getTestResults(ctx, testId) {
        const testBuffer = await ctx.stub.getState(testId);
        if (!testBuffer || testBuffer.length === 0) {
            throw new Error(`Test ${testId} not found`);
        }
        return JSON.parse(testBuffer.toString());
    }

    /**
     * Get all test results for a batch
     * @param {Context} ctx - Transaction context
     * @param {string} batchId - Batch identifier
     * @returns {Array} Array of test results
     */
    async getBatchTestResults(ctx, batchId) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const tests = [];
        
        while (true) {
            const res = await iterator.next();
            if (res.value && res.value.value.toString()) {
                const data = JSON.parse(res.value.value.toString());
                if (data.batchId === batchId && data.testId) {
                    tests.push(data);
                }
            }
            if (res.done) {
                await iterator.close();
                break;
            }
        }

        return tests.sort((a, b) => new Date(b.testDate) - new Date(a.testDate));
    }

    /**
     * Get batch test history
     * @param {Context} ctx - Transaction context
     * @param {string} batchId - Batch identifier
     * @returns {Object} Test history
     */
    async getBatchTestHistory(ctx, batchId) {
        const historyKey = `BATCH_TEST_HISTORY_${batchId}`;
        const historyBuffer = await ctx.stub.getState(historyKey);
        
        if (!historyBuffer || historyBuffer.length === 0) {
            return { batchId, tests: [], message: 'No test history found' };
        }

        return JSON.parse(historyBuffer.toString());
    }

    /**
     * Verify test authenticity using data hash
     * @param {Context} ctx - Transaction context
     * @param {string} testId - Test identifier
     * @returns {Object} Verification result
     */
    async verifyTestAuthenticity(ctx, testId) {
        const testBuffer = await ctx.stub.getState(testId);
        if (!testBuffer || testBuffer.length === 0) {
            throw new Error(`Test ${testId} not found`);
        }

        const testData = JSON.parse(testBuffer.toString());
        const storedHash = testData.dataHash;
        
        // Temporarily remove hash for recalculation
        delete testData.dataHash;
        const calculatedHash = TraceabilityUtils.generateDataHash(testData);
        
        // Restore hash
        testData.dataHash = storedHash;

        const isAuthentic = storedHash === calculatedHash;

        return {
            testId,
            isAuthentic,
            storedHash,
            calculatedHash,
            message: isAuthentic ? 'Test data is authentic' : 'Test data integrity compromised'
        };
    }

    /**
     * Get quality standards for a herb type
     * @param {Context} ctx - Transaction context
     * @param {string} herbType - Type of herb
     * @returns {Object} Quality standards
     */
    async getQualityStandards(ctx, herbType = 'default') {
        const standardsBuffer = await ctx.stub.getState('QUALITY_STANDARDS');
        const allStandards = JSON.parse(standardsBuffer.toString());
        
        return {
            herbType,
            standards: allStandards[herbType] || allStandards['default'],
            availableHerbs: Object.keys(allStandards)
        };
    }

    /**
     * Update quality standards (admin function)
     * @param {Context} ctx - Transaction context
     * @param {string} herbType - Type of herb
     * @param {string} standardsData - JSON string with new standards
     * @returns {Object} Update result
     */
    async updateQualityStandards(ctx, herbType, standardsData) {
        // Check permissions - only regulators can update standards
        const clientMSPID = ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'RegulatorMSP') {
            throw new Error('Only regulators can update quality standards');
        }

        const newStandards = JSON.parse(standardsData);
        
        const standardsBuffer = await ctx.stub.getState('QUALITY_STANDARDS');
        const allStandards = JSON.parse(standardsBuffer.toString());
        
        allStandards[herbType] = newStandards;
        
        await ctx.stub.putState('QUALITY_STANDARDS', Buffer.from(JSON.stringify(allStandards)));

        return {
            success: true,
            message: `Quality standards updated for ${herbType}`,
            updatedStandards: newStandards
        };
    }

    /**
     * Register lab certification
     * @param {Context} ctx - Transaction context
     * @param {string} labData - JSON string with lab certification data
     * @returns {Object} Registration result
     */
    async registerLabCertification(ctx, labData) {
        // Check permissions - only regulators can register labs
        const clientMSPID = ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'RegulatorMSP') {
            throw new Error('Only regulators can register lab certifications');
        }

        const lab = JSON.parse(labData);
        
        if (!lab.labId || !lab.labName || !lab.certification) {
            throw new Error('Lab ID, name, and certification are required');
        }

        const labKey = `LAB_CERT_${lab.labId}`;
        const existingLab = await ctx.stub.getState(labKey);
        if (existingLab && existingLab.length > 0) {
            throw new Error(`Lab ${lab.labId} already registered`);
        }

        lab.registeredAt = new Date().toISOString();
        await ctx.stub.putState(labKey, Buffer.from(JSON.stringify(lab)));

        return {
            success: true,
            message: `Lab ${lab.labId} registered successfully`,
            labId: lab.labId
        };
    }

    /**
     * Get lab certification details
     * @param {Context} ctx - Transaction context
     * @param {string} labId - Lab identifier
     * @returns {Object} Lab certification details
     */
    async getLabCertification(ctx, labId) {
        const labBuffer = await ctx.stub.getState(`LAB_CERT_${labId}`);
        if (!labBuffer || labBuffer.length === 0) {
            throw new Error(`Lab ${labId} not found`);
        }
        return JSON.parse(labBuffer.toString());
    }
}

module.exports = QualityTestContract;