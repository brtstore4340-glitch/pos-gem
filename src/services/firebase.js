import { app } from "../lib/firebase";
import { firebaseConfig } from "../config/firebaseConfig";

export { app };

if (import.meta?.env?.DEV) {
  window.__APP_DIAG__ = window.__APP_DIAG__ || {};
  window.__APP_DIAG__.firebaseProjectId = firebaseConfig?.projectId;
}
