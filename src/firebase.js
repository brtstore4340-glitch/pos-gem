import { browserLocalPersistence, setPersistence } from "firebase/auth";
import {
  app,
  auth,
  db,
  functions,
  googleProvider,
  appCheck,
} from "./lib/firebase";

// Ensure auth state is kept across refresh
setPersistence(auth, browserLocalPersistence).catch(() => {
  /* ignore storage errors */
});

export { app, auth, db, functions, googleProvider, appCheck };
