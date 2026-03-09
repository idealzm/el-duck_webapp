/**
 * User Service
 * Handles user operations: get, create, update
 */

const { getDb, saveDatabase } = require('../database/init');

/**
 * Get user by Telegram ID or create if not exists
 */
function getOrCreateUser(telegramId, userData = {}) {
  const db = getDb();
  
  const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = :telegram_id');
  stmt.bind({ ':telegram_id': telegramId });
  
  let user = null;
  if (stmt.step()) {
    user = stmt.getAsObject();
  }
  stmt.free();
  
  if (!user) {
    const insert = db.prepare(`
      INSERT INTO users (telegram_id, first_name, last_name, username, balance)
      VALUES (:telegram_id, :first_name, :last_name, :username, 0)
    `);
    
    insert.run({
      ':telegram_id': telegramId,
      ':first_name': userData.firstName || '',
      ':last_name': userData.lastName || '',
      ':username': userData.username || ''
    });
    insert.free();
    
    saveDatabase();
    
    const select = db.prepare('SELECT * FROM users WHERE telegram_id = :telegram_id');
    select.bind({ ':telegram_id': telegramId });
    if (select.step()) {
      user = select.getAsObject();
    }
    select.free();
  }
  
  return user;
}

/**
 * Get user by ID
 */
function getUserById(id) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE id = :id');
  stmt.bind({ ':id': id });
  
  let user = null;
  if (stmt.step()) {
    user = stmt.getAsObject();
  }
  stmt.free();
  
  return user;
}

/**
 * Get user by Telegram ID
 */
function getUserByTelegramId(telegramId) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users WHERE telegram_id = :telegram_id');
  stmt.bind({ ':telegram_id': telegramId });

  let user = null;
  if (stmt.step()) {
    user = stmt.getAsObject();
  }
  stmt.free();

  return user;
}

/**
 * Update user data (name, username)
 */
function updateUserData(userId, userData) {
  const db = getDb();
  const updates = [];
  const params = { ':id': userId };

  if (userData.firstName !== undefined) {
    updates.push('first_name = :first_name');
    params[':first_name'] = userData.firstName || '';
  }
  if (userData.lastName !== undefined) {
    updates.push('last_name = :last_name');
    params[':last_name'] = userData.lastName || '';
  }
  if (userData.username !== undefined) {
    updates.push('username = :username');
    params[':username'] = userData.username || '';
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    const stmt = db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = :id`);
    stmt.run(params);
    stmt.free();
    saveDatabase();
  }
}

/**
 * Update user balance
 */
function updateBalance(userId, amount) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE users 
    SET balance = balance + :amount, updated_at = CURRENT_TIMESTAMP 
    WHERE id = :id
  `);
  
  stmt.run({ ':amount': amount, ':id': userId });
  stmt.free();
  saveDatabase();
}

/**
 * Set user balance (absolute value)
 */
function setBalance(userId, balance) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE users 
    SET balance = :balance, updated_at = CURRENT_TIMESTAMP 
    WHERE id = :id
  `);
  
  stmt.run({ ':balance': balance, ':id': userId });
  stmt.free();
  saveDatabase();
}

/**
 * Activate subscription for user
 */
function activateSubscription(userId, plan, endDate) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE users 
    SET subscription_active = 1, 
        subscription_plan = :plan, 
        subscription_end = :end,
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = :id
  `);
  
  stmt.run({ ':plan': plan, ':end': endDate, ':id': userId });
  stmt.free();
  saveDatabase();
}

/**
 * Deactivate subscription
 */
function deactivateSubscription(userId) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE users 
    SET subscription_active = 0,
        subscription_plan = NULL,
        subscription_end = NULL,
        updated_at = CURRENT_TIMESTAMP 
    WHERE id = :id
  `);
  
  stmt.run({ ':id': userId });
  stmt.free();
  saveDatabase();
}

/**
 * Update user devices count
 */
function updateDevicesCount(userId, count) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE users 
    SET devices_count = :count, updated_at = CURRENT_TIMESTAMP 
    WHERE id = :id
  `);
  
  stmt.run({ ':count': count, ':id': userId });
  stmt.free();
  saveDatabase();
}

/**
 * Get all users (for admin)
 */
function getAllUsers() {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC');
  
  const users = [];
  while (stmt.step()) {
    users.push(stmt.getAsObject());
  }
  stmt.free();
  
  return users;
}

/**
 * Delete user by ID
 */
function deleteUser(userId) {
  const db = getDb();
  
  // First delete associated payments
  const deletePayments = db.prepare('DELETE FROM payments WHERE user_id = :user_id');
  deletePayments.run({ ':user_id': userId });
  deletePayments.free();
  
  // Then delete user
  const deleteUser = db.prepare('DELETE FROM users WHERE id = :id');
  deleteUser.run({ ':id': userId });
  deleteUser.free();
  
  saveDatabase();
}

/**
 * Get users statistics
 */
function getUsersStats() {
  const db = getDb();
  
  let stmt = db.prepare('SELECT COUNT(*) as count FROM users');
  stmt.step();
  const total = stmt.getAsObject();
  stmt.free();
  
  stmt = db.prepare('SELECT COUNT(*) as count FROM users WHERE subscription_active = 1');
  stmt.step();
  const active = stmt.getAsObject();
  stmt.free();
  
  stmt = db.prepare('SELECT COALESCE(SUM(balance), 0) as total FROM users');
  stmt.step();
  const totalBalance = stmt.getAsObject();
  stmt.free();
  
  return {
    totalUsers: total.count,
    activeSubscriptions: active.count,
    totalBalance: totalBalance.total
  };
}

module.exports = {
  getOrCreateUser,
  getUserById,
  getUserByTelegramId,
  updateUserData,
  updateBalance,
  setBalance,
  activateSubscription,
  deactivateSubscription,
  updateDevicesCount,
  getAllUsers,
  deleteUser,
  getUsersStats
};
