const Joi = require('joi');

/**
 * JSON Schema definitions for ledger objects in Ayurvedic herb traceability system
 * These schemas ensure data integrity and validation for all blockchain transactions
 */

// GPS coordinates schema
const gpsCoordinatesSchema = Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    accuracy: Joi.number().min(0).optional(), // GPS accuracy in meters
    timestamp: Joi.date().iso().required()
});

// Collection Event Schema - represents harvest/collection of herbs
const collectionEventSchema = Joi.object({
    batchId: Joi.string().required().description('Unique batch identifier'),
    farmerId: Joi.string().required().description('ID of the farmer/collector'),
    farmerName: Joi.string().required().description('Name of the farmer/collector'),
    herbType: Joi.string().required().description('Type of herb collected (e.g., Ashwagandha, Turmeric)'),
    herbVariety: Joi.string().optional().description('Specific variety of the herb'),
    quantityKg: Joi.number().positive().required().description('Quantity collected in kilograms'),
    collectionDate: Joi.date().iso().required().description('Date and time of collection'),
    gpsCoordinates: gpsCoordinatesSchema.required(),
    harvestSeason: Joi.string().valid('Spring', 'Summer', 'Monsoon', 'Autumn', 'Winter').required(),
    collectionMethod: Joi.string().valid('Hand-picked', 'Tool-assisted', 'Machine-harvested').required(),
    weatherConditions: Joi.object({
        temperature: Joi.number().optional(),
        humidity: Joi.number().min(0).max(100).optional(),
        rainfall: Joi.number().min(0).optional()
    }).optional(),
    soilConditions: Joi.object({
        ph: Joi.number().min(0).max(14).optional(),
        moisture: Joi.number().min(0).max(100).optional(),
        organicContent: Joi.number().min(0).max(100).optional()
    }).optional(),
    certificationType: Joi.string().valid('Organic', 'Natural', 'Conventional').required(),
    sustainabilityScore: Joi.number().min(0).max(100).optional(),
    createdAt: Joi.date().iso().default(() => new Date(), 'current timestamp'),
    digitalSignature: Joi.string().required().description('Cryptographic signature of the farmer')
});

// Processing Step Schema - represents any processing/transformation of herbs
const processingStepSchema = Joi.object({
    stepId: Joi.string().required().description('Unique processing step identifier'),
    batchId: Joi.string().required().description('Associated batch identifier'),
    facilityId: Joi.string().required().description('Processing facility identifier'),
    facilityName: Joi.string().required().description('Name of processing facility'),
    processType: Joi.string().valid(
        'Cleaning', 'Drying', 'Grinding', 'Extraction', 'Purification', 
        'Packaging', 'Sterilization', 'Quality-Check'
    ).required(),
    processDescription: Joi.string().optional().description('Detailed process description'),
    inputQuantityKg: Joi.number().positive().required().description('Input quantity in kg'),
    outputQuantityKg: Joi.number().positive().required().description('Output quantity in kg'),
    yieldPercentage: Joi.number().min(0).max(100).computed(function() {
        return (this.outputQuantityKg / this.inputQuantityKg) * 100;
    }),
    processStartTime: Joi.date().iso().required(),
    processEndTime: Joi.date().iso().required().greater(Joi.ref('processStartTime')),
    temperature: Joi.number().optional().description('Processing temperature in Celsius'),
    pressure: Joi.number().optional().description('Processing pressure in bar'),
    duration: Joi.number().positive().optional().description('Processing duration in minutes'),
    equipmentUsed: Joi.array().items(Joi.string()).optional(),
    operatorId: Joi.string().required().description('ID of the processing operator'),
    qualityParameters: Joi.object({
        moisture: Joi.number().min(0).max(100).optional(),
        purity: Joi.number().min(0).max(100).optional(),
        particleSize: Joi.string().optional(),
        color: Joi.string().optional(),
        odor: Joi.string().optional()
    }).optional(),
    batchNotes: Joi.string().optional(),
    createdAt: Joi.date().iso().default(() => new Date(), 'current timestamp'),
    digitalSignature: Joi.string().required().description('Cryptographic signature of the processor')
});

