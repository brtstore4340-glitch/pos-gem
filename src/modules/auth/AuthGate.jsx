
import { useAuth } from "./AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import GoogleSignIn from "@/components/auth/GoogleSignIn";
import IdPinLogin from "@/components/auth/IdPinLogin";
import PinReset from "@/components/auth/PinReset";

export function AuthGate({ children }) {
  const { firebaseUser, session, loading, authLoading, reason } = useAuth();

  // Show loading spinner while checking auth state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <LoadingSpinner label="Preparing secure session..." />
      </div>
    );
  }

  if (reason === "firebase-not-configured" || reason === "firebase-auth-init-failed") {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-xl rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <h2 className="text-lg font-semibold">Application configuration error</h2>
          <p className="mt-2 text-sm">
            Firebase authentication is not available in this deployment. Please verify hosting build environment variables
            (`VITE_FIREBASE_*`) and redeploy.
          </p>
        </div>
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

  return <>{children}</>;
}

export default AuthGate;

