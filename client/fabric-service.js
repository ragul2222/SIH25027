const { Gateway, Wallets } = require('fabric-network');
const { X509Identity } = require('fabric-network');
const FabricCAServices = require('fabric-ca-client');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const logger = require('./utils/logger');

/**
 * Fabric Gateway Service for managing blockchain connections
 * Handles user enrollment, wallet management, and gateway connections
 */
class FabricService {
    constructor() {
        this.gateway = null;
        this.wallet = null;
        this.contract = null;
        this.network = null;
    }

    /**
     * Initialize the Fabric service
     * @param {string} org - Organization name (farmer, processor, lab, distributor, regulator)
     * @param {string} userId - User identifier
     */
    async initialize(org, userId) {
        try {
            logger.info(`Initializing Fabric service for org: ${org}, user: ${userId}`);
            
            // Create wallet
            this.wallet = await Wallets.newFileSystemWallet(config.fabric.wallet.path);
            
            // Check if user exists in wallet
            const userIdentity = await this.wallet.get(userId);
            if (!userIdentity) {
                throw new Error(`Identity for user ${userId} not found in wallet`);
            }

            // Get connection profile for organization
            const connectionProfile = this.getConnectionProfile(org);
            
            // Create gateway
            this.gateway = new Gateway();
            
            // Connect to gateway
            await this.gateway.connect(connectionProfile, {
                wallet: this.wallet,
                identity: userId,
                discovery: config.fabric.gateway.discovery,
                eventHandlerOptions: {
                    commitTimeout: config.fabric.gateway.commitTimeout,
                    strategy: 'MSPID_SCOPE_ANYFORTX'
                }
            });

            // Get network and contract
            this.network = await this.gateway.getNetwork(config.fabric.channelName);
            this.contract = this.network.getContract(config.fabric.chaincodeName);

            logger.info(`Fabric service initialized successfully for ${org}/${userId}`);
            return true;

        } catch (error) {
            logger.error(`Failed to initialize Fabric service: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get connection profile for organization
     * @param {string} org - Organization name
     * @returns {Object} Connection profile
     */
    getConnectionProfile(org) {
        const orgConfig = config.fabric.connectionProfiles[org];
        if (!orgConfig) {
            throw new Error(`Connection profile not found for organization: ${org}`);
        }

        return {
            name: `${org}-network`,
            version: '1.0.0',
            client: {
                organization: org,
                connection: {
                    timeout: {
                        peer: {
                            endorser: '300'
                        }
                    }
                }
            },
            organizations: {
                [org]: {
                    mspid: orgConfig.mspId,
                    peers: [`peer0.${org}.ayurveda-network.com`]
                }
            },
            peers: {
                [`peer0.${org}.ayurveda-network.com`]: {
                    url: orgConfig.peerEndpoint,
                    grpcOptions: {
                        'ssl-target-name-override': orgConfig.peerHostAlias,
                        'hostnameOverride': orgConfig.peerHostAlias
                    }
                }
            },
            orderers: {
                'orderer.ayurveda-network.com': {
                    url: config.fabric.orderer.endpoint,
                    grpcOptions: {
                        'ssl-target-name-override': config.fabric.orderer.hostAlias,
                        'hostnameOverride': config.fabric.orderer.hostAlias
                    }
                }
            }
        };
    }

    /**
     * Enroll a new user in the organization
     * @param {string} org - Organization name
     * @param {string} userId - User identifier
     * @param {string} userSecret - User enrollment secret
     * @returns {boolean} Success status
     */
    async enrollUser(org, userId, userSecret) {
        try {
            logger.info(`Enrolling user ${userId} for organization ${org}`);

            // Create wallet if not exists
            if (!this.wallet) {
                this.wallet = await Wallets.newFileSystemWallet(config.fabric.wallet.path);
            }

            // Check if user already enrolled
            const userIdentity = await this.wallet.get(userId);
            if (userIdentity) {
                logger.warn(`User ${userId} already enrolled`);
                return true;
            }

            // Get CA info
            const caInfo = this.getCAInfo(org);
            const ca = new FabricCAServices(caInfo.url, { trustedRoots: [], verify: false }, caInfo.caName);

            // Enroll the user
            const enrollment = await ca.enroll({
                enrollmentID: userId,
                enrollmentSecret: userSecret
            });

            // Create user identity
            const x509Identity = {
                credentials: {
                    certificate: enrollment.certificate,
                    privateKey: enrollment.key.toBytes(),
                },
                mspId: config.fabric.connectionProfiles[org].mspId,
                type: 'X.509',
            };

            // Put identity in wallet
            await this.wallet.put(userId, x509Identity);
            logger.info(`User ${userId} enrolled and stored in wallet`);

            return true;

        } catch (error) {
            logger.error(`Failed to enroll user ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get CA information for organization
     * @param {string} org - Organization name
     * @returns {Object} CA information
     */
    getCAInfo(org) {
        // In a real implementation, this would come from connection profile
        // For now, return default CA configuration
        return {
            url: `https://ca.${org}.ayurveda-network.com:7054`,
            caName: `ca-${org}`
        };
    }

    /**
     * Submit transaction to blockchain
     * @param {string} contractName - Smart contract name
     * @param {string} functionName - Function to invoke
     * @param {Array} args - Function arguments
     * @returns {Object} Transaction result
     */
    async submitTransaction(contractName, functionName, ...args) {
        try {
            logger.info(`Submitting transaction: ${contractName}.${functionName}`, { args });

            if (!this.contract) {
                throw new Error('Contract not initialized. Call initialize() first.');
            }

            // Get specific contract if needed
            const contract = contractName === 'default' ? 
                this.contract : 
                this.network.getContract(config.fabric.chaincodeName, contractName);

            // Submit transaction
            const result = await contract.submitTransaction(functionName, ...args);
            const parsedResult = JSON.parse(result.toString());

            logger.info(`Transaction submitted successfully: ${contractName}.${functionName}`);
            return {
                success: true,
                result: parsedResult,
                transactionId: null // Will be available in newer SDK versions
            };

        } catch (error) {
            logger.error(`Transaction failed: ${contractName}.${functionName} - ${error.message}`);
            throw error;
        }
    }

    /**
     * Evaluate (query) transaction without submitting to ledger
     * @param {string} contractName - Smart contract name
     * @param {string} functionName - Function to invoke
     * @param {Array} args - Function arguments
     * @returns {Object} Query result
     */
    async evaluateTransaction(contractName, functionName, ...args) {
        try {
            logger.info(`Evaluating transaction: ${contractName}.${functionName}`, { args });

            if (!this.contract) {
                throw new Error('Contract not initialized. Call initialize() first.');
            }

            // Get specific contract if needed
            const contract = contractName === 'default' ? 
                this.contract : 
                this.network.getContract(config.fabric.chaincodeName, contractName);

            // Evaluate transaction
            const result = await contract.evaluateTransaction(functionName, ...args);
            const parsedResult = JSON.parse(result.toString());

            logger.info(`Transaction evaluated successfully: ${contractName}.${functionName}`);
            return {
                success: true,
                result: parsedResult
            };

        } catch (error) {
            logger.error(`Query failed: ${contractName}.${functionName} - ${error.message}`);
            throw error;
        }
    }

    /**
     * Disconnect from gateway
     */
    async disconnect() {
        try {
            if (this.gateway) {
                await this.gateway.disconnect();
                this.gateway = null;
                this.network = null;
                this.contract = null;
                logger.info('Disconnected from Fabric gateway');
            }
        } catch (error) {
            logger.error(`Error disconnecting from gateway: ${error.message}`);
        }
    }

    /**
     * Get transaction history for a key
     * @param {string} key - Ledger key to get history for
     * @returns {Array} Transaction history
     */
    async getTransactionHistory(key) {
        try {
            if (!this.contract) {
                throw new Error('Contract not initialized. Call initialize() first.');
            }

            const historyResult = await this.contract.evaluateTransaction('GetHistoryForKey', key);
            const history = JSON.parse(historyResult.toString());

            return {
                success: true,
                history: history
            };

        } catch (error) {
            logger.error(`Failed to get transaction history for key ${key}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get all identities in wallet
     * @returns {Array} List of identities
     */
    async getWalletIdentities() {
        try {
            if (!this.wallet) {
                this.wallet = await Wallets.newFileSystemWallet(config.fabric.wallet.path);
            }

            const identities = await this.wallet.list();
            return Object.keys(identities).map(id => ({
                id: id,
                mspId: identities[id].mspId
            }));

        } catch (error) {
            logger.error(`Failed to list wallet identities: ${error.message}`);
            throw error;
        }
    }

    /**
     * Remove identity from wallet
     * @param {string} userId - User identifier to remove
     * @returns {boolean} Success status
     */
    async removeIdentity(userId) {
        try {
            if (!this.wallet) {
                this.wallet = await Wallets.newFileSystemWallet(config.fabric.wallet.path);
            }

            await this.wallet.remove(userId);
            logger.info(`Identity ${userId} removed from wallet`);
            return true;

        } catch (error) {
            logger.error(`Failed to remove identity ${userId}: ${error.message}`);
            throw error;
        }
    }

    /**
     * Check if user identity exists in wallet
     * @param {string} userId - User identifier
     * @returns {boolean} True if identity exists
     */
    async identityExists(userId) {
        try {
            if (!this.wallet) {
                this.wallet = await Wallets.newFileSystemWallet(config.fabric.wallet.path);
            }

            const identity = await this.wallet.get(userId);
            return !!identity;

        } catch (error) {
            logger.error(`Failed to check identity ${userId}: ${error.message}`);
            return false;
        }
    }
}

module.exports = FabricService;