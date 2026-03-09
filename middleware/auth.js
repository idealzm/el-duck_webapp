/**
 * Admin Authentication Middleware
 * Validates admin session tokens
 */

const configService = require('../services/configService');

/**
 * Check admin authentication
 */
function requireAdmin(req, res, next) {
  // Support both old (telegramId) and new (adminTelegramId) field names
  const token = req.body.token;
  const telegramId = req.body.adminTelegramId || req.body.telegramId;

  if (!token || !telegramId) {
    return res.status(403).json({ error: 'Authentication required' });
  }

  // Cleanup expired sessions periodically
  configService.cleanupSessions();

  // Validate session
  if (!configService.validateSession(token, telegramId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
}

/**
 * Optional admin auth - adds admin status to request if authenticated
 */
function optionalAdmin(req, res, next) {
  const { token, telegramId } = req.body;

  req.isAdmin = false;

  if (token && telegramId) {
    req.isAdmin = configService.validateSession(token, telegramId);
  }

  next();
}

module.exports = {
  requireAdmin,
  optionalAdmin
};
