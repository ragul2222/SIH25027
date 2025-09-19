const { Contract } = require('fabric-contract-api');
const TraceabilityUtils = require('./utils');

/**
 * Harvest Validation Smart Contract for Ayurvedic Herb Traceability
 * Checks seasonality rules and sustainability quotas
 */
class HarvestValidationContract extends Contract {

    constructor() {
        super('HarvestValidationContract');
    }

    /**
     * Initialize contract with harvest validation rules
     * @param {Context} ctx - Transaction context
     */
    async initLedger(ctx) {
        console.info('============= START : Initialize Harvest Validation Ledger ===========');

        // Initialize sustainability tracking data structure
        const sustainabilityTracker = {
            lastUpdated: new Date().toISOString(),
            yearlyQuotas: {
                '2024': {
                    totalQuota: 100000, // 100 tons total for all herbs
                    usedQuota: 0,
                    herbQuotas: {
                        'Ashwagandha': { quota: 20000, used: 0 },
                        'Turmeric': { quota: 25000, used: 0 },
                        'Tulsi': { quota: 15000, used: 0 },
                        'Neem': { quota: 10000, used: 0 },
                        'Brahmi': { quota: 8000, used: 0 },
                        'Other': { quota: 22000, used: 0 }
                    }
                }
            }
        };

        await ctx.stub.putState('SUSTAINABILITY_TRACKER', Buffer.from(JSON.stringify(sustainabilityTracker)));

        console.info('============= END : Initialize Harvest Validation Ledger ===========');
    }

    /**
     * Validate harvest against seasonality rules
     * @param {Context} ctx - Transaction context
     * @param {string} herbType - Type of herb being harvested
     * @param {string} harvestDate - ISO date string of harvest
     * @param {string} gpsData - GPS coordinates JSON string
     * @returns {Object} Validation result
     */
    async validateHarvestSeason(ctx, herbType, harvestDate, gpsData = null) {
        console.info('============= START : Validate Harvest Season ===========');

        const harvestDateObj = new Date(harvestDate);
        const coordinates = gpsData ? JSON.parse(gpsData) : null;
        
        // Determine hemisphere and current season
        const hemisphere = (coordinates && coordinates.latitude < 0) ? 'south' : 'north';
        const season = TraceabilityUtils.getCurrentSeason(harvestDateObj, hemisphere);
        
        // Validate against seasonal rules
        const seasonValidation = TraceabilityUtils.validateHarvestSeason(herbType, season, harvestDateObj);
        
        // Additional time-based validation
        const currentDate = new Date();
        const harvestMonth = harvestDateObj.getMonth() + 1;
        
        // Check if harvest date is not in future
        if (harvestDateObj > currentDate) {
            return {
                isValid: false,
                message: 'Harvest date cannot be in the future',
                season,
                harvestDate: harvestDate
            };
        }

        // Check if harvest is too old (more than 1 year)
        const daysDifference = (currentDate - harvestDateObj) / (1000 * 60 * 60 * 24);
        if (daysDifference > 365) {
            return {
                isValid: false,
                message: 'Harvest date is too old (more than 1 year)',
                season,
                harvestDate: harvestDate
            };
        }

        // Herb-specific seasonal restrictions
        const herbSeasonalRules = {
            'Ashwagandha': {
                optimalMonths: [11, 12, 1, 2, 3, 4], // Nov-Apr
                message: 'Ashwagandha should be harvested in winter/spring (Nov-Apr) for optimal potency'
            },
            'Turmeric': {
                optimalMonths: [12, 1, 2, 3, 4, 5], // Dec-May
                message: 'Turmeric should be harvested after 8-9 months of planting (Dec-May)'
            },
            'Tulsi': {
                optimalMonths: [6, 7, 8, 9, 10], // Jun-Oct
                message: 'Tulsi leaves are best harvested during summer and monsoon (Jun-Oct)'
            },
            'Neem': {
                optimalMonths: [5, 6, 7, 8, 9], // May-Sep
                message: 'Neem is typically harvested during summer and early monsoon (May-Sep)'
            }
        };

        const herbRule = herbSeasonalRules[herbType];
        let isOptimalSeason = true;
        let seasonMessage = seasonValidation.message;

        if (herbRule && !herbRule.optimalMonths.includes(harvestMonth)) {
            isOptimalSeason = false;
            seasonMessage += `. Warning: ${herbRule.message}`;
        }

        console.info('============= END : Validate Harvest Season ===========');
        return {
            isValid: seasonValidation.isValid,
            isOptimalSeason,
            message: seasonMessage,
            season,
            harvestMonth,
            harvestDate: harvestDate,
            allowedSeasons: seasonValidation.allowedSeasons
        };
    }

