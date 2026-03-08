/**
 * Profile Routes
 * GET /api/profile?userId={telegramId}
 */

const express = require('express');
const router = express.Router();
const userService = require('../services/userService');

/**
 * GET /api/profile?userId={telegramId}
 * Get user profile information
 */
router.get('/', (req, res) => {
  try {
    const userId = parseInt(req.query.userId);
    
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ error: 'userId parameter is required' });
    }
    
    const user = userService.getUserByTelegramId(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      telegramId: user.telegram_id,
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
      balance: user.balance.toFixed(2),
      subscriptionActive: Boolean(user.subscription_active),
      subscriptionPlan: user.subscription_plan,
      subscriptionEnd: user.subscription_end,
      devicesCount: user.devices_count || 0,
      createdAt: user.created_at
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

module.exports = router;
