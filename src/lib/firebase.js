import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
import { firebaseConfig, firebaseRegion } from '../config/firebaseConfig';

const firebaseConfigured = Boolean(
  firebaseConfig?.apiKey &&
  firebaseConfig?.authDomain &&
  firebaseConfig?.projectId
);

// Force App Check on (ignore env override unless explicitly disabled in code).
const __ENABLE_APPCHECK__ =
  String(import.meta.env.VITE_ENABLE_APPCHECK ?? 'false').toLowerCase() === 'true';

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

if (!firebaseConfigured) {
  console.error('❌ Firebase Config is missing. Please check env files');
  console.error('Available env vars:', Object.keys(import.meta.env));
}

// Prevent double init (Vite HMR)
const app = firebaseConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;

const db = app ? getFirestore(app) : null;
const functions = app ? getFunctions(app, firebaseRegion) : null;
const auth = app ? getAuth(app) : null;
const storage = app ? getStorage(app) : null;

const googleProvider = auth ? new GoogleAuthProvider() : null;
if (googleProvider) {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

// App Check (reCAPTCHA v3) — gated by VITE_ENABLE_APPCHECK
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
const appCheckProviderKind = (import.meta.env.VITE_APPCHECK_PROVIDER || 'enterprise').toLowerCase();
let appCheck = null;

const initAppCheck = async () => {
  if (!app) return null;
  if (!__ENABLE_APPCHECK__) {
    console.warn('⚠️ App Check is disabled (VITE_ENABLE_APPCHECK=false).');
    return null;
  }

  // DEBUG ONLY (prints a debug token in console; add it in Firebase Console > App Check > Debug tokens)
  if (import.meta.env.DEV) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN ?? true;
  }

  if (!appCheckSiteKey) {
    console.warn('⚠️ App Check enabled but VITE_APPCHECK_SITE_KEY is missing. App Check not initialized.');
    return null;
  }

  try {
    const { initializeAppCheck, ReCaptchaV3Provider, ReCaptchaEnterpriseProvider } = await import('firebase/app-check');
    const provider =
      appCheckProviderKind === 'enterprise'
        ? new ReCaptchaEnterpriseProvider(appCheckSiteKey)
        : new ReCaptchaV3Provider(appCheckSiteKey);

    appCheck = initializeAppCheck(app, {
      provider,
      isTokenAutoRefreshEnabled: true,
    });
    return appCheck;
  } catch (err) {
    console.error('❌ Failed to initialize Firebase App Check:', err);
    return null;
  }
};

void initAppCheck();

export { app, db, functions, auth, storage, googleProvider, appCheck, firebaseConfigured };
// dev-only diagnostics
if (import.meta?.env?.DEV) {
  window.__APP_DIAG__ = window.__APP_DIAG__ || {};
  window.__APP_DIAG__.firebaseProjectId = firebaseConfig?.projectId;
}
