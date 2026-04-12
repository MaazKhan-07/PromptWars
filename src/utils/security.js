/**
 * FlowSphere Security Utilities
 * Input sanitization, rate limiting, CSRF tokens, and validation
 */

// ─── DOMPurify-like Sanitizer ───
const ALLOWED_TAGS = new Set(['b', 'i', 'em', 'strong', 'span', 'br', 'p', 'div', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const ALLOWED_ATTRS = new Set(['class', 'id', 'style', 'aria-label', 'aria-live', 'role']);

/**
 * Sanitize HTML string to prevent XSS
 * Strips all tags and attributes not in allowlist
 * @param {string} dirty - Untrusted input
 * @returns {string} Sanitized string
 */
export const sanitizeHTML = (dirty) => {
  if (typeof dirty !== 'string') return '';
  // Escape HTML entities
  const div = document.createElement('div');
  div.textContent = dirty;
  return div.innerHTML;
};

/**
 * Sanitize and allow safe HTML subset
 * @param {string} dirty - HTML that may contain safe formatting
 * @returns {string} Sanitized HTML
 */
export const sanitizeRichHTML = (dirty) => {
  if (typeof dirty !== 'string') return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(dirty, 'text/html');
  const clean = sanitizeNode(doc.body);
  return clean.innerHTML;
};

function sanitizeNode(node) {
  const fragment = document.createDocumentFragment();
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      fragment.appendChild(document.createTextNode(child.textContent));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const tagName = child.tagName.toLowerCase();
      if (ALLOWED_TAGS.has(tagName)) {
        const el = document.createElement(tagName);
        for (const attr of Array.from(child.attributes)) {
          if (ALLOWED_ATTRS.has(attr.name)) {
            el.setAttribute(attr.name, attr.value);
          }
        }
        el.appendChild(sanitizeNode(child));
        fragment.appendChild(el);
      } else {
        // Skip disallowed tag, but include text content
        fragment.appendChild(sanitizeNode(child));
      }
    }
  }
  const wrapper = document.createElement('div');
  wrapper.appendChild(fragment);
  return wrapper;
}

// ─── Rate Limiter ───
const rateLimitMap = new Map();

/**
 * Rate limit a function call
 * @param {string} key - Unique identifier for the action
 * @param {number} cooldownMs - Minimum milliseconds between calls
 * @returns {{allowed: boolean, remainingMs: number}}
 */
export const checkRateLimit = (key, cooldownMs = 3000) => {
  const now = Date.now();
  const lastCall = rateLimitMap.get(key) || 0;
  const elapsed = now - lastCall;

  if (elapsed < cooldownMs) {
    return { allowed: false, remainingMs: cooldownMs - elapsed };
  }

  rateLimitMap.set(key, now);
  return { allowed: true, remainingMs: 0 };
};

/**
 * Create a rate-limited wrapper for async functions
 * @param {string} key - Rate limit key
 * @param {Function} fn - Async function to wrap
 * @param {number} cooldownMs - Cooldown period
 * @param {Function} onCooldown - Called with remaining ms when rate limited
 * @returns {Function} Wrapped function
 */
export const rateLimitedCall = (key, fn, cooldownMs = 3000, onCooldown = null) => {
  return async (...args) => {
    const { allowed, remainingMs } = checkRateLimit(key, cooldownMs);
    if (!allowed) {
      if (onCooldown) onCooldown(remainingMs);
      return null;
    }
    return fn(...args);
  };
};

// ─── CSRF Token ───
let csrfToken = null;

/**
 * Generate a CSRF token for form submissions
 * In a SPA context, this provides defense-in-depth
 * @returns {string} CSRF token
 */
export const getCSRFToken = () => {
  if (!csrfToken) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    csrfToken = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }
  return csrfToken;
};

/**
 * Validate CSRF token
 * @param {string} token - Token to validate
 * @returns {boolean} Whether token matches
 */
export const validateCSRFToken = (token) => {
  return csrfToken !== null && token === csrfToken;
};

// ─── Input Validation ───

/**
 * Validate text input
 * @param {string} value - Input value
 * @param {Object} rules - Validation rules
 * @returns {{valid: boolean, error: string|null}}
 */
export const validateInput = (value, rules = {}) => {
  const { required = false, minLength = 0, maxLength = 500, pattern = null, type = 'text' } = rules;

  if (required && (!value || value.trim().length === 0)) {
    return { valid: false, error: 'This field is required' };
  }
  if (!value) return { valid: true, error: null };

  const trimmed = value.trim();

  if (trimmed.length < minLength) {
    return { valid: false, error: `Minimum ${minLength} characters required` };
  }
  if (trimmed.length > maxLength) {
    return { valid: false, error: `Maximum ${maxLength} characters allowed` };
  }
  if (type === 'number' && isNaN(Number(trimmed))) {
    return { valid: false, error: 'Please enter a valid number' };
  }
  if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }
  if (pattern && !pattern.test(trimmed)) {
    return { valid: false, error: 'Invalid format' };
  }

  return { valid: true, error: null };
};

/**
 * Safe error message for user display
 * Never reveals system internals
 * @param {Error} error - The caught error
 * @param {string} context - What operation failed
 * @returns {string} User-friendly error message
 */
export const getSafeErrorMessage = (error, context = 'operation') => {
  // Log detailed error only in development
  // Using globalThis.__VITE_DEV__ which Vite sets, avoids import.meta parse error in Jest
  if (globalThis.__VITE_DEV__) {
    console.error(`[FlowSphere Error] ${context}:`, error);
  }

  // Generic user-friendly messages
  const messages = {
    'network': 'Unable to connect. Please check your internet connection and try again.',
    'auth': 'Authentication failed. Please sign in again.',
    'permission': 'You don\'t have permission to perform this action.',
    'notfound': 'The requested resource was not found.',
    'ratelimit': 'Too many requests. Please wait a moment and try again.',
    'default': `Something went wrong with this ${context}. Please try again later.`
  };

  if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
    return messages.network;
  }
  if (error?.code?.includes('auth') || error?.message?.includes('auth')) {
    return messages.auth;
  }
  if (error?.code?.includes('permission')) {
    return messages.permission;
  }

  return messages.default;
};
