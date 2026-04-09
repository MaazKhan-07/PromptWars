import { calculateWaitTime, calculateDensityScore, getDensitySeverity, getWaitTimeCategory } from '../src/utils/calculations';

describe('Calculations Util', () => {
  describe('calculateWaitTime', () => {
    it('returns calculated wait time in minutes, rounding up', () => {
      expect(calculateWaitTime(30, 10)).toBe(5); // 300 seconds = 5 min
    });

    it('handles negative inputs gracefully', () => {
      expect(calculateWaitTime(-10, 10)).toBe(0);
      expect(calculateWaitTime(10, -5)).toBe(0);
    });
    
    it('handles zero people correctly', () => {
      expect(calculateWaitTime(0, 10)).toBe(0);
    });
  });

  describe('calculateDensityScore', () => {
    it('returns people per square meter', () => {
      expect(calculateDensityScore(100, 50)).toBe(2);
    });

    it('returns 0 if area is 0 or less', () => {
      expect(calculateDensityScore(100, 0)).toBe(0);
      expect(calculateDensityScore(100, -10)).toBe(0);
    });
  });

  describe('getDensitySeverity', () => {
    it('returns green for low density', () => {
      expect(getDensitySeverity(1.5)).toBe('green');
    });
    it('returns yellow for medium density', () => {
      expect(getDensitySeverity(2.5)).toBe('yellow');
    });
    it('returns orange for high density', () => {
      expect(getDensitySeverity(4.5)).toBe('orange');
    });
    it('returns red for extreme density', () => {
      expect(getDensitySeverity(6)).toBe('red');
    });
  });

  describe('getWaitTimeCategory', () => {
    it('returns green for under 5 minutes', () => {
      expect(getWaitTimeCategory(3)).toBe('green');
    });
    it('returns yellow for 5 to 15 minutes', () => {
      expect(getWaitTimeCategory(10)).toBe('yellow');
      expect(getWaitTimeCategory(15)).toBe('yellow');
    });
    it('returns red for over 15 minutes', () => {
      expect(getWaitTimeCategory(18)).toBe('red');
    });
  });
});