    /**
     * Validate harvest quantity against sustainability quotas
     * @param {Context} ctx - Transaction context
     * @param {string} herbType - Type of herb
     * @param {number} quantity - Requested harvest quantity in kg
     * @param {string} farmerId - Farmer identifier
     * @param {string} harvestDate - Harvest date
     * @returns {Object} Validation result
     */
    async validateSustainabilityQuota(ctx, herbType, quantity, farmerId, harvestDate) {
        console.info('============= START : Validate Sustainability Quota ===========');

        const harvestYear = new Date(harvestDate).getFullYear().toString();
        const quantityNum = parseFloat(quantity);

        if (quantityNum <= 0) {
            throw new Error('Harvest quantity must be positive');
        }

        // Get current sustainability tracker
        const trackerBuffer = await ctx.stub.getState('SUSTAINABILITY_TRACKER');
        let tracker;
        
        if (!trackerBuffer || trackerBuffer.length === 0) {
            // Initialize if not exists
            tracker = {
                lastUpdated: new Date().toISOString(),
                yearlyQuotas: {}
            };
        } else {
            tracker = JSON.parse(trackerBuffer.toString());
        }

        // Initialize year if not exists
        if (!tracker.yearlyQuotas[harvestYear]) {
            tracker.yearlyQuotas[harvestYear] = {
                totalQuota: 100000, // 100 tons per year default
                usedQuota: 0,
                herbQuotas: {
                    'Ashwagandha': { quota: 20000, used: 0 },
                    'Turmeric': { quota: 25000, used: 0 },
                    'Tulsi': { quota: 15000, used: 0 },
                    'Neem': { quota: 10000, used: 0 },
                    'Brahmi': { quota: 8000, used: 0 },
                    'Other': { quota: 22000, used: 0 }
                }
            };
        }

        const yearData = tracker.yearlyQuotas[harvestYear];
        const herbQuota = yearData.herbQuotas[herbType] || yearData.herbQuotas['Other'];

        // Check if quota is available
        const remainingQuota = herbQuota.quota - herbQuota.used;
        const remainingTotalQuota = yearData.totalQuota - yearData.usedQuota;

        if (quantityNum > remainingQuota) {
            return {
                isValid: false,
                message: `Insufficient quota for ${herbType}. Requested: ${quantityNum}kg, Available: ${remainingQuota}kg`,
                quotaStatus: {
                    herbType,
                    requested: quantityNum,
                    available: remainingQuota,
                    total: herbQuota.quota,
                    used: herbQuota.used,
                    utilization: (herbQuota.used / herbQuota.quota * 100).toFixed(2)
                }
            };
        }

        if (quantityNum > remainingTotalQuota) {
            return {
                isValid: false,
                message: `Insufficient total quota. Requested: ${quantityNum}kg, Available total: ${remainingTotalQuota}kg`,
                quotaStatus: {
                    totalRequested: quantityNum,
                    totalAvailable: remainingTotalQuota,
                    totalQuota: yearData.totalQuota,
                    totalUsed: yearData.usedQuota
                }
            };
        }

        // Get farmer's harvest history for additional validation
        const farmerHarvestKey = `FARMER_HARVEST_${farmerId}_${harvestYear}`;
        const farmerHistoryBuffer = await ctx.stub.getState(farmerHarvestKey);
        let farmerHistory = farmerHistoryBuffer && farmerHistoryBuffer.length > 0 ? 
            JSON.parse(farmerHistoryBuffer.toString()) : { totalHarvest: 0, herbHarvests: {} };

        // Check individual farmer limits (prevent over-concentration)
        const maxFarmerShare = 0.10; // Max 10% of total quota per farmer
        const maxFarmerQuota = yearData.totalQuota * maxFarmerShare;
        
        if (farmerHistory.totalHarvest + quantityNum > maxFarmerQuota) {
            return {
                isValid: false,
                message: `Farmer quota exceeded. Maximum allowed: ${maxFarmerQuota}kg per year, Current: ${farmerHistory.totalHarvest}kg, Requested: ${quantityNum}kg`,
                farmerQuotaStatus: {
                    farmerId,
                    maxAllowed: maxFarmerQuota,
                    currentTotal: farmerHistory.totalHarvest,
                    requested: quantityNum
                }
            };
        }

        console.info('============= END : Validate Sustainability Quota ===========');
        return {
            isValid: true,
            message: `Sustainability quota validated for ${quantityNum}kg of ${herbType}`,
            quotaStatus: {
                herbType,
                requested: quantityNum,
                available: remainingQuota,
                total: herbQuota.quota,
                used: herbQuota.used,
                utilization: (herbQuota.used / herbQuota.quota * 100).toFixed(2)
            },
            farmerQuotaStatus: {
                farmerId,
                maxAllowed: maxFarmerQuota,
                currentTotal: farmerHistory.totalHarvest,
                requested: quantityNum,
                newTotal: farmerHistory.totalHarvest + quantityNum
            }
        };
    }

