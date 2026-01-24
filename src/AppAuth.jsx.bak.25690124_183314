import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
<<<<<<< HEAD
=======
import UserManagementPage from "./pages/UserManagementPage";
>>>>>>> 96693dde7be30919d23ad1d88d01fd56886a787c
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
<<<<<<< HEAD
  const { loading, isAuthed, loginEmail } = useAuth();
=======
  const { loading, isAuthed, role, signOut, profile, firebaseUser } = useAuth();
  const [view, setView] = useState("app"); // "app" | "users"

  const canManage = useMemo(() => role === "admin" || role === "SM-SGM", [role]);
>>>>>>> 96693dde7be30919d23ad1d88d01fd56886a787c

  if (loading) return null;
  if (!isAuthed) {
    const handleLogin = async (email, password) => {
      const res = await loginEmail(email, password);
      if (!res?.success) {
        throw new Error(res?.error || "Login failed");
      }
    };
    return <LoginPage onLogin={handleLogin} />;
  }

<<<<<<< HEAD
  return <ErrorBoundary><ExistingApp /></ErrorBoundary>;
=======
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
>>>>>>> 96693dde7be30919d23ad1d88d01fd56886a787c
}
