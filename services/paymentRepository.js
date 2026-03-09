/**
 * Payment Repository
 * Handles payment data persistence
 */

const { v4: uuidv4 } = require('uuid');

class PaymentRepository {
  constructor(getDb, saveDatabase) {
    this.getDb = getDb;
    this.saveDatabase = saveDatabase;
  }

  /**
   * Create payment record
   * @param {number} userId - User ID
   * @param {number} amount - Payment amount
   * @param {string} description - Payment description
   * @param {string} type - Payment type ('topup' or 'subscription')
   * @param {string|null} plan - Subscription plan (if applicable)
   * @returns {string} Payment ID
   */
  create(userId, amount, description, type = 'topup', plan = null) {
    const db = this.getDb();
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
      ':payment_type': type,
      ':subscription_plan': plan
    });
    stmt.free();

    this.saveDatabase();

    return paymentId;
  }

  /**
   * Find payment by ID
   * @param {string} paymentId - Payment ID
   * @returns {Object|null} Payment object or null
   */
  findById(paymentId) {
    const db = this.getDb();
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
   * Find payment by YooKassa ID
   * @param {string} yookassaId - YooKassa payment ID
   * @returns {Object|null} Payment object or null
   */
  findByYooKassaId(yookassaId) {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM payments WHERE yookassa_payment_id = :yookassa_id');
    stmt.bind({ ':yookassa_id': yookassaId });

    let payment = null;
    if (stmt.step()) {
      payment = stmt.getAsObject();
    }
    stmt.free();

    return payment;
  }

  /**
   * Update payment status
   * @param {string} paymentId - Payment ID
   * @param {string} status - New status
   */
  updateStatus(paymentId, status) {
    const db = this.getDb();
    const stmt = db.prepare(`
      UPDATE payments
      SET status = :status, updated_at = CURRENT_TIMESTAMP
      WHERE id = :id
    `);

    stmt.run({ ':status': status, ':id': paymentId });
    stmt.free();

    this.saveDatabase();
  }

  /**
   * Update payment YooKassa ID
   * @param {string} paymentId - Payment ID
   * @param {string} yookassaId - YooKassa payment ID
   */
  updateYooKassaId(paymentId, yookassaId) {
    const db = this.getDb();
    const stmt = db.prepare(`
      UPDATE payments
      SET yookassa_payment_id = :yookassa_id, updated_at = CURRENT_TIMESTAMP
      WHERE id = :id
    `);

    stmt.run({ ':yookassa_id': yookassaId, ':id': paymentId });
    stmt.free();

    this.saveDatabase();
  }

  /**
   * Get all payments (for admin)
   * @returns {Array} All payments with user info
   */
  getAll() {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT p.*, u.telegram_id, u.first_name, u.last_name, u.username
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

  /**
   * Get payments by user ID
   * @param {number} userId - User ID
   * @returns {Array} User payments
   */
  findByUserId(userId) {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT * FROM payments
      WHERE user_id = :user_id
      ORDER BY created_at DESC
    `);
    stmt.bind({ ':user_id': userId });

    const payments = [];
    while (stmt.step()) {
      payments.push(stmt.getAsObject());
    }
    stmt.free();

    return payments;
  }

  /**
   * Get subscription payments
   * @returns {Array} Subscription payments
   */
  getSubscriptionPayments() {
    const db = this.getDb();
    const stmt = db.prepare(`
      SELECT * FROM payments
      WHERE payment_type = 'subscription'
      ORDER BY created_at DESC
    `);

    const payments = [];
    while (stmt.step()) {
      payments.push(stmt.getAsObject());
    }
    stmt.free();

    return payments;
  }
}

module.exports = PaymentRepository;
