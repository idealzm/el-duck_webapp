/**
 * Type Utilities
 * Safe parsing and conversion functions for common data types
 */

class TypeUtils {
  /**
   * Safely parse integer
   * @param {*} value - Value to parse
   * @param {number} defaultValue - Default value if parsing fails
   * @returns {number} Parsed integer or default
   */
  static toInt(value, defaultValue = 0) {
    if (typeof value === 'number') return Math.floor(value);
    if (value === null || value === undefined) return defaultValue;
    
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Safely parse float
   * @param {*} value - Value to parse
   * @param {number} defaultValue - Default value if parsing fails
   * @returns {number} Parsed float or default
   */
  static toFloat(value, defaultValue = 0.0) {
    if (typeof value === 'number') return value;
    if (value === null || value === undefined) return defaultValue;
    
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Safely parse boolean
   * @param {*} value - Value to parse
   * @param {boolean} defaultValue - Default value if parsing fails
   * @returns {boolean} Parsed boolean or default
   */
  static toBool(value, defaultValue = false) {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      return ['true', '1', 'yes', 'да'].includes(value.toLowerCase());
    }
    return Boolean(value);
  }

  /**
   * Safely parse string
   * @param {*} value - Value to parse
   * @param {string} defaultValue - Default value if parsing fails
   * @returns {string} Parsed string or default
   */
  static toString(value, defaultValue = '') {
    if (value === null || value === undefined) return defaultValue;
    return String(value);
  }

  /**
   * Safely parse array from comma-separated string or array
   * @param {*} value - Value to parse
   * @param {Array} defaultValue - Default value if parsing fails
   * @returns {Array} Parsed array or default
   */
  static toArray(value, defaultValue = []) {
    if (Array.isArray(value)) return value;
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'string') {
      return value.split(',').map(s => s.trim()).filter(Boolean);
    }
    return defaultValue;
  }

  /**
   * Safely parse object
   * @param {*} value - Value to parse
   * @param {Object} defaultValue - Default value if parsing fails
   * @returns {Object} Parsed object or default
   */
  static toObject(value, defaultValue = {}) {
    if (value === null || value === undefined) return defaultValue;
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    try {
      if (typeof value === 'string') {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object' && parsed !== null) return parsed;
      }
    } catch (error) {
      // Ignore parse errors
    }
    return defaultValue;
  }

  /**
   * Check if value is empty (null, undefined, empty string, empty array, empty object)
   * @param {*} value - Value to check
   * @returns {boolean} True if empty
   */
  static isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  /**
   * Check if value is a valid positive number
   * @param {*} value - Value to check
   * @returns {boolean} True if valid positive number
   */
  static isPositiveNumber(value) {
    const num = parseFloat(value);
    return !isNaN(num) && isFinite(num) && num > 0;
  }

  /**
   * Check if value is a valid email
   * @param {*} value - Value to check
   * @returns {boolean} True if valid email
   */
  static isEmail(value) {
    if (typeof value !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  /**
   * Check if value is a valid URL
   * @param {*} value - Value to check
   * @returns {boolean} True if valid URL
   */
  static isUrl(value) {
    if (typeof value !== 'string') return false;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clamp number between min and max
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Clamped value
   */
  static clamp(value, min, max) {
    const num = parseFloat(value);
    if (isNaN(num)) return min;
    return Math.min(Math.max(num, min), max);
  }

  /**
   * Format currency value
   * @param {number} value - Value to format
   * @param {string} currency - Currency symbol (default: '₽')
   * @param {number} decimals - Decimal places (default: 2)
   * @returns {string} Formatted currency string
   */
  static formatCurrency(value, currency = '₽', decimals = 2) {
    const num = parseFloat(value);
    if (isNaN(num)) return `0.${'0'.repeat(decimals)} ${currency}`;
    return `${num.toFixed(decimals)} ${currency}`;
  }
}

module.exports = TypeUtils;
