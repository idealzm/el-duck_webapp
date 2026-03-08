/**
 * Cards Routes
 * GET /api/cards
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const DATA_FILE = path.join(__dirname, '..', 'data.json');

/**
 * GET /api/cards
 * Get all cards configuration
 */
router.get('/', (req, res) => {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return res.json({ cards: [] });
    }
    
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    const config = JSON.parse(data);
    
    res.json(config);
  } catch (error) {
    console.error('Cards error:', error);
    res.status(500).json({ error: 'Failed to load cards' });
  }
});

module.exports = router;
