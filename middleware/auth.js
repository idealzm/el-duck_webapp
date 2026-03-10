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

  console.log('requireAdmin:', { token: token ? 'present' : 'missing', telegramId });

  if (!token) {
    console.log('Auth failed: token missing');
    return res.status(403).json({ error: 'Token required' });
  }

  if (!telegramId) {
    console.log('Auth failed: telegramId missing');
    return res.status(403).json({ error: 'Telegram ID required' });
  }

  // Cleanup expired sessions
  configService.cleanupSessions();

  // Validate session
  const isValid = configService.validateSession(token, telegramId);
  console.log('Session valid:', isValid);

  if (!isValid) {
    console.log('Auth failed: invalid session');
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check if user is in admin list
  const isAdmin = configService.isAdmin(telegramId);
  console.log('Is admin:', isAdmin);

  if (!isAdmin) {
    console.log('Auth failed: not an admin');
    return res.status(403).json({ error: 'Not an admin' });
  }

  next();
}

module.exports = {
  requireAdmin
};
