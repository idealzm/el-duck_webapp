/**
 * Admin Config Wrapper
 * Provides config access for services
 */

const configService = require('../services/configService');

module.exports = {
  getPrices: () => configService.getPrices(),
  getSettings: () => configService.getSettings(),
  isAdmin: (telegramId) => configService.isAdmin(telegramId)
};
