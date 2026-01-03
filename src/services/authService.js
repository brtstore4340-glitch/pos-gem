import { auth, googleProvider } from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.warn('Auth persistence error:', error?.code || error?.message || error);
});

/**
 * Sign in with Google
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return { success: true, data: result.user, error: null };
  } catch (error) {
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, googleProvider);
      return { success: true, data: null, error: null };
    }

    let userMessage = error.message;
    if (error.code === 'auth/unauthorized-domain') {
      userMessage = 'This domain is not authorized in Firebase Console.';
    } else if (error.code === 'auth/operation-not-allowed') {
      userMessage = 'Google Sign-In is not enabled in Firebase Console.';
    } else if (error.code === 'auth/invalid-api-key') {
      userMessage = 'Invalid API key. Check your Firebase configuration.';
    }

    return { success: false, data: null, error: `${error.code}: ${userMessage}` };
  }
}

/**
 * Handle redirect result after Google Sign-In
 * Call this on app initialization
 */
export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    
    if (result) {
      console.log('✅ Google Sign-In successful!', {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName
      });
      return { success: true, data: result.user, error: null };
    }
    
    // No redirect result (normal page load)
    return { success: true, data: null, error: null };
  } catch (error) {
    console.error('Redirect Result Error:', error);
    return { success: false, data: null, error: error.message };
  }
}

/**
 * Sign in with email and password
 */
export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { success: true, data: userCredential.user, error: null };
  } catch (error) {
    return { success: false, data: null, error: error.message };
  }
}

/**
 * Sign out
 */
export async function logout() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get current user
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Listen to auth state changes
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

