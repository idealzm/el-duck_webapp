/**
 * Settings Routes
 * GET /api/settings
 */

const express = require('express');
const router = express.Router();
const configService = require('../services/configService');

/**
 * GET /api/settings
 * Get site settings configuration
 */
router.get('/', (req, res) => {
  try {
    const settings = configService.getSettings();
    
    res.json(settings);
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

module.exports = router;
