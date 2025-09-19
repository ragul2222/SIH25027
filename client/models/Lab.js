const mongoose = require('mongoose');

/**
 * Lab Schema - Off-chain metadata storage for laboratory information
 * As specified in Person 3 Backend Integration Guide
 */
const LabSchema = new mongoose.Schema({
  labId: { 
    type: String, 
    unique: true, 
    required: true,
    index: true
  },
  labName: { 
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
    website: String
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
  accreditation: [{
    type: String,
    enum: ['NABL', 'ISO_17025', 'AYUSH', 'FSSAI', 'WHO_GMP']
  }],
  testCapabilities: [{
    testType: {
      type: String,
      enum: ['MOISTURE_CONTENT', 'ASH_CONTENT', 'FOREIGN_MATTER', 'ACTIVE_PRINCIPLES', 
             'HEAVY_METALS', 'PESTICIDE_RESIDUES', 'MICROBIAL_COUNT', 'AFLATOXIN', 
             'IDENTITY_TEST', 'PURITY_TEST']
    },
    methodology: String,
    turnaroundTime: Number, // in hours
    cost: Number
  }],
  equipment: [{
    equipmentId: String,
    name: String,
    model: String,
    manufacturer: String,
    calibrationDate: Date,
    nextCalibrationDue: Date,
    status: {
      type: String,
      enum: ['OPERATIONAL', 'MAINTENANCE', 'CALIBRATION_DUE', 'OUT_OF_ORDER'],
      default: 'OPERATIONAL'
    }
  }],
  staff: [{
    staffId: String,
    name: String,
    designation: String,
    qualifications: [String],
    experience: Number // years
  }],
  operatingHours: {
    monday: { start: String, end: String },
    tuesday: { start: String, end: String },
    wednesday: { start: String, end: String },
    thursday: { start: String, end: String },
    friday: { start: String, end: String },
    saturday: { start: String, end: String },
    sunday: { start: String, end: String }
  },
  blockchainIdentity: {
    publicKey: String,
    mspId: { type: String, default: 'LabMSP' },
    enrollmentId: String
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'UNDER_REVIEW'],
    default: 'ACTIVE'
  },
  licenseInfo: {
    licenseNumber: String,
    issuingAuthority: String,
    issueDate: Date,
    expiryDate: Date,
    status: {
      type: String,
      enum: ['VALID', 'EXPIRED', 'SUSPENDED', 'RENEWED'],
      default: 'VALID'
    }
  },
  qualityMetrics: {
    averageTurnaroundTime: Number, // hours
    accuracyRate: Number, // percentage
    customerSatisfactionScore: Number, // 1-5
    certificationRenewalDate: Date,
    totalTestsCompleted: { type: Number, default: 0 },
    testSuccessRate: { type: Number, default: 100 }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
LabSchema.index({ 'location.state': 1 });
LabSchema.index({ 'location.city': 1 });
LabSchema.index({ accreditation: 1 });
LabSchema.index({ 'testCapabilities.testType': 1 });
LabSchema.index({ status: 1 });

// Virtual for full address
LabSchema.virtual('fullAddress').get(function() {
  if (!this.location) return '';
  const loc = this.location;
  return `${loc.address}, ${loc.city}, ${loc.state} - ${loc.pincode}`;
});

// Method to check if lab can perform specific test
LabSchema.methods.canPerformTest = function(testType) {
  return this.testCapabilities.some(capability => 
    capability.testType === testType
  );
};

// Method to get test cost and turnaround time
LabSchema.methods.getTestInfo = function(testType) {
  const capability = this.testCapabilities.find(cap => cap.testType === testType);
  return capability ? {
    cost: capability.cost,
    turnaroundTime: capability.turnaroundTime,
    methodology: capability.methodology
  } : null;
};

// Method to check if lab is currently operational
LabSchema.methods.isOperational = function() {
  return this.status === 'ACTIVE' && 
         this.licenseInfo.status === 'VALID' &&
         new Date() < this.licenseInfo.expiryDate;
};

// Method to get available test types
LabSchema.methods.getAvailableTests = function() {
  return this.testCapabilities
    .filter(cap => this.isOperational())
    .map(cap => ({
      testType: cap.testType,
      cost: cap.cost,
      turnaroundTime: cap.turnaroundTime
    }));
};

module.exports = mongoose.model('Lab', LabSchema);
