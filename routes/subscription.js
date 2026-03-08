/**
 * Subscription Routes
 * POST /api/subscription/create
 * POST /api/subscription/pay
 * GET /api/subscription/success
 */

const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { validateFields, validateEnum, validateNumeric } = require('../middleware/validation');

/**
 * POST /api/subscription/create
 * Create subscription payment via YooKassa
 */
router.post('/create', 
  validateFields('userId', 'plan', 'amount'),
  validateEnum('plan', ['telegram', 'full']),
  validateNumeric('amount', { required: true, min: 1 }),
  async (req, res) => {
    try {
      const { userId, plan, amount, description } = req.body;
      
      const result = await paymentService.createSubscriptionPayment(
        userId, 
        plan, 
        amount, 
        description || `Подписка "${plan}"`
      );
      
      res.json(result);
    } catch (error) {
      console.error('Subscription create error:', error);
      res.status(400).json({ 
        error: error.message || 'Failed to create subscription' 
      });
    }
  }
);

/**
 * POST /api/subscription/pay
 * Pay for subscription from balance
 */
router.post('/pay',
  validateFields('userId', 'plan', 'amount'),
  validateEnum('plan', ['telegram', 'full']),
  validateNumeric('amount', { required: true, min: 1 }),
  (req, res) => {
    try {
      const { userId, plan, amount } = req.body;
      
      const result = paymentService.paySubscriptionFromBalance(userId, plan, amount);
      
      res.json(result);
    } catch (error) {
      console.error('Subscription pay error:', error);
      res.status(400).json({ 
        error: error.message || 'Failed to pay for subscription' 
      });
    }
  }
);

/**
 * GET /api/subscription/success
 * Handle subscription payment success redirect
 */
router.get('/success', (req, res) => {
  try {
    const { paymentId } = req.query;
    
    if (!paymentId) {
      return res.status(400).send('paymentId is required');
    }
    
    const payment = paymentService.getPaymentById(paymentId);
    
    if (!payment) {
      return res.status(404).send('Payment not found');
    }
    
    // If already succeeded, redirect to success page
    if (payment.status === 'succeeded') {
      return res.redirect(`/payment-success.html?paymentId=${paymentId}&status=success&type=subscription`);
    }
    
    // Check YooKassa status
    paymentService.getYooKassaPaymentStatus(payment.yookassa_payment_id)
      .then(status => {
        if (status === 'succeeded') {
          paymentService.processSuccessfulPayment(payment);
          res.redirect(`/payment-success.html?paymentId=${paymentId}&status=success&type=subscription`);
        } else {
          res.redirect(`/payment-success.html?paymentId=${paymentId}&status=pending&type=subscription`);
        }
      })
      .catch(() => {
        res.redirect(`/payment-success.html?paymentId=${paymentId}&status=pending&type=subscription`);
      });
      
  } catch (error) {
    console.error('Subscription success error:', error);
    res.status(500).send('Internal server error');
  }
});

module.exports = router;
