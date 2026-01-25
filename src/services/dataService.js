import {
  collection,
  getDocs,
  limit,
  query,
  startAfter,
} from "firebase/firestore";
import { db } from "../firebase";

/**
 * Fetch documents from a Firestore collection.
 * @param {string} path - Collection path (e.g., 'products')
 * @param {object} [options]
 * @param {number} [options.limit=200] - Max docs per page.
 * @param {import('firebase/firestore').QueryDocumentSnapshot} [options.cursor]
 * @returns {{ success: boolean, data: any[], nextCursor: any, error?: string }}
 */
export async function fetchData(path, options = {}) {
  try {
    const pageSize = Number(options.limit || 200);
    const cursor = options.cursor || null;
    const base = query(collection(db, path), limit(pageSize));
    const qy = cursor
      ? query(collection(db, path), startAfter(cursor), limit(pageSize))
      : base;
    const snap = await getDocs(qy);
    const data = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const nextCursor =
      snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;
    return { success: true, data, nextCursor };
  } catch (error) {
    console.error("fetchData error:", error);
    return {
      success: false,
      data: [],
      nextCursor: null,
      error: error?.message || "Unknown error",
    };
  }
}

// Add more data access helpers as needed.
