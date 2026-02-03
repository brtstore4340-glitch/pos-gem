import * as React from "react";
import { AppRouter } from "@/router/AppRouter";
import { AuthGate } from "@/modules/auth/AuthGate";
import { auth, db } from './src/firebase/config.js';

export default function App() {
  return (
    <AuthGate>
      <AppRouter />
    </AuthGate>
  );
}