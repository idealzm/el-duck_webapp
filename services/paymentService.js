/**
 * Payment Service
 * Handles YooKassa integration and payment operations
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { getDb, saveDatabase } = require('../database/init');

const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;
const YOOKASSA_BASE_URL = 'https://api.yookassa.ru/v3';

/**
 * Create YooKassa payment
 */
async function createYooKassaPayment(amount, description, returnUrl) {
  const paymentId = uuidv4();
  
  const authString = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');
  
  const payload = {
    amount: {
      value: amount.toFixed(2),
      currency: 'RUB'
    },
    confirmation: {
      type: 'redirect',
      return_url: returnUrl
    },
    capture: true,
    description: description
  };
  
  try {
    const response = await axios.post(`${YOOKASSA_BASE_URL}/payments`, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Idempotence-Key': paymentId,
        'Authorization': `Basic ${authString}`
      }
    });
    
    return {
      paymentId,
      yookassaId: response.data.id,
      confirmationUrl: response.data.confirmation.confirmation_url,
      amount
    };
  } catch (error) {
    console.error('YooKassa API error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.description || 'YooKassa payment creation failed');
  }
}

/**
 * Get YooKassa payment status
 */
async function getYooKassaPaymentStatus(yookassaPaymentId) {
  const authString = Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64');
  
  try {
    const response = await axios.get(`${YOOKASSA_BASE_URL}/payments/${yookassaPaymentId}`, {
      headers: {
        'Authorization': `Basic ${authString}`
      }
    });
    
    return response.data.status;
  } catch (error) {
    console.error('YooKassa API error:', error.response?.data || error.message);
    throw new Error('Failed to get payment status');
  }
}

/**
 * Create payment record in database
 */
function createPaymentRecord(userId, amount, description, paymentType = 'topup', subscriptionPlan = null) {
  const db = getDb();
  const paymentId = `pay_${uuidv4()}`;
  
  const stmt = db.prepare(`
    INSERT INTO payments (id, user_id, amount, status, description, payment_type, subscription_plan)
    VALUES (:id, :user_id, :amount, 'pending', :description, :payment_type, :subscription_plan)
  `);
  
  stmt.run({
    ':id': paymentId,
    ':user_id': userId,
    ':amount': amount,
    ':description': description,
    ':payment_type': paymentType,
    ':subscription_plan': subscriptionPlan
  });
  stmt.free();
  
  saveDatabase();
  
  return paymentId;
}

/**
 * Get payment by ID
 */
function getPaymentById(paymentId) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM payments WHERE id = :id');
  stmt.bind({ ':id': paymentId });
  
  let payment = null;
  if (stmt.step()) {
    payment = stmt.getAsObject();
  }
  stmt.free();
  
  return payment;
}

/**
 * Get payment by YooKassa ID
 */
function getPaymentByYooKassaId(yookassaPaymentId) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM payments WHERE yookassa_payment_id = :yookassa_id');
  stmt.bind({ ':yookassa_id': yookassaPaymentId });
  
  let payment = null;
  if (stmt.step()) {
    payment = stmt.getAsObject();
  }
  stmt.free();
  
  return payment;
}

/**
 * Update payment status
 */
function updatePaymentStatus(paymentId, status) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE payments 
    SET status = :status, updated_at = CURRENT_TIMESTAMP 
    WHERE id = :id
  `);
  
  stmt.run({ ':status': status, ':id': paymentId });
  stmt.free();
  saveDatabase();
}

/**
 * Update payment YooKassa ID
 */
function updatePaymentYooKassaId(paymentId, yookassaId) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE payments 
    SET yookassa_payment_id = :yookassa_id, updated_at = CURRENT_TIMESTAMP 
    WHERE id = :id
  `);
  
  stmt.run({ ':yookassa_id': yookassaId, ':id': paymentId });
  stmt.free();
  saveDatabase();
}

/**
 * Process successful payment
 */
function processSuccessfulPayment(payment) {
  const db = getDb();
  const userService = require('./userService');
  
  // Update payment status
  updatePaymentStatus(payment.id, 'succeeded');
  
  if (payment.payment_type === 'subscription') {
    // Activate subscription
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
    
    userService.activateSubscription(payment.user_id, payment.subscription_plan, subscriptionEnd.toISOString());
  } else {
    // Top up balance
    userService.updateBalance(payment.user_id, payment.amount);
  }
}

