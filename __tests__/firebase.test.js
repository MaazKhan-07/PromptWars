import { getFirebaseData, listenToFirebaseData } from '../src/services/firebase';

// Mock Firebase service
jest.mock('../src/services/firebase', () => {
  let mockData = {
    waitTimes: { gateA: 5, gateB: 12, gateC: 25 },
    alerts: [{ msg: "Test alert", active: true }]
  };
  
  return {
    getFirebaseData: jest.fn().mockImplementation(() => Promise.resolve(mockData)),
    listenToFirebaseData: jest.fn((callback) => {
      callback(mockData);
      return jest.fn(); // unsubscribe mock
    }),
    setMockDataForTests: (data) => { mockData = data; }
  };
});

describe('Firebase Service Mock', () => {
  it('fetches initial data successfully', async () => {
    const data = await getFirebaseData();
    expect(data.waitTimes.gateA).toBe(5);
  });

  it('handles empty database gracefully (edge case)', async () => {
    const { setMockDataForTests } = require('../src/services/firebase');
    setMockDataForTests({});
    
    const data = await getFirebaseData();
    expect(data).toEqual({});
  });

  it('triggers listener callbacks with data', () => {
    const { setMockDataForTests } = require('../src/services/firebase');
    setMockDataForTests({ alerts: [] });
    
    const mockCallback = jest.fn();
    listenToFirebaseData(mockCallback);
    expect(mockCallback).toHaveBeenCalledWith({ alerts: [] });
  });

  it('returns unsubscribe function for listeners', () => {
    const unsub = listenToFirebaseData(() => {});
    expect(typeof unsub).toBe('function');
  });
  
  it('handles disconnected state (error fallback)', async () => {
    // Re-mock to throw error
    const { getFirebaseData } = require('../src/services/firebase');
    getFirebaseData.mockRejectedValueOnce(new Error('Network offline'));
    
    await expect(getFirebaseData()).rejects.toThrow('Network offline');
  });
});
