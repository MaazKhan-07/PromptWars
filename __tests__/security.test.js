/**
 * FlowSphere — Security Utils Tests
 */
import { sanitizeHTML, checkRateLimit, validateInput, getCSRFToken, validateCSRFToken, getSafeErrorMessage } from '../src/utils/security.js';

describe('Security Utils', () => {
  describe('sanitizeHTML', () => {
    it('escapes HTML entities', () => {
      expect(sanitizeHTML('<script>alert("xss")</script>')).not.toContain('<script>');
    });
    it('handles non-string input', () => {
      expect(sanitizeHTML(null)).toBe('');
      expect(sanitizeHTML(undefined)).toBe('');
      expect(sanitizeHTML(123)).toBe('');
    });
    it('preserves safe text', () => {
      expect(sanitizeHTML('Hello World')).toBe('Hello World');
    });
    it('escapes angle brackets', () => {
      const result = sanitizeHTML('<img src=x onerror=alert(1)>');
      expect(result).not.toContain('<img');
    });
  });

  describe('checkRateLimit', () => {
    it('allows first call', () => {
      const result = checkRateLimit('test-unique-1', 3000);
      expect(result.allowed).toBe(true);
    });
    it('blocks rapid second call', () => {
      checkRateLimit('test-unique-2', 3000);
      const result = checkRateLimit('test-unique-2', 3000);
      expect(result.allowed).toBe(false);
      expect(result.remainingMs).toBeGreaterThan(0);
    });
    it('different keys are independent', () => {
      checkRateLimit('key-a', 3000);
      const result = checkRateLimit('key-b', 3000);
      expect(result.allowed).toBe(true);
    });
  });

  describe('validateInput', () => {
    it('validates required fields', () => {
      expect(validateInput('', { required: true }).valid).toBe(false);
      expect(validateInput('hello', { required: true }).valid).toBe(true);
    });
    it('validates length constraints', () => {
      expect(validateInput('hi', { minLength: 5 }).valid).toBe(false);
      expect(validateInput('hello world', { maxLength: 5 }).valid).toBe(false);
    });
    it('validates number type', () => {
      expect(validateInput('abc', { type: 'number' }).valid).toBe(false);
      expect(validateInput('123', { type: 'number' }).valid).toBe(true);
    });
    it('validates email type', () => {
      expect(validateInput('notanemail', { type: 'email' }).valid).toBe(false);
      expect(validateInput('test@test.com', { type: 'email' }).valid).toBe(true);
    });
    it('returns null error for valid input', () => {
      expect(validateInput('valid text', { required: true }).error).toBeNull();
    });
  });

  describe('CSRF Token', () => {
    it('generates a token', () => {
      const token = getCSRFToken();
      expect(token).toBeTruthy();
      expect(token.length).toBe(64);
    });
    it('returns same token on subsequent calls', () => {
      const t1 = getCSRFToken();
      const t2 = getCSRFToken();
      expect(t1).toBe(t2);
    });
    it('validates correct token', () => {
      const token = getCSRFToken();
      expect(validateCSRFToken(token)).toBe(true);
    });
    it('rejects wrong token', () => {
      expect(validateCSRFToken('wrong-token')).toBe(false);
    });
  });

  describe('getSafeErrorMessage', () => {
    it('returns user-friendly message', () => {
      const msg = getSafeErrorMessage(new Error('some internal error'), 'operation');
      expect(msg).not.toContain('internal');
      expect(msg).toContain('try again');
    });
    it('detects network errors', () => {
      const msg = getSafeErrorMessage(new Error('network failed'));
      expect(msg).toContain('internet connection');
    });
  });
});
