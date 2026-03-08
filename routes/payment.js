/**
 * Payment Routes
 * POST /api/payment/create
 * GET /api/payment/success
 * POST /api/payment/webhook
 */

const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const { validateFields, validateNumeric } = require('../middleware/validation');

/**
 * POST /api/payment/create
 * Create top-up payment via YooKassa
 */
router.post('/create',
  validateFields('userId', 'amount'),
  validateNumeric('amount', { required: true, min: 1 }),
  async (req, res) => {
    try {
      const { userId, amount, description } = req.body;
      
      const result = await paymentService.createTopUpPayment(
        userId, 
        amount, 
        description || 'Пополнение баланса'
      );
      
      res.json(result);
    } catch (error) {
      console.error('Payment create error:', error);
      res.status(400).json({ 
        error: error.message || 'Failed to create payment' 
      });
    }
  }
);

/**
 * GET /api/payment/success
 * Handle payment success redirect
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
      return res.redirect(`/payment-success.html?paymentId=${paymentId}&status=success`);
    }
    
    // Check YooKassa status
    paymentService.getYooKassaPaymentStatus(payment.yookassa_payment_id)
      .then(status => {
        if (status === 'succeeded') {
          paymentService.processSuccessfulPayment(payment);
          res.redirect(`/payment-success.html?paymentId=${paymentId}&status=success`);
        } else {
          res.redirect(`/payment-success.html?paymentId=${paymentId}&status=pending`);
        }
      })
      .catch(() => {
        res.redirect(`/payment-success.html?paymentId=${paymentId}&status=pending`);
      });
      
  } catch (error) {
    console.error('Payment success error:', error);
    res.status(500).send('Internal server error');
  }
});

/**
 * POST /api/payment/webhook
 * YooKassa webhook handler
 */
router.post('/webhook', (req, res) => {
  try {
    const { event, object } = req.body;
    
    // Only process payment.succeeded events
    if (event !== 'payment.succeeded') {
      return res.json({ ok: true });
    }
    
    const yookassaPaymentId = object?.id;
    
    if (!yookassaPaymentId) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }
    
    const payment = paymentService.getPaymentByYooKassaId(yookassaPaymentId);
    
    // If payment not found or already processed, just acknowledge
    if (!payment || payment.status === 'succeeded') {
      return res.json({ ok: true });
    }
    
    // Process the successful payment
    paymentService.processSuccessfulPayment(payment);
    
    res.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

module.exports = router;
