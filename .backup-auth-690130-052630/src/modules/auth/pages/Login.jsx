import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

export default function Login() {
  const nav = useNavigate();
  const { login, requestPasswordReset } = useAuth();

  const [emailOrUsername, setEmailOrUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [remember, setRemember] = useState(true);

  const [err, setErr] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await login({ emailOrUsername, password, remember });
      nav("/auth/select-profile", { replace: true });
    } catch (ex) {
      setErr(ex?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword() {
    setErr(null);
    setMsg(null);
    try {
      await requestPasswordReset(emailOrUsername);
      setMsg("ส่งอีเมลรีเซ็ตรหัสผ่านแล้ว");
    } catch (ex) {
      setErr(ex?.message || "ส่งอีเมลรีเซ็ตไม่สำเร็จ");
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h2>Login</h2>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        Starter: user <b>admin</b> / pass <b>admin</b> / PIN <b>1234</b>
      </p>

      <form onSubmit={onSubmit}>
        <label>Username / Email</label>
        <input
          value={emailOrUsername}
          onChange={(e) => setEmailOrUsername(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        />

        <label>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10, margin: "6px 0 12px" }}
        />

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Remember me (default ON)
        </label>

        {msg && <div style={{ color: "green", marginTop: 10 }}>{msg}</div>}
        {err && <div style={{ color: "crimson", marginTop: 10 }}>{err}</div>}

        <button disabled={busy} style={{ width: "100%", padding: 12, marginTop: 12 }}>
          {busy ? "Signing in..." : "Sign in"}
        </button>

        <button type="button" onClick={onResetPassword} style={{ width: "100%", padding: 12, marginTop: 10 }}>
          Forgot password (send email)
        </button>
      </form>
    </div>
  );
}