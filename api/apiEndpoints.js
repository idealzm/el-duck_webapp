/**
 * API Endpoints
 * Typed wrapper around ApiClient for application-specific endpoints
 */

const { ApiClient } = require('./apiClient');
const { API_ENDPOINTS } = require('../constants');

class ApiEndpoints {
  constructor(baseURL = '/api') {
    this.client = new ApiClient(baseURL);
  }

  // ==================== PUBLIC ENDPOINTS ====================

  /**
   * Get user balance and subscription info
   * @param {number} userId - User Telegram ID
   * @param {string} firstName - User first name
   * @param {string} lastName - User last name
   * @param {string} username - User username
   * @returns {Promise<Object>} Balance and subscription data
   */
  async getBalance(userId, firstName = '', lastName = '', username = '') {
    return this.client.get(API_ENDPOINTS.BALANCE, {
      userId,
      firstName,
      lastName,
      username
    });
  }

  /**
   * Get user profile
   * @param {number} userId - User Telegram ID
   * @returns {Promise<Object>} Profile data
   */
  async getProfile(userId) {
    return this.client.get(API_ENDPOINTS.PROFILE, { userId });
  }

  /**
   * Get cards configuration
   * @param {number} userId - User Telegram ID (optional)
   * @returns {Promise<Object>} Cards and access levels
   */
  async getCards(userId = null) {
    return this.client.get(API_ENDPOINTS.CARDS, userId ? { userId } : {});
  }

  /**
   * Get current prices
   * @returns {Promise<Object>} Prices configuration
   */
  async getPrices() {
    return this.client.get(API_ENDPOINTS.PRICES);
  }

  /**
   * Get site settings
   * @returns {Promise<Object>} Site settings
   */
  async getSettings() {
    return this.client.get(API_ENDPOINTS.SETTINGS);
  }

  // ==================== PAYMENT ENDPOINTS ====================

  /**
   * Create payment
   * @param {number} userId - User Telegram ID
   * @param {number} amount - Payment amount
   * @param {string} description - Payment description
   * @returns {Promise<Object>} Payment data with confirmation URL
   */
  async createPayment(userId, amount, description) {
    return this.client.post(API_ENDPOINTS.PAYMENT_CREATE, {
      userId,
      amount,
      description
    });
  }

  // ==================== SUBSCRIPTION ENDPOINTS ====================

  /**
   * Create subscription via YooKassa
   * @param {number} userId - User Telegram ID
   * @param {string} plan - Subscription plan ('telegram' or 'full')
   * @param {number} amount - Payment amount
   * @param {string} description - Payment description
   * @returns {Promise<Object>} Subscription payment data
   */
  async createSubscription(userId, plan, amount, description = '') {
    return this.client.post(API_ENDPOINTS.SUBSCRIPTION_CREATE, {
      userId,
      plan,
      amount,
      description
    });
  }

  /**
   * Pay for subscription from balance
   * @param {number} userId - User Telegram ID
   * @param {string} plan - Subscription plan ('telegram' or 'full')
   * @param {number} amount - Payment amount
   * @returns {Promise<Object>} Subscription activation result
   */
  async paySubscriptionFromBalance(userId, plan, amount) {
    return this.client.post(API_ENDPOINTS.SUBSCRIPTION_PAY, {
      userId,
      plan,
      amount
    });
  }

  // ==================== ADMIN ENDPOINTS ====================

  /**
   * Get admin config (bot username, CSRF token)
   * @param {number} telegramId - Admin Telegram ID
   * @returns {Promise<Object>} Config data
   */
  async getAdminConfig(telegramId) {
    return this.client.get(API_ENDPOINTS.ADMIN_CONFIG, { telegramId });
  }

  /**
   * Admin login
   * @param {Object} userData - Telegram user data
   * @returns {Promise<Object>} Auth result with token
   */
  async adminAuth(userData) {
    return this.client.post(API_ENDPOINTS.ADMIN_AUTH, userData);
  }

  /**
   * Check admin session
   * @param {string} token - Session token
   * @param {number} telegramId - Admin Telegram ID
   * @returns {Promise<Object>} Session validation result
   */
  async adminCheck(token, telegramId) {
    return this.client.post(API_ENDPOINTS.ADMIN_CHECK, { token, telegramId });
  }

