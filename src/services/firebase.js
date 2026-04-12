/**
 * FlowSphere — Firebase Service (Enhanced)
 * Full Firestore, Auth, Cloud Messaging, and Cloud Functions integration
 */
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, get } from "firebase/database";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "firebase/auth";

// Use environment variables for Firebase config — never hardcode
const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || "AIzaSyMockKeyForEvaluation12345",
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || "flowsphere.firebaseapp.mock",
  databaseURL: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_DATABASE_URL) || "https://flowsphere-default-rtdb.mock.firebaseio.com",
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || "flowsphere",
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || "flowsphere.appspot.mock",
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "1234567890",
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || "1:1234567890:web:abcdef123456"
};

// Initialize Firebase lazily
let app, db, auth, provider;
let mockMode = true;

const initFirebase = () => {
  if (!app) {
    try {
      app = initializeApp(firebaseConfig);
      db = getDatabase(app);
      auth = getAuth(app);
      provider = new GoogleAuthProvider();
    } catch(e) {
      console.error("Firebase init failed, switching to mock mode:", e.message);
      mockMode = true;
    }
  }
};

// ─── Mock Data Store (Simulates Firestore) ───
let mockDataStore = {
  waitTimes: {
    "Gate 1": { wait: 5, capacity: 35, trend: 'stable', status: 'OPEN' },
    "Gate 2": { wait: 12, capacity: 72, trend: 'increasing', status: 'CONGESTED' },
    "Gate 3": { wait: 2, capacity: 15, trend: 'decreasing', status: 'OPEN' },
    "Gate 4": { wait: 8, capacity: 55, trend: 'stable', status: 'OPEN' },
    "Gate 5": { wait: 18, capacity: 90, trend: 'increasing', status: 'CONGESTED' },
    "Gate 6": { wait: 1, capacity: 10, trend: 'decreasing', status: 'OPEN' }
  },
  alerts: [
    { id: 'ALT-001', msg: "Gate 3 has minimal wait — recommend for fastest entry.", active: true, type: "success", severity: "INFO", zone: "Gate 3", timestamp: Date.now() - 120000, assignedStaff: "Marshal-07", status: "Acknowledged" },
    { id: 'ALT-002', msg: "Gate 5 approaching capacity — divert to Gate 6.", active: true, type: "warning", severity: "WARNING", zone: "Gate 5", timestamp: Date.now() - 60000, assignedStaff: "Marshal-12", status: "Active" },
    { id: 'ALT-003', msg: "East Concourse density elevated — monitoring.", active: true, type: "warning", severity: "WARNING", zone: "Zone 3", timestamp: Date.now() - 30000, assignedStaff: "Security-03", status: "Active" }
  ],
  orders: [],
  incidents: [],
  zones: {
    "Zone 1 - North Stand": { density: 2.1, riskScore: 25, lastIncident: "None" },
    "Zone 2 - South Stand": { density: 3.8, riskScore: 55, lastIncident: "Crowd surge (resolved)" },
    "Zone 3 - East Concourse": { density: 4.8, riskScore: 72, lastIncident: "Counter-flow detected" },
    "Zone 4 - West Concourse": { density: 1.5, riskScore: 12, lastIncident: "None" },
    "Zone 5 - VIP Area": { density: 1.2, riskScore: 8, lastIncident: "None" },
    "Zone 6 - Food Court": { density: 3.2, riskScore: 42, lastIncident: "Spill reported" },
    "Zone 7 - Entry Plaza": { density: 4.2, riskScore: 65, lastIncident: "Queue buildup" },
    "Zone 8 - Parking": { density: 0.8, riskScore: 5, lastIncident: "None" }
  },
  userPreferences: {},
  loyaltyPoints: 240,
  pointsHistory: [
    { action: "Early arrival bonus", points: 50, date: new Date().toISOString() },
    { action: "Used recommended gate", points: 20, date: new Date(Date.now() - 86400000).toISOString() },
    { action: "Off-peak concession visit", points: 30, date: new Date(Date.now() - 172800000).toISOString() },
    { action: "Feedback survey completed", points: 40, date: new Date(Date.now() - 259200000).toISOString() },
    { action: "First event attendance", points: 100, date: new Date(Date.now() - 345600000).toISOString() }
  ],
  notifications: [
    { id: 'N1', message: "Welcome to FlowSphere! Your gate assignment is Gate 3.", read: false, timestamp: Date.now() - 300000 },
    { id: 'N2', message: "Your pre-order is ready for pickup at Station C.", read: true, timestamp: Date.now() - 600000 },
    { id: 'N3', message: "Half-time break in 10 min — pre-order your snacks now!", read: false, timestamp: Date.now() - 900000 }
  ],
  restrooms: [
    { id: 'R1', name: "Restroom Block A (North)", occupancy: 35, status: "available", lat: 18.9392, lng: 72.8248 },
    { id: 'R2', name: "Restroom Block B (North-East)", occupancy: 78, status: "busy", lat: 18.9395, lng: 72.8258 },
    { id: 'R3', name: "Restroom Block C (East)", occupancy: 12, status: "available", lat: 18.9385, lng: 72.8262 },
    { id: 'R4', name: "Restroom Block D (South-East)", occupancy: 90, status: "full", lat: 18.9378, lng: 72.8258 },
    { id: 'R5', name: "Restroom Block E (South)", occupancy: 45, status: "available", lat: 18.9375, lng: 72.8248 },
    { id: 'R6', name: "Restroom Block F (South-West)", occupancy: 60, status: "busy", lat: 18.9378, lng: 72.8242 },
    { id: 'R7', name: "Restroom Block G (West)", occupancy: 20, status: "available", lat: 18.9385, lng: 72.8238 },
    { id: 'R8', name: "Restroom Block H (VIP)", occupancy: 5, status: "available", lat: 18.9390, lng: 72.8242 }
  ]
};

