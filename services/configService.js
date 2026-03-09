/**
 * Admin Config Service
 * Handles admin configuration management
 */

const fs = require('fs');
const path = require('path');

const ADMIN_CONFIG_PATH = path.join(__dirname, '..', 'admin_config.json');
const BOT_CONFIG_PATH = path.join(__dirname, '..', 'bot_config.json');
const SESSIONS_PATH = path.join(__dirname, '..', 'admin_sessions.json');

/**
 * Load admin configuration
 */
function loadAdminConfig() {
  const defaultConfig = {
    adminIds: [],
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
      return { ...defaultConfig, ...config };
    }
  } catch (error) {
    console.error('Error loading admin config:', error);
  }
  
  return defaultConfig;
}

/**
 * Save admin configuration
 */
function saveAdminConfig(config) {
  try {
    fs.writeFileSync(ADMIN_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving admin config:', error);
    return false;
  }
}

/**
 * Load bot configuration
 */
function loadBotConfig() {
  const defaultConfig = {
    botToken: '',
    botUsername: ''
  };
  
  try {
    if (fs.existsSync(BOT_CONFIG_PATH)) {
      const data = fs.readFileSync(BOT_CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading bot config:', error);
  }
  
  return defaultConfig;
}

/**
 * Save bot configuration
 */
function saveBotConfig(config) {
  try {
    fs.writeFileSync(BOT_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error saving bot config:', error);
    return false;
  }
}

/**
 * Check if user is admin
 */
function isAdmin(telegramId) {
  const config = loadAdminConfig();
  const adminIds = config.adminIds || [];
  
  if (Array.isArray(adminIds)) {
    return adminIds.includes(String(telegramId)) || adminIds.includes(Number(telegramId));
  }
  
  return false;
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
    telegramId,
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
  const sessions = loadSessions();
  
  if (!sessions[token]) {
    return false;
  }

  const session = sessions[token];

  // Check expiration
  if (Date.now() > session.expires_at) {
    delete sessions[token];
    saveSessions(sessions);
    return false;
  }

  // Check telegram ID match
  if (session.telegramId !== telegramId) {
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
    console.error('Error loading sessions:', error);
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
    console.error('Error saving sessions:', error);
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
  loadBotConfig,
  saveBotConfig,
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
