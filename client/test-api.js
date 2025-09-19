const axios = require('axios');

/**
 * Person 3 Backend Integration Test Script
 * Tests all API endpoints to ensure they work without errors
 */
class APITestSuite {
    constructor() {
        this.baseURL = 'http://localhost:4001';
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        this.testResults = [];
    }

    async runTest(name, testFunction) {
        try {
            console.log(`🧪 Running test: ${name}`);
            const result = await testFunction();
            this.testResults.push({ name, status: 'PASSED', result });
            console.log(`✅ ${name} - PASSED`);
            return result;
        } catch (error) {
            this.testResults.push({ name, status: 'FAILED', error: error.message });
            console.log(`❌ ${name} - FAILED: ${error.message}`);
            return null;
        }
    }

    async testHealthEndpoint() {
        const response = await this.client.get('/health');
        if (response.status === 200 && response.data.status === 'healthy') {
            return response.data;
        }
        throw new Error('Health check failed');
    }

    async testAPIDocsEndpoint() {
        const response = await this.client.get('/api-docs');
        if (response.status === 200 && response.data.title) {
            return response.data;
        }
        throw new Error('API docs endpoint failed');
    }

    async testConnectivityEndpoint() {
        const response = await this.client.get('/api/test');
        if (response.status === 200) {
            return response.data;
        }
        throw new Error('Connectivity test failed');
    }

    async testFarmerRegistrationSample() {
        const response = await this.client.post('/api/test/farmer', {
            customField: 'test'
        });
        if (response.status === 200 && response.data.success) {
            return response.data;
        }
        throw new Error('Farmer registration sample failed');
    }

    async testHarvestRecordingSample() {
        const response = await this.client.post('/api/test/harvest', {
            farmerId: 'TEST_FARMER_123'
        });
        if (response.status === 200 && response.data.success) {
            return response.data;
        }
        throw new Error('Harvest recording sample failed');
    }

    async testFarmerRegistration() {
        const sampleFarmer = {
            name: 'Test API Farmer',
            contactNumber: '9876543210',
            email: 'test.api@example.com',
            address: {
                street: '123 API Test Road',
                village: 'Test Village',
                district: 'Test District',
                state: 'Karnataka',
                pincode: '560001',
                coordinates: {
                    latitude: 12.9716,
                    longitude: 77.5946
                }
            },
            certifications: ['ORGANIC'],
            approvedHerbs: [{
                herbType: 'ASHWAGANDHA',
                herbVariety: 'PREMIUM',
                certificationLevel: 'ORGANIC'
            }]
        };

        const response = await this.client.post('/api/collector/farmers/register', sampleFarmer);
        return response.data;
    }

    async testProcessingFacilityRegistration() {
        const sampleFacility = {
            facilityName: 'Test Processing Facility',
            registrationNumber: 'TEST_REG_123',
            contactInfo: {
                phone: '9876543210',
                email: 'facility@test.com',
                contactPerson: {
                    name: 'Test Manager',
                    designation: 'Plant Manager',
                    phone: '9876543210',
                    email: 'manager@test.com'
                }
            },
            location: {
                address: '456 Processing Street',
                city: 'Bangalore',
                state: 'Karnataka',
                pincode: '560002',
                coordinates: {
                    latitude: 12.9716,
                    longitude: 77.5946
                }
            },
            capabilities: ['DRYING', 'GRINDING', 'PACKAGING'],
            certifications: ['GMP', 'ISO_9001'],
            licenseInfo: {
                licenseNumber: 'LIC123456',
                licenseType: 'Processing',
                issuingAuthority: 'State FDA',
                issueDate: new Date('2024-01-01'),
                expiryDate: new Date('2025-12-31')
            }
        };

        const response = await this.client.post('/api/processing/facilities/register', sampleFacility);
        return response.data;
    }

    async testGetAllFarmers() {
        const response = await this.client.get('/api/collector/farmers?page=1&limit=5');
        return response.data;
    }

    async testGetAllFacilities() {
        const response = await this.client.get('/api/processing/facilities?page=1&limit=5');
        return response.data;
    }

    async testFacilitiesByCapability() {
        const response = await this.client.get('/api/processing/facilities/by-capability/DRYING');
        return response.data;
    }

    async runAllTests() {
        console.log('🚀 Starting Person 3 Backend Integration API Tests\\n');
        console.log('=' .repeat(60));

        // Basic endpoint tests
        await this.runTest('Health Endpoint', () => this.testHealthEndpoint());
        await this.runTest('API Documentation Endpoint', () => this.testAPIDocsEndpoint());
        await this.runTest('Connectivity Test Endpoint', () => this.testConnectivityEndpoint());

        // Sample data tests
        await this.runTest('Farmer Registration Sample', () => this.testFarmerRegistrationSample());
        await this.runTest('Harvest Recording Sample', () => this.testHarvestRecordingSample());

        // Database operation tests (without blockchain for now)
        await this.runTest('Farmer Registration (Database)', () => this.testFarmerRegistration());
        await this.runTest('Processing Facility Registration (Database)', () => this.testProcessingFacilityRegistration());
        await this.runTest('Get All Farmers', () => this.testGetAllFarmers());
        await this.runTest('Get All Facilities', () => this.testGetAllFacilities());
        await this.runTest('Get Facilities by Capability', () => this.testFacilitiesByCapability());

        // Print results summary
        console.log('\\n' + '=' .repeat(60));
        console.log('📊 TEST RESULTS SUMMARY');
        console.log('=' .repeat(60));

        const passed = this.testResults.filter(t => t.status === 'PASSED').length;
        const failed = this.testResults.filter(t => t.status === 'FAILED').length;
        const total = this.testResults.length;

        console.log(`Total Tests: ${total}`);
        console.log(`✅ Passed: ${passed}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📈 Success Rate: ${(passed / total * 100).toFixed(1)}%`);

        if (failed > 0) {
            console.log('\\n🔍 FAILED TESTS:');
            this.testResults
                .filter(t => t.status === 'FAILED')
                .forEach(t => console.log(`   - ${t.name}: ${t.error}`));
        }

        console.log('\\n🎉 API Testing Complete!');
        
        if (failed === 0) {
            console.log('✨ All tests passed! Backend integration is working correctly.');
        } else {
            console.log('⚠️  Some tests failed. Please check the errors above.');
        }

        return {
            total,
            passed,
            failed,
            successRate: (passed / total * 100).toFixed(1),
            results: this.testResults
        };
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const testSuite = new APITestSuite();
    testSuite.runAllTests().then(() => {
        process.exit(0);
    }).catch((error) => {
        console.error('Test suite failed:', error);
        process.exit(1);
    });
}

module.exports = APITestSuite;