/**
 * Subscription Helper Utilities
 * Centralized logic for subscription status and access level checks
 */

const { SUBSCRIPTION_PLANS, SUBSCRIPTION_STATUS } = require('../constants');

class SubscriptionHelper {
  /**
   * Get access levels based on subscription status
   * @param {boolean|number} subscriptionActive - Subscription active flag (0/1, true/false)
   * @param {string} subscriptionPlan - Subscription plan ('telegram', 'full', null)
   * @returns {Object} Access levels object
   */
  static getAccessLevels(subscriptionActive, subscriptionPlan) {
    const isActive = this.isActive(subscriptionActive);
    
    return {
      hasTelegramAccess: isActive && (subscriptionPlan === SUBSCRIPTION_PLANS.TELEGRAM || subscriptionPlan === SUBSCRIPTION_PLANS.FULL),
      hasFullAccess: isActive && subscriptionPlan === SUBSCRIPTION_PLANS.FULL,
      isActive,
      plan: subscriptionPlan || SUBSCRIPTION_PLANS.NONE
    };
  }

  /**
   * Check if subscription is active
   * @param {boolean|number} subscriptionActive - Subscription active flag
   * @returns {boolean} True if active
   */
  static isActive(subscriptionActive) {
    return subscriptionActive === 1 || subscriptionActive === true;
  }

  /**
   * Format subscription status for UI display
   * @param {Object} user - User object with subscription data
   * @returns {Object} Formatted status { text, class, icon }
   */
  static formatStatus(user) {
    const { isActive, plan } = this.getAccessLevels(user.subscription_active, user.subscription_plan);
    
    if (!isActive) {
      return {
        text: 'Не активна',
        class: SUBSCRIPTION_STATUS.INACTIVE,
        icon: '❌'
      };
    }
    
    if (plan === SUBSCRIPTION_PLANS.TELEGRAM) {
      return {
        text: 'Telegram доступ',
        class: SUBSCRIPTION_STATUS.ACTIVE,
        icon: '✈️'
      };
    }
    
    if (plan === SUBSCRIPTION_PLANS.FULL) {
      return {
        text: 'Полный доступ',
        class: SUBSCRIPTION_STATUS.ACTIVE,
        icon: '🚀'
      };
    }
    
    return {
      text: 'Неизвестно',
      class: SUBSCRIPTION_STATUS.INACTIVE,
      icon: '❓'
    };
  }

  /**
   * Get subscription end date label
   * @param {string|Date} endDate - Subscription end date
   * @param {string} locale - Locale for date formatting (default: 'ru-RU')
   * @returns {string} Formatted date or '—'
   */
  static formatEndDate(endDate, locale = 'ru-RU') {
    if (!endDate) return '—';
    
    try {
      const date = new Date(endDate);
      return date.toLocaleDateString(locale, { 
        day: 'numeric', 
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      return '—';
    }
  }

  /**
   * Check if subscription is expired
   * @param {string|Date} endDate - Subscription end date
   * @returns {boolean} True if expired
   */
  static isExpired(endDate) {
    if (!endDate) return false;
    return new Date(endDate) < new Date();
  }

  /**
   * Get days until subscription expires
   * @param {string|Date} endDate - Subscription end date
   * @returns {number|null} Days remaining or null if not active
   */
  static getDaysUntilExpiry(endDate) {
    if (!endDate) return null;
    
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
  }

  /**
   * Get plan display name
   * @param {string} plan - Plan identifier
   * @returns {string} Human-readable plan name
   */
  static getPlanName(plan) {
    const names = {
      [SUBSCRIPTION_PLANS.TELEGRAM]: 'Telegram Proxy',
      [SUBSCRIPTION_PLANS.FULL]: 'Полный доступ (VPN + Proxy)',
      [SUBSCRIPTION_PLANS.NONE]: 'Нет подписки'
    };
    return names[plan] || 'Неизвестный план';
  }

  /**
   * Get plan icon
   * @param {string} plan - Plan identifier
   * @returns {string} Emoji icon
   */
  static getPlanIcon(plan) {
    const icons = {
      [SUBSCRIPTION_PLANS.TELEGRAM]: '✈️',
      [SUBSCRIPTION_PLANS.FULL]: '🚀',
      [SUBSCRIPTION_PLANS.NONE]: '❌'
    };
    return icons[plan] || '❓';
  }
}

module.exports = SubscriptionHelper;