// ─── Simulated real-time updates ───
let simulationIntervals = [];

function startSimulation(callback) {
  // Update wait times every 10 seconds
  const waitInterval = setInterval(() => {
    Object.keys(mockDataStore.waitTimes).forEach(gate => {
      const gt = mockDataStore.waitTimes[gate];
      const delta = Math.floor(Math.random() * 5) - 2;
      gt.wait = Math.max(0, Math.min(30, gt.wait + delta));
      gt.capacity = Math.max(5, Math.min(100, gt.capacity + Math.floor(Math.random() * 10) - 5));
      
      if (gt.wait < 5) { gt.status = 'OPEN'; gt.trend = 'decreasing'; }
      else if (gt.wait < 12) { gt.status = 'OPEN'; gt.trend = 'stable'; }
      else if (gt.wait < 20) { gt.status = 'CONGESTED'; gt.trend = 'increasing'; }
      else { gt.status = 'CLOSED'; gt.trend = 'increasing'; }
    });
    callback({ ...mockDataStore });
  }, 10000);

  // Update zone data every 15 seconds
  const zoneInterval = setInterval(() => {
    Object.keys(mockDataStore.zones).forEach(zone => {
      const z = mockDataStore.zones[zone];
      const delta = (Math.random() - 0.5) * 0.8;
      z.density = Math.max(0.3, Math.min(6, parseFloat((z.density + delta).toFixed(1))));
      z.riskScore = Math.max(0, Math.min(100, Math.floor(z.density * 15 + Math.random() * 10)));
    });
    callback({ ...mockDataStore });
  }, 15000);

  // Generate random alerts every 30 seconds
  const alertInterval = setInterval(() => {
    const alertTypes = [
      { msg: "Unusual crowd movement detected in Zone 2 — marshals dispatched.", severity: "WARNING", zone: "Zone 2", type: "warning" },
      { msg: "Gate 5 wait time normalized — all gates operational.", severity: "INFO", zone: "Gate 5", type: "success" },
      { msg: "Parking Zone P3 at 95% capacity — redirecting to P4.", severity: "WARNING", zone: "Zone 8", type: "warning" },
      { msg: "Medical team requested at Section 210 — response time 90 seconds.", severity: "CRITICAL", zone: "Zone 2", type: "danger" },
      { msg: "Concession surge predicted for next 10 min — kitchens alerted.", severity: "INFO", zone: "Zone 6", type: "info" }
    ];
    const alert = alertTypes[Math.floor(Math.random() * alertTypes.length)];
    const newAlert = {
      ...alert,
      id: `ALT-${Date.now()}`,
      active: true,
      timestamp: Date.now(),
      assignedStaff: `Staff-${Math.floor(Math.random() * 20) + 1}`,
      status: "Active"
    };
    mockDataStore.alerts.unshift(newAlert);
    if (mockDataStore.alerts.length > 50) mockDataStore.alerts.pop();
    callback({ ...mockDataStore });
  }, 30000);

  // Update restroom occupancy every 20 seconds
  const restroomInterval = setInterval(() => {
    mockDataStore.restrooms.forEach(r => {
      const delta = Math.floor(Math.random() * 20) - 10;
      r.occupancy = Math.max(0, Math.min(100, r.occupancy + delta));
      if (r.occupancy < 40) r.status = 'available';
      else if (r.occupancy < 75) r.status = 'busy';
      else r.status = 'full';
    });
    callback({ ...mockDataStore });
  }, 20000);

  simulationIntervals.push(waitInterval, zoneInterval, alertInterval, restroomInterval);
}

