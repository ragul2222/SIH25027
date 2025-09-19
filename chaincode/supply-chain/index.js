/**
 * Main chaincode entry point for Ayurvedic Herb Traceability System
 * 
 * This chaincode implements a comprehensive traceability solution for Ayurvedic herbs
 * using Hyperledger Fabric blockchain technology. It provides:
 * 
 * - GeoFencing validation for harvest locations
 * - Harvest validation with seasonality and sustainability checks
 * - Quality testing management with lab result validation
 * - Complete provenance tracking from farm to consumer
 * 
 * The system ensures transparency, authenticity, and compliance across
 * the entire Ayurvedic herb supply chain.
 */

const GeoFencingContract = require('./geofencing-contract');
const HarvestValidationContract = require('./harvest-validation-contract');
const QualityTestContract = require('./quality-test-contract');
const ProvenanceContract = require('./provenance-contract');

module.exports.contracts = [
    GeoFencingContract,
    HarvestValidationContract,
    QualityTestContract,
    ProvenanceContract
];

module.exports.GeoFencingContract = GeoFencingContract;
module.exports.HarvestValidationContract = HarvestValidationContract;
module.exports.QualityTestContract = QualityTestContract;
module.exports.ProvenanceContract = ProvenanceContract;