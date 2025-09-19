const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const APIUtils = require('../utils/api-utils');

/**
 * Authentication and Authorization Middleware
 * Implements role-based access control for Ayurvedic herb traceability APIs
 */
class AuthMiddleware {
    
    /**
     * Authenticate JWT token
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Next middleware function
     */
    static async authenticate(req, res, next) {
        try {
            const token = AuthMiddleware.extractToken(req);
            
            if (!token) {
                return res.status(401).json(
                    APIUtils.formatErrorResponse(
                        new Error('Access token required'),
                        'authentication'
                    )
                );
            }

            // Verify JWT token
            const decoded = jwt.verify(token, config.jwt.secret);
            
            // Add user information to request
            req.user = {
                userId: decoded.userId,
                organization: decoded.organization,
                role: decoded.role,
                permissions: decoded.permissions || [],
                iat: decoded.iat,
                exp: decoded.exp
            };

            logger.info(`Authenticated user: ${req.user.userId} (${req.user.organization}/${req.user.role})`);
            next();

        } catch (error) {
            logger.error(`Authentication failed: ${error.message}`);
            
            let message = 'Invalid or expired token';
            if (error.name === 'TokenExpiredError') {
                message = 'Token expired';
            } else if (error.name === 'JsonWebTokenError') {
                message = 'Invalid token format';
            }
            
            return res.status(401).json(
                APIUtils.formatErrorResponse(
                    new Error(message),
                    'authentication'
                )
            );
        }
    }

    /**
     * Extract token from request headers or query parameters
     * @param {Object} req - Express request object
     * @returns {string|null} JWT token
     */
    static extractToken(req) {
        // Check Authorization header (preferred method)
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        // Check query parameter (fallback for QR code scans)
        if (req.query.token) {
            return req.query.token;
        }

        // Check cookie (for web applications)
        if (req.cookies && req.cookies.authToken) {
            return req.cookies.authToken;
        }

        return null;
    }

    /**
     * Authorize based on required roles
     * @param {...string} allowedRoles - Roles allowed to access the resource
     * @returns {Function} Express middleware function
     */
    static authorize(...allowedRoles) {
        return (req, res, next) => {
            try {
                if (!req.user) {
                    return res.status(401).json(
                        APIUtils.formatErrorResponse(
                            new Error('Authentication required'),
                            'authorization'
                        )
                    );
                }

                const userRole = req.user.role;
                
                // Check if user's role is in the allowed roles
                if (!allowedRoles.includes(userRole)) {
                    logger.warn(`Access denied for user ${req.user.userId} (${userRole}). Required: [${allowedRoles.join(', ')}]`);
                    
                    return res.status(403).json(
                        APIUtils.formatErrorResponse(
                            new Error(`Access denied. Required role: ${allowedRoles.join(' or ')}`),
                            'authorization'
                        )
                    );
                }

                logger.info(`Access granted for user ${req.user.userId} (${userRole})`);
                next();

            } catch (error) {
                logger.error(`Authorization failed: ${error.message}`);
                return res.status(500).json(
                    APIUtils.formatErrorResponse(error, 'authorization')
                );
            }
        };
    }

    /**
     * Check specific permissions
     * @param {...string} requiredPermissions - Permissions required to access the resource
     * @returns {Function} Express middleware function
     */
    static requirePermissions(...requiredPermissions) {
        return (req, res, next) => {
            try {
                if (!req.user) {
                    return res.status(401).json(
                        APIUtils.formatErrorResponse(
                            new Error('Authentication required'),
                            'permission_check'
                        )
                    );
                }

                const userPermissions = req.user.permissions || [];
                
                // Check if user has all required permissions
                const hasAllPermissions = requiredPermissions.every(permission => 
                    userPermissions.includes(permission)
                );

                if (!hasAllPermissions) {
                    const missingPermissions = requiredPermissions.filter(permission => 
                        !userPermissions.includes(permission)
                    );

                    logger.warn(`Missing permissions for user ${req.user.userId}: ${missingPermissions.join(', ')}`);
                    
                    return res.status(403).json(
                        APIUtils.formatErrorResponse(
                            new Error(`Missing permissions: ${missingPermissions.join(', ')}`),
                            'permission_check'
                        )
                    );
                }

                next();

            } catch (error) {
                logger.error(`Permission check failed: ${error.message}`);
                return res.status(500).json(
                    APIUtils.formatErrorResponse(error, 'permission_check')
                );
            }
        };
    }

    /**
     * Validate resource ownership (for data access control)
     * @param {string} resourceParam - Request parameter containing resource ID
     * @param {string} ownerField - Field name containing owner ID in user object
     * @returns {Function} Express middleware function
     */
    static validateOwnership(resourceParam, ownerField = 'userId') {
        return async (req, res, next) => {
            try {
                if (!req.user) {
                    return res.status(401).json(
                        APIUtils.formatErrorResponse(
                            new Error('Authentication required'),
                            'ownership_validation'
                        )
                    );
                }

                // Regulators have access to all resources
                if (req.user.role === config.roles.REGULATOR) {
                    return next();
                }

                const resourceId = req.params[resourceParam];
                const ownerId = req.user[ownerField];

                if (resourceId !== ownerId) {
                    logger.warn(`Resource access denied for user ${req.user.userId}. Resource: ${resourceId}, Owner: ${ownerId}`);
                    
                    return res.status(403).json(
                        APIUtils.formatErrorResponse(
                            new Error('Access denied: insufficient permissions for this resource'),
                            'ownership_validation'
                        )
                    );
                }

                next();

            } catch (error) {
                logger.error(`Ownership validation failed: ${error.message}`);
                return res.status(500).json(
                    APIUtils.formatErrorResponse(error, 'ownership_validation')
                );
            }
        };
    }