// Quality Test Schema - represents laboratory testing results
const qualityTestSchema = Joi.object({
    testId: Joi.string().required().description('Unique test identifier'),
    batchId: Joi.string().required().description('Associated batch identifier'),
    labId: Joi.string().required().description('Testing laboratory identifier'),
    labName: Joi.string().required().description('Name of testing laboratory'),
    labCertification: Joi.string().required().description('Lab certification/accreditation'),
    testType: Joi.string().valid('Physical', 'Chemical', 'Microbiological', 'DNA', 'Pesticide-Residue').required(),
    testDate: Joi.date().iso().required(),
    sampleId: Joi.string().required().description('Unique sample identifier'),
    sampleQuantity: Joi.number().positive().required().description('Sample quantity tested in grams'),
    
    // Physical parameters
    moistureContent: Joi.number().min(0).max(100).optional().description('Moisture percentage'),
    ashContent: Joi.number().min(0).max(100).optional().description('Ash content percentage'),
    foreignMatter: Joi.number().min(0).max(100).optional().description('Foreign matter percentage'),
    
    // Chemical parameters
    activePrinciples: Joi.object().pattern(
        Joi.string(), // Active principle name
        Joi.number().min(0) // Concentration value
    ).optional(),
    heavyMetals: Joi.object({
        lead: Joi.number().min(0).optional().description('Lead content in ppm'),
        mercury: Joi.number().min(0).optional().description('Mercury content in ppm'),
        cadmium: Joi.number().min(0).optional().description('Cadmium content in ppm'),
        arsenic: Joi.number().min(0).optional().description('Arsenic content in ppm')
    }).optional(),
    
    // Pesticide residue
    pesticideResidues: Joi.array().items(
        Joi.object({
            pesticideName: Joi.string().required(),
            concentration: Joi.number().min(0).required().description('Concentration in ppm'),
            mrl: Joi.number().min(0).required().description('Maximum Residue Limit'),
            status: Joi.string().valid('Pass', 'Fail').required()
        })
    ).optional(),
    
    // Microbiological parameters
    microbialCount: Joi.object({
        totalBacterialCount: Joi.number().min(0).optional().description('CFU/g'),
        yeastMoldCount: Joi.number().min(0).optional().description('CFU/g'),
        enterobacteria: Joi.number().min(0).optional().description('CFU/g'),
        salmonella: Joi.string().valid('Absent', 'Present').optional(),
        ecoli: Joi.number().min(0).optional().description('CFU/g')
    }).optional(),
    
    // DNA testing
    dnaAuthenticity: Joi.object({
        speciesConfirmed: Joi.boolean().required(),
        geneticMarkers: Joi.array().items(Joi.string()).optional(),
        dnaMatchPercentage: Joi.number().min(0).max(100).optional(),
        contaminationDetected: Joi.boolean().optional()
    }).optional(),
    
    overallResult: Joi.string().valid('Pass', 'Fail', 'Conditional-Pass').required(),
    testResults: Joi.object().optional().description('Additional test-specific results'),
    remarks: Joi.string().optional(),
    testMethodology: Joi.string().optional().description('Standards/methods used for testing'),
    testerId: Joi.string().required().description('ID of the lab technician'),
    createdAt: Joi.date().iso().default(() => new Date(), 'current timestamp'),
    digitalSignature: Joi.string().required().description('Cryptographic signature of the lab')
});

