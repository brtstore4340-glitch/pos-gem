import React, { useMemo, useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import UserManagementPage from "./pages/UserManagementPage";
import ErrorBoundary from "./components/ErrorBoundary";
import ExistingApp from "./App";

export default function AppAuth() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { loading, isAuthed, role, signOut, profile, firebaseUser } = useAuth();
  const [view, setView] = useState("app"); // "app" | "users"

  const canManage = useMemo(() => role === "admin" || role === "SM-SGM", [role]);

  if (loading) return null;
  if (!isAuthed) return <LoginPage />;

  return (
    <div>
      <div style={{ padding: 12, borderBottom: "1px solid #ddd", display: "flex", gap: 12, alignItems: "center" }}>
        <div style={{ fontWeight: 700 }}>POS</div>
        <button onClick={() => setView("app")} style={{ padding: "6px 10px" }}>
          App
        </button>
        {canManage ? (
          <button onClick={() => setView("users")} style={{ padding: "6px 10px" }}>
            Users
          </button>
        ) : null}
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {profile && profile.username ? profile.username : ""} {role ? `(${role})` : ""}
          </div>
          <button onClick={signOut} style={{ padding: "6px 10px" }}>
            Logout
          </button>
        </div>
      </div>

      {/* auth debug */}
      <div style={{ padding: "6px 12px", fontSize: 12, opacity: 0.7 }}>
        uid: {firebaseUser ? firebaseUser.uid : "-"} | role: {role || "-"}
      </div>

      {view === "users" && canManage ? <ErrorBoundary><UserManagementPage /></ErrorBoundary> : <ErrorBoundary><ExistingApp /></ErrorBoundary>}
    </div>
  );
}
