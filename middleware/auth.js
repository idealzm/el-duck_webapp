/**
 * Admin Authentication Middleware
 */

const configService = require('../services/configService');

/**
 * Require admin authentication
 */
function requireAdmin(req, res, next) {
  const token = req.body.token;
  const telegramId = req.body.adminTelegramId || req.body.telegramId;

  if (!token) {
    return res.status(403).json({ error: 'Token required' });
  }
  
  if (!telegramId) {
    return res.status(403).json({ error: 'Telegram ID required' });
  }

  // Cleanup expired sessions
  configService.cleanupSessions();

  // Validate session
  const isValid = configService.validateSession(token, telegramId);
  
  if (!isValid) {
    return res.status(403).json({ error: 'Access denied' });
  }

  next();
}

module.exports = {
  requireAdmin
};
