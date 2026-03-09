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
    console.log('Auth middleware: missing token or telegramId');
    console.log('Request body:', req.body);
    return res.status(403).json({ error: 'Authentication required' });
  }

  // Cleanup expired sessions periodically
  configService.cleanupSessions();

  // Validate session
  const isValid = configService.validateSession(token, telegramId);
  console.log('RequireAdmin validation result:', isValid);
  
  if (!isValid) {
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
