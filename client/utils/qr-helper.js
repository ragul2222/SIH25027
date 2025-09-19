const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('./logger');

/**
 * QR Code Helper Utilities for Batch Traceability
 * Generates QR codes linking to provenance data with multiple output formats
 */
class QRCodeHelper {

    /**
     * Generate QR code in multiple formats for batch traceability
     * @param {string} batchId - Batch identifier
     * @param {string} qrCodeId - Unique QR code identifier
     * @param {Object} options - QR code generation options
     * @returns {Promise<Object>} QR code data and images in multiple formats
     */
    static async generateBatchQRCode(batchId, qrCodeId, options = {}) {
        try {
            const qrConfig = {
                baseUrl: options.baseUrl || config.qrCode.baseUrl,
                size: options.size || config.qrCode.size,
                errorCorrectionLevel: options.errorLevel || config.qrCode.errorCorrectionLevel,
                margin: options.margin || 2,
                colors: {
                    dark: options.darkColor || '#2E7D32',  // Green for herbs
                    light: options.lightColor || '#FFFFFF'
                }
            };

            // Generate traceability URL
            const traceabilityUrl = `${qrConfig.baseUrl}/trace/${batchId}?qr=${qrCodeId}&source=qr`;

            // Generate QR code in multiple formats
            const results = await Promise.all([
                // Data URL (base64 encoded PNG)
                QRCode.toDataURL(traceabilityUrl, {
                    width: qrConfig.size,
                    height: qrConfig.size,
                    margin: qrConfig.margin,
                    errorCorrectionLevel: qrConfig.errorCorrectionLevel,
                    type: 'image/png',
                    quality: 0.92,
                    color: qrConfig.colors
                }),

                // SVG string
                QRCode.toString(traceabilityUrl, {
                    type: 'svg',
                    width: qrConfig.size,
                    height: qrConfig.size,
                    margin: qrConfig.margin,
                    errorCorrectionLevel: qrConfig.errorCorrectionLevel,
                    color: qrConfig.colors
                }),

                // Terminal string (for testing)
                QRCode.toString(traceabilityUrl, {
                    type: 'terminal',
                    small: true
                })
            ]);

            const qrData = {
                batchId,
                qrCodeId,
                url: traceabilityUrl,
                formats: {
                    dataURL: results[0],      // Base64 encoded PNG
                    svg: results[1],          // SVG string
                    terminal: results[2]      // Terminal display
                },
                metadata: {
                    size: qrConfig.size,
                    errorCorrectionLevel: qrConfig.errorCorrectionLevel,
                    generatedAt: new Date().toISOString(),
                    version: '1.0'
                }
            };

            logger.info(`QR code generated successfully for batch ${batchId}`);
            return qrData;

        } catch (error) {
            logger.error(`QR code generation failed for batch ${batchId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate QR code and save to file system
     * @param {string} batchId - Batch identifier
     * @param {string} qrCodeId - Unique QR code identifier
     * @param {string} outputDir - Output directory for files
     * @param {Object} options - Generation options
     * @returns {Promise<Object>} File paths and QR data
     */
    static async generateAndSaveQRCode(batchId, qrCodeId, outputDir = './qr-codes', options = {}) {
        try {
            // Create output directory if it doesn't exist
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            const qrData = await this.generateBatchQRCode(batchId, qrCodeId, options);
            const filePaths = {};

            // Save PNG file
            const pngPath = path.join(outputDir, `${batchId}_${qrCodeId}.png`);
            const pngBuffer = Buffer.from(qrData.formats.dataURL.split(',')[1], 'base64');
            fs.writeFileSync(pngPath, pngBuffer);
            filePaths.png = pngPath;

            // Save SVG file
            const svgPath = path.join(outputDir, `${batchId}_${qrCodeId}.svg`);
            fs.writeFileSync(svgPath, qrData.formats.svg);
            filePaths.svg = svgPath;

            // Save metadata JSON file
            const metadataPath = path.join(outputDir, `${batchId}_${qrCodeId}_metadata.json`);
            fs.writeFileSync(metadataPath, JSON.stringify({
                ...qrData,
                files: filePaths
            }, null, 2));
            filePaths.metadata = metadataPath;

            logger.info(`QR code files saved for batch ${batchId} in ${outputDir}`);

            return {
                ...qrData,
                files: filePaths
            };

        } catch (error) {
            logger.error(`Failed to save QR code files for batch ${batchId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate printable QR code label with batch information
     * @param {Object} batchInfo - Batch information
     * @param {string} qrCodeId - QR code identifier
     * @param {Object} options - Label options
     * @returns {Promise<string>} SVG label with QR code and batch info
     */
    static async generatePrintableLabel(batchInfo, qrCodeId, options = {}) {
        try {
            const labelConfig = {
                width: options.width || 400,
                height: options.height || 300,
                qrSize: options.qrSize || 120,
                fontSize: options.fontSize || 12,
                fontFamily: options.fontFamily || 'Arial, sans-serif',
                primaryColor: options.primaryColor || '#2E7D32',
                backgroundColor: options.backgroundColor || '#FFFFFF'
            };

            // Generate QR code SVG
            const qrData = await this.generateBatchQRCode(batchInfo.batchId, qrCodeId, {
                size: labelConfig.qrSize
            });

            // Extract QR path from SVG
            const qrSvgMatch = qrData.formats.svg.match(/<path[^>]*d="([^"]*)"[^>]*>/);
            const qrPath = qrSvgMatch ? qrSvgMatch[1] : '';

            // Generate printable label SVG
            const labelSvg = `
                <svg width="${labelConfig.width}" height="${labelConfig.height}" xmlns="http://www.w3.org/2000/svg">
                    <!-- Background -->
                    <rect width="100%" height="100%" fill="${labelConfig.backgroundColor}" stroke="${labelConfig.primaryColor}" stroke-width="2"/>
                    
                    <!-- Header -->
                    <rect x="0" y="0" width="100%" height="40" fill="${labelConfig.primaryColor}"/>
                    <text x="200" y="25" text-anchor="middle" fill="white" font-family="${labelConfig.fontFamily}" 
                          font-size="${labelConfig.fontSize + 4}" font-weight="bold">
                        Ayurvedic Herb Traceability
                    </text>
                    
                    <!-- QR Code -->
                    <g transform="translate(20, 50)">
                        <rect width="${labelConfig.qrSize}" height="${labelConfig.qrSize}" fill="white"/>
                        <path d="${qrPath}" fill="black" transform="scale(${labelConfig.qrSize/29})"/>
                    </g>
                    
                    <!-- Batch Information -->
                    <g transform="translate(${labelConfig.qrSize + 40}, 50)">
                        <text x="0" y="20" font-family="${labelConfig.fontFamily}" font-size="${labelConfig.fontSize + 2}" 
                              font-weight="bold" fill="${labelConfig.primaryColor}">Batch Information</text>
                        
                        <text x="0" y="45" font-family="${labelConfig.fontFamily}" font-size="${labelConfig.fontSize}" fill="black">
                            Batch ID: ${batchInfo.batchId}
                        </text>
                        
                        <text x="0" y="65" font-family="${labelConfig.fontFamily}" font-size="${labelConfig.fontSize}" fill="black">
                            Herb: ${batchInfo.herbType || 'N/A'}
                        </text>
                        
                        <text x="0" y="85" font-family="${labelConfig.fontFamily}" font-size="${labelConfig.fontSize}" fill="black">
                            Quantity: ${batchInfo.quantity || 'N/A'} kg
                        </text>
                        
                        <text x="0" y="105" font-family="${labelConfig.fontFamily}" font-size="${labelConfig.fontSize}" fill="black">
                            Date: ${batchInfo.date ? new Date(batchInfo.date).toLocaleDateString() : 'N/A'}
                        </text>
                        
                        <text x="0" y="125" font-family="${labelConfig.fontFamily}" font-size="${labelConfig.fontSize}" fill="black">
                            Status: ${batchInfo.status || 'N/A'}
                        </text>
                    </g>
                    
                    <!-- Footer -->
                    <text x="200" y="${labelConfig.height - 15}" text-anchor="middle" 
                          font-family="${labelConfig.fontFamily}" font-size="${labelConfig.fontSize - 2}" fill="gray">
                        Scan QR code for complete traceability information
                    </text>
                    
                    <!-- QR Code ID -->
                    <text x="20" y="${labelConfig.height - 5}" font-family="monospace" font-size="10" fill="gray">
                        QR: ${qrCodeId}
                    </text>
                </svg>
            `.trim();

            logger.info(`Printable label generated for batch ${batchInfo.batchId}`);
            return labelSvg;

        } catch (error) {
            logger.error(`Failed to generate printable label for batch ${batchInfo.batchId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate batch QR codes for multiple packaging units
     * @param {string} batchId - Main batch identifier
     * @param {Array} packagingUnits - Array of packaging unit information
     * @param {Object} options - Generation options
     * @returns {Promise<Array>} Array of QR code data for each unit
     */
    static async generatePackagingQRCodes(batchId, packagingUnits, options = {}) {
        try {
            const qrCodes = [];

            for (let i = 0; i < packagingUnits.length; i++) {
                const unit = packagingUnits[i];
                const unitQrId = `${batchId}-UNIT-${String(i + 1).padStart(3, '0')}-${Date.now()}`;

                // Create unit-specific URL with packaging information
                const unitUrl = `${config.qrCode.baseUrl}/trace/${batchId}?qr=${unitQrId}&unit=${unit.unitId}&weight=${unit.weight}`;

                const unitQrData = await QRCode.toDataURL(unitUrl, {
                    width: options.size || 200,
                    errorCorrectionLevel: options.errorLevel || 'M',
                    margin: options.margin || 2,
                    color: {
                        dark: options.darkColor || '#2E7D32',
                        light: options.lightColor || '#FFFFFF'
                    }
                });

                qrCodes.push({
                    batchId,
                    unitId: unit.unitId,
                    qrCodeId: unitQrId,
                    url: unitUrl,
                    dataURL: unitQrData,
                    weight: unit.weight,
                    packageType: unit.packageType,
                    generatedAt: new Date().toISOString()
                });
            }

            logger.info(`Generated ${qrCodes.length} packaging QR codes for batch ${batchId}`);
            return qrCodes;

        } catch (error) {
            logger.error(`Failed to generate packaging QR codes for batch ${batchId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Validate QR code format and extract information
     * @param {string} qrCodeData - QR code data/URL
     * @returns {Object} Extracted QR code information
     */
    static parseQRCodeData(qrCodeData) {
        try {
            const url = new URL(qrCodeData);
            const pathParts = url.pathname.split('/');
            
            if (pathParts.length < 3 || pathParts[1] !== 'trace') {
                throw new Error('Invalid QR code format');
            }

            const batchId = pathParts[2];
            const qrCodeId = url.searchParams.get('qr');
            const unitId = url.searchParams.get('unit');
            const weight = url.searchParams.get('weight');
            const source = url.searchParams.get('source');

            return {
                batchId,
                qrCodeId,
                unitId,
                weight: weight ? parseFloat(weight) : null,
                source: source || 'unknown',
                isValid: !!(batchId && qrCodeId),
                originalUrl: qrCodeData
            };

        } catch (error) {
            logger.error(`Failed to parse QR code data: ${error.message}`);
            return {
                isValid: false,
                error: error.message,
                originalUrl: qrCodeData
            };
        }
    }

    /**
     * Generate QR code for mobile app deep linking
     * @param {string} batchId - Batch identifier
     * @param {string} qrCodeId - QR code identifier
     * @param {Object} options - Deep link options
     * @returns {Promise<Object>} QR code with deep link URL
     */
    static async generateMobileAppQRCode(batchId, qrCodeId, options = {}) {
        try {
            const appScheme = options.appScheme || 'ayurveda-trace';
            const fallbackUrl = options.fallbackUrl || `${config.qrCode.baseUrl}/trace/${batchId}`;
            
            // Generate universal link for mobile app
            const deepLinkUrl = `${appScheme}://trace?batch=${batchId}&qr=${qrCodeId}&fallback=${encodeURIComponent(fallbackUrl)}`;

            const qrData = await QRCode.toDataURL(deepLinkUrl, {
                width: options.size || 200,
                errorCorrectionLevel: 'H', // High error correction for mobile scanning
                margin: 3,
                color: {
                    dark: options.darkColor || '#1976D2',  // Blue for mobile
                    light: options.lightColor || '#FFFFFF'
                }
            });

            return {
                batchId,
                qrCodeId,
                deepLinkUrl,
                fallbackUrl,
                dataURL: qrData,
                type: 'mobile-app',
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            logger.error(`Failed to generate mobile app QR code for batch ${batchId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Generate analytics-enabled QR code with tracking
     * @param {string} batchId - Batch identifier
     * @param {string} qrCodeId - QR code identifier
     * @param {Object} trackingParams - Analytics tracking parameters
     * @returns {Promise<Object>} QR code with analytics tracking
     */
    static async generateAnalyticsQRCode(batchId, qrCodeId, trackingParams = {}) {
        try {
            const baseUrl = config.qrCode.baseUrl;
            const analyticsUrl = new URL(`${baseUrl}/trace/${batchId}`);
            
            // Add standard tracking parameters
            analyticsUrl.searchParams.set('qr', qrCodeId);
            analyticsUrl.searchParams.set('utm_source', trackingParams.source || 'qr_code');
            analyticsUrl.searchParams.set('utm_medium', trackingParams.medium || 'packaging');
            analyticsUrl.searchParams.set('utm_campaign', trackingParams.campaign || 'traceability');
            
            // Add custom tracking parameters
            if (trackingParams.location) {
                analyticsUrl.searchParams.set('location', trackingParams.location);
            }
            if (trackingParams.distributor) {
                analyticsUrl.searchParams.set('distributor', trackingParams.distributor);
            }

            const qrData = await QRCode.toDataURL(analyticsUrl.toString(), {
                width: 200,
                errorCorrectionLevel: 'M',
                margin: 2,
                color: {
                    dark: '#4CAF50',  // Green for analytics
                    light: '#FFFFFF'
                }
            });

            return {
                batchId,
                qrCodeId,
                url: analyticsUrl.toString(),
                dataURL: qrData,
                tracking: trackingParams,
                type: 'analytics-enabled',
                generatedAt: new Date().toISOString()
            };

        } catch (error) {
            logger.error(`Failed to generate analytics QR code for batch ${batchId}: ${error.message}`);
            throw error;
        }
    }
}

module.exports = QRCodeHelper;