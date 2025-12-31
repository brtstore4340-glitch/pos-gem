import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

// ดึงค่า Config จาก Environment Variables (.env.local)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// ตรวจสอบว่ามีค่า Config หรือไม่
if (!firebaseConfig.apiKey) {
  console.warn('⚠️ Firebase Config is missing. Please check .env.local');
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const functions = getFunctions(app, 'asia-southeast1');

export { app, db, functions };
