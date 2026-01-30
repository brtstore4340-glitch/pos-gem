import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { listProfiles } from "../authDb";

export default function SelectProfile() {
  const nav = useNavigate();
  const { fbUser, setSelectedProfile } = useAuth();

  const [profiles, setProfiles] = useState([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!fbUser) return;
      setBusy(true);
      setErr(null);
      try {
        const p = await listProfiles(fbUser.uid);
        if (!mounted) return;
        const enabled = p.filter(x => !x.disabled);
        setProfiles(enabled);

        if (enabled.length === 1) {
          setSelectedProfile({ id: enabled[0].id, ...enabled[0] });
          nav("/auth/pin", { replace: true });
        }
      } catch (ex) {
        setErr(ex?.message || "Failed to load profiles");
      } finally {
        setBusy(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [fbUser, nav, setSelectedProfile]);

  if (!fbUser) return null;
  if (busy) return <div style={{ padding: 16 }}>Loading profiles...</div>;
  if (err) return <div style={{ padding: 16, color: "crimson" }}>{err}</div>;

  return (
    <div style={{ maxWidth: 520, margin: "40px auto", padding: 16 }}>
      <h2>Select user</h2>

      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {profiles.map(p => (
          <button
            key={p.id}
            onClick={() => {
              setSelectedProfile({ id: p.id, ...p });
              nav("/auth/pin");
            }}
            style={{ padding: 12, textAlign: "left" }}
          >
            <div style={{ fontWeight: 700 }}>{p.displayName || p.id}</div>
            <div style={{ opacity: 0.8 }}>role: {p.role}</div>
          </button>
        ))}
      </div>
    </div>
  );
}