import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
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
  const { loading, isAuthed, loginEmail } = useAuth();

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

  return <ErrorBoundary><ExistingApp /></ErrorBoundary>;
}