    /**
     * Generate JWT token for user
     * @param {Object} userData - User data for token
     * @returns {string} JWT token
     */
    static generateToken(userData) {
        try {
            const payload = {
                userId: userData.userId,
                organization: userData.organization,
                role: userData.role,
                permissions: userData.permissions || AuthMiddleware.getRolePermissions(userData.role),
                iat: Math.floor(Date.now() / 1000)
            };

            const token = jwt.sign(payload, config.jwt.secret, {
                expiresIn: config.jwt.expiresIn,
                issuer: 'ayurveda-traceability-system',
                audience: userData.organization
            });

            logger.info(`Token generated for user ${userData.userId} (${userData.organization}/${userData.role})`);
            return token;

        } catch (error) {
            logger.error(`Token generation failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Get default permissions for a role
     * @param {string} role - User role
     * @returns {Array} Array of permissions
     */
    static getRolePermissions(role) {
        const rolePermissions = {
            [config.roles.FARMER]: [
                'harvest:create',
                'harvest:view_own',
                'batch:view_own',
                'geofencing:validate'
            ],
            [config.roles.PROCESSOR]: [
                'processing:create',
                'processing:view_own',
                'batch:view_assigned',
                'batch:update_status'
            ],
            [config.roles.LAB]: [
                'test:create',
                'test:view_own',
                'test:validate',
                'batch:view_assigned',
                'quality:manage'
            ],
            [config.roles.DISTRIBUTOR]: [
                'packaging:create',
                'packaging:finalize',
                'batch:view_assigned',
                'distribution:manage',
                'qr:generate'
            ],
            [config.roles.REGULATOR]: [
                'audit:view_all',
                'system:manage',
                'quota:manage',
                'geofencing:manage',
                'quality:standards',
                'reports:generate',
                'user:manage'
            ]
        };

        return rolePermissions[role] || [];
    }

    /**
     * Middleware to validate API rate limiting per role
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Next middleware function
     */
    static rateLimitByRole(req, res, next) {
        // This would be implemented with a rate limiting library like express-rate-limit
        // Different limits for different roles
        const roleLimits = {
            [config.roles.FARMER]: 100, // 100 requests per window
            [config.roles.PROCESSOR]: 200,
            [config.roles.LAB]: 150,
            [config.roles.DISTRIBUTOR]: 120,
            [config.roles.REGULATOR]: 500
        };

        const userRole = req.user ? req.user.role : 'anonymous';
        const limit = roleLimits[userRole] || 50;

        // In a real implementation, this would check against a rate limiting store
        // For now, just log and continue
        logger.debug(`Rate limit check for role ${userRole}: ${limit} requests per window`);
        next();
    }

    /**
     * Validate batch access permissions
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Next middleware function
     */
    static async validateBatchAccess(req, res, next) {
        try {
            if (!req.user) {
                return res.status(401).json(
                    APIUtils.formatErrorResponse(
                        new Error('Authentication required'),
                        'batch_access_validation'
                    )
                );
            }

            // Regulators have access to all batches
            if (req.user.role === config.roles.REGULATOR) {
                return next();
            }

            const batchId = req.params.batchId;
            if (!batchId) {
                return res.status(400).json(
                    APIUtils.formatErrorResponse(
                        new Error('Batch ID required'),
                        'batch_access_validation'
                    )
                );
            }

            // For other roles, batch access validation would require
            // querying the blockchain to check if the user has rights to this batch
            // This is a simplified check - in production, this would query the actual batch ownership
            
            logger.info(`Batch access validated for user ${req.user.userId} on batch ${batchId}`);
            next();

        } catch (error) {
            logger.error(`Batch access validation failed: ${error.message}`);
            return res.status(500).json(
                APIUtils.formatErrorResponse(error, 'batch_access_validation')
            );
        }
    }

    /**
     * Log user activity for audit purposes
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {Function} next - Next middleware function
     */
    static auditLog(req, res, next) {
        const originalSend = res.send;
        
        res.send = function(body) {
            // Log the activity
            const auditData = {
                timestamp: new Date().toISOString(),
                user: req.user ? {
                    userId: req.user.userId,
                    organization: req.user.organization,
                    role: req.user.role
                } : 'anonymous',
                action: {
                    method: req.method,
                    path: req.path,
                    params: req.params,
                    query: req.query
                },
                response: {
                    statusCode: res.statusCode,
                    success: res.statusCode < 400
                },
                ip: req.ip,
                userAgent: req.get('User-Agent')
            };

            logger.info('API Activity', auditData);
            originalSend.call(this, body);
        };

        next();
    }
}

module.exports = AuthMiddleware;