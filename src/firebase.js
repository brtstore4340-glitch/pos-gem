import { browserLocalPersistence, setPersistence } from "firebase/auth";
import { firebaseConfig } from "./config/firebaseConfig";
import {
  app,
  auth,
  db,
  functions,
  googleProvider,
  appCheck,
  firebaseConfigured,
} from "./lib/firebase";

// Ensure auth state is kept across refresh
if (auth) {
  setPersistence(auth, browserLocalPersistence).catch(() => {
    /* ignore storage errors */
  });
}

export { app, auth, db, functions, googleProvider, appCheck, firebaseConfigured };
// dev-only diagnostics
if (import.meta?.env?.DEV) {
  window.__APP_DIAG__ = window.__APP_DIAG__ || {};
  window.__APP_DIAG__.firebaseProjectId = firebaseConfig?.projectId;
}
