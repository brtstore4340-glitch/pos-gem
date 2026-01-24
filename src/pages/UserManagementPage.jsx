import React, { useCallback, useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { createManagedUser, updateManagedUser } from "../services/authService";

const ROLE_OPTIONS = ["admin", "SM-SGM", "user"];

export default function UserManagementPage() {
  const { firebaseUser, role } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
    allowedMenusText: "",
  });

  const canManage = role === "admin" || role === "SM-SGM";

  const scopeQuery = useMemo(() => {
    const base = collection(db, "users");
    if (role === "SM-SGM" && firebaseUser && firebaseUser.uid) {
      return query(base, where("createdByUid", "==", firebaseUser.uid), limit(200));
    }
    return query(base, limit(200));
  }, [role, firebaseUser]);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const snap = await getDocs(scopeQuery);
      const rows = [];
      snap.forEach((d) => rows.push(d.data()));
      rows.sort((a, b) => String(a.username || "").localeCompare(String(b.username || "")));
      setItems(rows);
    } catch (err) {
      setError(err && err.message ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, [scopeQuery]);

  useEffect(() => {
    if (!canManage) return;
    load();
  }, [canManage, load]);

  async function onCreate(e) {
    e.preventDefault();
    setError("");
    try {
      const allowedMenus = String(form.allowedMenusText || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      await createManagedUser({
        username: form.username,
        email: form.email,
        password: form.password,
        role: form.role,
        allowedMenus,
      });

      setForm({ username: "", email: "", password: "", role: "user", allowedMenusText: "" });
      await load();
    } catch (err) {
      setError(err && err.message ? err.message : "Create user failed");
    }
  }

  async function onQuickUpdate(u, patch) {
    setError("");
    try {
      await updateManagedUser({ uid: u.uid, ...patch });
      await load();
    } catch (err) {
      setError(err && err.message ? err.message : "Update failed");
    }
  }

  if (!canManage) {
    return <div style={{ padding: 16 }}>Access denied.</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>User Management</h2>
      {error ? <div style={{ color: "crimson", margin: "10px 0" }}>{error}</div> : null}

      <div style={{ border: "1px solid #ddd", padding: 12, marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Create User</h3>
        <form onSubmit={onCreate}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label>username</label>
              <input
                value={form.username}
                onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <div>
              <label>email</label>
              <input
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <div>
              <label>password</label>
              <input
                value={form.password}
                onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                type="password"
                style={{ width: "100%", padding: 8 }}
              />
            </div>
            <div>
              <label>role</label>
              <select
                value={form.role}
                onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
                style={{ width: "100%", padding: 8 }}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 10 }}>
            <label>allowedMenus (comma-separated)</label>
            <input
              value={form.allowedMenusText}
              onChange={(e) => setForm((s) => ({ ...s, allowedMenusText: e.target.value }))}
              style={{ width: "100%", padding: 8 }}
              placeholder="e.g. dashboard,inventory,reports"
            />
          </div>
          <button style={{ marginTop: 10, padding: "8px 12px" }} type="submit">
            Create
          </button>
        </form>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h3 style={{ margin: 0 }}>Users</h3>
        <button onClick={load} disabled={loading} style={{ padding: "6px 10px" }}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      <div style={{ marginTop: 10, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>username</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>email</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>role</th>
              <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>allowedMenus</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u.uid}>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{u.username}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{u.email}</td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  <select
                    value={u.role || "user"}
                    onChange={(e) => onQuickUpdate(u, { role: e.target.value })}
                    style={{ padding: 6 }}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                  <input
                    defaultValue={Array.isArray(u.allowedMenus) ? u.allowedMenus.join(",") : ""}
                    onBlur={(e) =>
                      onQuickUpdate(u, {
                        allowedMenus: String(e.target.value || "")
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    style={{ width: 320, padding: 6 }}
                  />
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 12, color: "#666" }}>
                  No users found in scope.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
