import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { profileRef } from "../authDb";
import { hashPinPBKDF2, verifyPin, normalizePin } from "../pinCrypto";

export default function EnterPin() {
  const nav = useNavigate();
  const { fbUser, selectedProfile, setSelectedProfile } = useAuth();

  const [pin, setPin] = useState("1234");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => selectedProfile ? `Enter PIN (${selectedProfile.displayName || selectedProfile.id})` : "Enter PIN", [selectedProfile]);

  if (!fbUser || !selectedProfile) return null;

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      const pRef = profileRef(fbUser.uid, selectedProfile.id);
      const snap = await getDoc(pRef);
      const data = snap.data() || {};

      // Starter: if hash missing, seed 1234 (still mustChangePin = true for first login)
      if (!data.pinHashB64 || !data.pinSaltB64 || !data.pinIterations) {
        const seeded = await hashPinPBKDF2("1234");
        await updateDoc(pRef, {
          pinSaltB64: seeded.saltB64,
          pinHashB64: seeded.hashB64,
          pinIterations: seeded.iterations,
          updatedAt: serverTimestamp(),
        });
        data.pinSaltB64 = seeded.saltB64;
        data.pinHashB64 = seeded.hashB64;
        data.pinIterations = seeded.iterations;
      }

      normalizePin(pin);

      const ok = await verifyPin(pin, {
        saltB64: data.pinSaltB64,
        hashB64: data.pinHashB64,
        iterations: data.pinIterations,
      });

      if (!ok) throw new Error("PIN ไม่ถูกต้อง");

      setSelectedProfile({ ...selectedProfile, ...data });

      if (data.mustChangePin) nav("/auth/change-pin", { replace: true });
      else nav("/update-info", { replace: true });

    } catch (ex) {
      setErr(ex?.message || "PIN failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h2>{title}</h2>
      <p style={{ opacity: 0.8, marginTop: 0 }}>PIN 4 หลัก</p>

      <form onSubmit={onSubmit}>
        <label>PIN</label>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          inputMode="numeric"
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        />

        {err && <div style={{ color: "crimson" }}>{err}</div>}

        <button disabled={busy} style={{ width: "100%", padding: 12, marginTop: 12 }}>
          {busy ? "Checking..." : "Continue"}
        </button>
      </form>
    </div>
  );
}