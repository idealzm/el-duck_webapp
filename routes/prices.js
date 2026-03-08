/**
 * Prices Routes
 * GET /api/prices
 */

const express = require('express');
const router = express.Router();
const configService = require('../services/configService');

/**
 * GET /api/prices
 * Get current prices configuration
 */
router.get('/', (req, res) => {
  try {
    const prices = configService.getPrices();
    
    res.json(prices);
  } catch (error) {
    console.error('Prices error:', error);
    res.status(500).json({ error: 'Failed to load prices' });
  }
});

module.exports = router;
