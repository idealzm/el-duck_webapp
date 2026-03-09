/**
 * API Client
 * Centralized HTTP client for API requests with error handling
 */

const { HTTP_STATUS } = require('../constants');

class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

class ApiClient {
  constructor(baseURL = '/api', options = {}) {
    this.baseURL = baseURL;
    this.timeout = options.timeout || 30000;
    this.defaultHeaders = options.headers || {};
    this.onRequest = options.onRequest || null;
    this.onResponse = options.onResponse || null;
    this.onError = options.onError || null;
  }

  /**
   * GET request
   * @param {string} endpoint - API endpoint
   * @param {Object} params - Query parameters
   * @param {Object} headers - Additional headers
   * @returns {Promise<Object>} Response data
   */
  async get(endpoint, params = {}, headers = {}) {
    const url = new URL(`${this.baseURL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, value);
      }
    });
    return this.#request(url.toString(), { method: 'GET', headers });
  }

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} headers - Additional headers
   * @returns {Promise<Object>} Response data
   */
  async post(endpoint, data = {}, headers = {}) {
    return this.#request(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data)
    });
  }

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {Object} data - Request body
   * @param {Object} headers - Additional headers
   * @returns {Promise<Object>} Response data
   */
  async put(endpoint, data = {}, headers = {}) {
    return this.#request(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(data)
    });
  }

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @param {Object} headers - Additional headers
   * @returns {Promise<Object>} Response data
   */
  async delete(endpoint, headers = {}) {
    return this.#request(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers
    });
  }

  /**
   * Internal request handler
   * @param {string} url - Full URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  async #request(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const config = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers
      },
      signal: controller.signal
    };

    // Call onRequest hook
    if (typeof this.onRequest === 'function') {
      this.onRequest(url, config);
    }

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      // Call onResponse hook
      if (typeof this.onResponse === 'function') {
        this.onResponse(response);
      }

      if (!response.ok) {
        let errorData = null;
        try {
          errorData = await response.json();
        } catch {
          // Ignore JSON parse errors
        }

        throw new ApiError(
          errorData?.error || errorData?.message || response.statusText,
          response.status,
          errorData
        );
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      }
      
      return response.text();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new ApiError('Request timeout', HTTP_STATUS.REQUEST_TIMEOUT);
      }

      if (error instanceof ApiError) {
        if (typeof this.onError === 'function') {
          this.onError(error);
        }
        throw error;
      }

      // Network errors
      throw new ApiError(
        'Network error. Please check your connection.',
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Set default header
   * @param {string} name - Header name
   * @param {string} value - Header value
   */
  setHeader(name, value) {
    this.defaultHeaders[name] = value;
  }

  /**
   * Remove default header
   * @param {string} name - Header name
   */
  removeHeader(name) {
    delete this.defaultHeaders[name];
  }

  /**
   * Clear all default headers
   */
  clearHeaders() {
    this.defaultHeaders = {};
  }

  /**
   * Set authorization token
   * @param {string} token - Auth token
   */
  setAuthToken(token) {
    this.setHeader('Authorization', `Bearer ${token}`);
  }

  /**
   * Clear authorization token
   */
  clearAuthToken() {
    this.removeHeader('Authorization');
  }
}

module.exports = { ApiClient, ApiError };
