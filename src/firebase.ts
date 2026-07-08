import { initializeApp } from 'firebase/app';
import { 
  getAuth,
  onAuthStateChanged as fbOnAuthStateChanged,
  signInWithEmailAndPassword as fbSignInWithEmailAndPassword,
  createUserWithEmailAndPassword as fbCreateUserWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile as fbUpdateProfile
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// SQLite Mode Detection Helper
export const isSqliteMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const force = localStorage.getItem('DB_MODE');
  if (force === 'sqlite') return true;
  if (force === 'firebase') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || window.navigator.userAgent.includes('Electron');
};

// Local Auth state simulation
const localAuthListeners: ((user: any) => void)[] = [];
let localCurrentUser: any = null;

// Helper to load saved local user on module load
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('local_auth_user');
  if (saved) {
    try {
      localCurrentUser = JSON.parse(saved);
    } catch (e) {}
  }
}

// Proxy wrapper for onAuthStateChanged
export const onAuthStateChanged = (authObj: any, callback: (user: any) => void) => {
  if (isSqliteMode()) {
    localAuthListeners.push(callback);
    // Call immediately with current state asynchronously
    setTimeout(() => {
      callback(localCurrentUser);
    }, 0);
    return () => {
      const idx = localAuthListeners.indexOf(callback);
      if (idx !== -1) localAuthListeners.splice(idx, 1);
    };
  } else {
    return fbOnAuthStateChanged(authObj, callback);
  }
};

// Proxy wrapper for signInWithEmailAndPassword
export const signInWithEmailAndPassword = async (authObj: any, emailOrUsername: string, password: string) => {
  if (isSqliteMode()) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: emailOrUsername, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Invalid credentials');
    }
    const data = await res.json();
    localCurrentUser = data.user;
    localStorage.setItem('local_auth_user', JSON.stringify(data.user));
    localAuthListeners.forEach(listener => listener(localCurrentUser));
    return { user: localCurrentUser };
  } else {
    return fbSignInWithEmailAndPassword(authObj, emailOrUsername, password);
  }
};

// Proxy wrapper for createUserWithEmailAndPassword
export const createUserWithEmailAndPassword = async (authObj: any, emailOrUsername: string, password: string) => {
  if (isSqliteMode()) {
    const username = emailOrUsername.split('@')[0] || emailOrUsername;
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email: emailOrUsername, password, displayName: username })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create user');
    }
    const data = await res.json();
    localCurrentUser = data.user;
    localStorage.setItem('local_auth_user', JSON.stringify(data.user));
    localAuthListeners.forEach(listener => listener(localCurrentUser));
    return { user: localCurrentUser };
  } else {
    return fbCreateUserWithEmailAndPassword(authObj, emailOrUsername, password);
  }
};

// Proxy wrapper for signOut
export const signOut = async (authObj: any) => {
  if (isSqliteMode()) {
    localCurrentUser = null;
    localStorage.removeItem('local_auth_user');
    localAuthListeners.forEach(listener => listener(null));
    return;
  } else {
    return fbSignOut(authObj);
  }
};

// Proxy wrapper for updateProfile
export const updateProfile = async (userObj: any, profile: { displayName?: string, photoURL?: string }) => {
  if (isSqliteMode()) {
    if (localCurrentUser) {
      localCurrentUser = { ...localCurrentUser, ...profile };
      localStorage.setItem('local_auth_user', JSON.stringify(localCurrentUser));
      localAuthListeners.forEach(listener => listener(localCurrentUser));
    }
    return;
  } else {
    return fbUpdateProfile(userObj, profile);
  }
};

// Test connection
async function testConnection() {
  if (isSqliteMode()) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client is offline.");
    }
  }
}

testConnection();