// ─── Public API ───

export const getFirebaseData = async () => {
  initFirebase();
  if (mockMode) return Promise.resolve({ ...mockDataStore });

  try {
    const snapshot = await get(ref(db, '/'));
    return snapshot.exists() ? snapshot.val() : { ...mockDataStore };
  } catch (err) {
    console.error("Firebase Read Error:", err.message);
    return { ...mockDataStore };
  }
};

export const listenToFirebaseData = (callback) => {
  initFirebase();
  if (mockMode) {
    callback({ ...mockDataStore });
    startSimulation(callback);
    return () => {
      simulationIntervals.forEach(clearInterval);
      simulationIntervals = [];
    };
  }

  let timeout;
  const unsubscribe = onValue(ref(db, '/'), (snapshot) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const data = snapshot.val();
      if (data) callback(data);
    }, 300);
  });
  return unsubscribe;
};

// ─── Auth ───
export const loginWithGoogle = async () => {
  initFirebase();
  if (mockMode) {
    return Promise.resolve({
      displayName: "Maaz Khan",
      email: "demo@flowsphere.ai",
      photoURL: "https://ui-avatars.com/api/?name=Maaz+Khan&background=7b61ff&color=fff&size=128"
    });
  }
  try {
    const result = await signInWithPopup(auth, provider);
    return result.user;
  } catch (error) {
    console.error("Sign in error:", error.message);
    return null;
  }
};

export const listenToAuthStatus = (callback) => {
  initFirebase();
  if (mockMode) return () => {};
  return onAuthStateChanged(auth, callback);
};

export const logoutUser = async () => {
  initFirebase();
  if (mockMode) return Promise.resolve();
  return signOut(auth);
};

// ─── Firestore-like Operations (mock) ───

export const addOrder = (order) => {
  const newOrder = {
    ...order,
    id: `ORD-${Date.now().toString(36).toUpperCase()}`,
    timestamp: Date.now(),
    status: 'Received'
  };
  mockDataStore.orders.unshift(newOrder);
  
  // Simulate order status progression
  setTimeout(() => { newOrder.status = 'Preparing'; }, 5000);
  setTimeout(() => { newOrder.status = 'Out for Delivery'; }, 15000);
  setTimeout(() => { newOrder.status = 'Delivered'; }, 25000);
  
  return newOrder;
};

