/**
 * El-Duck Application Constants
 * Centralized configuration values and magic numbers
 */

module.exports = {
  // ==================== RATE LIMITING ====================
  RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,  // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,           // max requests per window

  // ==================== PAYMENT POLLING ====================
  PAYMENT_CHECK_INITIAL_DELAY_MS: 3000,   // 3 seconds before first check
  PAYMENT_CHECK_INTERVAL_MS: 3000,        // 3 seconds between checks
  PAYMENT_CHECK_TIMEOUT_MS: 180000,       // 3 minutes total timeout
  PAYMENT_CHECK_MAX_ATTEMPTS: 60,         // maximum check attempts

  // ==================== SESSIONS ====================
  SESSION_EXPIRY_MS: 24 * 60 * 60 * 1000,  // 24 hours
  CSRF_TOKEN_EXPIRY_MS: 24 * 60 * 60 * 1000,  // 24 hours

  // ==================== ANIMATIONS & UI ====================
  MODAL_ANIMATION_DURATION_MS: 300,
  TOAST_SHOW_DURATION_MS: 2500,
  TOAST_AUTOHIDE_DELAY_MS: 10000,
  BALANCE_REFRESH_DEBOUNCE_MS: 500,
  AVATAR_INITIAL_DELAY_MS: 500,

  // ==================== SUBSCRIPTION ====================
  SUBSCRIPTION_EXTENSION_MONTHS: 1,
  DEVICES_LIMIT: 3,

  // ==================== SUBSCRIPTION PLANS ====================
  SUBSCRIPTION_PLANS: {
    TELEGRAM: 'telegram',
    FULL: 'full',
    NONE: 'none'
  },

  // ==================== PAYMENT TYPES ====================
  PAYMENT_TYPES: {
    SUBSCRIPTION: 'subscription',
    TOPUP: 'topup'
  },

  // ==================== PAYMENT STATUSES ====================
  PAYMENT_STATUSES: {
    PENDING: 'pending',
    SUCCEEDED: 'succeeded',
    FAILED: 'failed'
  },

  // ==================== SUBSCRIPTION STATUS ====================
  SUBSCRIPTION_STATUS: {
    ACTIVE: 'active',
    EXPIRED: 'expired',
    INACTIVE: 'inactive'
  },

  // ==================== API ENDPOINTS ====================
  API_ENDPOINTS: {
    // Public
    BALANCE: '/api/balance',
    PROFILE: '/api/profile',
    CARDS: '/api/cards',
    PRICES: '/api/prices',
    SETTINGS: '/api/settings',
    
    // Payment
    PAYMENT_CREATE: '/api/payment/create',
    PAYMENT_SUCCESS: '/api/payment/success',
    PAYMENT_WEBHOOK: '/api/payment/webhook',
    
    // Subscription
    SUBSCRIPTION_CREATE: '/api/subscription/create',
    SUBSCRIPTION_PAY: '/api/subscription/pay',
    SUBSCRIPTION_SUCCESS: '/api/subscription/success',
    
    // Admin
    ADMIN_CONFIG: '/api/admin/config',
    ADMIN_AUTH: '/api/admin/auth',
    ADMIN_CHECK: '/api/admin/check',
    ADMIN_LOGOUT: '/api/admin/logout',
    ADMIN_USERS: '/api/admin/users',
    ADMIN_STATS: '/api/admin/stats',
    ADMIN_USER_BALANCE: '/api/admin/user/balance',
    ADMIN_USER_SUBSCRIPTION: '/api/admin/user/subscription',
    ADMIN_USER_DELETE: '/api/admin/user/delete',
    ADMIN_PRICES: '/api/admin/prices',
    ADMIN_PRICES_SAVE: '/api/admin/prices/save',
    ADMIN_SUBSCRIPTIONS: '/api/admin/subscriptions',
    ADMIN_SETTINGS: '/api/admin/settings',
    ADMIN_SETTINGS_SAVE: '/api/admin/settings/save'
  },

  // ==================== ALLOWED DOMAINS (CORS) ====================
  ALLOWED_DOMAINS: [
    'https://dev.el-duck.ru',
    'http://localhost:3000',
    'https://t.me',
    'https://telegram.org',
    'android-app://org.telegram.messenger',
    'ios-app://686446520'
  ],

  // ==================== FILE PATHS ====================
  PATHS: {
    ADMIN_CONFIG: 'admin_config.json',
    BOT_CONFIG: 'bot_config.json',
    ADMIN_SESSIONS: 'admin_sessions.json',
    DATABASE: 'database.db',
    DATA: 'data.json'
  },

  // ==================== DEFAULT VALUES ====================
  DEFAULTS: {
    PRICES: {
      telegramPrice: 99,
      fullPrice: 299,
      minTopUp: 50,
      maxTopUp: 500,
      billingCycle: 'month'
    },
    SETTINGS: {
      siteEnabled: true,
      maintenanceMessage: 'Технические работы. Сайт временно недоступен.'
    }
  },

  // ==================== BILLING CYCLES ====================
  BILLING_CYCLES: {
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year'
  },

  // ==================== HTTP STATUS ====================
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500
  }
};
