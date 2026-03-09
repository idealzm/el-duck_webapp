/**
 * User Data Mapper
 * Converts between database format (snake_case) and application format (camelCase)
 */

class UserMapper {
  /**
   * Convert database user object to application format
   * @param {Object} dbUser - User object from database
   * @returns {Object|null} Mapped user object or null if input is invalid
   */
  static fromDatabase(dbUser) {
    if (!dbUser) return null;
    
    return {
      id: dbUser.id,
      telegramId: dbUser.telegram_id,
      firstName: dbUser.first_name || '',
      lastName: dbUser.last_name || '',
      username: dbUser.username || '',
      balance: this.#parseBalance(dbUser.balance),
      subscriptionActive: Boolean(dbUser.subscription_active),
      subscriptionPlan: dbUser.subscription_plan,
      subscriptionEnd: dbUser.subscription_end,
      devicesCount: dbUser.devices_count || 0,
      createdAt: dbUser.created_at,
      updatedAt: dbUser.updated_at
    };
  }

  /**
   * Convert application user object to database format
   * @param {Object} user - User object from application
   * @returns {Object} Database-ready user object
   */
  static toDatabase(user) {
    return {
      telegram_id: user.telegramId,
      first_name: user.firstName,
      last_name: user.lastName,
      username: user.username,
      balance: user.balance,
      subscription_active: user.subscriptionActive ? 1 : 0,
      subscription_plan: user.subscriptionPlan,
      subscription_end: user.subscriptionEnd,
      devices_count: user.devicesCount
    };
  }

  /**
   * Convert array of database users to application format
   * @param {Array} dbUsers - Array of database user objects
   * @returns {Array} Array of mapped user objects
   */
  static fromDatabaseArray(dbUsers) {
    if (!Array.isArray(dbUsers)) return [];
    return dbUsers.map(user => this.fromDatabase(user)).filter(Boolean);
  }

  /**
   * Parse balance value safely
   * @param {number|string} balance - Balance value
   * @returns {number} Parsed balance
   */
  static #parseBalance(balance) {
    if (typeof balance === 'number') return balance;
    if (typeof balance === 'string') {
      const parsed = parseFloat(balance);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  /**
   * Get user display name
   * @param {Object} user - User object
   * @returns {string} Display name
   */
  static getDisplayName(user) {
    const firstName = user.firstName || user.first_name || '';
    const lastName = user.lastName || user.last_name || '';
    
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || 'Без имени';
  }

  /**
   * Get user display username (@username or ID)
   * @param {Object} user - User object
   * @returns {string} Display username
   */
  static getDisplayUsername(user) {
    const username = user.username;
    const telegramId = user.telegramId || user.telegram_id;
    
    return username ? `@${username}` : `ID: ${telegramId}`;
  }

  /**
   * Get avatar initial from user name
   * @param {Object} user - User object
   * @returns {string} Single uppercase letter
   */
  static getAvatarInitial(user) {
    const firstName = user.firstName || user.first_name || '';
    return (firstName !== '' ? firstName.charAt(0) : 'U').toUpperCase();
  }

  /**
   * Validate user object has required fields
   * @param {Object} user - User object to validate
   * @returns {Object} Validation result { valid, errors }
   */
  static validate(user) {
    const errors = [];
    
    if (!user.telegramId && !user.telegram_id) {
      errors.push('telegramId is required');
    }
    
    if (user.balance !== undefined) {
      const balance = parseFloat(user.balance);
      if (isNaN(balance) || balance < 0) {
        errors.push('balance must be a non-negative number');
      }
    }
    
    if (user.firstName && user.firstName.length > 100) {
      errors.push('firstName must be less than 100 characters');
    }
    
    if (user.lastName && user.lastName.length > 100) {
      errors.push('lastName must be less than 100 characters');
    }
    
    if (user.username && user.username.length > 100) {
      errors.push('username must be less than 100 characters');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = UserMapper;
