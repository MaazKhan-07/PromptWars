/**
 * FlowSphere — Gemini AI Service
 * Handles all Gemini API calls with rate limiting and error handling
 */
import { checkRateLimit, getSafeErrorMessage, sanitizeHTML } from '../utils/security.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Get API key from environment variable — never hardcode
const getApiKey = () => {
  try {
    return import.meta.env?.VITE_GEMINI_API_KEY || '';
  } catch {
    return '';
  }
};

// Mock mode when no API key is available
const isMockMode = () => !getApiKey() || getApiKey() === 'your_gemini_api_key_here';

/**
 * Call Gemini API with rate limiting
 * @param {string} prompt - The prompt text
 * @param {string} rateLimitKey - Unique key for rate limiting this call
 * @returns {Promise<{text: string, fromMock: boolean}>}
 */
export const callGeminiAPI = async (prompt, rateLimitKey = 'gemini-default') => {
  // Rate limit: max 1 request per 3 seconds per key
  const { allowed, remainingMs } = checkRateLimit(rateLimitKey, 3000);
  if (!allowed) {
    return {
      text: null,
      error: `Please wait ${Math.ceil(remainingMs / 1000)} seconds before trying again.`,
      rateLimited: true,
      remainingMs,
      fromMock: false
    };
  }

  if (isMockMode()) {
    return getMockResponse(prompt);
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${getApiKey()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';

    return { text: sanitizeHTML(text), fromMock: false };
  } catch (error) {
    const safeMsg = getSafeErrorMessage(error, 'AI analysis');
    // Fallback to mock on error
    const mock = getMockResponse(prompt);
    return { ...mock, fallbackError: safeMsg };
  }
};

// ─── Context-Specific AI Functions ───

/**
 * Get crowd intelligence insight (Tab 1)
 */
export const getCrowdIntelligence = async (crowdData) => {
  const prompt = `You are FlowSphere AI, an intelligent stadium crowd management system analyzing Wankhede Stadium, Mumbai.

Current crowd data:
${JSON.stringify(crowdData, null, 2)}

Based on this data, provide a brief (2-3 sentences) actionable crowd intelligence insight. Include:
- Which areas show concerning density
- Recommended action for gate operators
- Predicted crowd movement in the next 10 minutes

Be specific with gate names and section references.`;

  return callGeminiAPI(prompt, 'crowd-intelligence');
};

/**
 * Get gate recommendation (Tab 2)
 */
export const getGateRecommendation = async (gateData, currentGate) => {
  const prompt = `You are FlowSphere AI. A visitor is at ${currentGate} which is congested.

Current gate wait times:
${JSON.stringify(gateData, null, 2)}

Recommend the best alternative gate in 2-3 sentences. Include the gate name, current wait time, and walking directions from ${currentGate}.`;

  return callGeminiAPI(prompt, `gate-rec-${currentGate}`);
};

/**
 * Smart Arrival Planner (Tab 2)
 */
export const getSmartArrivalPlan = async (seatSection, arrivalTime) => {
  const prompt = `You are FlowSphere AI. Plan the optimal arrival for a visitor to Wankhede Stadium, Mumbai.

Details:
- Seat Section: ${sanitizeHTML(seatSection)}
- Planned Arrival Time: ${sanitizeHTML(arrivalTime)}

Provide a personalized recommendation including:
1. Best gate to use based on proximity to their section
2. Estimated walk time from gate to seat
3. Recommended arrival buffer time
4. Best parking zone if driving

Keep it concise (4-5 sentences).`;

  return callGeminiAPI(prompt, 'arrival-planner');
};

/**
 * Demand forecasting for concessions (Tab 3)
 */
export const getDemandForecast = async (matchPhase, orderHistory) => {
  const prompt = `You are FlowSphere AI analyzing F&B demand at Wankhede Stadium.

Current match phase: ${sanitizeHTML(matchPhase)}
Recent order trends: ${JSON.stringify(orderHistory, null, 2)}

Predict F&B demand for the next 15 minutes:
- Which items will surge in demand?
- Which kitchen stations should prepare?
- Is a specific zone likely to see increased orders?

Give 2-3 actionable predictions.`;

  return callGeminiAPI(prompt, 'demand-forecast');
};

/**
 * Risk assessment for safety (Tab 4)
 */
export const getRiskAssessment = async (zoneData) => {
  const prompt = `You are FlowSphere AI performing a safety risk assessment for Wankhede Stadium.

Current zone status:
${JSON.stringify(zoneData, null, 2)}

Provide a risk briefing:
1. Overall risk level (LOW / MODERATE / ELEVATED / HIGH)
2. Top 2 zones of concern with reasons
3. Recommended preemptive actions for security staff
4. Any predicted escalation scenarios

Be specific and actionable. 4-5 sentences.`;

  return callGeminiAPI(prompt, 'risk-assessment');
};

/**
 * Journey planner for attendee (Tab 6)
 */
export const getJourneyPlan = async (seatNumber, transportMode) => {
  const prompt = `You are FlowSphere AI creating a personalized event day timeline for a visitor to Wankhede Stadium, Mumbai.

Details:
- Seat: ${sanitizeHTML(seatNumber)}
- Transport: ${sanitizeHTML(transportMode)}

Create a timeline with:
1. Departure recommendation from home
2. Arrival at venue with best gate
3. Pre-order window for F&B
4. When to take seat
5. Half-time concession recommendation
6. Post-match departure strategy

Format as a bullet-point timeline.`;

  return callGeminiAPI(prompt, 'journey-planner');
};

// ─── Mock Responses ───
function getMockResponse(prompt) {
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes('crowd') && lowerPrompt.includes('intelligence')) {
    return {
      text: 'Section C (North Stand) is showing 15% higher density than the 60-minute average — currently at 4.2 persons/m². Recommend opening the Gate 7 alternate corridor to redistribute flow from Gates 5-6. Predictive model indicates a further 20% density increase in the next 10 minutes as half-time approaches.',
      fromMock: true
    };
  }
  if (lowerPrompt.includes('gate') && lowerPrompt.includes('recommend')) {
    return {
      text: 'Gate 4 currently has the shortest wait at 3 minutes with only 45% capacity utilization. From your current position at Gate 2, head south along Concourse B — approximately 4-minute walk. Gate 4 has dedicated express lanes currently open.',
      fromMock: true
    };
  }
  if (lowerPrompt.includes('arrival') || lowerPrompt.includes('planner')) {
    return {
      text: 'For Section 114, Gate 3 is your optimal entry with a 2-minute walk to your seat. Arrive by 6:15 PM to take advantage of the early-entry loyalty bonus (+50 Flow Points). If driving, Parking Zone P2 offers the shortest route to Gate 3. Allow 10-minute buffer for security screening.',
      fromMock: true
    };
  }
  if (lowerPrompt.includes('demand') || lowerPrompt.includes('f&b')) {
    return {
      text: 'Expect 40% surge in hot beverage orders in the next 15 minutes as the innings break approaches. Kitchen Station B should pre-prepare 200+ chai/coffee units. Sections D-F typically drive highest concession traffic during breaks — alert delivery runners in those zones.',
      fromMock: true
    };
  }
  if (lowerPrompt.includes('risk') || lowerPrompt.includes('safety')) {
    return {
      text: 'Overall risk level: MODERATE. Zone 3 (East Concourse) shows elevated density at 4.8 persons/m² with rising trend — recommend positioning 2 additional marshals near exits 3A/3B. Zone 7 (VIP approach) cleared below threshold. No anomalous counter-flow patterns detected currently, but predictive model flags a 15% probability of congestion at Gate 1 post-match.',
      fromMock: true
    };
  }
  if (lowerPrompt.includes('journey') || lowerPrompt.includes('timeline')) {
    return {
      text: '• 5:00 PM — Depart from home (allow 45 min for traffic on Marine Drive)\n• 5:45 PM — Arrive at Parking Zone P2\n• 5:55 PM — Enter via Gate 3 (estimated wait: 2 min)\n• 6:00 PM — Pre-order window opens for half-time F&B delivery\n• 6:10 PM — Take your seat in Section 114\n• 7:30 PM — Half-time: collect pre-order at Pickup Point C\n• 9:15 PM — Match ends: staggered exit Wave 2 via Gate 3 (depart at 9:20 PM)',
      fromMock: true
    };
  }

  return {
    text: 'FlowSphere AI analysis complete. Based on current venue conditions, all systems are operating within normal parameters. No immediate action required. Continue monitoring real-time feeds for updates.',
    fromMock: true
  };
}
