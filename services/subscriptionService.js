/**
 * Subscription Service
 * Handles subscription activation, deactivation, and calculations
 */

const { SUBSCRIPTION_EXTENSION_MONTHS } = require('../constants');
const { calculateSubscriptionEnd } = require('./paymentService');

class SubscriptionService {
  constructor(userService) {
    this.userService = userService;
  }

  /**
   * Calculate subscription end date based on user's current subscription
   * @param {Object} user - User object with subscription_active and subscription_end
   * @returns {Date} Subscription end date
   */
  calculateEndDate(user) {
    return calculateSubscriptionEnd(user);
  }

  /**
   * Activate subscription from balance payment
   * @param {number} userId - User ID
   * @param {string} plan - Subscription plan ('telegram' or 'full')
   * @param {number} amount - Payment amount
   * @returns {Object} Activation result
   */
  activateFromBalance(userId, plan, amount) {
    const user = this.userService.getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    if (user.balance < amount) {
      throw new Error('Недостаточно средств на балансе');
    }

    const validPlans = ['telegram', 'full'];
    if (!validPlans.includes(plan)) {
      throw new Error('Неверный тип подписки');
    }

    const subscriptionEnd = this.calculateEndDate(user);

    return {
      userId: user.id,
      plan,
      subscriptionEnd,
      newBalance: user.balance - amount
    };
  }

  /**
   * Activate subscription after successful payment
   * @param {Object} payment - Payment object
   * @returns {Object} Activation result
   */
  activateFromPayment(payment) {
    const user = this.userService.getUserById(payment.user_id);

    if (!user) {
      throw new Error('User not found');
    }

    const subscriptionEnd = this.calculateEndDate(user);

    return {
      userId: user.id,
      plan: payment.subscription_plan,
      subscriptionEnd
    };
  }

  /**
   * Get subscription status info
   * @param {Object} user - User object
   * @returns {Object} Subscription status
   */
  getStatus(user) {
    const isActive = user.subscription_active === 1 || user.subscription_active === true;
    const isExpired = isActive && user.subscription_end && new Date(user.subscription_end) < new Date();

    return {
      isActive: isActive && !isExpired,
      isExpired,
      plan: user.subscription_plan,
      endDate: user.subscription_end,
      daysRemaining: isActive && user.subscription_end
        ? Math.ceil((new Date(user.subscription_end) - new Date()) / (1000 * 60 * 60 * 24))
        : null
    };
  }

  /**
   * Check if user has access to specific feature
   * @param {Object} user - User object
   * @param {string} feature - Feature name ('telegram' or 'vpn')
   * @returns {boolean} Has access
   */
  hasAccess(user, feature) {
    const { isActive, plan } = this.getStatus(user);

    if (!isActive) return false;

    if (feature === 'telegram') {
      return plan === 'telegram' || plan === 'full';
    }

    if (feature === 'vpn') {
      return plan === 'full';
    }

    return false;
  }
}

module.exports = SubscriptionService;
