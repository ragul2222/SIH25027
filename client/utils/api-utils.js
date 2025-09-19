const QRCode = require('qrcode');
const crypto = require('crypto');
const config = require('../config');
const logger = require('./logger');

/**
 * Utility functions for the API
 */
class APIUtils {
    
    /**
     * Generate QR code for batch traceability
     * @param {string} batchId - Batch identifier
     * @param {string} qrCodeId - QR code identifier
     * @returns {Promise<Object>} QR code data and image
     */
    static async generateQRCode(batchId, qrCodeId) {
        try {
            const url = `${config.qrCode.baseUrl}/trace/${batchId}?qr=${qrCodeId}`;
            
            // Generate QR code as data URL
            const qrCodeDataURL = await QRCode.toDataURL(url, {
                width: config.qrCode.size,
                errorCorrectionLevel: config.qrCode.errorCorrectionLevel,
                type: 'image/png',
                quality: 0.92,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });

            // Generate QR code as SVG string
            const qrCodeSVG = await QRCode.toString(url, {
                type: 'svg',
                width: config.qrCode.size,
                errorCorrectionLevel: config.qrCode.errorCorrectionLevel
            });

            return {
                url,
                qrCodeId,
                dataURL: qrCodeDataURL,
                svg: qrCodeSVG,
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            logger.error(`QR code generation failed for batch ${batchId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate unique batch ID
     * @param {string} herbType - Type of herb
     * @param {string} farmerId - Farmer ID
     * @param {Date} date - Collection date
     * @returns {string} Unique batch ID
     */
    static generateBatchId(herbType, farmerId, date = new Date()) {
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
        const random = crypto.randomBytes(4).toString('hex').toUpperCase();
        const herbCode = herbType.toUpperCase().slice(0, 3);
        const farmerCode = farmerId.slice(-4);
        
        return `${herbCode}-${farmerCode}-${dateStr}-${random}`;
    }

    /**
     * Generate unique test ID
     * @param {string} labId - Lab identifier
     * @param {string} testType - Type of test
     * @returns {string} Unique test ID
     */
    static generateTestId(labId, testType) {
        const timestamp = Date.now();
        const random = crypto.randomBytes(3).toString('hex').toUpperCase();
        const testCode = testType.toUpperCase().slice(0, 3);
        
        return `TEST-${testCode}-${labId}-${timestamp}-${random}`;
    }

    /**
     * Generate unique processing step ID
     * @param {string} facilityId - Facility identifier
     * @param {string} processType - Type of process
     * @returns {string} Unique step ID
     */
    static generateStepId(facilityId, processType) {
        const timestamp = Date.now();
        const random = crypto.randomBytes(3).toString('hex').toUpperCase();
        const processCode = processType.toUpperCase().slice(0, 3);
        
        return `STEP-${processCode}-${facilityId}-${timestamp}-${random}`;
    }

    /**
     * Validate GPS coordinates
     * @param {number} latitude - Latitude value
     * @param {number} longitude - Longitude value
     * @returns {boolean} True if coordinates are valid
     */
    static validateGPSCoordinates(latitude, longitude) {
        return (
            typeof latitude === 'number' &&
            typeof longitude === 'number' &&
            latitude >= -90 && latitude <= 90 &&
            longitude >= -180 && longitude <= 180
        );
    }

    /**
     * Format error response
     * @param {Error} error - Error object
     * @param {string} operation - Operation that failed
     * @returns {Object} Formatted error response
     */
    static formatErrorResponse(error, operation) {
        return {
            success: false,
            error: {
                message: error.message,
                operation,
                timestamp: new Date().toISOString(),
                code: error.code || 'UNKNOWN_ERROR'
            }
        };
    }

    /**
     * Format success response
     * @param {*} data - Response data
     * @param {string} message - Success message
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Formatted success response
     */
    static formatSuccessResponse(data, message, metadata = {}) {
        return {
            success: true,
            message,
            data,
            metadata: {
                timestamp: new Date().toISOString(),
                ...metadata
            }
        };
    }

    /**
     * Parse and validate JSON data
     * @param {string} jsonString - JSON string to parse
     * @param {string} fieldName - Field name for error messages
     * @returns {Object} Parsed JSON data
     */
    static parseJSON(jsonString, fieldName = 'data') {
        try {
            return JSON.parse(jsonString);
        } catch (error) {
            throw new Error(`Invalid JSON in ${fieldName}: ${error.message}`);
        }
    }

    /**
     * Calculate processing yield percentage
     * @param {number} inputQuantity - Input quantity
     * @param {number} outputQuantity - Output quantity
     * @returns {number} Yield percentage
     */
    static calculateYield(inputQuantity, outputQuantity) {
        if (inputQuantity <= 0) return 0;
        return Math.round((outputQuantity / inputQuantity) * 100 * 100) / 100; // Round to 2 decimal places
    }

    /**
     * Validate date string
     * @param {string} dateString - Date string to validate
     * @returns {boolean} True if date is valid
     */
    static isValidDate(dateString) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date) && date.toISOString() === dateString;
    }

    /**
     * Get current season based on date
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

    /**
     * Sanitize user input
     * @param {string} input - Input string to sanitize
     * @returns {string} Sanitized string
     */
    static sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/[<>]/g, '') // Remove angle brackets
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, '') // Remove event handlers
            .trim();
    }

    /**
     * Generate digital signature for data
     * @param {Object} data - Data to sign
     * @param {string} privateKey - Private key for signing
     * @returns {string} Digital signature
     */
    static generateDigitalSignature(data, privateKey) {
        try {
            const dataString = typeof data === 'string' ? data : JSON.stringify(data);
            const sign = crypto.createSign('SHA256');
            sign.update(dataString);
            return sign.sign(privateKey, 'hex');
        } catch (error) {
            logger.error(`Digital signature generation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Verify digital signature
     * @param {Object} data - Original data
     * @param {string} signature - Digital signature to verify
     * @param {string} publicKey - Public key for verification
     * @returns {boolean} True if signature is valid
     */
    static verifyDigitalSignature(data, signature, publicKey) {
        try {
            const dataString = typeof data === 'string' ? data : JSON.stringify(data);
            const verify = crypto.createVerify('SHA256');
            verify.update(dataString);
            return verify.verify(publicKey, signature, 'hex');
        } catch (error) {
            logger.error(`Digital signature verification failed: ${error.message}`);
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
     * Paginate array results
     * @param {Array} data - Data array to paginate
     * @param {number} page - Page number (1-based)
     * @param {number} limit - Items per page
     * @returns {Object} Paginated results
     */
    static paginate(data, page = 1, limit = 20) {
        const offset = (page - 1) * limit;
        const totalItems = data.length;
        const totalPages = Math.ceil(totalItems / limit);
        const items = data.slice(offset, offset + limit);

        return {
            items,
            pagination: {
                currentPage: page,
                totalPages,
                totalItems,
                itemsPerPage: limit,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        };
    }

    /**
     * Retry async operation with exponential backoff
     * @param {Function} operation - Async operation to retry
     * @param {number} maxRetries - Maximum retry attempts
     * @param {number} baseDelay - Base delay in milliseconds
     * @returns {*} Operation result
     */
    static async retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (attempt === maxRetries) {
                    throw lastError;
                }
                
                const delay = baseDelay * Math.pow(2, attempt - 1);
                logger.warn(`Operation failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries}): ${error.message}`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        
        throw lastError;
    }

    /**
     * Convert buffer to base64 string
     * @param {Buffer} buffer - Buffer to convert
     * @returns {string} Base64 string
     */
    static bufferToBase64(buffer) {
        return buffer.toString('base64');
    }

    /**
     * Convert base64 string to buffer
     * @param {string} base64String - Base64 string to convert
     * @returns {Buffer} Buffer
     */
    static base64ToBuffer(base64String) {
        return Buffer.from(base64String, 'base64');
    }
}

module.exports = APIUtils;