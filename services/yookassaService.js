/**
 * YooKassa Service
 * Handles integration with YooKassa payment API
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class YooKassaService {
  constructor(shopId, secretKey, baseUrl = 'https://api.yookassa.ru/v3') {
    if (!shopId || !secretKey) {
      throw new Error('YooKassa shopId and secretKey are required');
    }
    
    this.shopId = shopId;
    this.secretKey = secretKey;
    this.baseUrl = baseUrl;
    this.#authString = Buffer.from(`${shopId}:${secretKey}`).toString('base64');
  }

  #authString;

  /**
   * Create payment in YooKassa
   * @param {number} amount - Payment amount
   * @param {string} description - Payment description
   * @param {string} returnUrl - Return URL after payment
   * @returns {Promise<Object>} Payment data with confirmation URL
   */
  async createPayment(amount, description, returnUrl) {
    const paymentId = uuidv4();

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
      const response = await axios.post(`${this.baseUrl}/payments`, payload, {
        headers: {
          'Content-Type': 'application/json',
          'Idempotence-Key': paymentId,
          'Authorization': `Basic ${this.#authString}`
        }
      });

      return {
        paymentId,
        yookassaId: response.data.id,
        confirmationUrl: response.data.confirmation.confirmation_url,
        amount,
        status: response.data.status
      };
    } catch (error) {
      console.error('YooKassa API error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.description || 'YooKassa payment creation failed');
    }
  }

  /**
   * Get payment status from YooKassa
   * @param {string} yookassaPaymentId - YooKassa payment ID
   * @returns {Promise<string>} Payment status
   */
  async getPaymentStatus(yookassaPaymentId) {
    try {
      const response = await axios.get(`${this.baseUrl}/payments/${yookassaPaymentId}`, {
        headers: {
          'Authorization': `Basic ${this.#authString}`
        }
      });

      return response.data.status;
    } catch (error) {
      console.error('YooKassa API error:', error.response?.data || error.message);
      throw new Error('Failed to get payment status');
    }
  }

  /**
   * Refund payment
   * @param {string} yookassaPaymentId - YooKassa payment ID
   * @param {number} amount - Refund amount
   * @returns {Promise<Object>} Refund data
   */
  async refundPayment(yookassaPaymentId, amount) {
    const payload = {
      amount: {
        value: amount.toFixed(2),
        currency: 'RUB'
      }
    };

    try {
      const response = await axios.post(
        `${this.baseUrl}/refunds`,
        {
          ...payload,
          payment_id: yookassaPaymentId
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${this.#authString}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('YooKassa refund error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.description || 'Refund failed');
    }
  }
}

module.exports = YooKassaService;
