import * as React from "react";
import { useNavigate } from "react-router-dom";
import PosUI from "@/components/PosUI";

export function PosPage() {
  const navigate = useNavigate();

  return (
    <PosUI
      onAdminSettings={() => navigate("/settings")}
      onSearch={() => navigate("/item-search")}
    />
  );
}
