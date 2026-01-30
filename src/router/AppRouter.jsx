import * as React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

import { HomePage } from "@/pages/HomePage";
import { PosPage } from "@/pages/PosPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "pos", element: <PosPage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "orders", element: <OrdersPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
