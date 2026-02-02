export function normalizePin(pin) {
  const s = String(pin ?? "").trim();
  if (!/^\d{4}$/.test(s)) throw new Error("PIN must be exactly 4 digits");
  return s;
}

function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function hashPinPBKDF2(pin, saltB64, iterations = 120000) {
  const p = normalizePin(pin);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(p), "PBKDF2", false, ["deriveBits"]);
  const salt = saltB64 ? b64ToBuf(saltB64) : crypto.getRandomValues(new Uint8Array(16)).buffer;

  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    keyMaterial,
    256
  );

  return { saltB64: bufToB64(salt), hashB64: bufToB64(bits), iterations };
}

export async function verifyPin(pin, { saltB64, hashB64, iterations }) {
  const res = await hashPinPBKDF2(pin, saltB64, iterations);
  return res.hashB64 === hashB64;
}