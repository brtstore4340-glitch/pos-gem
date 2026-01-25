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

// Validate Firebase config at startup
function validateFirebaseConfig() {
  const requiredKeys = [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId"
  ];

  const missingKeys = requiredKeys.filter(key => !firebaseConfig[key]);

  if (missingKeys.length > 0) {
    const errorMsg = `Firebase config validation failed. Missing required environment variables:\n  ${missingKeys.map(k => `VITE_FIREBASE_${k.replace(/([A-Z])/g, "_$1").toUpperCase()}`).join("\n  ")}\n\nEnsure your .env.local or .env.production file defines all required Firebase config values.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
}

// Validate on import
validateFirebaseConfig();

const firebaseRegion = import.meta.env.VITE_FIREBASE_REGION || "asia-southeast1";

export { firebaseConfig, firebaseRegion };
