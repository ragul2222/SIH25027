const logger = require('./logger');

/**
 * Provenance History Helper Utilities
 * Generates comprehensive traceability reports and visualizations
 */
class ProvenanceHelper {

    /**
     * Generate complete provenance report for a batch
     * @param {Object} provenanceRecord - Complete provenance record from blockchain
     * @param {Object} options - Report generation options
     * @returns {Object} Formatted provenance report
     */
    static generateProvenanceReport(provenanceRecord, options = {}) {
        try {
            const includeDetails = options.includeDetails !== false;
            const includeSustainability = options.includeSustainability !== false;
            const includeCompliance = options.includeCompliance !== false;

            const report = {
                batchId: provenanceRecord.batchId,
                currentStatus: provenanceRecord.currentStatus,
                reportGeneratedAt: new Date().toISOString(),
                completionScore: provenanceRecord.completionScore || 0,
                
                // Executive Summary
                summary: this.generateExecutiveSummary(provenanceRecord),
                
                // Journey Timeline
                timeline: this.generateDetailedTimeline(provenanceRecord),
                
                // Collection Information
                collection: this.formatCollectionInfo(provenanceRecord.collectionEvent),
                
                // Processing Information
                processing: this.formatProcessingInfo(provenanceRecord.processingSteps || []),
                
                // Quality Testing Information
                qualityTesting: this.formatQualityTestingInfo(provenanceRecord.qualityTests || []),
                
                // Distribution Information
                distribution: this.formatDistributionInfo(provenanceRecord.distributionInfo),
            };

            // Add optional sections
            if (includeSustainability && provenanceRecord.sustainability) {
                report.sustainability = this.formatSustainabilityInfo(provenanceRecord.sustainability);
            }

            if (includeCompliance && provenanceRecord.compliance) {
                report.compliance = this.formatComplianceInfo(provenanceRecord.compliance);
            }

            if (includeDetails) {
                report.technicalDetails = {
                    version: provenanceRecord.version,
                    createdAt: provenanceRecord.createdAt,
                    lastUpdated: provenanceRecord.lastUpdated,
                    dataIntegrity: this.validateDataIntegrity(provenanceRecord)
                };
            }

            logger.info(`Provenance report generated for batch ${provenanceRecord.batchId}`);
            return report;

        } catch (error) {
            logger.error(`Failed to generate provenance report: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate executive summary of the batch journey
     * @param {Object} provenanceRecord - Provenance record
     * @returns {Object} Executive summary
     */
    static generateExecutiveSummary(provenanceRecord) {
        const collection = provenanceRecord.collectionEvent;
        const processing = provenanceRecord.processingSteps || [];
        const testing = provenanceRecord.qualityTests || [];
        const distribution = provenanceRecord.distributionInfo;

        const startDate = collection ? new Date(collection.collectionDate) : null;
        const endDate = distribution && distribution.packageDate ? 
            new Date(distribution.packageDate) : new Date();
        
        const journeyDays = startDate ? 
            Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) : null;

        // Calculate total quantity transformation
        const initialQuantity = collection ? collection.quantityKg : 0;
        const finalQuantity = processing.length > 0 ? 
            processing[processing.length - 1].outputQuantityKg : initialQuantity;
        
        const overallYield = initialQuantity > 0 ? 
            Math.round((finalQuantity / initialQuantity) * 100 * 100) / 100 : null;

        // Quality status
        const passedTests = testing.filter(test => test.overallResult === 'Pass').length;
        const totalTests = testing.length;
        const qualityScore = totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : null;

        return {
            herbType: collection ? collection.herbType : 'Unknown',
            farmer: collection ? collection.farmerName : 'Unknown',
            harvestLocation: collection ? this.formatGPSLocation(collection.gpsCoordinates) : 'Unknown',
            journeyDuration: journeyDays ? `${journeyDays} days` : 'In progress',
            totalProcessingSteps: processing.length,
            qualityTestsPerformed: totalTests,
            qualityScore: qualityScore ? `${qualityScore}%` : 'Not tested',
            overallYield: overallYield ? `${overallYield}%` : 'N/A',
            initialQuantity: `${initialQuantity} kg`,
            finalQuantity: `${finalQuantity} kg`,
            currentStatus: provenanceRecord.currentStatus,
            certifications: this.extractCertifications(provenanceRecord),
            sustainabilityScore: provenanceRecord.sustainability ? 
                provenanceRecord.sustainability.overallScore : null
        };
    }

    /**
     * Generate detailed timeline with rich information
     * @param {Object} provenanceRecord - Provenance record
     * @returns {Array} Detailed timeline events
     */
    static generateDetailedTimeline(provenanceRecord) {
        const timeline = [];
        
        // Collection Event
        if (provenanceRecord.collectionEvent) {
            const collection = provenanceRecord.collectionEvent;
            timeline.push({
                stage: 'Collection',
                timestamp: collection.collectionDate,
                title: `Harvest of ${collection.herbType}`,
                description: `${collection.quantityKg}kg harvested by ${collection.farmerName}`,
                location: this.formatGPSLocation(collection.gpsCoordinates),
                details: {
                    season: collection.harvestSeason,
                    method: collection.collectionMethod,
                    certification: collection.certificationType,
                    weather: collection.weatherConditions,
                    soil: collection.soilConditions
                },
                actor: {
                    name: collection.farmerName,
                    id: collection.farmerId,
                    type: 'Farmer'
                },
                metrics: {
                    quantity: `${collection.quantityKg} kg`,
                    sustainability: collection.sustainabilityScore ? 
                        `${collection.sustainabilityScore}/100` : 'Not scored'
                }
            });
        }

        // Processing Steps
        if (provenanceRecord.processingSteps) {
            provenanceRecord.processingSteps.forEach((step, index) => {
                timeline.push({
                    stage: 'Processing',
                    substage: `Step ${index + 1}`,
                    timestamp: step.processStartTime,
                    title: `${step.processType} Process`,
                    description: `${step.processDescription || step.processType} at ${step.facilityName}`,
                    duration: step.processEndTime ? 
                        this.calculateDuration(step.processStartTime, step.processEndTime) : null,
                    details: {
                        inputQuantity: `${step.inputQuantityKg} kg`,
                        outputQuantity: `${step.outputQuantityKg} kg`,
                        yield: step.yieldPercentage ? `${step.yieldPercentage}%` : 'N/A',
                        temperature: step.temperature ? `${step.temperature}°C` : null,
                        pressure: step.pressure ? `${step.pressure} bar` : null,
                        equipment: step.equipmentUsed,
                        qualityParameters: step.qualityParameters
                    },
                    actor: {
                        name: step.facilityName,
                        id: step.facilityId,
                        type: 'Processing Facility',
                        operator: step.operatorId
                    },
                    metrics: {
                        efficiency: step.yieldPercentage ? `${step.yieldPercentage}%` : 'N/A',
                        duration: step.duration ? `${step.duration} minutes` : null
                    }
                });
            });
        }

        // Quality Tests
        if (provenanceRecord.qualityTests) {
            provenanceRecord.qualityTests.forEach((test, index) => {
                timeline.push({
                    stage: 'Quality Testing',
                    substage: `Test ${index + 1}`,
                    timestamp: test.testDate,
                    title: `${test.testType} Testing`,
                    description: `${test.testType} analysis at ${test.labName}`,
                    result: test.overallResult,
                    details: {
                        sampleQuantity: `${test.sampleQuantity} g`,
                        methodology: test.testMethodology,
                        parameters: this.formatTestParameters(test),
                        certification: test.labCertification
                    },
                    actor: {
                        name: test.labName,
                        id: test.labId,
                        type: 'Laboratory',
                        tester: test.testerId
                    },
                    metrics: {
                        result: test.overallResult,
                        parametersChecked: this.countTestParameters(test)
                    }
                });
            });
        }

        // Packaging/Distribution
        if (provenanceRecord.distributionInfo) {
            const dist = provenanceRecord.distributionInfo;
            timeline.push({
                stage: 'Distribution',
                timestamp: dist.packageDate,
                title: 'Packaging and Distribution',
                description: `Packaged for distribution by ${dist.distributorName || 'distributor'}`,
                details: {
                    packageType: dist.packageType,
                    packageWeight: dist.packageWeight ? `${dist.packageWeight} kg` : null,
                    batchLotNumber: dist.batchLotNumber,
                    expiryDate: dist.expiryDate,
                    destination: dist.destinationAddress ? 
                        this.formatAddress(dist.destinationAddress) : null
                },
                actor: {
                    name: dist.distributorName,
                    id: dist.distributorId,
                    type: 'Distributor'
                },
                qrCode: {
                    id: dist.qrCodeId,
                    url: dist.qrCodeUrl
                }
            });
        }

        // Sort timeline by timestamp
        return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    }

    /**
     * Format collection information
     * @param {Object} collectionEvent - Collection event data
     * @returns {Object} Formatted collection information
     */
    static formatCollectionInfo(collectionEvent) {
        if (!collectionEvent) return null;

        return {
            batchId: collectionEvent.batchId,
            farmer: {
                id: collectionEvent.farmerId,
                name: collectionEvent.farmerName
            },
            herb: {
                type: collectionEvent.herbType,
                variety: collectionEvent.herbVariety,
                quantity: `${collectionEvent.quantityKg} kg`
            },
            harvest: {
                date: collectionEvent.collectionDate,
                season: collectionEvent.harvestSeason,
                method: collectionEvent.collectionMethod
            },
            location: {
                coordinates: collectionEvent.gpsCoordinates,
                formatted: this.formatGPSLocation(collectionEvent.gpsCoordinates)
            },
            conditions: {
                weather: collectionEvent.weatherConditions,
                soil: collectionEvent.soilConditions
            },
            certification: {
                type: collectionEvent.certificationType,
                sustainabilityScore: collectionEvent.sustainabilityScore
            }
        };
    }

    /**
     * Format processing information
     * @param {Array} processingSteps - Processing steps array
     * @returns {Object} Formatted processing information
     */
    static formatProcessingInfo(processingSteps) {
        if (!processingSteps || processingSteps.length === 0) {
            return { totalSteps: 0, steps: [], summary: null };
        }

        const totalInput = processingSteps[0].inputQuantityKg;
        const totalOutput = processingSteps[processingSteps.length - 1].outputQuantityKg;
        const overallYield = totalInput > 0 ? (totalOutput / totalInput) * 100 : 0;
        const totalDuration = processingSteps.reduce((sum, step) => {
            return sum + (step.duration || 0);
        }, 0);

        const stepsSummary = processingSteps.map((step, index) => ({
            stepNumber: index + 1,
            stepId: step.stepId,
            processType: step.processType,
            facility: {
                id: step.facilityId,
                name: step.facilityName
            },
            quantities: {
                input: `${step.inputQuantityKg} kg`,
                output: `${step.outputQuantityKg} kg`,
                yield: `${step.yieldPercentage}%`
            },
            timing: {
                start: step.processStartTime,
                end: step.processEndTime,
                duration: step.duration ? `${step.duration} minutes` : null
            },
            conditions: {
                temperature: step.temperature ? `${step.temperature}°C` : null,
                pressure: step.pressure ? `${step.pressure} bar` : null
            },
            quality: step.qualityParameters,
            equipment: step.equipmentUsed,
            operator: step.operatorId
        }));

        return {
            totalSteps: processingSteps.length,
            summary: {
                totalInput: `${totalInput} kg`,
                totalOutput: `${totalOutput} kg`,
                overallYield: `${Math.round(overallYield * 100) / 100}%`,
                totalDuration: `${totalDuration} minutes`,
                facilities: [...new Set(processingSteps.map(step => step.facilityName))]
            },
            steps: stepsSummary
        };
    }

    /**
     * Format quality testing information
     * @param {Array} qualityTests - Quality tests array
     * @returns {Object} Formatted quality testing information
     */
    static formatQualityTestingInfo(qualityTests) {
        if (!qualityTests || qualityTests.length === 0) {
            return { totalTests: 0, tests: [], summary: null };
        }

        const testResults = {
            pass: qualityTests.filter(test => test.overallResult === 'Pass').length,
            fail: qualityTests.filter(test => test.overallResult === 'Fail').length,
            conditional: qualityTests.filter(test => test.overallResult === 'Conditional-Pass').length
        };

        const testsSummary = qualityTests.map((test, index) => ({
            testNumber: index + 1,
            testId: test.testId,
            testType: test.testType,
            laboratory: {
                id: test.labId,
                name: test.labName,
                certification: test.labCertification
            },
            sample: {
                id: test.sampleId,
                quantity: `${test.sampleQuantity} g`
            },
            results: {
                overall: test.overallResult,
                parameters: this.formatTestParameters(test)
            },
            testDate: test.testDate,
            methodology: test.testMethodology,
            tester: test.testerId
        }));

        const overallScore = qualityTests.length > 0 ? 
            Math.round((testResults.pass / qualityTests.length) * 100) : 0;

        return {
            totalTests: qualityTests.length,
            summary: {
                overallScore: `${overallScore}%`,
                results: testResults,
                laboratories: [...new Set(qualityTests.map(test => test.labName))],
                testTypes: [...new Set(qualityTests.map(test => test.testType))]
            },
            tests: testsSummary
        };
    }

    /**
     * Format distribution information
     * @param {Object} distributionInfo - Distribution information
     * @returns {Object} Formatted distribution information
     */
    static formatDistributionInfo(distributionInfo) {
        if (!distributionInfo) return null;

        return {
            distributor: {
                id: distributionInfo.distributorId,
                name: distributionInfo.distributorName
            },
            packaging: {
                date: distributionInfo.packageDate,
                type: distributionInfo.packageType,
                weight: distributionInfo.packageWeight ? 
                    `${distributionInfo.packageWeight} kg` : null,
                lotNumber: distributionInfo.batchLotNumber,
                expiryDate: distributionInfo.expiryDate
            },
            traceability: {
                qrCodeId: distributionInfo.qrCodeId,
                qrCodeUrl: distributionInfo.qrCodeUrl
            },
            destination: distributionInfo.destinationAddress ? 
                this.formatAddress(distributionInfo.destinationAddress) : null
        };
    }

    /**
     * Format sustainability information
     * @param {Object} sustainability - Sustainability data
     * @returns {Object} Formatted sustainability information
     */
    static formatSustainabilityInfo(sustainability) {
        return {
            overallScore: sustainability.overallScore || 0,
            metrics: {
                carbonFootprint: sustainability.carbonFootprint ? 
                    `${sustainability.carbonFootprint} kg CO2e` : null,
                waterUsage: sustainability.waterUsage ? 
                    `${sustainability.waterUsage} liters` : null,
                energyConsumption: sustainability.energyConsumption ? 
                    `${sustainability.energyConsumption} kWh` : null,
                biodiversityImpact: sustainability.biodiversityImpact ? 
                    `${sustainability.biodiversityImpact}/10` : null,
                socialImpact: sustainability.socialImpact ? 
                    `${sustainability.socialImpact}/10` : null
            }
        };
    }

    /**
     * Format compliance information
     * @param {Object} compliance - Compliance data
     * @returns {Object} Formatted compliance information
     */
    static formatComplianceInfo(compliance) {
        return {
            certifications: {
                organic: compliance.organicCertified || false,
                gmp: compliance.gmpCertified || false,
                iso: compliance.isoCertified || false,
                ayush: compliance.ayushCompliant || false,
                fssai: compliance.fssaiApproved || false
            },
            complianceScore: this.calculateComplianceScore(compliance)
        };
    }

    /**
     * Helper method to format GPS location
     * @param {Object} gpsCoordinates - GPS coordinates
     * @returns {string} Formatted location string
     */
    static formatGPSLocation(gpsCoordinates) {
        if (!gpsCoordinates || !gpsCoordinates.latitude || !gpsCoordinates.longitude) {
            return 'Location not available';
        }

        const lat = parseFloat(gpsCoordinates.latitude).toFixed(4);
        const lon = parseFloat(gpsCoordinates.longitude).toFixed(4);
        
        return `${lat}°N, ${lon}°E`;
    }

    /**
     * Helper method to format address
     * @param {Object} address - Address object
     * @returns {string} Formatted address string
     */
    static formatAddress(address) {
        if (!address) return null;

        const parts = [
            address.street,
            address.city,
            address.state,
            address.country,
            address.postalCode
        ].filter(Boolean);

        return parts.join(', ');
    }

    /**
     * Helper method to calculate duration between timestamps
     * @param {string} startTime - Start timestamp
     * @param {string} endTime - End timestamp
     * @returns {string} Duration string
     */
    static calculateDuration(startTime, endTime) {
        const start = new Date(startTime);
        const end = new Date(endTime);
        const diffMs = end - start;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        if (diffHours > 0) {
            return `${diffHours}h ${diffMinutes}m`;
        }
        return `${diffMinutes}m`;
    }

    /**
     * Helper method to format test parameters
     * @param {Object} test - Test object
     * @returns {Object} Formatted test parameters
     */
    static formatTestParameters(test) {
        const parameters = {};

        if (test.moistureContent !== undefined) {
            parameters.moisture = `${test.moistureContent}%`;
        }
        if (test.ashContent !== undefined) {
            parameters.ash = `${test.ashContent}%`;
        }
        if (test.foreignMatter !== undefined) {
            parameters.foreignMatter = `${test.foreignMatter}%`;
        }
        if (test.activePrinciples) {
            parameters.activePrinciples = test.activePrinciples;
        }
        if (test.heavyMetals) {
            parameters.heavyMetals = test.heavyMetals;
        }
        if (test.pesticideResidues) {
            parameters.pesticides = `${test.pesticideResidues.length} compounds tested`;
        }
        if (test.microbialCount) {
            parameters.microbial = test.microbialCount;
        }
        if (test.dnaAuthenticity) {
            parameters.dnaConfirmed = test.dnaAuthenticity.speciesConfirmed;
        }

        return parameters;
    }

    /**
     * Helper method to count test parameters
     * @param {Object} test - Test object
     * @returns {number} Number of parameters tested
     */
    static countTestParameters(test) {
        let count = 0;
        if (test.moistureContent !== undefined) count++;
        if (test.ashContent !== undefined) count++;
        if (test.foreignMatter !== undefined) count++;
        if (test.activePrinciples) count += Object.keys(test.activePrinciples).length;
        if (test.heavyMetals) count += Object.keys(test.heavyMetals).length;
        if (test.pesticideResidues) count += test.pesticideResidues.length;
        if (test.microbialCount) count += Object.keys(test.microbialCount).length;
        if (test.dnaAuthenticity) count++;
        return count;
    }

    /**
     * Helper method to extract certifications
     * @param {Object} provenanceRecord - Provenance record
     * @returns {Array} Array of certifications
     */
    static extractCertifications(provenanceRecord) {
        const certifications = [];

        if (provenanceRecord.collectionEvent?.certificationType) {
            certifications.push(provenanceRecord.collectionEvent.certificationType);
        }

        if (provenanceRecord.compliance) {
            const compliance = provenanceRecord.compliance;
            if (compliance.organicCertified) certifications.push('Organic');
            if (compliance.gmpCertified) certifications.push('GMP');
            if (compliance.isoCertified) certifications.push('ISO');
            if (compliance.ayushCompliant) certifications.push('AYUSH');
            if (compliance.fssaiApproved) certifications.push('FSSAI');
        }

        return [...new Set(certifications)]; // Remove duplicates
    }

    /**
     * Helper method to calculate compliance score
     * @param {Object} compliance - Compliance data
     * @returns {number} Compliance score percentage
     */
    static calculateComplianceScore(compliance) {
        const certifications = [
            compliance.organicCertified,
            compliance.gmpCertified,
            compliance.isoCertified,
            compliance.ayushCompliant,
            compliance.fssaiApproved
        ];

        const passedCount = certifications.filter(cert => cert === true).length;
        return Math.round((passedCount / certifications.length) * 100);
    }

    /**
     * Helper method to validate data integrity
     * @param {Object} provenanceRecord - Provenance record
     * @returns {Object} Data integrity status
     */
    static validateDataIntegrity(provenanceRecord) {
        const issues = [];
        const warnings = [];

        // Check required fields
        if (!provenanceRecord.batchId) issues.push('Missing batch ID');
        if (!provenanceRecord.collectionEvent) issues.push('Missing collection event');
        if (!provenanceRecord.currentStatus) issues.push('Missing current status');

        // Check data consistency
        if (provenanceRecord.processingSteps?.length > 0) {
            const firstStep = provenanceRecord.processingSteps[0];
            const collectionQuantity = provenanceRecord.collectionEvent?.quantityKg;
            
            if (collectionQuantity && firstStep.inputQuantityKg !== collectionQuantity) {
                warnings.push('Collection quantity does not match first processing input');
            }
        }

        // Check status consistency
        const hasTests = provenanceRecord.qualityTests?.length > 0;
        const hasPackaging = !!provenanceRecord.distributionInfo;
        
        if (provenanceRecord.currentStatus === 'Packaged' && !hasPackaging) {
            issues.push('Status is Packaged but no distribution info found');
        }

        return {
            isValid: issues.length === 0,
            issues,
            warnings,
            checkedAt: new Date().toISOString()
        };
    }
}

module.exports = ProvenanceHelper;