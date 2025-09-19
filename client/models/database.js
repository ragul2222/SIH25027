const mongoose = require('mongoose');
const logger = require('../utils/logger');

/**
 * Database connection and configuration
 * As specified in Person 3 Backend Integration Guide
 */
class Database {
    constructor() {
        this.connection = null;
        this.isConnected = false;
    }

    /**
     * Connect to MongoDB database
     */
    async connect() {
        try {
            const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ayurveda_traceability';
            
            const options = {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                maxPoolSize: 10, // Maintain up to 10 socket connections
                serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
                socketTimeoutMS: 45000, // Close sockets after 45 seconds
            };

            this.connection = await mongoose.connect(mongoURI, options);
            this.isConnected = true;

            logger.info('Successfully connected to MongoDB database');

            // Handle connection events
            mongoose.connection.on('error', (error) => {
                logger.error('MongoDB connection error:', error);
                this.isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                logger.warn('MongoDB disconnected');
                this.isConnected = false;
            });

            mongoose.connection.on('reconnected', () => {
                logger.info('MongoDB reconnected');
                this.isConnected = true;
            });

            // Handle process termination
            process.on('SIGINT', this.gracefulShutdown.bind(this));
            process.on('SIGTERM', this.gracefulShutdown.bind(this));

            return this.connection;
        } catch (error) {
            logger.error('Failed to connect to MongoDB:', error);
            throw error;
        }
    }

    /**
     * Disconnect from database
     */
    async disconnect() {
        try {
            if (this.connection) {
                await mongoose.connection.close();
                this.isConnected = false;
                logger.info('Disconnected from MongoDB database');
            }
        } catch (error) {
            logger.error('Error disconnecting from MongoDB:', error);
            throw error;
        }
    }

    /**
     * Graceful shutdown
     */
    async gracefulShutdown(signal) {
        logger.info(`Received ${signal}. Gracefully shutting down database connection...`);
        try {
            await this.disconnect();
            process.exit(0);
        } catch (error) {
            logger.error('Error during graceful shutdown:', error);
            process.exit(1);
        }
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
    }

    /**
     * Health check for database
     */
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return {
                    status: 'unhealthy',
                    error: 'Database not connected'
                };
            }

            // Simple ping to database
            await mongoose.connection.db.admin().ping();
            
            return {
                status: 'healthy',
                connection: this.getConnectionStatus(),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Database health check failed:', error);
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Clear all collections (for testing purposes)
     */
    async clearDatabase() {
        try {
            if (process.env.NODE_ENV !== 'test') {
                throw new Error('Database clearing is only allowed in test environment');
            }

            const collections = mongoose.connection.collections;
            for (const key in collections) {
                await collections[key].deleteMany({});
            }
            logger.info('Database cleared successfully');
        } catch (error) {
            logger.error('Error clearing database:', error);
            throw error;
        }
    }

    /**
     * Create indexes for better performance
     */
    async createIndexes() {
        try {
            // Import models to register them
            require('../models/Farmer');
            require('../models/Lab');
            require('../models/ProcessingFacility');

            // Create indexes
            await mongoose.connection.db.collection('farmers').createIndex({ farmerId: 1 }, { unique: true });
            await mongoose.connection.db.collection('farmers').createIndex({ 'address.state': 1 });
            await mongoose.connection.db.collection('farmers').createIndex({ 'address.district': 1 });

            await mongoose.connection.db.collection('labs').createIndex({ labId: 1 }, { unique: true });
            await mongoose.connection.db.collection('labs').createIndex({ 'location.state': 1 });
            await mongoose.connection.db.collection('labs').createIndex({ accreditation: 1 });

            await mongoose.connection.db.collection('processingfacilities').createIndex({ facilityId: 1 }, { unique: true });
            await mongoose.connection.db.collection('processingfacilities').createIndex({ 'location.state': 1 });
            await mongoose.connection.db.collection('processingfacilities').createIndex({ capabilities: 1 });

            logger.info('Database indexes created successfully');
        } catch (error) {
            logger.error('Error creating database indexes:', error);
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new Database();
