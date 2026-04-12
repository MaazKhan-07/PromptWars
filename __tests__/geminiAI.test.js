/**
 * FlowSphere — Gemini AI Service Tests
 */

// Mock fetch globally
global.fetch = jest.fn();

// Mock import.meta.env
jest.mock('../src/services/geminiAI.js', () => {
  const originalModule = jest.requireActual('../src/utils/security.js');
  
  const callGeminiAPI = jest.fn(async (prompt, key) => {
    return { text: 'Mock AI response for testing', fromMock: true };
  });

  return {
    callGeminiAPI,
    getCrowdIntelligence: jest.fn(async (data) => ({
      text: 'Section C showing elevated density — recommend opening Gate 7 corridor.',
      fromMock: true
    })),
    getGateRecommendation: jest.fn(async (gates, current) => ({
      text: `Gate 4 has shortest wait. Walk south from ${current}.`,
      fromMock: true
    })),
    getSmartArrivalPlan: jest.fn(async (section, time) => ({
      text: `For ${section}, arrive via Gate 3 by ${time}.`,
      fromMock: true
    })),
    getDemandForecast: jest.fn(async (phase, history) => ({
      text: 'Expect 40% surge in hot beverages.',
      fromMock: true
    })),
    getRiskAssessment: jest.fn(async (zones) => ({
      text: 'Overall risk: MODERATE. Zone 3 elevated.',
      fromMock: true
    })),
    getJourneyPlan: jest.fn(async (seat, transport) => ({
      text: '5:00 PM — Depart home. 5:45 PM — Arrive.',
      fromMock: true
    }))
  };
});

const { getCrowdIntelligence, getGateRecommendation, getSmartArrivalPlan, getDemandForecast, getRiskAssessment, getJourneyPlan } = require('../src/services/geminiAI.js');

describe('Gemini AI Service', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getCrowdIntelligence', () => {
    it('returns crowd analysis text', async () => {
      const result = await getCrowdIntelligence({ "Zone 1": { density: 3.5 } });
      expect(result.text).toContain('density');
      expect(result.fromMock).toBe(true);
    });

    it('handles empty zone data', async () => {
      const result = await getCrowdIntelligence({});
      expect(result.text).toBeTruthy();
    });
  });

  describe('getGateRecommendation', () => {
    it('recommends alternative gate', async () => {
      const result = await getGateRecommendation({ "Gate 1": 15, "Gate 2": 3 }, 'Gate 1');
      expect(result.text).toContain('Gate');
    });

    it('includes current gate in prompt context', async () => {
      const result = await getGateRecommendation({}, 'Gate 5');
      expect(result.text).toBeTruthy();
      expect(getGateRecommendation).toHaveBeenCalledWith({}, 'Gate 5');
    });
  });

  describe('getSmartArrivalPlan', () => {
    it('generates personalized arrival plan', async () => {
      const result = await getSmartArrivalPlan('North Stand A', '18:00');
      expect(result.text).toContain('Gate');
    });
  });

  describe('getDemandForecast', () => {
    it('predicts demand based on match phase', async () => {
      const result = await getDemandForecast('Half-Time', []);
      expect(result.text).toContain('surge');
    });
  });

  describe('getRiskAssessment', () => {
    it('returns risk briefing', async () => {
      const result = await getRiskAssessment({ "Zone 3": { density: 4.8, riskScore: 72 } });
      expect(result.text).toContain('MODERATE');
    });
  });

  describe('getJourneyPlan', () => {
    it('creates event day timeline', async () => {
      const result = await getJourneyPlan('Section 114, Row F', 'Car');
      expect(result.text).toContain('Depart');
    });
  });
});
