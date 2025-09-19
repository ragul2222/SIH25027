const { Contract } = require('fabric-contract-api');
const TraceabilityUtils = require('./utils');
const { geoFencingZoneSchema } = require('./schemas');

/**
 * GeoFencing Smart Contract for Ayurvedic Herb Traceability
 * Validates harvest GPS coordinates against approved zones
 */
class GeoFencingContract extends Contract {

    constructor() {
        super('GeoFencingContract');
    }

    /**
     * Initialize contract with default geofencing zones
     * @param {Context} ctx - Transaction context
     */
    async initLedger(ctx) {
        console.info('============= START : Initialize GeoFencing Ledger ===========');

        // Sample geofencing zones for different regions
        const zones = [
            {
                zoneId: 'ZONE001',
                zoneName: 'Kerala Highlands - Ashwagandha Zone',
                herbTypes: ['Ashwagandha', 'Brahmi', 'Shatavari'],
                centerPoint: { latitude: 10.1632, longitude: 76.6413, accuracy: 10, timestamp: new Date().toISOString() },
                radius: 50000, // 50km radius
                altitude: { min: 500, max: 1500 },
                soilType: 'Red laterite soil',
                climateZone: 'Tropical highland',
                seasonalRestrictions: {
                    allowedSeasons: ['Winter', 'Spring'],
                    harvestWindow: { startDate: '11-01', endDate: '04-30' }
                },
                sustainabilityLimits: {
                    maxAnnualHarvest: 10000, // 10 tons per year
                    minRegenerationPeriod: 90, // 3 months between harvests
                    maxHarvestPercentage: 30
                },
                isActive: true
            },
            {
                zoneId: 'ZONE002',
                zoneName: 'Tamil Nadu Plains - Turmeric Zone',
                herbTypes: ['Turmeric', 'Ginger'],
                centerPoint: { latitude: 11.1271, longitude: 78.6569, accuracy: 10, timestamp: new Date().toISOString() },
                radius: 30000, // 30km radius
                soilType: 'Alluvial soil',
                climateZone: 'Tropical plains',
                seasonalRestrictions: {
                    allowedSeasons: ['Winter', 'Spring'],
                    harvestWindow: { startDate: '12-01', endDate: '05-31' }
                },
                sustainabilityLimits: {
                    maxAnnualHarvest: 15000,
                    minRegenerationPeriod: 120,
                    maxHarvestPercentage: 25
                },
                isActive: true
            },
            {
                zoneId: 'ZONE003',
                zoneName: 'Maharashtra Western Ghats - Medicinal Zone',
                herbTypes: ['Tulsi', 'Neem', 'Arjuna', 'Amla'],
                boundaries: [
                    { latitude: 18.5204, longitude: 73.8567, accuracy: 10, timestamp: new Date().toISOString() },
                    { latitude: 18.6298, longitude: 73.7997, accuracy: 10, timestamp: new Date().toISOString() },
                    { latitude: 18.5678, longitude: 73.9123, accuracy: 10, timestamp: new Date().toISOString() },
                    { latitude: 18.4891, longitude: 73.8789, accuracy: 10, timestamp: new Date().toISOString() }
                ],
                centerPoint: { latitude: 18.5518, longitude: 73.8567, accuracy: 10, timestamp: new Date().toISOString() },
                altitude: { min: 200, max: 800 },
                soilType: 'Black cotton soil',
                climateZone: 'Semi-arid tropical',
                isActive: true
            }
        ];

        for (let i = 0; i < zones.length; i++) {
            const zone = zones[i];
            zone.createdAt = new Date().toISOString();
            
            await ctx.stub.putState(zone.zoneId, Buffer.from(JSON.stringify(zone)));
            console.info(`Added geofencing zone: ${zone.zoneName}`);
        }

        console.info('============= END : Initialize GeoFencing Ledger ===========');
    }

    /**
     * Add a new geofencing zone
     * @param {Context} ctx - Transaction context
     * @param {string} zoneData - JSON string of zone data
     * @returns {Object} Success message with zone ID
     */
    async addGeoFencingZone(ctx, zoneData) {
        console.info('============= START : Add GeoFencing Zone ===========');

        // Check permissions - only regulators can add zones
        const clientMSPID = ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'RegulatorMSP') {
            throw new Error('Only regulators can add geofencing zones');
        }

        const zone = JSON.parse(zoneData);

        // Validate schema
        const { error, value } = geoFencingZoneSchema.validate(zone);
        if (error) {
            throw new Error(`Invalid zone data: ${error.details[0].message}`);
        }

        // Check if zone already exists
        const existingZone = await ctx.stub.getState(value.zoneId);
        if (existingZone && existingZone.length > 0) {
            throw new Error(`Zone ${value.zoneId} already exists`);
        }

        // Add timestamp
        value.createdAt = new Date().toISOString();

        await ctx.stub.putState(value.zoneId, Buffer.from(JSON.stringify(value)));

