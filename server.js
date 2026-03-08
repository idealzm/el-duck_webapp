/**
 * El-Duck WebApp Server
 * Modern Node.js/Express backend for VPN subscription service
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// Import database initialization
const { initDatabase } = require('./database/init');

// Import routes
const balanceRoutes = require('./routes/balance');
const subscriptionRoutes = require('./routes/subscription');
const paymentRoutes = require('./routes/payment');
const profileRoutes = require('./routes/profile');
const cardsRoutes = require('./routes/cards');
const pricesRoutes = require('./routes/prices');
const settingsRoutes = require('./routes/settings');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // Слушать все интерфейсы

// Middleware
const corsOptions = {
  origin: function (origin, callback) {
    // Разрешить все запросы без origin (Telegram WebApp, мобильные приложения)
    if (!origin) return callback(null, true);
    
    // Разрешённые домены
    const allowedDomains = [
      'https://dev.el-duck.ru',
      'http://localhost:3000',
      'https://t.me',
      'https://telegram.org',
      'android-app://org.telegram.messenger',
      'ios-app://686446520'
    ];
    
    if (allowedDomains.indexOf(origin) !== -1 || origin.includes('telegram.org')) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      callback(null, true); // Всё равно разрешаем для отладки
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname)));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/balance', balanceRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/prices', pricesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    
    app.listen(PORT, HOST, () => {
      console.log(`🦆 El-Duck Server running on ${HOST}:${PORT}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'production'}`);
      console.log(`   Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
