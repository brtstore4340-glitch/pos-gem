import { onRequest } from "firebase-functions/v2/https";
import { onInit } from "firebase-functions/v2";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { initializeApp } from "firebase-admin/app";

setGlobalOptions({ region: "asia-southeast1" });

/**
 * Best practice:
 * Avoid heavy initialization at module load time.
 * Firebase recommends using onInit() to defer slow init during deploy discovery.
 */
let _appInitialized = false;

onInit(() => {
  if (!_appInitialized) {
    initializeApp();
    _appInitialized = true;
  }
});

export const health = onRequest((req, res) => {
  res.status(200).json({ ok: true, service: "boots-pos-gemini-functions" });
});
