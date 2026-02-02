import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { profileRef } from "../authDb";
import { hashPinPBKDF2, normalizePin } from "../pinCrypto";

export default function ChangePin() {
  const nav = useNavigate();
  const { fbUser, selectedProfile, setSelectedProfile } = useAuth();

  const [pin1, setPin1] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!fbUser || !selectedProfile) return null;

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      normalizePin(pin1);
      normalizePin(pin2);
      if (pin1 !== pin2) throw new Error("PIN ไม่ตรงกัน");

      const hashed = await hashPinPBKDF2(pin1);

      await updateDoc(profileRef(fbUser.uid, selectedProfile.id), {
        pinSaltB64: hashed.saltB64,
        pinHashB64: hashed.hashB64,
        pinIterations: hashed.iterations,
        mustChangePin: false,
        updatedAt: serverTimestamp(),
      });

      setSelectedProfile({ ...selectedProfile, mustChangePin: false });
      nav("/update-info", { replace: true });

    } catch (ex) {
      setErr(ex?.message || "Change PIN failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h2>Change PIN</h2>
      <p style={{ opacity: 0.8, marginTop: 0 }}>First login requires PIN change</p>

      <form onSubmit={onSubmit}>
        <label>New PIN</label>
        <input
          value={pin1}
          onChange={(e) => setPin1(e.target.value)}
          inputMode="numeric"
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        />

        <label>Confirm PIN</label>
        <input
          value={pin2}
          onChange={(e) => setPin2(e.target.value)}
          inputMode="numeric"
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        />

        {err && <div style={{ color: "crimson" }}>{err}</div>}

        <button disabled={busy} style={{ width: "100%", padding: 12, marginTop: 12 }}>
          {busy ? "Saving..." : "Save PIN"}
        </button>
      </form>
    </div>
  );
}