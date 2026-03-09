/**
 * Admin Routes
 * All admin endpoints requiring authentication
 */

const express = require('express');
const router = express.Router();
const configService = require('../services/configService');
const userService = require('../services/userService');
const paymentService = require('../services/paymentService');
const { requireAdmin } = require('../middleware/auth');
const { validateFields, validateNumeric, validateEnum } = require('../middleware/validation');

/**
 * POST /api/admin/auth
 * Admin login - create session
 * Accepts Telegram user data: { id, first_name, last_name, username, photo_url, auth_date, hash }
 */
router.post('/auth', (req, res) => {
  try {
    // Telegram sends { id, first_name, ... } but we need telegramId
    const telegramId = req.body.telegramId || req.body.id;

    if (!telegramId) {
      console.error('Auth error: No telegramId or id in request body');
      console.error('Request body:', req.body);
      return res.status(400).json({ error: 'telegramId is required' });
    }

    console.log('=== Admin Auth Attempt ===');
    console.log('Telegram ID:', telegramId);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    // Load config and check admin IDs
    const config = configService.loadAdminConfig();
    console.log('Admin IDs from config:', config.adminIds);
    console.log('Is admin check result:', configService.isAdmin(telegramId));

    if (!configService.isAdmin(telegramId)) {
      console.error('Access denied for telegramId:', telegramId);
      console.error('Your telegramId is not in adminIds list');
      return res.status(403).json({ 
        error: 'Access denied. Not an admin.',
        debug: {
          yourId: telegramId,
          adminIds: config.adminIds
        }
      });
    }

    // Generate session token
    const token = `admin_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    configService.createSession(token, telegramId);
    
    console.log('Session created:', token);
    console.log('Admin auth successful for telegramId:', telegramId);

    res.json({
      success: true,
      token,
      telegramId
    });
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * POST /api/admin/check
 * Check admin session validity
 */
router.post('/check', (req, res) => {
  try {
    const { token, telegramId } = req.body;

    if (!token || !telegramId) {
      return res.status(400).json({ valid: false, isAdmin: false });
    }

    const valid = configService.validateSession(token, telegramId);
    
    // Return both 'valid' and 'isAdmin' for compatibility
    res.json({ valid, isAdmin: valid });
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Check failed', valid: false, isAdmin: false });
  }
});

/**
 * POST /api/admin/logout
 * Logout admin - delete session
 */
router.post('/logout', (req, res) => {
  try {
    const { token } = req.body;
    
    if (token) {
      configService.deleteSession(token);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

/**
 * GET /api/admin/bot-config
 * Get bot configuration
 */
router.get('/bot-config', (req, res) => {
  try {
    const config = configService.loadBotConfig();
    res.json(config);
  } catch (error) {
    console.error('Bot config error:', error);
    res.status(500).json({ error: 'Failed to load bot config' });
  }
});

/**
 * POST /api/admin/bot-config
 * Update bot configuration
 */
router.post('/bot-config', requireAdmin, (req, res) => {
  try {
    const { botToken, botUsername } = req.body;
    
    const config = { botToken, botUsername };
    const success = configService.saveBotConfig(config);
    
    if (success) {
      res.json({ success: true, config });
    } else {
      res.status(500).json({ error: 'Failed to save bot config' });
    }
  } catch (error) {
    console.error('Bot config save error:', error);
    res.status(500).json({ error: 'Failed to save bot config' });
  }
});

/**
 * POST /api/admin/users
 * Get all users
 */
router.post('/users', (req, res) => {
  try {
    const { token, telegramId } = req.body;
    
    // Check admin authorization
    if (!configService.validateSession(token, telegramId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const users = userService.getAllUsers();

    // Format users for response
    const formattedUsers = users.map(user => ({
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
    }));

    res.json(formattedUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

/**
 * POST /api/admin/stats
 * Get statistics
 */
router.post('/stats', requireAdmin, (req, res) => {
  try {
    const stats = userService.getUsersStats();
    const payments = paymentService.getAllPayments();
    
    const totalRevenue = payments
      .filter(p => p.status === 'succeeded')
      .reduce((sum, p) => sum + p.amount, 0);
    
    res.json({
      ...stats,
      totalPayments: payments.length,
      totalRevenue: totalRevenue.toFixed(2)
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

/**
 * POST /api/admin/user/balance
 * Update user balance
 */
router.post('/user/balance', requireAdmin, 
  validateFields('userId', 'balance'),
  validateNumeric('balance', { required: true, min: 0 }),
  (req, res) => {
    try {
      const { userId, balance } = req.body;
      
      const user = userService.getUserById(parseInt(userId));
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      userService.setBalance(parseInt(userId), parseFloat(balance));
      
      res.json({ 
        success: true, 
        message: 'Balance updated',
        newBalance: parseFloat(balance).toFixed(2)
      });
    } catch (error) {
      console.error('Update balance error:', error);
      res.status(500).json({ error: 'Failed to update balance' });
    }
  }
);

/**
 * POST /api/admin/user/subscription
 * Update user subscription
 */
router.post('/user/subscription', requireAdmin,
  validateFields('userId'),
  (req, res) => {
    try {
      const { userId, active, plan, endDate } = req.body;
      
      const user = userService.getUserById(parseInt(userId));
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      if (active === false) {
        userService.deactivateSubscription(parseInt(userId));
        res.json({ success: true, message: 'Subscription deactivated' });
      } else {
        const newPlan = plan || user.subscription_plan;
        const newEndDate = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        
        userService.activateSubscription(parseInt(userId), newPlan, newEndDate);
        res.json({ 
          success: true, 
          message: 'Subscription updated',
          plan: newPlan,
          endDate: newEndDate
        });
      }
    } catch (error) {
      console.error('Update subscription error:', error);
      res.status(500).json({ error: 'Failed to update subscription' });
    }
  }
);

/**
 * POST /api/admin/user/delete
 * Delete user
 */
router.post('/user/delete', requireAdmin,
  validateFields('userId'),
  (req, res) => {
    try {
      const { userId } = req.body;
      
      const user = userService.getUserById(parseInt(userId));
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      userService.deleteUser(parseInt(userId));
      
      res.json({ success: true, message: 'User deleted' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

/**
 * POST /api/admin/prices
 * Get prices configuration
 */
router.post('/prices', (req, res) => {
  try {
    const { token, telegramId } = req.body;
    
    console.log('=== Prices Request ===');
    console.log('Token:', token);
    console.log('Telegram ID:', telegramId);
    console.log('Full request body:', JSON.stringify(req.body, null, 2));

    // Check admin authorization
    const isValid = configService.validateSession(token, telegramId);
    console.log('Validation result:', isValid);
    
    if (!isValid) {
      console.error('Access denied - invalid session');
      return res.status(403).json({ error: 'Access denied' });
    }

    const prices = configService.getPrices();
    res.json(prices);
  } catch (error) {
    console.error('Get prices error:', error);
    res.status(500).json({ error: 'Failed to get prices' });
  }
});

/**
 * POST /api/admin/prices
 * Update prices configuration
 */
router.post('/prices', requireAdmin, (req, res) => {
  try {
    const { telegramPrice, fullPrice, minTopUp, maxTopUp, billingCycle } = req.body;
    
    const success = configService.updatePrices({
      telegramPrice: telegramPrice !== undefined ? Number(telegramPrice) : undefined,
      fullPrice: fullPrice !== undefined ? Number(fullPrice) : undefined,
      minTopUp: minTopUp !== undefined ? Number(minTopUp) : undefined,
      maxTopUp: maxTopUp !== undefined ? Number(maxTopUp) : undefined,
      billingCycle
    });
    
    if (success) {
      res.json({ success: true, prices: configService.getPrices() });
    } else {
      res.status(500).json({ error: 'Failed to save prices' });
    }
  } catch (error) {
    console.error('Update prices error:', error);
    res.status(500).json({ error: 'Failed to update prices' });
  }
});

/**
 * POST /api/admin/subscriptions
 * Get all subscriptions (payments with subscription type)
 */
router.post('/subscriptions', (req, res) => {
  try {
    const { token, telegramId } = req.body;
    
    // Check admin authorization
    if (!configService.validateSession(token, telegramId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const payments = paymentService.getAllPayments();
    const subscriptions = payments.filter(p => p.payment_type === 'subscription');

    res.json(subscriptions);
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to get subscriptions' });
  }
});

/**
 * POST /api/admin/settings
 * Get site settings
 */
router.post('/settings', (req, res) => {
  try {
    const { token, telegramId } = req.body;
    
    // Check admin authorization
    if (!configService.validateSession(token, telegramId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const settings = configService.getSettings();
    res.json(settings);
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * POST /api/admin/settings
 * Update site settings
 */
router.post('/settings', requireAdmin, (req, res) => {
  try {
    const settings = req.body;
    
    const success = configService.updateSettings(settings);
    
    if (success) {
      res.json({ success: true, settings: configService.getSettings() });
    } else {
      res.status(500).json({ error: 'Failed to save settings' });
    }
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
