const mongoose = require('mongoose');

/**
 * Processing Facility Schema - Off-chain metadata storage for processing facility information
 * As specified in Person 3 Backend Integration Guide
 */
const ProcessingFacilitySchema = new mongoose.Schema({
  facilityId: { 
    type: String, 
    unique: true, 
    required: true,
    index: true
  },
  facilityName: { 
    type: String, 
    required: true 
  },
  registrationNumber: {
    type: String,
    required: true,
    unique: true
  },
  contactInfo: {
    phone: String,
    email: { type: String, required: true },
    website: String,
    contactPerson: {
      name: String,
      designation: String,
      phone: String,
      email: String
    }
  },
  location: {
    address: String,
    city: String,
    state: String,
    pincode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  capabilities: [{
    type: String,
    enum: ['DRYING', 'GRINDING', 'PACKAGING', 'SORTING', 'CLEANING', 
           'STERILIZATION', 'EXTRACTION', 'FORMULATION', 'QUALITY_CONTROL']
  }],
  certifications: [{
    type: String,
    enum: ['GMP', 'ISO_9001', 'ISO_22000', 'HACCP', 'ORGANIC', 'AYUSH_GMP', 'FSSAI']
  }],
  equipment: [{
    equipmentId: String,
    name: String,
    type: {
      type: String,
      enum: ['DRYER', 'GRINDER', 'PACKAGER', 'SORTER', 'CLEANER', 
             'STERILIZER', 'EXTRACTOR', 'MIXER', 'TESTING_INSTRUMENT']
    },
    model: String,
    manufacturer: String,
    capacity: {
      value: Number,
      unit: String // kg/hour, tonnes/day, etc.
    },
    specifications: {
      temperature: { min: Number, max: Number },
      humidity: { min: Number, max: Number },
      powerRating: String,
      dimensions: String
    },
    installationDate: Date,
    lastMaintenanceDate: Date,
    nextMaintenanceDate: Date,
    status: {
      type: String,
      enum: ['OPERATIONAL', 'MAINTENANCE', 'BREAKDOWN', 'CALIBRATION'],
      default: 'OPERATIONAL'
    },
    calibrationCertificate: {
      certificateNumber: String,
      issuingAuthority: String,
      issueDate: Date,
      expiryDate: Date
    }
  }],
  staff: [{
    staffId: String,
    name: String,
    designation: String,
    qualifications: [String],
    experience: Number, // years
    certifications: [String],
    trainingRecords: [{
      trainingType: String,
      completionDate: Date,
      validityPeriod: Number // months
    }]
  }],
  operatingHours: {
    monday: { start: String, end: String, isOperational: Boolean },
    tuesday: { start: String, end: String, isOperational: Boolean },
    wednesday: { start: String, end: String, isOperational: Boolean },
    thursday: { start: String, end: String, isOperational: Boolean },
    friday: { start: String, end: String, isOperational: Boolean },
    saturday: { start: String, end: String, isOperational: Boolean },
    sunday: { start: String, end: String, isOperational: Boolean }
  },
  blockchainIdentity: {
    publicKey: String,
    mspId: { type: String, default: 'ProcessorMSP' },
    enrollmentId: String
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'UNDER_MAINTENANCE'],
    default: 'ACTIVE'
  },
  licenseInfo: {
    licenseNumber: String,
    licenseType: String,
    issuingAuthority: String,
    issueDate: Date,
    expiryDate: Date,
    status: {
      type: String,
      enum: ['VALID', 'EXPIRED', 'SUSPENDED', 'RENEWED'],
      default: 'VALID'
    }
  },
  qualityStandards: {
    temperatureControl: {
      required: Boolean,
      range: { min: Number, max: Number }
    },
    humidityControl: {
      required: Boolean,
      range: { min: Number, max: Number }
    },
    cleanlinessStandards: [String],
    pestControlMeasures: [String],
    wasteManagement: {
      solidWaste: String,
      liquidWaste: String,
      emissions: String
    }
  },
  performanceMetrics: {
    averageProcessingTime: Number, // hours
    capacityUtilization: Number, // percentage
    qualityRejectionRate: Number, // percentage
    energyEfficiency: Number,
    totalBatchesProcessed: { type: Number, default: 0 },
    customerSatisfactionScore: Number // 1-5
  },
  sustainabilityMetrics: {
    energyConsumption: Number, // kWh per kg
    waterUsage: Number, // liters per kg
    wasteGeneration: Number, // kg waste per kg output
    carbonFootprint: Number, // kg CO2 per kg output
    renewableEnergyPercentage: Number
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
ProcessingFacilitySchema.index({ 'location.state': 1 });
ProcessingFacilitySchema.index({ 'location.city': 1 });
ProcessingFacilitySchema.index({ capabilities: 1 });
ProcessingFacilitySchema.index({ certifications: 1 });
ProcessingFacilitySchema.index({ status: 1 });

// Virtual for full address
ProcessingFacilitySchema.virtual('fullAddress').get(function() {
  if (!this.location) return '';
  const loc = this.location;
  return `${loc.address}, ${loc.city}, ${loc.state} - ${loc.pincode}`;
});

// Method to check if facility can perform specific processing
ProcessingFacilitySchema.methods.canPerformProcessing = function(processType) {
  return this.capabilities.includes(processType);
};

// Method to get available equipment for a process type
ProcessingFacilitySchema.methods.getAvailableEquipment = function(processType) {
  const equipmentTypeMap = {
    'DRYING': ['DRYER'],
    'GRINDING': ['GRINDER'],
    'PACKAGING': ['PACKAGER'],
    'SORTING': ['SORTER'],
    'CLEANING': ['CLEANER'],
    'STERILIZATION': ['STERILIZER']
  };
  
  const requiredTypes = equipmentTypeMap[processType] || [];
  return this.equipment.filter(eq => 
    requiredTypes.includes(eq.type) && eq.status === 'OPERATIONAL'
  );
};

// Method to check if facility is currently operational
ProcessingFacilitySchema.methods.isOperational = function() {
  return this.status === 'ACTIVE' && 
         this.licenseInfo.status === 'VALID' &&
         new Date() < this.licenseInfo.expiryDate;
};

// Method to get current processing capacity
ProcessingFacilitySchema.methods.getCurrentCapacity = function(processType) {
  const equipment = this.getAvailableEquipment(processType);
  return equipment.reduce((total, eq) => total + (eq.capacity?.value || 0), 0);
};

// Method to calculate estimated processing time
ProcessingFacilitySchema.methods.estimateProcessingTime = function(quantity, processType) {
  const capacity = this.getCurrentCapacity(processType);
  if (capacity === 0) return null;
  
  const baseTime = quantity / capacity;
  const setupTime = 2; // hours
  return Math.ceil(baseTime + setupTime);
};

module.exports = mongoose.model('ProcessingFacility', ProcessingFacilitySchema);
