/**
 * SMS Gateway Service for Ayurvedic Herb Traceability
 * Handles Twilio SMS integration for harvest reporting and notifications
 */

const twilio = require('twilio');

class SMSService {
    constructor() {
        this.client = null;
        this.isEnabled = false;
        this.initializeTwilio();
    }

    initializeTwilio() {
        try {
            const accountSid = process.env.TWILIO_ACCOUNT_SID;
            const authToken = process.env.TWILIO_AUTH_TOKEN;
            const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

            if (accountSid && authToken && phoneNumber) {
                this.client = twilio(accountSid, authToken);
                this.phoneNumber = phoneNumber;
                this.isEnabled = true;
                console.log('✅ SMS Service initialized with Twilio');
            } else {
                console.log('⚠️ SMS Service: Twilio credentials not found, running in mock mode');
                this.isEnabled = false;
            }
        } catch (error) {
            console.error('❌ SMS Service initialization failed:', error.message);
            this.isEnabled = false;
        }
    }

    /**
     * Parse incoming SMS message for harvest data
     * Expected format: "HARVEST ASHWA 50KG LAT:23.2599 LNG:77.4126 ORGANIC"
     */
    async parseHarvestSMS(message, fromNumber) {
        const parts = message.trim().toUpperCase().split(' ');
        
        if (parts[0] !== 'HARVEST') {
            throw new Error('Invalid SMS format. Start with HARVEST');
        }

        if (parts.length < 5) {
            throw new Error('Invalid SMS format. Expected: HARVEST [HERB] [QUANTITY]KG LAT:[LAT] LNG:[LNG] [CERTIFICATION]');
        }
        
        const herbType = parts[1];
        const quantityMatch = parts[2].match(/(\d+(?:\.\d+)?)KG/i);
        if (!quantityMatch) {
            throw new Error('Invalid quantity format. Use format: 50KG');
        }
        const quantity = parseFloat(quantityMatch[1]);
        
        const latMatch = parts[3].match(/LAT:(-?\d+(?:\.\d+)?)/i);
        const lngMatch = parts[4].match(/LNG:(-?\d+(?:\.\d+)?)/i);
        
        if (!latMatch || !lngMatch) {
            throw new Error('Invalid GPS format. Use LAT:23.2599 LNG:77.4126');
        }
        
        const lat = parseFloat(latMatch[1]);
        const lng = parseFloat(lngMatch[1]);
        const certification = parts[5] || 'CONVENTIONAL';
        
        return {
            herbType: this.mapHerbCode(herbType),
            quantityKg: quantity,
            gpsCoordinates: { latitude: lat, longitude: lng },
            certificationType: certification,
            collectionDate: new Date().toISOString(),
            harvestSeason: this.getCurrentSeason(),
            sourcePhone: fromNumber
        };
    }

    /**
     * Map herb codes to full names
     */
    mapHerbCode(code) {
        const herbMap = {
            'ASHWA': 'Ashwagandha',
            'BRAHMI': 'Brahmi',
            'NEEM': 'Neem',
            'TULSI': 'Tulsi',
            'GILOY': 'Giloy',
            'AMLA': 'Amla',
            'TURMERIC': 'Turmeric',
            'GINGER': 'Ginger'
        };
        return herbMap[code] || code;
    }

    /**
     * Get current harvest season
     */
    getCurrentSeason() {
        const month = new Date().getMonth() + 1;
        if (month >= 3 && month <= 6) return 'Summer';
        if (month >= 7 && month <= 10) return 'Monsoon';
        return 'Winter';
    }

    /**
     * Handle incoming SMS webhook from Twilio
     */
    async handleIncomingSMS(req, res) {
        try {
            const { Body: message, From: fromNumber } = req.body;
            
            console.log(`📱 Received SMS from ${fromNumber}: ${message}`);
            
            // Parse SMS data
            const harvestData = await this.parseHarvestSMS(message, fromNumber);
            
            // Simulate farmer lookup (in real implementation, would query database)
            const mockFarmer = {
                farmerId: `FARMER_SMS_${Date.now()}`,
                name: 'SMS Farmer',
                contactNumber: fromNumber
            };
            
            // Add farmer info to harvest data
            harvestData.farmerId = mockFarmer.farmerId;
            harvestData.farmerName = mockFarmer.name;
            
            // Generate mock batch ID
            const batchId = `BATCH_SMS_${Date.now()}`;
            const transactionId = `TXN_${Date.now()}`;
            
            // Send confirmation SMS
            await this.sendConfirmationSMS(fromNumber, batchId, transactionId);
            
            res.json({ 
                success: true, 
                batchId,
                transactionId,
                harvestData,
                message: 'SMS processed successfully'
            });
            
        } catch (error) {
            console.error('❌ SMS processing error:', error.message);
            
            // Send error SMS
            if (req.body.From) {
                await this.sendErrorSMS(req.body.From, error.message);
            }
            
            res.status(400).json({ 
                success: false, 
                error: error.message 
            });
        }
    }

