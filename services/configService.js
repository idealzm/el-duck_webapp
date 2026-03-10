/**
 * Config Service
 * Handles admin configuration and session management
 */

const fs = require('fs');
const path = require('path');

const ADMIN_CONFIG_PATH = path.join(__dirname, '..', 'admin_config.json');
const SESSIONS_PATH = path.join(__dirname, '..', 'admin_sessions.json');

/**
 * Load admin configuration
 */
function loadAdminConfig() {
  const defaultConfig = {
    adminIds: getAdminIdsFromEnv(),
    prices: {
      telegramPrice: 99,
      fullPrice: 299,
      minTopUp: 50,
      maxTopUp: 500,
      billingCycle: 'month'
    },
    settings: {
      siteEnabled: true,
      maintenanceMessage: 'Технические работы. Сайт временно недоступен.',
      wgConfigUrl: '',
      wgMsiUrl: '',
      proxyServer: '',
      proxyPort: '',
      proxyUser: '',
      proxyPass: ''
    }
  };

  try {
    if (fs.existsSync(ADMIN_CONFIG_PATH)) {
      const data = fs.readFileSync(ADMIN_CONFIG_PATH, 'utf8');
      const config = JSON.parse(data);
      // Merge with defaults (adminIds always from env if set)
      const envAdminIds = getAdminIdsFromEnv();
      return {
        ...defaultConfig,
        ...config,
        adminIds: envAdminIds.length > 0 ? envAdminIds : (config.adminIds || defaultConfig.adminIds),
        settings: { ...defaultConfig.settings, ...config.settings },
        prices: { ...defaultConfig.prices, ...config.prices }
      };
    }
  } catch (error) {
    console.error('Error loading admin config:', error.message);
  }

  return defaultConfig;
}

/**
 * Get admin IDs from environment variable
 * Supports comma-separated values: "123456,789012,345678"
 * @returns {Array<string>} Array of admin Telegram IDs
 */
function getAdminIdsFromEnv() {
  const envValue = process.env.ADMIN_TELEGRAM_ID;
  if (!envValue) return [];
  
  return envValue
    .split(',')
    .map(id => id.trim())
    .filter(id => id && /^\d+$/.test(id));
}

/**
 * Save admin configuration
 */
function saveAdminConfig(config) {
  try {
    fs.writeFileSync(ADMIN_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving admin config:', error.message);
    return false;
  }
}

/**
 * Get bot token from environment variable
 */
function getBotToken() {
  return process.env.BOT_TOKEN || '';
}

/**
 * Get bot username from environment variable
 */
function getBotUsername() {
  return process.env.BOT_USERNAME || '';
}

/**
 * Check if user is admin
 */
function isAdmin(telegramId) {
  const config = loadAdminConfig();
  const adminIds = config.adminIds || [];

  // Convert to array if string
  const idsArray = Array.isArray(adminIds) ? adminIds : [adminIds];

  // Check both string and number comparison
  const idStr = String(telegramId);
  const idNum = Number(telegramId);

  return idsArray.some(id => String(id) === idStr || Number(id) === idNum);
}

/**
 * Get prices
 */
function getPrices() {
  const config = loadAdminConfig();
  return config.prices || {};
}

/**
 * Update prices
 */
function updatePrices(newPrices) {
  const config = loadAdminConfig();
  config.prices = { ...config.prices, ...newPrices };
  return saveAdminConfig(config);
}

/**
 * Get settings
 */
function getSettings() {
  const config = loadAdminConfig();
  return config.settings || {};
}

/**
 * Update settings
 */
function updateSettings(newSettings) {
  const config = loadAdminConfig();
  config.settings = { ...config.settings, ...newSettings };
  return saveAdminConfig(config);
}

/**
 * Create admin session
 */
function createSession(token, telegramId, expiresIn = 24 * 60 * 60 * 1000) {
  const sessions = loadSessions();
  
  sessions[token] = {
    telegramId: String(telegramId),
    timestamp: Date.now(),
    expires_at: Date.now() + expiresIn
  };
  
  saveSessions(sessions);
  return sessions[token];
}

/**
 * Validate admin session
 */
function validateSession(token, telegramId) {
  if (!token || !telegramId) {
    return false;
  }
  
  const sessions = loadSessions();
  const session = sessions[token];
  
  if (!session) {
    return false;
  }
  
  // Check expiration
  if (Date.now() > session.expires_at) {
    delete sessions[token];
    saveSessions(sessions);
    return false;
  }
  
  // Check telegram ID match (string comparison)
  if (String(session.telegramId) !== String(telegramId)) {
    return false;
  }
  
  // Check if admin
  return isAdmin(telegramId);
}

/**
 * Delete session
 */
function deleteSession(token) {
  const sessions = loadSessions();
  delete sessions[token];
  saveSessions(sessions);
}

/**
 * Load sessions
 */
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_PATH)) {
      const data = fs.readFileSync(SESSIONS_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading sessions:', error.message);
  }
  return {};
}

/**
 * Save sessions
 */
function saveSessions(sessions) {
  try {
    fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving sessions:', error.message);
    return false;
  }
}

/**
 * Cleanup expired sessions
 */
function cleanupSessions() {
  const sessions = loadSessions();
  const now = Date.now();
  let changed = false;
  
  for (const [token, session] of Object.entries(sessions)) {
    if (now > session.expires_at) {
      delete sessions[token];
      changed = true;
    }
  }
  
  if (changed) {
    saveSessions(sessions);
  }
}

module.exports = {
  loadAdminConfig,
  saveAdminConfig,
  getBotToken,
  getBotUsername,
  isAdmin,
  getPrices,
  updatePrices,
  getSettings,
  updateSettings,
  createSession,
  validateSession,
  deleteSession,
  loadSessions,
  saveSessions,
  cleanupSessions
};
