import React, { useEffect, useMemo, useState } from "react";
import { onSnapshot } from "firebase/firestore";
import { useAuth } from "../AuthContext";
import { accountRef, pingDatabase } from "../authDb";

export default function UpdateInfo() {
  const { fbUser, selectedProfile, logout, endAllSessions } = useAuth();
  const [dbState, setDbState] = useState({ status: "connecting", message: "… กำลังเชื่อมต่อฐานข้อมูล …" });
  const [welcome, setWelcome] = useState("");

  useEffect(() => {
    let mounted = true;
    async function ping() {
      try {
        setDbState({ status: "connecting", message: "… กำลังเชื่อมต่อฐานข้อมูล …" });
        await pingDatabase();
        if (!mounted) return;
        setDbState({ status: "ok", message: "เชื่อมต่อฐานข้อมูลสำเร็จแล้ว" });
      } catch {
        if (!mounted) return;
        setDbState({ status: "error", message: "เชื่อมต่อฐานข้อมูลไม่สำเร็จ" });
      }
    }
    ping();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!fbUser) return;
    const unsub = onSnapshot(accountRef(fbUser.uid), (snap) => {
      const data = snap.data() || {};
      setWelcome(String(data.welcomeMessage || "ยินดีต้อนรับ"));
    });
    return () => unsub();
  }, [fbUser]);

  const color = useMemo(() => dbState.status === "ok" ? "green" : (dbState.status === "error" ? "crimson" : "#444"), [dbState.status]);

  if (!fbUser || !selectedProfile) return null;

  return (
    <div style={{ maxWidth: 760, margin: "24px auto", padding: 16 }}>
      <h2>Update Info</h2>

      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>System status</div>
        <div style={{ color }}>{dbState.message}</div>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Welcome</div>
        <div>{welcome}</div>

        <div style={{ opacity: 0.8, marginTop: 8 }}>
          user: <b>{selectedProfile.displayName || selectedProfile.id}</b> | role: <b>{selectedProfile.role}</b>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        {selectedProfile.role === "admin" && (
          <a href="/admin/settings" style={{ padding: 10, border: "1px solid #ddd", borderRadius: 8, textDecoration: "none" }}>
            Admin Settings
          </a>
        )}
        <button onClick={() => endAllSessions()} style={{ padding: 10 }}>
          End session (all devices)
        </button>
        <button onClick={() => logout("logout")} style={{ padding: 10 }}>
          Logout
        </button>
      </div>

      <div style={{ marginTop: 18, opacity: 0.7, fontSize: 13 }}>
        * Idle auto logout: 15 นาที
      </div>
    </div>
  );
}