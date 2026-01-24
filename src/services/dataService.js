import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Fetch documents from a Firestore collection.
 * @param {string} path - Collection path (e.g., 'products')
 * @returns {{ success: boolean, data: any[], error?: string }}
 */
export async function fetchData(path) {
  try {
    const snap = await getDocs(collection(db, path));
    const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return { success: true, data };
  } catch (error) {
    console.error('fetchData error:', error);
    return { success: false, data: [], error: error?.message || 'Unknown error' };
  }
}

// Add more data access helpers as needed.
