/**
 * CSRF Protection Middleware
 * Simple token-based CSRF protection for admin panel
 */

const crypto = require('crypto');

const csrfTokens = new Map();
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate CSRF token
 */
function generateToken(sessionId) {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(token, {
    sessionId,
    createdAt: Date.now()
  });
  
  // Cleanup old tokens
  cleanupTokens();
  
  return token;
}

/**
 * Validate CSRF token
 */
function validateToken(token, sessionId) {
  if (!token) return false;
  
  const record = csrfTokens.get(token);
  if (!record) return false;
  
  if (record.sessionId !== sessionId) return false;
  
  if (Date.now() - record.createdAt > TOKEN_EXPIRY) {
    csrfTokens.delete(token);
    return false;
  }
  
  return true;
}

/**
 * Remove used token
 */
function consumeToken(token) {
  csrfTokens.delete(token);
}

/**
 * Cleanup expired tokens
 */
function cleanupTokens() {
  const now = Date.now();
  for (const [token, record] of csrfTokens.entries()) {
    if (now - record.createdAt > TOKEN_EXPIRY) {
      csrfTokens.delete(token);
    }
  }
}

/**
 * CSRF protection middleware factory
 */
function csrfProtection(options = {}) {
  const {
    cookieName = 'csrf_token',
    headerName = 'X-CSRF-Token',
    excludePaths = ['/api/admin/config']
  } = options;

  return (req, res, next) => {
    // Skip CSRF for GET requests and excluded paths
    if (req.method === 'GET' || excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const token = req.headers[headerName.toLowerCase()] || req.body._csrf;
    const sessionId = req.session?.id || req.body.telegramId || 'anonymous';

    if (!validateToken(token, sessionId)) {
      return res.status(403).json({
        error: 'Invalid or missing CSRF token'
      });
    }

    // Consume token (one-time use)
    consumeToken(token);

    next();
  };
}

module.exports = {
  generateToken,
  validateToken,
  consumeToken,
  csrfProtection
};