    /**
     * Update sustainability quota usage after successful harvest
     * @param {Context} ctx - Transaction context
     * @param {string} herbType - Type of herb
     * @param {number} quantity - Harvested quantity in kg
     * @param {string} farmerId - Farmer identifier
     * @param {string} harvestDate - Harvest date
     * @returns {Object} Update result
     */
    async updateQuotaUsage(ctx, herbType, quantity, farmerId, harvestDate) {
        console.info('============= START : Update Quota Usage ===========');

        const harvestYear = new Date(harvestDate).getFullYear().toString();
        const quantityNum = parseFloat(quantity);

        // Get and update sustainability tracker
        const trackerBuffer = await ctx.stub.getState('SUSTAINABILITY_TRACKER');
        const tracker = JSON.parse(trackerBuffer.toString());
        
        const yearData = tracker.yearlyQuotas[harvestYear];
        const herbQuota = yearData.herbQuotas[herbType] || yearData.herbQuotas['Other'];

        // Update herb-specific quota
        herbQuota.used += quantityNum;
        yearData.usedQuota += quantityNum;
        tracker.lastUpdated = new Date().toISOString();

        // Update farmer history
        const farmerHarvestKey = `FARMER_HARVEST_${farmerId}_${harvestYear}`;
        const farmerHistoryBuffer = await ctx.stub.getState(farmerHarvestKey);
        let farmerHistory = farmerHistoryBuffer && farmerHistoryBuffer.length > 0 ? 
            JSON.parse(farmerHistoryBuffer.toString()) : 
            { farmerId, year: harvestYear, totalHarvest: 0, herbHarvests: {}, lastUpdated: new Date().toISOString() };

        farmerHistory.totalHarvest += quantityNum;
        farmerHistory.herbHarvests[herbType] = (farmerHistory.herbHarvests[herbType] || 0) + quantityNum;
        farmerHistory.lastUpdated = new Date().toISOString();

        // Save updated data
        await ctx.stub.putState('SUSTAINABILITY_TRACKER', Buffer.from(JSON.stringify(tracker)));
        await ctx.stub.putState(farmerHarvestKey, Buffer.from(JSON.stringify(farmerHistory)));

        console.info('============= END : Update Quota Usage ===========');
        return {
            success: true,
            message: `Quota usage updated: ${quantityNum}kg of ${herbType} for farmer ${farmerId}`,
            updatedQuota: {
                herbType,
                used: herbQuota.used,
                remaining: herbQuota.quota - herbQuota.used,
                utilization: (herbQuota.used / herbQuota.quota * 100).toFixed(2)
            },
            farmerStatus: {
                farmerId,
                totalHarvest: farmerHistory.totalHarvest,
                herbHarvest: farmerHistory.herbHarvests[herbType]
            }
        };
    }

