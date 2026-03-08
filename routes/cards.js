/**
 * Cards Routes
 * GET /api/cards
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database/init');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

/**
 * GET /api/cards
 * Get all cards configuration with subscription status
 */
router.get('/', (req, res) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId) : null;
    
    let hasFullAccess = false;
    let hasTelegramAccess = false;
    
    // Если передан userId, проверяем подписку
    if (userId) {
      try {
        const db = getDb();
        const stmt = db.prepare('SELECT subscription_active, subscription_plan FROM users WHERE telegram_id = :telegram_id');
        stmt.bind({ ':telegram_id': userId });
        
        if (stmt.step()) {
          const user = stmt.getAsObject();
          if (user.subscription_active) {
            if (user.subscription_plan === 'full') {
              hasFullAccess = true;
              hasTelegramAccess = true;
            } else if (user.subscription_plan === 'telegram') {
              hasTelegramAccess = true;
            }
          }
        }
        stmt.free();
      } catch (dbError) {
        console.error('Error checking subscription:', dbError.message);
        // Игнорируем ошибку БД, возвращаем без подписки
      }
    }
    
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({ 
        cards: [],
        hasFullAccess,
        hasTelegramAccess
      });
    }

    const data = fs.readFileSync(DATA_FILE, 'utf8');
    const config = JSON.parse(data);

    res.json({
      ...config,
      hasFullAccess,
      hasTelegramAccess
    });
  } catch (error) {
    console.error('Cards error:', error);
    res.status(500).json({ error: 'Failed to load cards' });
  }
});

module.exports = router;
