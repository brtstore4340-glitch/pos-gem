import * as React from "react";
import { AppRouter } from "@/router/AppRouter";
import { AuthGate } from "@/modules/auth/AuthGate";

export default function App() {
  return (
    <AuthGate>
      <AppRouter />
    </AuthGate>
  );
}