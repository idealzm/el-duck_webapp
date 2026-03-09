/**
 * Balance Routes
 * GET /api/balance?userId={telegramId}
 */

const express = require('express');
const router = express.Router();
const userService = require('../services/userService');

/**
 * GET /api/balance?userId={telegramId}&firstName={firstName}&lastName={lastName}&username={username}
 * Get user balance and subscription info
 */
router.get('/', (req, res) => {
  try {
    const userId = parseInt(req.query.userId);
    const { firstName, lastName, username } = req.query;

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'userId parameter is required' });
    }

    // Get or create user with updated data
    const user = userService.getOrCreateUser(userId, {
      firstName: firstName || '',
      lastName: lastName || '',
      username: username || ''
    });

    // Update user data if provided and different
    if (firstName !== undefined || lastName !== undefined || username !== undefined) {
      userService.updateUserData(user.id, { firstName, lastName, username });
    }

    res.json({
      balance: user.balance.toFixed(2),
      subscriptionActive: Boolean(user.subscription_active),
      subscriptionPlan: user.subscription_plan,
      subscriptionEnd: user.subscription_end,
      devicesCount: user.devices_count || 0
    });
  } catch (error) {
    console.error('Balance error:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

module.exports = router;
