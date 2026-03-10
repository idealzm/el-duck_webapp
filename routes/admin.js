/**
 * Admin Routes
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const configService = require('../services/configService');
const userService = require('../services/userService');
const paymentService = require('../services/paymentService');
const { requireAdmin } = require('../middleware/auth');
const { getDb } = require('../database/init');

/**
 * POST /api/admin/auth - Login via Telegram WebApp
 * Validates initData from Telegram and creates admin session
 */
router.post('/auth', async (req, res) => {
  try {
    const { initData, user } = req.body;

    // Support both new (initData) and old (direct user) auth methods
    const telegramId = user?.id || req.body.telegramId || req.body.id;

    if (!telegramId) {
      return res.status(400).json({ 
        error: 'telegramId is required',
        hint: 'Send { initData } or { user: { id } } in request body'
      });
    }

    // Validate initData if provided (more secure)
    if (initData) {
      const isValid = await validateTelegramInitData(initData);
      if (!isValid) {
        return res.status(403).json({ error: 'Invalid Telegram initData' });
      }
    }

    // Check if user is admin
    if (!configService.isAdmin(telegramId)) {
      return res.status(403).json({ 
        error: 'Access denied. Not an admin.',
        hint: 'Add your Telegram ID to ADMIN_TELEGRAM_ID in .env or admin_config.json'
      });
    }

    // Create session token
    const token = `admin_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    configService.createSession(token, telegramId);

    console.log(`Admin login successful: ${telegramId}`);

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
 * Validate Telegram WebApp initData
 * @param {string} initData - Raw initData string from Telegram
 * @returns {Promise<boolean>} True if valid
 */
async function validateTelegramInitData(initData) {
  const botToken = process.env.BOT_TOKEN;
  
  if (!botToken) {
    console.warn('BOT_TOKEN not set, skipping initData validation');
    return true; // Skip validation if token not set
  }

  try {
    // Parse initData
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    
    if (!hash) {
      console.error('No hash in initData');
      return false;
    }

    // Remove hash from data
    params.delete('hash');

    // Sort and format data
    const dataCheckArr = [];
    for (const [key, value] of params.entries()) {
      dataCheckArr.push(`${key}=${value}`);
    }
    dataCheckArr.sort();

    const dataCheckString = dataCheckArr.join('\n');

    // Create HMAC-SHA256 hash
    const crypto = require('crypto');
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    // Compare hashes
    const isValid = calculatedHash === hash;
    console.log('Telegram initData validation:', isValid ? 'SUCCESS' : 'FAILED');
    
    return isValid;
  } catch (error) {
    console.error('Telegram initData validation error:', error.message);
    return false;
  }
}

/**
 * GET /api/admin/bot-username - Get bot username for login widget
 */
router.get('/bot-username', (req, res) => {
  try {
    res.json({
      botUsername: configService.getBotUsername()
    });
  } catch (error) {
    console.error('Get bot username error:', error);
    res.status(500).json({ error: 'Failed to get bot username' });
  }
});

/**
 * POST /api/admin/check - Check session
 */
router.post('/check', (req, res) => {
  const { token, telegramId } = req.body;
  
  if (!token || !telegramId) {
    return res.json({ valid: false, isAdmin: false });
  }

  const valid = configService.validateSession(token, telegramId);
  res.json({ valid, isAdmin: valid });
});

/**
 * POST /api/admin/logout - Logout
 */
router.post('/logout', (req, res) => {
  const { token } = req.body;
  if (token) {
    configService.deleteSession(token);
  }
  res.json({ success: true });
});

/**
 * POST /api/admin/users - Get all users
 */
router.post('/users', requireAdmin, (req, res) => {
  try {
    const users = userService.getAllUsers();
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
 * POST /api/admin/prices - Get prices
 */
router.post('/prices', requireAdmin, (req, res) => {
  try {
    res.json(configService.getPrices());
  } catch (error) {
    console.error('Get prices error:', error);
    res.status(500).json({ error: 'Failed to get prices' });
  }
});

/**
 * POST /api/admin/prices/save - Save prices
 */
router.post('/prices/save', requireAdmin, (req, res) => {
  try {
    const { telegramPrice, fullPrice, minTopUp, maxTopUp, billingCycle } = req.body;
    
    const success = configService.updatePrices({
      telegramPrice: Number(telegramPrice),
      fullPrice: Number(fullPrice),
      minTopUp: Number(minTopUp),
      maxTopUp: Number(maxTopUp),
      billingCycle
    });

    if (success) {
      res.json({ success: true, prices: configService.getPrices() });
    } else {
      res.status(500).json({ error: 'Failed to save prices' });
    }
  } catch (error) {
    console.error('Save prices error:', error);
    res.status(500).json({ error: 'Failed to save prices' });
  }
});

/**
 * POST /api/admin/subscriptions - Get subscriptions
 */
router.post('/subscriptions', requireAdmin, (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare(`
      SELECT u.telegram_id, u.first_name, u.last_name, u.username, 
             u.subscription_active, u.subscription_plan, u.subscription_end,
             u.created_at
      FROM users u
      WHERE u.subscription_active = 1
      ORDER BY u.subscription_end DESC
    `);
    
    const subscriptions = [];
    while (stmt.step()) {
      subscriptions.push(stmt.getAsObject());
    }
    stmt.free();
    
    res.json(subscriptions);
  } catch (error) {
    console.error('Get subscriptions error:', error);
    res.status(500).json({ error: 'Failed to get subscriptions' });
  }
});

/**
 * POST /api/admin/settings - Get settings
 */
router.post('/settings', requireAdmin, (req, res) => {
  try {
    res.json(configService.getSettings());
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

/**
 * POST /api/admin/settings/save - Save settings
 */
router.post('/settings/save', requireAdmin, (req, res) => {
  try {
    const {
      siteEnabled,
      maintenanceMessage,
      wgConfigUrl,
      wgMsiUrl,
      proxyServer,
      proxyPort,
      proxyUser,
      proxyPass,
      adminIds
    } = req.body;

    // Validate URLs if provided
    const isValidUrl = (url) => {
      if (!url) return true; // Empty is OK
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    };

    if (wgConfigUrl && !isValidUrl(wgConfigUrl)) {
      return res.status(400).json({ error: 'Invalid WireGuard config URL' });
    }
    if (wgMsiUrl && !isValidUrl(wgMsiUrl)) {
      return res.status(400).json({ error: 'Invalid Windows installer URL' });
    }

    const newSettings = {
      siteEnabled: Boolean(siteEnabled),
      maintenanceMessage: String(maintenanceMessage || ''),
      wgConfigUrl: String(wgConfigUrl || ''),
      wgMsiUrl: String(wgMsiUrl || ''),
      proxyServer: String(proxyServer || ''),
      proxyPort: String(proxyPort || ''),
      proxyUser: String(proxyUser || ''),
      proxyPass: String(proxyPass || '')
    };

    // Parse adminIds from comma-separated string to array
    if (adminIds !== undefined) {
      const config = configService.loadAdminConfig();
      config.adminIds = typeof adminIds === 'string' 
        ? adminIds.split(',').map(id => id.trim()).filter(id => id)
        : (Array.isArray(adminIds) ? adminIds : []);
      configService.saveAdminConfig(config);
    }

    const success = configService.updateSettings(newSettings);

    if (success) {
      res.json({ success: true, settings: configService.getSettings() });
    } else {
      res.status(500).json({ error: 'Failed to save settings' });
    }
  } catch (error) {
    console.error('Save settings error:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

/**
 * POST /api/admin/user/balance - Update user balance
 */
router.post('/user/balance', requireAdmin, (req, res) => {
  try {
    const { telegramId, amount, operation } = req.body;

    if (!telegramId) {
      return res.status(400).json({ error: 'telegramId is required' });
    }

    const user = userService.getUserByTelegramId(parseInt(telegramId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const balanceChange = operation === 'add' ? Math.abs(amount) : -Math.abs(amount);
    userService.updateBalance(user.id, balanceChange);

    res.json({
      success: true,
      message: 'Balance updated',
      newBalance: (user.balance + balanceChange).toFixed(2)
    });
  } catch (error) {
    console.error('Update balance error:', error);
    res.status(500).json({ error: 'Failed to update balance' });
  }
});

/**
 * POST /api/admin/user/subscription - Update subscription
 */
router.post('/user/subscription', requireAdmin, (req, res) => {
  try {
    const { telegramId, plan, endDate } = req.body;

    if (!telegramId) {
      return res.status(400).json({ error: 'telegramId is required' });
    }

    const user = userService.getUserByTelegramId(parseInt(telegramId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (plan === 'none' || plan === null || plan === '' || req.body.active === false) {
      userService.deactivateSubscription(user.id);
      res.json({ success: true, message: 'Subscription deactivated' });
    } else {
      const newPlan = plan || 'full';
      const newEndDate = endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      userService.activateSubscription(user.id, newPlan, newEndDate);
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
});

/**
 * POST /api/admin/user/delete - Delete user
 */
router.post('/user/delete', requireAdmin, (req, res) => {
  try {
    const { telegramId } = req.body;

    if (!telegramId) {
      return res.status(400).json({ error: 'telegramId is required' });
    }

    const user = userService.getUserByTelegramId(parseInt(telegramId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    userService.deleteUser(user.id);

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