    /**
     * Get current quota status
     * @param {Context} ctx - Transaction context
     * @param {string} year - Year to check (optional, defaults to current year)
     * @returns {Object} Quota status
     */
    async getQuotaStatus(ctx, year = null) {
        const targetYear = year || new Date().getFullYear().toString();
        
        const trackerBuffer = await ctx.stub.getState('SUSTAINABILITY_TRACKER');
        if (!trackerBuffer || trackerBuffer.length === 0) {
            throw new Error('Sustainability tracker not initialized');
        }

        const tracker = JSON.parse(trackerBuffer.toString());
        const yearData = tracker.yearlyQuotas[targetYear];

        if (!yearData) {
            throw new Error(`No quota data found for year ${targetYear}`);
        }

        // Calculate utilization percentages
        const quotaStatus = {
            year: targetYear,
            totalQuota: yearData.totalQuota,
            totalUsed: yearData.usedQuota,
            totalRemaining: yearData.totalQuota - yearData.usedQuota,
            totalUtilization: (yearData.usedQuota / yearData.totalQuota * 100).toFixed(2),
            herbQuotas: {}
        };

        for (const [herbType, quota] of Object.entries(yearData.herbQuotas)) {
            quotaStatus.herbQuotas[herbType] = {
                quota: quota.quota,
                used: quota.used,
                remaining: quota.quota - quota.used,
                utilization: (quota.used / quota.quota * 100).toFixed(2)
            };
        }

        return quotaStatus;
    }

    /**
     * Get farmer harvest history
     * @param {Context} ctx - Transaction context
     * @param {string} farmerId - Farmer identifier
     * @param {string} year - Year to check (optional, defaults to current year)
     * @returns {Object} Farmer harvest history
     */
    async getFarmerHarvestHistory(ctx, farmerId, year = null) {
        const targetYear = year || new Date().getFullYear().toString();
        const farmerHarvestKey = `FARMER_HARVEST_${farmerId}_${targetYear}`;
        
        const farmerHistoryBuffer = await ctx.stub.getState(farmerHarvestKey);
        if (!farmerHistoryBuffer || farmerHistoryBuffer.length === 0) {
            return {
                farmerId,
                year: targetYear,
                totalHarvest: 0,
                herbHarvests: {},
                message: 'No harvest history found for this farmer in the specified year'
            };
        }

        return JSON.parse(farmerHistoryBuffer.toString());
    }

    /**
     * Update quota limits (admin function)
     * @param {Context} ctx - Transaction context
     * @param {string} quotaData - JSON string with new quota limits
     * @returns {Object} Update result
     */
    async updateQuotaLimits(ctx, quotaData) {
        // Check permissions - only regulators can update quotas
        const clientMSPID = ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'RegulatorMSP') {
            throw new Error('Only regulators can update quota limits');
        }

        const newQuotas = JSON.parse(quotaData);
        const year = newQuotas.year || new Date().getFullYear().toString();

        const trackerBuffer = await ctx.stub.getState('SUSTAINABILITY_TRACKER');
        const tracker = JSON.parse(trackerBuffer.toString());

        // Update quota limits
        if (!tracker.yearlyQuotas[year]) {
            tracker.yearlyQuotas[year] = { totalQuota: 0, usedQuota: 0, herbQuotas: {} };
        }

        const yearData = tracker.yearlyQuotas[year];
        
        if (newQuotas.totalQuota) {
            yearData.totalQuota = newQuotas.totalQuota;
        }

        if (newQuotas.herbQuotas) {
            for (const [herbType, quota] of Object.entries(newQuotas.herbQuotas)) {
                if (!yearData.herbQuotas[herbType]) {
                    yearData.herbQuotas[herbType] = { quota: 0, used: 0 };
                }
                yearData.herbQuotas[herbType].quota = quota;
            }
        }

        tracker.lastUpdated = new Date().toISOString();
        await ctx.stub.putState('SUSTAINABILITY_TRACKER', Buffer.from(JSON.stringify(tracker)));

        return {
            success: true,
            message: `Quota limits updated for year ${year}`,
            updatedQuotas: yearData
        };
    }
}

module.exports = HarvestValidationContract;