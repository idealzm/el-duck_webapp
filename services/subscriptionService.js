/**
 * Subscription Service
 * Handles subscription activation, deactivation, and calculations
 */

const { SUBSCRIPTION_EXTENSION_MONTHS } = require('../constants');

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
    let subscriptionEnd = new Date();

    if (user.subscription_active && user.subscription_end) {
      // Parse date properly (handle both formats: "2026-04-08 21:39:54" and "2026-04-08T21:39:54.100Z")
      const endDateStr = user.subscription_end.includes('T')
        ? user.subscription_end
        : user.subscription_end.replace(' ', 'T');
      const endDate = new Date(endDateStr);

      if (endDate > new Date()) {
        // Extend from current end date - add 1 month safely
        subscriptionEnd = new Date(endDate);
        const currentMonth = subscriptionEnd.getMonth();
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
        // Handle edge case: Jan 31 + 1 month = Mar 3 (not Feb 31 which doesn't exist)
        if (subscriptionEnd.getMonth() !== (currentMonth + 1) % 12) {
          subscriptionEnd.setDate(0); // Set to last day of previous month
        }
      } else {
        // End date is in the past, start from now
        subscriptionEnd = new Date();
        subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
      }
    } else {
      // New subscription from now
      subscriptionEnd = new Date();
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
    }

    return subscriptionEnd;
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