  /**
   * Admin logout
   * @param {string} token - Session token
   * @returns {Promise<Object>} Logout result
   */
  async adminLogout(token) {
    return this.client.post(API_ENDPOINTS.ADMIN_LOGOUT, { token });
  }

  /**
   * Get all users
   * @param {string} token - Session token
   * @param {number} telegramId - Admin Telegram ID
   * @returns {Promise<Array>} Users list
   */
  async getAdminUsers(token, telegramId) {
    return this.client.post(API_ENDPOINTS.ADMIN_USERS, { token, telegramId });
  }

  /**
   * Get admin statistics
   * @param {string} token - Session token
   * @param {number} telegramId - Admin Telegram ID
   * @returns {Promise<Object>} Statistics data
   */
  async getAdminStats(token, telegramId) {
    return this.client.post(API_ENDPOINTS.ADMIN_STATS, { token, telegramId });
  }

  /**
   * Update user balance
   * @param {string} token - Session token
   * @param {number} telegramId - Admin Telegram ID
   * @param {number} targetUserId - Target user Telegram ID
   * @param {number} amount - Amount to add/subtract
   * @param {string} operation - 'add' or 'subtract'
   * @returns {Promise<Object>} Update result
   */
  async updateUserBalance(token, telegramId, targetUserId, amount, operation) {
    return this.client.post(API_ENDPOINTS.ADMIN_USER_BALANCE, {
      token,
      telegramId,
      telegramId: targetUserId,
      amount,
      operation
    });
  }

  /**
   * Update user subscription
   * @param {string} token - Session token
   * @param {number} telegramId - Admin Telegram ID
   * @param {number} targetUserId - Target user Telegram ID
   * @param {string} plan - Subscription plan
   * @param {string} endDate - Subscription end date (ISO format)
   * @returns {Promise<Object>} Update result
   */
  async updateUserSubscription(token, telegramId, targetUserId, plan, endDate) {
    return this.client.post(API_ENDPOINTS.ADMIN_USER_SUBSCRIPTION, {
      token,
      telegramId,
      telegramId: targetUserId,
      plan,
      endDate
    });
  }

  /**
   * Delete user
   * @param {string} token - Session token
   * @param {number} telegramId - Admin Telegram ID
   * @param {number} targetUserId - Target user Telegram ID
   * @returns {Promise<Object>} Delete result
   */
  async deleteUser(token, telegramId, targetUserId) {
    return this.client.post(API_ENDPOINTS.ADMIN_USER_DELETE, {
      token,
      telegramId,
      telegramId: targetUserId
    });
  }

  /**
   * Get admin prices
   * @param {string} token - Session token
   * @param {number} telegramId - Admin Telegram ID
   * @returns {Promise<Object>} Prices configuration
   */
  async getAdminPrices(token, telegramId) {
    return this.client.post(API_ENDPOINTS.ADMIN_PRICES, { token, telegramId });
  }

  /**
   * Save admin prices
   * @param {string} token - Session token
   * @param {number} telegramId - Admin Telegram ID
   * @param {Object} prices - Prices data
   * @returns {Promise<Object>} Save result
   */
  async saveAdminPrices(token, telegramId, prices) {
    return this.client.post(API_ENDPOINTS.ADMIN_PRICES_SAVE, {
      token,
      telegramId,
      ...prices
    });
  }

  /**
   * Get all subscriptions
   * @param {string} token - Session token
   * @param {number} telegramId - Admin Telegram ID
   * @returns {Promise<Array>} Subscriptions list
   */
  async getAdminSubscriptions(token, telegramId) {
    return this.client.post(API_ENDPOINTS.ADMIN_SUBSCRIPTIONS, { token, telegramId });
  }

  /**
   * Get admin settings
   * @param {string} token - Session token
   * @param {number} telegramId - Admin Telegram ID
   * @returns {Promise<Object>} Settings data
   */
  async getAdminSettings(token, telegramId) {
    return this.client.post(API_ENDPOINTS.ADMIN_SETTINGS, { token, telegramId });
  }

  /**
   * Save admin settings
   * @param {string} token - Session token
   * @param {number} telegramId - Admin Telegram ID
   * @param {Object} settings - Settings data
   * @returns {Promise<Object>} Save result
   */
  async saveAdminSettings(token, telegramId, settings) {
    return this.client.post(API_ENDPOINTS.ADMIN_SETTINGS_SAVE, {
      token,
      telegramId,
      ...settings
    });
  }
}

module.exports = ApiEndpoints;
