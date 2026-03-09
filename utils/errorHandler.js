/**
 * Error Handler Utilities
 * Centralized error handling for frontend and backend
 */

class ErrorHandler {
  /**
   * Handle API error and return user-friendly message
   * @param {Error} error - Error object
   * @param {string} context - Context of the error (e.g., 'Load cards', 'Payment')
   * @returns {string} User-friendly error message
   */
  static handleApiError(error, context = 'Operation') {
    console.error(`${context} error:`, error);

    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return 'Нет соединения с сервером. Проверьте интернет.';
    }

    // JSON parse errors
    if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
      return 'Ошибка формата данных. Попробуйте позже.';
    }

    // Abort errors (user cancelled)
    if (error.name === 'AbortError') {
      return 'Запрос отменён.';
    }

    // HTTP errors with status
    if (error.status) {
      return this.#getHttpErrorMessage(error.status, error.message);
    }

    // Generic error
    return error.message || `Произошла ошибка (${context}). Попробуйте снова.`;
  }

  /**
   * Get HTTP status error message
   * @param {number} status - HTTP status code
   * @param {string} defaultMessage - Default error message
   * @returns {string} User-friendly message
   */
  static #getHttpErrorMessage(status, defaultMessage) {
    const messages = {
      400: 'Неверный запрос. Проверьте данные.',
      401: 'Требуется авторизация.',
      403: 'Доступ запрещён.',
      404: 'Ресурс не найден.',
      409: 'Конфликт данных.',
      422: 'Ошибка валидации.',
      429: 'Слишком много запросов. Подождите немного.',
      500: 'Ошибка сервера. Попробуйте позже.',
      502: 'Сервер недоступен.',
      503: 'Сервер временно недоступен.'
    };
    return messages[status] || defaultMessage || `Ошибка ${status}`;
  }

  /**
   * Show error message to user in specified element
   * @param {string} message - Error message
   * @param {string} elementId - ID of element to show error in
   * @param {string} type - Error type ('error', 'warning', 'info')
   */
  static showUserError(message, elementId, type = 'error') {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Element #${elementId} not found for error display`);
      return;
    }

    const icons = {
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };

    element.innerHTML = `<p class="${type}-message">${icons[type]} ${this.#escapeHtml(message)}</p>`;
  }

  /**
   * Hide error message from element
   * @param {string} elementId - ID of element
   */
  static hideUserError(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
      const errorMessage = element.querySelector('.error-message, .warning-message, .info-message');
      if (errorMessage) {
        errorMessage.remove();
      }
    }
  }

  /**
   * Show toast notification
   * @param {string} message - Message to show
   * @param {string} type - Toast type ('success', 'error', 'warning', 'info')
   * @param {number} duration - Duration in ms (default: 3000)
   */
  static showToast(message, type = 'info', duration = 3000) {
    // Remove existing toast
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${this.#getToastIcon(type)}</span>
      <span>${this.#escapeHtml(message)}</span>
    `;

    document.body.appendChild(toast);

    // Trigger reflow for animation
    toast.offsetHeight;
    toast.classList.add('show');

    // Auto-hide
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Get toast icon based on type
   * @param {string} type - Toast type
   * @returns {string} Icon character
   */
  static #getToastIcon(type) {
    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };
    return icons[type] || 'ℹ';
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text - Text to escape
   * @returns {string} Escaped text
   */
  static #escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Log error with context (development only)
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @param {Object} metadata - Additional metadata
   */
  static logError(error, context, metadata = {}) {
    if (process.env.NODE_ENV === 'development') {
      console.group(`[${context}]`);
      console.error('Error:', error);
      console.error('Metadata:', metadata);
      console.groupEnd();
    } else {
      // In production, log to monitoring service
      console.error(`[${context}]`, error.message);
    }
  }

  /**
   * Wrap async function with error handling
   * @param {Function} fn - Async function to wrap
   * @param {string} context - Context for error messages
   * @param {Function} onError - Optional error handler callback
   * @returns {Function} Wrapped function
   */
  static wrapAsync(fn, context, onError = null) {
    return async (...args) => {
      try {
        return await fn(...args);
      } catch (error) {
        const userMessage = this.handleApiError(error, context);
        if (onError) {
          onError(error, userMessage);
        }
        throw new Error(userMessage);
      }
    };
  }
}

module.exports = ErrorHandler;