// Provenance Record Schema - links all steps in the supply chain
const provenanceRecordSchema = Joi.object({
    batchId: Joi.string().required().description('Unique batch identifier'),
    currentStatus: Joi.string().valid(
        'Collected', 'In-Processing', 'Quality-Testing', 'Tested-Pass', 
        'Tested-Fail', 'Packaged', 'Distributed', 'Recalled'
    ).required(),
    
    // Collection information
    collectionEvent: collectionEventSchema.optional(),
    
    // Processing history
    processingSteps: Joi.array().items(processingStepSchema).default([]),
    
    // Quality testing history
    qualityTests: Joi.array().items(qualityTestSchema).default([]),
    
    // Distribution information
    distributionInfo: Joi.object({
        distributorId: Joi.string().optional(),
        distributorName: Joi.string().optional(),
        packageDate: Joi.date().iso().optional(),
        expiryDate: Joi.date().iso().optional(),
        packageType: Joi.string().optional(),
        packageWeight: Joi.number().positive().optional(),
        batchLotNumber: Joi.string().optional(),
        qrCodeId: Joi.string().optional(),
        destinationAddress: Joi.object({
            street: Joi.string().optional(),
            city: Joi.string().optional(),
            state: Joi.string().optional(),
            country: Joi.string().optional(),
            postalCode: Joi.string().optional()
        }).optional()
    }).optional(),
    
    // Compliance and certification
    compliance: Joi.object({
        organicCertified: Joi.boolean().default(false),
        gmpCertified: Joi.boolean().default(false),
        isoCertified: Joi.boolean().default(false),
        ayushCompliant: Joi.boolean().default(false),
        fssaiApproved: Joi.boolean().default(false)
    }).optional(),
    
    // Sustainability metrics
    sustainability: Joi.object({
        carbonFootprint: Joi.number().min(0).optional().description('CO2 equivalent in kg'),
        waterUsage: Joi.number().min(0).optional().description('Water used in liters'),
        energyConsumption: Joi.number().min(0).optional().description('Energy used in kWh'),
        biodiversityImpact: Joi.number().min(0).max(10).optional().description('Impact score 0-10'),
        socialImpact: Joi.number().min(0).max(10).optional().description('Social impact score 0-10')
    }).optional(),
    
    createdAt: Joi.date().iso().default(() => new Date(), 'current timestamp'),
    lastUpdated: Joi.date().iso().default(() => new Date(), 'current timestamp'),
    version: Joi.number().integer().min(1).default(1).description('Record version for audit trail')
});

// GeoFencing Zone Schema - defines approved harvesting areas
const geoFencingZoneSchema = Joi.object({
    zoneId: Joi.string().required().description('Unique zone identifier'),
    zoneName: Joi.string().required().description('Human readable zone name'),
    herbTypes: Joi.array().items(Joi.string()).required().description('Approved herbs for this zone'),
    boundaries: Joi.array().items(gpsCoordinatesSchema).min(3).required().description('Zone boundary coordinates'),
    centerPoint: gpsCoordinatesSchema.required(),
    radius: Joi.number().positive().optional().description('Zone radius in meters'),
    altitude: Joi.object({
        min: Joi.number().optional(),
        max: Joi.number().optional()
    }).optional(),
    soilType: Joi.string().optional(),
    climateZone: Joi.string().optional(),
    seasonalRestrictions: Joi.object({
        allowedSeasons: Joi.array().items(Joi.string().valid('Spring', 'Summer', 'Monsoon', 'Autumn', 'Winter')).optional(),
        harvestWindow: Joi.object({
            startDate: Joi.string().optional().description('MM-DD format'),
            endDate: Joi.string().optional().description('MM-DD format')
        }).optional()
    }).optional(),
    sustainabilityLimits: Joi.object({
        maxAnnualHarvest: Joi.number().positive().optional().description('Max harvest per year in kg'),
        minRegenerationPeriod: Joi.number().positive().optional().description('Days between harvests'),
        maxHarvestPercentage: Joi.number().min(0).max(100).optional().description('Max % of available resource')
    }).optional(),
    isActive: Joi.boolean().default(true),
    createdAt: Joi.date().iso().default(() => new Date(), 'current timestamp')
});

module.exports = {
    collectionEventSchema,
    processingStepSchema,
    qualityTestSchema,
    provenanceRecordSchema,
    geoFencingZoneSchema,
    gpsCoordinatesSchema
};