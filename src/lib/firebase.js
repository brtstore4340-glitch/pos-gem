import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

// ดึงค่า Config จาก Environment Variables (.env.local)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// ?? DEBUG: Log Firebase configuration
console.log('?? Firebase Config Debug:', {
  hasApiKey: !!firebaseConfig.apiKey,
  hasAuthDomain: !!firebaseConfig.authDomain,
  hasProjectId: !!firebaseConfig.projectId,
  authDomain: firebaseConfig.authDomain,
  projectId: firebaseConfig.projectId,
});

// ตรวจสอบว่ามีค่า Config หรือไม่
if (!firebaseConfig.apiKey) {
  console.error('? Firebase Config is missing. Please check .env.local');
  console.error('Available env vars:', Object.keys(import.meta.env));
}

// ป้องกันการ initialize ซ้ำระหว่าง HMR (Vite)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app, 'asia-southeast1');
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Configure Google provider
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// App Check (reCAPTCHA Enterprise)
const appCheckSiteKey = import.meta.env.VITE_APPCHECK_SITE_KEY;
let appCheck = null;
if (appCheckSiteKey) {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true
  });
} else {
  console.warn('⚠️ App Check site key missing (VITE_APPCHECK_SITE_KEY). App Check not initialized.');
}

export { app, db, functions, auth, googleProvider, appCheck };
