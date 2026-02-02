import React, { useEffect, useState } from "react";
import { getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { listProfiles, profileRef, setWelcomeMessage } from "../authDb";
import { hashPinPBKDF2, normalizePin } from "../pinCrypto";

export default function AdminSettings() {
  const { fbUser } = useAuth();

  const [profiles, setProfiles] = useState([]);
  const [welcome, setWelcome] = useState("ยินดีต้อนรับ");

  const [newId, setNewId] = useState("staff1");
  const [newRole, setNewRole] = useState("staff");
  const [newName, setNewName] = useState("Staff 1");

  const [tmpPin, setTmpPin] = useState("0000");
  const [msg, setMsg] = useState("");

  async function refresh() {
    if (!fbUser) return;
    const p = await listProfiles(fbUser.uid);
    setProfiles(p);
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!fbUser) return;
      const p = await listProfiles(fbUser.uid);
      if (!mounted) return;
      setProfiles(p);
    })();
    return () => { mounted = false; };
  }, [fbUser, msg]);

  if (!fbUser) return null;

  async function onSaveWelcome() {
    await setWelcomeMessage(fbUser.uid, welcome);
    setMsg("Saved welcome message");
  }

  async function onCreateProfile() {
    setMsg("");
    const id = String(newId || "").trim();
    if (!id) return setMsg("Profile id required");

    const ref = profileRef(fbUser.uid, id);
    const snap = await getDoc(ref);
    if (snap.exists()) return setMsg("Profile id already exists");

    normalizePin(tmpPin);
    const hashed = await hashPinPBKDF2(tmpPin);

    await setDoc(ref, {
      role: newRole,
      displayName: newName,
      disabled: false,
      mustChangePin: true,
      pinSaltB64: hashed.saltB64,
      pinHashB64: hashed.hashB64,
      pinIterations: hashed.iterations,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    setMsg("Created profile (must change PIN on first login)");
    await refresh();
  }

  async function onResetPin(id) {
    normalizePin(tmpPin);
    const hashed = await hashPinPBKDF2(tmpPin);

    await updateDoc(profileRef(fbUser.uid, id), {
      pinSaltB64: hashed.saltB64,
      pinHashB64: hashed.hashB64,
      pinIterations: hashed.iterations,
      mustChangePin: true,
      updatedAt: serverTimestamp(),
    });

    setMsg("Reset PIN (force change PIN) for " + id);
    await refresh();
  }

  async function onToggleDisable(id, disabled) {
    await updateDoc(profileRef(fbUser.uid, id), { disabled: !!disabled, updatedAt: serverTimestamp() });
    setMsg("Updated " + id);
    await refresh();
  }

  return (
    <div style={{ maxWidth: 860, margin: "24px auto", padding: 16 }}>
      <h2>Admin Settings</h2>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ fontWeight: 700 }}>Welcome message</div>
        <textarea value={welcome} onChange={(e) => setWelcome(e.target.value)} rows={3} style={{ width: "100%", marginTop: 8, padding: 10 }} />
        <button onClick={onSaveWelcome} style={{ marginTop: 8, padding: 10 }}>Save</button>
      </div>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Create profile (supervisor/staff/admin)</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label>Profile ID</label>
            <input value={newId} onChange={(e) => setNewId(e.target.value)} style={{ width: "100%", padding: 10 }} />
          </div>
          <div>
            <label>Role</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)} style={{ width: "100%", padding: 10 }}>
              <option value="staff">staff</option>
              <option value="supervisor">supervisor</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div>
            <label>Display name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: "100%", padding: 10 }} />
          </div>
          <div>
            <label>Temp PIN (4 digits)</label>
            <input value={tmpPin} onChange={(e) => setTmpPin(e.target.value)} inputMode="numeric" style={{ width: "100%", padding: 10 }} />
          </div>
        </div>

        <button onClick={onCreateProfile} style={{ marginTop: 10, padding: 10 }}>
          Create (force change PIN)
        </button>
      </div>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginTop: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Profiles</div>

        <div style={{ display: "grid", gap: 10 }}>
          {profiles.map(p => (
            <div key={p.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {p.displayName || p.id} <span style={{ opacity: 0.7 }}>({p.id})</span>
                  </div>
                  <div style={{ opacity: 0.8 }}>role: {p.role} {p.disabled ? "(disabled)" : ""}</div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => onResetPin(p.id)} style={{ padding: 8 }}>Reset PIN</button>
                  <button onClick={() => onToggleDisable(p.id, !p.disabled)} style={{ padding: 8 }}>
                    {p.disabled ? "Enable" : "Disable"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {msg && <div style={{ marginTop: 10, color: "green" }}>{msg}</div>}
      </div>
    </div>
  );
}