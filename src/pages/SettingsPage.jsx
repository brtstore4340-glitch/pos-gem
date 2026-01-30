import * as React from "react";
import { useNavigate } from "react-router-dom";
import AdminSettings from "@/components/AdminSettings";

export function SettingsPage() {
  const navigate = useNavigate();

  return (
    <AdminSettings
      variant="page"
      onBack={() => navigate("/pos")}
    />
  );
}
