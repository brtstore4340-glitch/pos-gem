import React from "react";
import { useAuth } from "../../context/AuthContext";
import GoogleSignIn from "./GoogleSignIn";
import IdPinLogin from "./IdPinLogin";
import PinReset from "./PinReset";
import LoadingSpinner from "../LoadingSpinner";

export default function AuthGate({ children }) {
  const { firebaseUser, authLoading, session } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-50">
        <LoadingSpinner label="Preparing secure session..." />
      </div>
    );
  }

  if (!firebaseUser) {
    return <GoogleSignIn />;
  }

  if (!session) {
    return <IdPinLogin />;
  }

  if (session.pinResetRequired) {
    return <PinReset />;
  }

  return children;
}
