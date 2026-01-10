/* THAM_APPCHECK_DISABLED_NOTE: AppCheck is disabled via VITE_ENABLE_APPCHECK=false to unblock Admin Console. */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

const __ENABLE_APPCHECK__ = import.meta.env.VITE_ENABLE_APPCHECK === 'true';

// ดึงค่า Config จาก Environment Variables (.env.local / .env.production)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseRegion = import.meta.env.VITE_FIREBASE_REGION || 'asia-southeast1';

// DEBUG: Log Firebase configuration
console.log('🔥 Firebase Config Debug:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  hasProjectId: !!firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
  region: firebaseRegion,
  enableAppCheck: __ENABLE_APPCHECK__,
});

if (!firebaseConfig.apiKey) {
  console.error('❌ Firebase Config is missing. Please check env files');
  console.error('Available env vars:', Object.keys(import.meta.env));
}

// Prevent double init (Vite HMR)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const db = getFirestore(app);
const functions = getFunctions(app, firebaseRegion);
const auth = getAuth(app);
const storage = getStorage(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// App Check (reCAPTCHA v3) — gated by VITE_ENABLE_APPCHECK
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
let appCheck = null;

if (__ENABLE_APPCHECK__) {
  // DEBUG ONLY (prints a debug token in console; add it in Firebase Console > App Check > Debug tokens)
  if (import.meta.env.DEV) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN ?? true;
  }

  if (appCheckSiteKey) {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } else {
    console.warn('⚠️ App Check enabled but VITE_APPCHECK_SITE_KEY is missing. App Check not initialized.');
  }
} else {
  console.warn('⚠️ App Check is disabled (VITE_ENABLE_APPCHECK=false).');
}

export { app, db, functions, auth, storage, googleProvider, appCheck };
// dev-only diagnostics
if (import.meta?.env?.DEV) {
  window.__APP_DIAG__ = window.__APP_DIAG__ || {};
  window.__APP_DIAG__.firebaseProjectId = firebaseConfig?.projectId;
}
