import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ allowRoles, children }) {
  const { fbUser, selectedProfile, authReady } = useAuth();

  if (!authReady) return null;
  if (!fbUser) return <Navigate to="/login" replace />;
  if (!selectedProfile) return <Navigate to="/auth/select-profile" replace />;

  if (Array.isArray(allowRoles) && allowRoles.length > 0) {
    if (!allowRoles.includes(selectedProfile.role)) return <Navigate to="/update-info" replace />;
  }

  return children;
}