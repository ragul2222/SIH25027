const winston = require('winston');
const path = require('path');
const config = require('../config');

// Ensure logs directory exists
const fs = require('fs');
const logsDir = './logs';
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
}

// Define log format
const logFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
    winston.format.prettyPrint()
);

// Create logger instance
const logger = winston.createLogger({
    level: config.logging.level,
    format: logFormat,
    defaultMeta: { service: 'ayurveda-traceability-api' },
    transports: [
        // Write to console
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

// Add file transport if enabled
if (config.logging.file.enabled) {
    logger.add(new winston.transports.File({
        filename: config.logging.file.filename,
        maxsize: config.logging.file.maxsize,
        maxFiles: config.logging.file.maxFiles
    }));
}

// In production, log to file only
if (config.server.environment === 'production') {
    logger.remove(winston.transports.Console);
}

module.exports = logger;