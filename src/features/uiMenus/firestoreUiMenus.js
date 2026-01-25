import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
} from "firebase/firestore";

/**
 * Paginated read: limit + startAfter (1 query/page)
 */
export async function fetchUiMenusPage(db, opts = {}) {
  const pageSize = Number(opts.pageSize || 50);
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("pageSize must be a positive integer");
  }
  const cursor = opts.cursor || null;

  const col = collection(db, "ui_menus");
  const base = query(col, orderBy("order", "asc"), limit(pageSize));
  const qy = cursor
    ? query(col, orderBy("order", "asc"), startAfter(cursor), limit(pageSize))
    : base;

  const snap = await getDocs(qy);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const nextCursor =
    snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null;

  return { items, nextCursor, hasMore: snap.docs.length === pageSize };
}
