// Centralized Firebase config used by client code.
// Values are sourced from Vite env vars; ensure .env.local or .env.production defines them.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const firebaseRegion = import.meta.env.VITE_FIREBASE_REGION || "asia-southeast1";

export { firebaseConfig, firebaseRegion };
