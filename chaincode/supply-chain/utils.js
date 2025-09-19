const crypto = require('crypto');

/**
 * Utility functions for Ayurvedic herb traceability system
 */
class TraceabilityUtils {
    
    /**
     * Generate a unique batch ID
     * @param {string} herbType - Type of herb
     * @param {string} farmerId - Farmer ID
     * @param {Date} date - Collection date
     * @returns {string} Unique batch ID
     */
    static generateBatchId(herbType, farmerId, date = new Date()) {
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        return `${herbType.toUpperCase().slice(0, 3)}-${farmerId.slice(-4)}-${dateStr}-${random}`;
    }

    /**
     * Calculate distance between two GPS coordinates using Haversine formula
     * @param {Object} point1 - {latitude, longitude}
     * @param {Object} point2 - {latitude, longitude}
     * @returns {number} Distance in meters
     */
    static calculateDistance(point1, point2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = point1.latitude * Math.PI / 180;
        const φ2 = point2.latitude * Math.PI / 180;
        const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180;
        const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    /**
     * Check if a point is within a circular geofenced area
     * @param {Object} point - {latitude, longitude}
     * @param {Object} zone - Zone with centerPoint and radius
     * @returns {boolean} True if point is within zone
     */
    static isPointInCircularZone(point, zone) {
        const distance = this.calculateDistance(point, zone.centerPoint);
        return distance <= zone.radius;
    }

    /**
     * Check if a point is within a polygonal geofenced area
     * @param {Object} point - {latitude, longitude}
     * @param {Array} boundaries - Array of boundary coordinates
     * @returns {boolean} True if point is within polygon
     */
    static isPointInPolygon(point, boundaries) {
        const x = point.latitude;
        const y = point.longitude;
        let inside = false;

        for (let i = 0, j = boundaries.length - 1; i < boundaries.length; j = i++) {
            const xi = boundaries[i].latitude;
            const yi = boundaries[i].longitude;
            const xj = boundaries[j].latitude;
            const yj = boundaries[j].longitude;

            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    /**
     * Validate harvest season against herb-specific rules
     * @param {string} herbType - Type of herb
     * @param {string} season - Current season
     * @param {Date} harvestDate - Date of harvest
     * @returns {Object} Validation result with isValid and message
     */
    static validateHarvestSeason(herbType, season, harvestDate = new Date()) {
        // Define seasonal rules for different herbs
        const seasonalRules = {
            'Ashwagandha': ['Winter', 'Spring'],
            'Turmeric': ['Winter', 'Spring'],
            'Ginger': ['Winter', 'Spring'],
            'Tulsi': ['Summer', 'Monsoon', 'Autumn'],
            'Neem': ['Summer', 'Monsoon'],
            'Brahmi': ['Summer', 'Monsoon', 'Autumn'],
            'Amla': ['Winter', 'Spring'],
            'Arjuna': ['Spring', 'Summer'],
            'Shatavari': ['Spring', 'Summer', 'Autumn'],
            'Guduchi': ['Summer', 'Monsoon']
        };

        const allowedSeasons = seasonalRules[herbType] || ['Spring', 'Summer', 'Monsoon', 'Autumn', 'Winter'];
        const isValid = allowedSeasons.includes(season);

        return {
            isValid,
            message: isValid ? 
                `Harvest season ${season} is valid for ${herbType}` :
                `Invalid harvest season ${season} for ${herbType}. Allowed seasons: ${allowedSeasons.join(', ')}`,
            allowedSeasons
        };
    }

    /**
     * Calculate sustainability score based on various factors
     * @param {Object} params - Sustainability parameters
     * @returns {number} Score between 0-100
     */
    static calculateSustainabilityScore(params) {
        const {
            harvestMethod = 'Hand-picked',
            certificationLevel = 'Organic',
            soilHealth = 50,
            waterEfficiency = 50,
            biodiversityImpact = 50,
            carbonFootprint = 50
        } = params;

        let score = 0;

        // Harvest method score (30% weight)
        const methodScores = {
            'Hand-picked': 30,
            'Tool-assisted': 20,
            'Machine-harvested': 10
        };
        score += methodScores[harvestMethod] || 15;

        // Certification score (25% weight)
        const certScores = {
            'Organic': 25,
            'Natural': 15,
            'Conventional': 5
        };
        score += certScores[certificationLevel] || 10;

        // Environmental factors (45% weight)
        score += (soilHealth * 0.15) / 100 * 100;
        score += (waterEfficiency * 0.10) / 100 * 100;
        score += (biodiversityImpact * 0.10) / 100 * 100;
        score += Math.max(0, (100 - carbonFootprint) * 0.10) / 100 * 100;

        return Math.min(100, Math.max(0, score));
    }

    /**
     * Validate quality test results against standards
     * @param {Object} testResults - Quality test results
     * @param {string} herbType - Type of herb
     * @returns {Object} Validation result
     */
    static validateQualityStandards(testResults, herbType) {
        const standards = {
            'Ashwagandha': {
                moisture: { max: 12 },
                ash: { max: 8 },
                foreignMatter: { max: 2 },
                withanolides: { min: 0.3 }
            },
            'Turmeric': {
                moisture: { max: 10 },
                ash: { max: 9 },
                foreignMatter: { max: 1 },
                curcumin: { min: 2.0 }
            },
            'default': {
                moisture: { max: 15 },
                ash: { max: 10 },
                foreignMatter: { max: 3 }
            }
        };

        const standard = standards[herbType] || standards['default'];
        const violations = [];

        // Check each parameter
        for (const [param, limits] of Object.entries(standard)) {
            const value = testResults[param];
            if (value !== undefined) {
                if (limits.max !== undefined && value > limits.max) {
                    violations.push(`${param}: ${value}% exceeds maximum ${limits.max}%`);
                }
                if (limits.min !== undefined && value < limits.min) {
                    violations.push(`${param}: ${value}% below minimum ${limits.min}%`);
                }
            }
        }

        return {
            isValid: violations.length === 0,
            violations,
            standard
        };
    }

    /**
     * Generate QR code data for batch traceability
     * @param {string} batchId - Batch identifier
     * @param {string} baseUrl - Base URL for traceability portal
     * @returns {Object} QR code data and URL
     */
    static generateQRCodeData(batchId, baseUrl = 'https://traceability.ayurveda.com') {
        const qrCodeId = crypto.randomBytes(8).toString('hex').toUpperCase();
        const url = `${baseUrl}/trace/${batchId}?qr=${qrCodeId}`;
        
        const qrData = {
            batchId,
            qrCodeId,
            url,
            timestamp: new Date().toISOString(),
            version: '1.0'
        };

        return {
            qrData,
            url,
            qrCodeId
        };
    }

    /**
     * Validate digital signature
     * @param {string} data - Data that was signed
     * @param {string} signature - Digital signature
     * @param {string} publicKey - Public key for verification
     * @returns {boolean} True if signature is valid
     */
    static validateDigitalSignature(data, signature, publicKey) {
        try {
            const verifier = crypto.createVerify('SHA256');
            verifier.update(data);
            return verifier.verify(publicKey, signature, 'hex');
        } catch (error) {
            console.error('Signature validation error:', error);
            return false;
        }
    }

    /**
     * Generate hash for data integrity
     * @param {Object} data - Data to hash
     * @returns {string} SHA256 hash
     */
    static generateDataHash(data) {
        const dataString = typeof data === 'string' ? data : JSON.stringify(data);
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    /**
     * Check if harvest is within sustainability limits
     * @param {Object} zone - Geofencing zone with limits
     * @param {number} requestedQuantity - Requested harvest quantity
     * @param {Array} previousHarvests - Array of previous harvests in time period
     * @returns {Object} Validation result
     */
    static validateSustainabilityLimits(zone, requestedQuantity, previousHarvests = []) {
        if (!zone.sustainabilityLimits) {
            return { isValid: true, message: 'No sustainability limits defined' };
        }

        const limits = zone.sustainabilityLimits;
        const currentYear = new Date().getFullYear();
        
        // Check annual harvest limit
        if (limits.maxAnnualHarvest) {
            const yearHarvests = previousHarvests.filter(h => 
                new Date(h.collectionDate).getFullYear() === currentYear
            );
            const totalHarvested = yearHarvests.reduce((sum, h) => sum + h.quantityKg, 0);
            
            if (totalHarvested + requestedQuantity > limits.maxAnnualHarvest) {
                return {
                    isValid: false,
                    message: `Annual harvest limit exceeded. Limit: ${limits.maxAnnualHarvest}kg, Already harvested: ${totalHarvested}kg, Requested: ${requestedQuantity}kg`
                };
            }
        }

        // Check regeneration period
        if (limits.minRegenerationPeriod) {
            const lastHarvest = previousHarvests
                .sort((a, b) => new Date(b.collectionDate) - new Date(a.collectionDate))[0];
            
            if (lastHarvest) {
                const daysSinceLastHarvest = (Date.now() - new Date(lastHarvest.collectionDate)) / (1000 * 60 * 60 * 24);
                if (daysSinceLastHarvest < limits.minRegenerationPeriod) {
                    return {
                        isValid: false,
                        message: `Minimum regeneration period not met. Required: ${limits.minRegenerationPeriod} days, Elapsed: ${Math.floor(daysSinceLastHarvest)} days`
                    };
                }
            }
        }

        return { isValid: true, message: 'Sustainability limits satisfied' };
    }

    /**
     * Get current season based on date and location
     * @param {Date} date - Date to check
     * @param {string} hemisphere - 'north' or 'south'
     * @returns {string} Season name
     */
    static getCurrentSeason(date = new Date(), hemisphere = 'north') {
        const month = date.getMonth() + 1; // 1-12
        
        if (hemisphere === 'north') {
            if (month >= 3 && month <= 5) return 'Spring';
            if (month >= 6 && month <= 8) return 'Summer';
            if (month >= 9 && month <= 11) return 'Autumn';
            return 'Winter';
        } else {
            if (month >= 3 && month <= 5) return 'Autumn';
            if (month >= 6 && month <= 8) return 'Winter';
            if (month >= 9 && month <= 11) return 'Spring';
            return 'Summer';
        }
    }
}

module.exports = TraceabilityUtils;