/**
 * Create subscription payment
 */
async function createSubscriptionPayment(userId, plan, amount, description) {
  const userService = require('./userService');
  const user = userService.getOrCreateUser(userId);
  
  const protocol = 'http';
  const host = 'localhost:3000';
  const returnUrl = `${protocol}://${host}/api/subscription/success?paymentId={paymentId}`;
  
  const yooKassaResult = await createYooKassaPayment(amount, description, returnUrl);
  
  const paymentId = createPaymentRecord(user.id, amount, description, 'subscription', plan);
  updatePaymentYooKassaId(paymentId, yooKassaResult.yookassaId);
  
  return {
    payment_id: paymentId,
    confirmation_url: yooKassaResult.confirmationUrl,
    amount,
    plan
  };
}

/**
 * Create top-up payment
 */
async function createTopUpPayment(userId, amount, description = 'Пополнение баланса') {
  const userService = require('./userService');
  const user = userService.getOrCreateUser(userId);
  
  // Validate amount
  const config = require('../config/adminConfig');
  const prices = config.getPrices();
  
  if (amount < prices.minTopUp) {
    throw new Error(`Минимальная сумма: ${prices.minTopUp} ₽`);
  }
  
  if (amount > prices.maxTopUp) {
    throw new Error(`Максимальная сумма: ${prices.maxTopUp} ₽`);
  }
  
  const protocol = 'http';
  const host = 'localhost:3000';
  const returnUrl = `${protocol}://${host}/api/payment/success?paymentId={paymentId}`;
  
  const yooKassaResult = await createYooKassaPayment(amount, description, returnUrl);
  
  const paymentId = createPaymentRecord(user.id, amount, description, 'topup');
  updatePaymentYooKassaId(paymentId, yooKassaResult.yookassaId);
  
  return {
    payment_id: paymentId,
    confirmation_url: yooKassaResult.confirmationUrl,
    amount
  };
}

/**
 * Pay for subscription from balance
 */
function paySubscriptionFromBalance(userId, plan, amount) {
  const userService = require('./userService');
  const user = userService.getUserByTelegramId(userId);
  
  if (!user) {
    throw new Error('User not found');
  }
  
  if (user.balance < amount) {
    throw new Error('Недостаточно средств на балансе');
  }
  
  const validPlans = ['telegram', 'full'];
  if (!validPlans.includes(plan)) {
    throw new Error('Неверный тип подписки');
  }
  
  // Calculate subscription end date
  let subscriptionEnd = new Date();
  
  if (user.subscription_active && user.subscription_end) {
    const endDate = new Date(user.subscription_end);
    if (endDate > new Date()) {
      // Extend from current end date
      subscriptionEnd = new Date(endDate);
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
    }
  } else {
    // New subscription from now
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + 1);
  }
  
  const db = getDb();
  
  // Create payment record
  const paymentId = `pay_balance_${uuidv4()}`;
  const stmt = db.prepare(`
    INSERT INTO payments (id, user_id, amount, status, description, payment_type, subscription_plan)
    VALUES (:id, :user_id, :amount, 'succeeded', 'Подписка (оплата с баланса)', 'subscription', :plan)
  `);
  stmt.run({
    ':id': paymentId,
    ':user_id': user.id,
    ':amount': amount,
    ':plan': plan
  });
  stmt.free();
  
  // Deduct from balance
  userService.updateBalance(user.id, -amount);
  
  // Activate subscription
  userService.activateSubscription(user.id, plan, subscriptionEnd.toISOString());
  
  saveDatabase();
  
  return {
    success: true,
    message: 'Подписка активирована',
    plan,
    subscriptionEnd: subscriptionEnd.toISOString()
  };
}

/**
 * Get all payments (for admin)
 */
function getAllPayments() {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT p.*, u.telegram_id, u.first_name, u.username
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
  `);
  
  const payments = [];
  while (stmt.step()) {
    payments.push(stmt.getAsObject());
  }
  stmt.free();
  
  return payments;
}

module.exports = {
  createYooKassaPayment,
  getYooKassaPaymentStatus,
  createPaymentRecord,
  getPaymentById,
  getPaymentByYooKassaId,
  updatePaymentStatus,
  updatePaymentYooKassaId,
  processSuccessfulPayment,
  createSubscriptionPayment,
  createTopUpPayment,
  paySubscriptionFromBalance,
  getAllPayments
};
