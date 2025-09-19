const mongoose = require('mongoose');

/**
 * Farmer Schema - Off-chain metadata storage for farmer information
 * As specified in Person 3 Backend Integration Guide
 */
const FarmerSchema = new mongoose.Schema({
  farmerId: { 
    type: String, 
    unique: true, 
    required: true,
    index: true
  },
  name: { 
    type: String, 
    required: true 
  },
  contactNumber: { 
    type: String, 
    required: true 
  },
  email: {
    type: String,
    required: false
  },
  address: {
    street: String,
    village: String,
    district: String,
    state: String,
    pincode: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  certifications: [{
    type: String,
    enum: ['ORGANIC', 'FAIR_TRADE', 'GOOD_AGRICULTURAL_PRACTICES', 'AYUSH_PREMIUM']
  }],
  approvedHerbs: [{
    herbType: String,
    herbVariety: String,
    certificationLevel: String
  }],
  registrationDate: { 
    type: Date, 
    default: Date.now 
  },
  blockchainIdentity: {
    publicKey: String,
    mspId: { type: String, default: 'FarmerMSP' },
    enrollmentId: String
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'],
    default: 'ACTIVE'
  },
  bankDetails: {
    accountNumber: String,
    ifscCode: String,
    bankName: String,
    accountHolderName: String
  },
  documents: [{
    type: String, // Document type
    documentUrl: String, // IPFS hash or URL
    verificationStatus: {
      type: String,
      enum: ['PENDING', 'VERIFIED', 'REJECTED'],
      default: 'PENDING'
    },
    uploadDate: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Indexes for efficient querying
FarmerSchema.index({ 'address.district': 1 });
FarmerSchema.index({ 'address.state': 1 });
FarmerSchema.index({ certifications: 1 });
FarmerSchema.index({ 'approvedHerbs.herbType': 1 });

// Virtual for full address
FarmerSchema.virtual('fullAddress').get(function() {
  if (!this.address) return '';
  const addr = this.address;
  return `${addr.street}, ${addr.village}, ${addr.district}, ${addr.state} - ${addr.pincode}`;
});

// Method to check if farmer can harvest specific herb
FarmerSchema.methods.canHarvestHerb = function(herbType, herbVariety) {
  return this.approvedHerbs.some(herb => 
    herb.herbType === herbType && 
    (herb.herbVariety === herbVariety || herb.herbVariety === 'ALL')
  );
};

// Method to get farmer's certification level for a herb
FarmerSchema.methods.getCertificationLevel = function(herbType) {
  const herb = this.approvedHerbs.find(h => h.herbType === herbType);
  return herb ? herb.certificationLevel : 'BASIC';
};

module.exports = mongoose.model('Farmer', FarmerSchema);
