import * as React from "react";
import { useNavigate } from "react-router-dom";
import ProductLookupModal from "@/components/ProductLookupModal";

export function ItemSearchPage() {
  const navigate = useNavigate();

  return (
    <ProductLookupModal
      variant="page"
      onClose={() => navigate("/pos")}
    />
  );
}
