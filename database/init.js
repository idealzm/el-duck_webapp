/**
 * Database initialization and connection management
 * Uses sql.js (SQLite compiled to JavaScript)
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database.db');
let db = null;

/**
 * Initialize the database with required tables
 */
async function initDatabase() {
  const SQL = await initSqlJs();
  
  // Load existing database or create new one
  try {
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
  } catch (error) {
    console.error('Error loading database, creating new one:', error);
    db = new SQL.Database();
  }
  
  // Create users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER UNIQUE NOT NULL,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      balance REAL DEFAULT 0,
      subscription_active BOOLEAN DEFAULT 0,
      subscription_plan TEXT,
      subscription_end DATETIME,
      devices_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Create payments table
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      yookassa_payment_id TEXT,
      description TEXT,
      payment_type TEXT DEFAULT 'topup',
      subscription_plan TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  
  // Create admin_sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      telegram_id INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);
  
  // Create indexes for better performance
  db.run('CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_active, subscription_plan)');
  db.run('CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_payments_yookassa ON payments(yookassa_payment_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status)');
  
  // Save initial state
  saveDatabase();
  
  console.log('✅ Database initialized successfully');
  
  return db;
}

/**
 * Save database to disk (async with debounce)
 */
let saveTimeout = null;
function saveDatabase() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (db) {
      try {
        const data = db.export();
        await fs.promises.writeFile(DB_PATH, Buffer.from(data));
      } catch (error) {
        console.error('Database save error:', error);
      }
    }
  }, 100);
}

/**
 * Get database instance
 */
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
function closeDatabase() {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

module.exports = {
  initDatabase,
  getDb,
  closeDatabase,
  saveDatabase
};
