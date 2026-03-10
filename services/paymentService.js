/**
 * Payment Service (Legacy Compatibility Layer)
 * @deprecated Use YooKassaService, PaymentRepository, and SubscriptionService directly
 */

const { getDb, saveDatabase } = require('../database/init');
const YooKassaService = require('./yookassaService');
const PaymentRepository = require('./paymentRepository');
const SubscriptionService = require('./subscriptionService');

const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;

// Lazy-loaded service instances
let yookassaService = null;
let paymentRepository = null;
let subscriptionService = null;

function getYookassaService() {
  if (!yookassaService) {
    yookassaService = new YooKassaService(YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY);
  }
  return yookassaService;
}

function getPaymentRepository() {
  if (!paymentRepository) {
    paymentRepository = new PaymentRepository(getDb, saveDatabase);
  }
  return paymentRepository;
}

function getSubscriptionService() {
  if (!subscriptionService) {
    const userService = require('./userService');
    subscriptionService = new SubscriptionService(userService);
  }
  return subscriptionService;
}

// ==================== DEPRECATED FUNCTIONS (Backward Compatibility) ====================

/**
 * @deprecated Use YooKassaService.createPayment()
 */
async function createYooKassaPayment(amount, description, returnUrl) {
  return getYookassaService().createPayment(amount, description, returnUrl);
}

/**
 * @deprecated Use YooKassaService.getPaymentStatus()
 */
async function getYooKassaPaymentStatus(yookassaPaymentId) {
  return getYookassaService().getPaymentStatus(yookassaPaymentId);
}

/**
 * @deprecated Use PaymentRepository.create()
 */
function createPaymentRecord(userId, amount, description, paymentType = 'topup', subscriptionPlan = null) {
  return getPaymentRepository().create(userId, amount, description, paymentType, subscriptionPlan);
}

/**
 * @deprecated Use PaymentRepository.findById()
 */
function getPaymentById(paymentId) {
  return getPaymentRepository().findById(paymentId);
}

/**
 * @deprecated Use PaymentRepository.findByYooKassaId()
 */
function getPaymentByYooKassaId(yookassaPaymentId) {
  return getPaymentRepository().findByYooKassaId(yookassaPaymentId);
}

/**
 * @deprecated Use PaymentRepository.updateStatus()
 */
function updatePaymentStatus(paymentId, status) {
  getPaymentRepository().updateStatus(paymentId, status);
}

/**
 * @deprecated Use PaymentRepository.updateYooKassaId()
 */
function updatePaymentYooKassaId(paymentId, yookassaId) {
  getPaymentRepository().updateYooKassaId(paymentId, yookassaId);
}

/**
 * @deprecated Use PaymentRepository.getAll()
 */
function getAllPayments() {
  return getPaymentRepository().getAll();
}

/**
 * @deprecated Use SubscriptionService.calculateEndDate()
 */
function calculateSubscriptionEnd(user) {
  return getSubscriptionService().calculateEndDate(user);
}

/**
 * Process successful payment
 * @deprecated Use SubscriptionService directly
 */
function processSuccessfulPayment(payment) {
  const userService = require('./userService');
  getPaymentRepository().updateStatus(payment.id, 'succeeded');

  if (payment.payment_type === 'subscription') {
    const user = userService.getUserById(payment.user_id);
    const subscriptionEnd = getSubscriptionService().calculateEndDate(user);
    userService.activateSubscription(payment.user_id, payment.subscription_plan, subscriptionEnd.toISOString());
  } else {
    userService.updateBalance(payment.user_id, payment.amount);
  }
}

/**
 * Create subscription payment
 * @deprecated Use new service classes directly
 */
async function createSubscriptionPayment(userId, plan, amount, description) {
  const userService = require('./userService');
  const user = userService.getOrCreateUser(userId);

  const domain = process.env.DOMAIN || 'http://localhost:3000';
  const returnUrl = `${domain}/api/subscription/success?paymentId={paymentId}`;

  const yooKassaResult = await getYookassaService().createPayment(amount, description, returnUrl);
  const paymentId = getPaymentRepository().create(user.id, amount, description, 'subscription', plan);
  getPaymentRepository().updateYooKassaId(paymentId, yooKassaResult.yookassaId);

  return {
    payment_id: paymentId,
    confirmation_url: yooKassaResult.confirmationUrl,
    amount,
    plan
  };
}

/**
 * Create top-up payment
 * @deprecated Use new service classes directly
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

  const domain = process.env.DOMAIN || 'http://localhost:3000';
  const returnUrl = `${domain}/api/payment/success?paymentId={paymentId}`;

  const yooKassaResult = await getYookassaService().createPayment(amount, description, returnUrl);
  const paymentId = getPaymentRepository().create(user.id, amount, description, 'topup');
  getPaymentRepository().updateYooKassaId(paymentId, yooKassaResult.yookassaId);

  return {
    payment_id: paymentId,
    confirmation_url: yooKassaResult.confirmationUrl,
    amount
  };
}

/**
 * Pay for subscription from balance
 * @deprecated Use SubscriptionService.activateFromBalance()
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

  const db = getDb();
  const paymentId = `pay_balance_${require('uuid').v4()}`;
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

  userService.updateBalance(user.id, -amount);

  const subscriptionEnd = getSubscriptionService().calculateEndDate(user);
  userService.activateSubscription(user.id, plan, subscriptionEnd.toISOString());

  saveDatabase();

  return {
    success: true,
    message: 'Подписка активирована',
    plan,
    subscriptionEnd: subscriptionEnd.toISOString()
  };
}

// ==================== EXPORTS ====================

module.exports = {
  // Legacy exports for backward compatibility
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
  getAllPayments,

  // New service exports
  getYookassaService,
  getPaymentRepository,
  getSubscriptionService
};