        console.info('============= END : Add GeoFencing Zone ===========');
        return {
            success: true,
            message: `Geofencing zone ${value.zoneId} added successfully`,
            zoneId: value.zoneId
        };
    }

    /**
     * Validate if GPS coordinates are within approved zones for a herb type
     * @param {Context} ctx - Transaction context
     * @param {string} herbType - Type of herb being harvested
     * @param {string} gpsData - JSON string containing GPS coordinates
     * @returns {Object} Validation result
     */
    async validateGPSCoordinates(ctx, herbType, gpsData) {
        console.info('============= START : Validate GPS Coordinates ===========');

        const coordinates = JSON.parse(gpsData);
        const { latitude, longitude } = coordinates;

        if (!latitude || !longitude) {
            throw new Error('Invalid GPS coordinates: latitude and longitude required');
        }

        // Get all active zones
        const iterator = await ctx.stub.getStateByRange('', '');
        const zones = [];
        
        while (true) {
            const res = await iterator.next();
            if (res.value && res.value.value.toString()) {
                const zone = JSON.parse(res.value.value.toString());
                if (zone.isActive && zone.herbTypes && zone.herbTypes.includes(herbType)) {
                    zones.push(zone);
                }
            }
            if (res.done) {
                await iterator.close();
                break;
            }
        }

        if (zones.length === 0) {
            return {
                isValid: false,
                message: `No active geofencing zones found for herb type: ${herbType}`,
                validZones: []
            };
        }

        // Check each applicable zone
        const validZones = [];
        for (const zone of zones) {
            let isInZone = false;

            if (zone.boundaries && zone.boundaries.length >= 3) {
                // Polygon-based zone
                isInZone = TraceabilityUtils.isPointInPolygon(coordinates, zone.boundaries);
            } else if (zone.centerPoint && zone.radius) {
                // Circular zone
                isInZone = TraceabilityUtils.isPointInCircularZone(coordinates, zone);
            }

            if (isInZone) {
                validZones.push({
                    zoneId: zone.zoneId,
                    zoneName: zone.zoneName,
                    distance: zone.centerPoint ? 
                        TraceabilityUtils.calculateDistance(coordinates, zone.centerPoint) : null
                });
            }
        }

        const isValid = validZones.length > 0;

        console.info('============= END : Validate GPS Coordinates ===========');
        return {
            isValid,
            message: isValid ? 
                `GPS coordinates validated for ${herbType} in ${validZones.length} zone(s)` :
                `GPS coordinates not valid for ${herbType} - outside all approved zones`,
            validZones,
            coordinates: { latitude, longitude },
            herbType
        };
    }

    /**
     * Get zone details by zone ID
     * @param {Context} ctx - Transaction context
     * @param {string} zoneId - Zone identifier
     * @returns {Object} Zone details
     */
    async getZone(ctx, zoneId) {
        const zoneBuffer = await ctx.stub.getState(zoneId);
        if (!zoneBuffer || zoneBuffer.length === 0) {
            throw new Error(`Zone ${zoneId} does not exist`);
        }
        return JSON.parse(zoneBuffer.toString());
    }

    /**
     * Get all zones for a specific herb type
     * @param {Context} ctx - Transaction context
     * @param {string} herbType - Type of herb
     * @returns {Array} Array of applicable zones
     */
    async getZonesForHerbType(ctx, herbType) {
        const iterator = await ctx.stub.getStateByRange('', '');
        const zones = [];
        
        while (true) {
            const res = await iterator.next();
            if (res.value && res.value.value.toString()) {
                const zone = JSON.parse(res.value.value.toString());
                if (zone.isActive && zone.herbTypes && zone.herbTypes.includes(herbType)) {
                    zones.push(zone);
                }
            }
            if (res.done) {
                await iterator.close();
                break;
            }
        }

        return zones;
    }

    /**
     * Update zone status (activate/deactivate)
     * @param {Context} ctx - Transaction context
     * @param {string} zoneId - Zone identifier
     * @param {boolean} isActive - New active status
     * @returns {Object} Success message
     */
    async updateZoneStatus(ctx, zoneId, isActive) {
        // Check permissions - only regulators can update zones
        const clientMSPID = ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'RegulatorMSP') {
            throw new Error('Only regulators can update zone status');
        }

        const zoneBuffer = await ctx.stub.getState(zoneId);
        if (!zoneBuffer || zoneBuffer.length === 0) {
            throw new Error(`Zone ${zoneId} does not exist`);
        }

        const zone = JSON.parse(zoneBuffer.toString());
        zone.isActive = isActive === 'true' || isActive === true;
        zone.lastUpdated = new Date().toISOString();

        await ctx.stub.putState(zoneId, Buffer.from(JSON.stringify(zone)));

        return {
            success: true,
            message: `Zone ${zoneId} ${zone.isActive ? 'activated' : 'deactivated'} successfully`
        };
    }

    /**
     * Get all zones (for regulatory audit purposes)
     * @param {Context} ctx - Transaction context
     * @returns {Array} All zones
     */
    async getAllZones(ctx) {
        // Check permissions - only regulators can view all zones
        const clientMSPID = ctx.clientIdentity.getMSPID();
        if (clientMSPID !== 'RegulatorMSP') {
            throw new Error('Only regulators can view all zones');
        }

        const iterator = await ctx.stub.getStateByRange('', '');
        const zones = [];
        
        while (true) {
            const res = await iterator.next();
            if (res.value && res.value.value.toString()) {
                const zone = JSON.parse(res.value.value.toString());
                zones.push(zone);
            }
            if (res.done) {
                await iterator.close();
                break;
            }
        }

        return zones;
    }
}

module.exports = GeoFencingContract;