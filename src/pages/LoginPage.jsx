import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(usernameOrEmail, password);
    } catch (err) {
      const msg = err && err.message ? err.message : "Login failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h2 style={{ marginBottom: 12 }}>Login</h2>
      <form onSubmit={onSubmit}>
        <label style={{ display: "block", marginBottom: 6 }}>
          Username or Email
        </label>
        <input
          value={usernameOrEmail}
          onChange={(e) => setUsernameOrEmail(e.target.value)}
          autoComplete="username"
          style={{ width: "100%", padding: 10, marginBottom: 12 }}
          placeholder="username หรอ email"
        />
        <label style={{ display: "block", marginBottom: 6 }}>
          Password
        </label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          style={{ width: "100%", padding: 10, marginBottom: 12 }}
          placeholder="password"
        />
        {error ? (
          <div style={{ color: "crimson", marginBottom: 12 }}>{error}</div>
        ) : null}
        <button type="submit" disabled={busy} style={{ padding: "10px 14px" }}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}