    /**
     * Send harvest confirmation SMS
     */
    async sendConfirmationSMS(phoneNumber, batchId, transactionId) {
        const message = `✅ Harvest recorded successfully!\nBatch ID: ${batchId}\nTransaction: ${transactionId}\nTrack your herbs at: ${process.env.CONSUMER_APP_URL || 'https://herb-trace.app'}/trace/${batchId}`;
        
        return await this.sendSMS(phoneNumber, message);
    }

    /**
     * Send error notification SMS
     */
    async sendErrorSMS(phoneNumber, errorMessage) {
        const message = `❌ Harvest recording failed: ${errorMessage}\n\nCorrect format:\nHARVEST [HERB] [QUANTITY]KG LAT:[LAT] LNG:[LNG] [CERTIFICATION]\n\nExample:\nHARVEST ASHWA 50KG LAT:23.2599 LNG:77.4126 ORGANIC`;
        
        return await this.sendSMS(phoneNumber, message);
    }

    /**
     * Send notification SMS for quality issues
     */
    async sendQualityAlertSMS(phoneNumber, batchId, issueType) {
        const message = `⚠️ Quality Alert for Batch ${batchId}\nIssue: ${issueType}\nAction required: Contact processing facility immediately\nRef: Quality Control System`;
        
        return await this.sendSMS(phoneNumber, message);
    }

    /**
     * Send SMS notification for supply chain updates
     */
    async sendSupplyChainUpdateSMS(phoneNumber, batchId, status, location) {
        const message = `📦 Supply Chain Update\nBatch: ${batchId}\nStatus: ${status}\nLocation: ${location}\nTime: ${new Date().toLocaleString()}`;
        
        return await this.sendSMS(phoneNumber, message);
    }

    /**
     * Core SMS sending function
     */
    async sendSMS(phoneNumber, message) {
        try {
            if (!this.isEnabled) {
                console.log(`📱 [MOCK SMS] To: ${phoneNumber}\nMessage: ${message}`);
                return {
                    success: true,
                    messageId: `mock_${Date.now()}`,
                    status: 'delivered',
                    mock: true
                };
            }

            const result = await this.client.messages.create({
                body: message,
                from: this.phoneNumber,
                to: phoneNumber
            });

            console.log(`📱 SMS sent successfully to ${phoneNumber}, SID: ${result.sid}`);
            
            return {
                success: true,
                messageId: result.sid,
                status: result.status,
                mock: false
            };
            
        } catch (error) {
            console.error(`❌ SMS send failed to ${phoneNumber}:`, error.message);
            
            // Return mock success for demo purposes
            return {
                success: false,
                error: error.message,
                messageId: `error_${Date.now()}`,
                mock: true
            };
        }
    }

    /**
     * Test SMS connectivity
     */
    async testSMSConnectivity(testPhoneNumber = null) {
        try {
            const testNumber = testPhoneNumber || '+1234567890';
            const testMessage = '🧪 SMS Gateway Test - Ayurvedic Herb Traceability System\nTime: ' + new Date().toISOString();
            
            const result = await this.sendSMS(testNumber, testMessage);
            
            return {
                success: true,
                twilioEnabled: this.isEnabled,
                result,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                success: false,
                twilioEnabled: this.isEnabled,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get SMS service status
     */
    getStatus() {
        return {
            enabled: this.isEnabled,
            provider: 'Twilio',
            phoneNumber: this.phoneNumber,
            initialized: !!this.client,
            features: [
                'Harvest SMS Parsing',
                'Confirmation SMS',
                'Error Notifications',
                'Quality Alerts',
                'Supply Chain Updates'
            ]
        };
    }
}

module.exports = SMSService;