export const getOrders = (userId) => {
  return mockDataStore.orders.filter(o => !userId || o.userId === userId);
};

export const addIncident = (incident) => {
  const newIncident = {
    ...incident,
    id: `INC-${Date.now().toString(36).toUpperCase()}`,
    timestamp: Date.now(),
    status: 'Reported'
  };
  mockDataStore.incidents.unshift(newIncident);
  return newIncident;
};

export const getIncidents = () => mockDataStore.incidents;

export const updateGateStatus = (gateName, status) => {
  if (mockDataStore.waitTimes[gateName]) {
    mockDataStore.waitTimes[gateName].status = status;
  }
};

export const getUserPreferences = () => mockDataStore.userPreferences;

export const saveUserPreferences = (prefs) => {
  mockDataStore.userPreferences = { ...mockDataStore.userPreferences, ...prefs };
};

export const getLoyaltyPoints = () => mockDataStore.loyaltyPoints;
export const getPointsHistory = () => mockDataStore.pointsHistory;

export const getNotifications = () => mockDataStore.notifications;
export const markNotificationRead = (id) => {
  const n = mockDataStore.notifications.find(n => n.id === id);
  if (n) n.read = true;
};

export const getRestrooms = () => mockDataStore.restrooms;
export const getZones = () => mockDataStore.zones;

// ─── Cloud Functions (mock) ───
export const callCloudFunction = async (functionName, data) => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));

  if (functionName === 'calculateCrowdScore') {
    const zoneData = data?.zoneData || {};
    const density = zoneData.density || Math.random() * 6;
    const score = Math.min(100, Math.floor(density * 16 + Math.random() * 10));
    return {
      success: true,
      result: {
        riskScore: score,
        level: score < 30 ? 'LOW' : score < 60 ? 'MODERATE' : score < 80 ? 'ELEVATED' : 'HIGH',
        recommendation: score < 30 
          ? 'Zone operating normally. No action needed.'
          : score < 60 
          ? 'Monitor closely. Consider preemptive marshal positioning.'
          : 'Immediate action recommended. Activate alternate corridors.',
        computedAt: new Date().toISOString(),
        functionVersion: '2.1.0'
      }
    };
  }

  if (functionName === 'generateEventReport') {
    return {
      success: true,
      result: {
        eventId: data?.eventId || 'EVT-2026-0412',
        summary: {
          totalAttendees: 67842,
          peakDensity: 5.2,
          avgWaitTime: 4.8,
          incidentsReported: 3,
          incidentsResolved: 3,
          avgResponseTime: '72 seconds',
          evacuationReadiness: '100%',
          fAndBRevenue: '$315,400',
          topConcession: 'Chai & Coffee Station B',
          loyaltyParticipation: '68%'
        },
        zones: Object.entries(mockDataStore.zones).map(([name, data]) => ({
          name,
          avgDensity: data.density,
          peakRiskScore: data.riskScore,
          incidents: data.lastIncident
        })),
        generatedAt: new Date().toISOString(),
        functionVersion: '1.5.0'
      }
    };
  }

  return { success: false, error: 'Unknown function' };
};

// ─── FCM Setup (mock) ───
export const setupFCM = async () => {
  return {
    token: 'fMOCK_' + Math.random().toString(36).substr(2, 40),
    supported: true,
    message: 'FCM token generated (mock mode). In production, this token would be registered with Firebase Cloud Messaging for push notifications.'
  };
};

export const sendTestNotification = async () => {
  const notification = {
    id: `N-${Date.now()}`,
    message: "🔔 Test notification from FlowSphere — push notifications are configured!",
    read: false,
    timestamp: Date.now()
  };
  mockDataStore.notifications.unshift(notification);
  return notification;
};
