/**
 * Modal Manager
 * Centralized modal window management with animations and event handlers
 */

const { MODAL_ANIMATION_DURATION_MS } = require('../constants');

class ModalManager {
  constructor(options = {}) {
    this.modals = new Map();
    this.animationDuration = options.animationDuration || MODAL_ANIMATION_DURATION_MS;
    this.hapticFeedback = options.hapticFeedback !== false;
    this.tg = options.tg || (typeof window !== 'undefined' ? window.Telegram?.WebApp : null);
  }

  /**
   * Register a modal with configuration
   * @param {string} id - Modal element ID
   * @param {Object} options - Modal options
   */
  register(id, options = {}) {
    this.modals.set(id, {
      id,
      onClose: options.onClose || null,
      onOpen: options.onOpen || null,
      closeOnBackdrop: options.closeOnBackdrop ?? true,
      closeOnEscape: options.closeOnEscape ?? true,
      closeOnOutsideClick: options.closeOnOutsideClick ?? true
    });
  }

  /**
   * Open modal by ID
   * @param {string} id - Modal element ID
   * @param {Object} data - Optional data to pass to modal
   */
  open(id, data = null) {
    const modal = document.getElementById(id);
    const config = this.modals.get(id);
    
    if (!modal || !config) {
      console.warn(`Modal #${id} not found or not registered`);
      return;
    }

    // Trigger haptic feedback
    this.#triggerHaptic('light');

    // Add active classes
    modal.classList.add('active');
    document.body.classList.add('modal-open');

    // Reset closing state
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.classList.remove('closing');
    }

    // Store data if provided
    if (data !== null) {
      modal.dataset.modalData = JSON.stringify(data);
    }

    // Call onOpen callback
    if (typeof config.onOpen === 'function') {
      config.onOpen(data);
    }

    // Focus first focusable element
    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
      setTimeout(() => firstFocusable.focus(), this.animationDuration);
    }
  }

  /**
   * Close modal by ID
   * @param {string} id - Modal element ID
   */
  close(id) {
    const modal = document.getElementById(id);
    const config = this.modals.get(id);
    
    if (!modal || !config) return;

    // Add closing animation class
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.classList.add('closing');
    }

    // Wait for animation then remove
    setTimeout(() => {
      modal.classList.remove('active');
      if (modalContent) {
        modalContent.classList.remove('closing');
      }
      document.body.classList.remove('modal-open');

      // Clear stored data
      delete modal.dataset.modalData;

      // Call onClose callback
      if (typeof config.onClose === 'function') {
        config.onClose();
      }
    }, this.animationDuration);
  }

  /**
   * Close all open modals
   */
  closeAll() {
    for (const [id] of this.modals) {
      this.close(id);
    }
  }

  /**
   * Get modal data
   * @param {string} id - Modal element ID
   * @returns {Object|null} Stored data or null
   */
  getData(id) {
    const modal = document.getElementById(id);
    if (!modal || !modal.dataset.modalData) return null;
    
    try {
      return JSON.parse(modal.dataset.modalData);
    } catch {
      return null;
    }
  }

  /**
   * Check if modal is open
   * @param {string} id - Modal element ID
   * @returns {boolean} True if modal is open
   */
  isOpen(id) {
    const modal = document.getElementById(id);
    return modal ? modal.classList.contains('active') : false;
  }

  /**
   * Setup global event handlers for all modals
   */
  setupGlobalHandlers() {
    // Backdrop click handler
    window.onclick = (event) => {
      for (const [id, config] of this.modals.entries()) {
        if (config.closeOnBackdrop && event.target === document.getElementById(id)) {
          this.close(id);
        }
      }
    };

    // Escape key handler
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      
      for (const [id, config] of this.modals.entries()) {
        if (config.closeOnEscape && this.isOpen(id)) {
          this.close(id);
          break; // Close only topmost modal
        }
      }
    });

    // Prevent scroll when modal is open
    document.addEventListener('touchmove', (e) => {
      if (document.body.classList.contains('modal-open')) {
        const modal = document.querySelector('.modal.active');
        if (!modal) return;

        const modalBody = e.target.closest('.modal-body');
        if (!modalBody) {
          e.preventDefault();
          return;
        }

        const atTop = modalBody.scrollTop === 0;
        const atBottom = modalBody.scrollTop + modalBody.clientHeight >= modalBody.scrollHeight;
        const touchEndY = e.touches[0].clientY;
        const touchStartY = e.touches[0].clientY - (e.touches[0].clientY - (e.touches[0].clientY - 1));

        if ((atTop && touchEndY > touchStartY) || (atBottom && touchEndY < touchStartY)) {
          e.preventDefault();
        }
      }
    }, { passive: false });
  }

  /**
   * Trigger haptic feedback if available
   * @param {string} type - Haptic type ('light', 'medium', 'heavy', 'rigid', 'soft')
   */
  #triggerHaptic(type = 'light') {
    if (!this.hapticFeedback) return;
    if (!this.tg) return;
    if (!this.tg.HapticFeedback) return;

    const method = `${type}Occurred`;
    if (typeof this.tg.HapticFeedback[method] === 'function') {
      this.tg.HapticFeedback[method]();
    } else if (typeof this.tg.HapticFeedback.impactOccurred === 'function') {
      this.tg.HapticFeedback.impactOccurred(type);
    }
  }

  /**
   * Create and register a simple confirmation modal
   * @param {string} id - Modal ID
   * @param {string} title - Modal title
   * @param {string} message - Confirmation message
   * @param {Function} onConfirm - Callback when confirmed
   * @param {Function} onCancel - Callback when cancelled
   */
  createConfirmation(id, title, message, onConfirm, onCancel = null) {
    this.register(id, {
      onClose: () => {
        if (onCancel) onCancel();
      }
    });

    const modal = document.getElementById(id);
    if (!modal) return;

    const confirmBtn = modal.querySelector('[data-action="confirm"]');
    const cancelBtn = modal.querySelector('[data-action="cancel"]');

    if (confirmBtn) {
      confirmBtn.onclick = () => {
        onConfirm();
        this.close(id);
      };
    }

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        if (onCancel) onCancel();
        this.close(id);
      };
    }

    // Set title and message if elements exist
    const titleEl = modal.querySelector('[data-element="title"]');
    const messageEl = modal.querySelector('[data-element="message"]');
    
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
  }
}

module.exports = ModalManager;
