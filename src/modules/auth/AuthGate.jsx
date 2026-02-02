
import { useAuth } from "./AuthContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import GoogleSignIn from "@/components/auth/GoogleSignIn";
import IdPinLogin from "@/components/auth/IdPinLogin";
import PinReset from "@/components/auth/PinReset";
import { ServerStatus } from "@/components/ui/ServerStatus";

export function AuthGate({ children }) {
  const { firebaseUser, session, loading, authLoading } = useAuth();

  // Show loading spinner while checking auth state
  if (loading || authLoading) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
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

  return <>{children}</>;
}

export default AuthGate;

