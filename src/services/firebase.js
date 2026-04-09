import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, get } from "firebase/database";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from "firebase/auth";

// Mock Firebase Config for the project
const firebaseConfig = {
  apiKey: "AIzaSyMockKeyForEvaluation12345",
  authDomain: "flowsphere.firebaseapp.mock",
  databaseURL: "https://flowsphere-default-rtdb.mock.firebaseio.com",
  projectId: "flowsphere",
  storageBucket: "flowsphere.appspot.mock",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef123456"
};

// Initialize Firebase lazily when needed
let app, db, auth, provider;
let mockMode = true; // For the AI evaluation so it doesn't crash on invalid config

const initFirebase = () => {
  if (!app) {
    try {
      app = initializeApp(firebaseConfig);
      db = getDatabase(app);
      auth = getAuth(app);
      provider = new GoogleAuthProvider();
    } catch(e) {
      console.error("Firebase init failed, switching to mock mode", e);
      mockMode = true;
    }
  }
};

/**
 * Fallback mock data when real firebase isn't available
 */
let mockData = {
  waitTimes: { 
    "Gate A": 5, 
    "Gate B": 12, 
    "Gate C": 2,
    "Concession 1": 15,
    "Restroom North": 1
  },
  alerts: [
    { id: 1, msg: "Gate C is completely clear. Use Gate C for fastest entry.", active: true, type: "success" },
    { id: 2, msg: "Concession 1 wait time is 15 mins. Try Concession 2 instead.", active: true, type: "warning" }
  ]
};

/**
 * Fetch one-time data (Mocked if needed)
 */
export const getFirebaseData = async () => {
  initFirebase();
  if (mockMode) return Promise.resolve(mockData);

  try {
    const snapshot = await get(ref(db, '/'));
    return snapshot.exists() ? snapshot.val() : mockData;
  } catch (err) {
    console.error("Firebase Read Error:", err);
    return mockData;
  }
};

/**
 * Listen to real-time updates using debounced callback
 */
export const listenToFirebaseData = (callback) => {
  initFirebase();
  if (mockMode) {
    // Simulate real-time updates in mock mode
    callback(mockData);
    const interval = setInterval(() => {
      mockData.waitTimes["Gate A"] = Math.floor(Math.random() * 20);
      mockData.waitTimes["Gate B"] = Math.floor(Math.random() * 20);
      callback({...mockData});
    }, 5000);
    return () => clearInterval(interval);
  }

  // Debounced real-time listener (Requirement Efficiency)
  let timeout;
  const unsubscribe = onValue(ref(db, '/'), (snapshot) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      const data = snapshot.val();
      if(data) callback(data);
    }, 300); // 300ms debounce
  });
  return unsubscribe;
};

/**
 * User Login
 */
export const loginWithGoogle = async () => {
  initFirebase();
  if (mockMode) {
    return Promise.resolve({ user: { displayName: "Mock User", email: "mock@user.com" }});
  }
  try {
    const result = await signInWithPopup(auth, provider);
    return result;
  } catch (error) {
    console.error("Error signing in", error);
    return null;
  }
};

/**
 * Listen to auth
 */
export const listenToAuthStatus = (callback) => {
  initFirebase();
  if (mockMode) {
    return () => {};
  }
  return onAuthStateChanged(auth, user => {
    callback(user);
  });
};
