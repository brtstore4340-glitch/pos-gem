import * as React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import ProtectedRoute from "@/modules/auth/ProtectedRoute";
import Login from "@/modules/auth/pages/Login";
import SelectProfile from "@/modules/auth/pages/SelectProfile";
import EnterPin from "@/modules/auth/pages/EnterPin";
import ChangePin from "@/modules/auth/pages/ChangePin";
import UpdateInfo from "@/modules/auth/pages/UpdateInfo";
import AdminSettings from "@/modules/auth/pages/AdminSettings";
import { HomePage } from "@/pages/HomePage";
import { PosPage } from "@/pages/PosPage";
import { ProductsPage } from "@/pages/ProductsPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { ReportsPage } from "@/pages/ReportsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ItemSearchPage } from "@/pages/ItemSearchPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

const router = createBrowserRouter([
  // Auth routes (public)
  { path: "/login", element: <Login /> },
  { path: "/auth/select-profile", element: <SelectProfile /> },
  { path: "/auth/pin", element: <EnterPin /> },
  { path: "/auth/change-pin", element: <ChangePin /> },

  // Post-login default page
  {
    path: "/update-info",
    element: (
      <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
        <UpdateInfo />
      </ProtectedRoute>
    )
  },

  // Admin settings
  {
    path: "/admin/settings",
    element: (
      <ProtectedRoute allowRoles={["admin"]}>
        <AdminSettings />
      </ProtectedRoute>
    )
  },

  // Main app (protected)
  {
    path: "/",
    element: (
      <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: (
          <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
            <HomePage />
          </ProtectedRoute>
        )
      },
      {
        path: "pos",
        element: (
          <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
            <PosPage />
          </ProtectedRoute>
        )
      },
      {
        path: "products",
        element: (
          <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
            <ProductsPage />
          </ProtectedRoute>
        )
      },
      {
        path: "orders",
        element: (
          <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
            <OrdersPage />
          </ProtectedRoute>
        )
      },
      {
        path: "reports",
        element: (
          <ProtectedRoute allowRoles={["admin", "supervisor"]}>
            <ReportsPage />
          </ProtectedRoute>
        )
      },
      {
        path: "settings",
        element: (
          <ProtectedRoute allowRoles={["admin"]}>
            <SettingsPage />
          </ProtectedRoute>
        )
      },
      {
        path: "item-search",
        element: (
          <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
            <ItemSearchPage />
          </ProtectedRoute>
        )
      },
      {
        path: "*",
        element: (
          <ProtectedRoute allowRoles={["admin", "supervisor", "staff"]}>
            <NotFoundPage />
          </ProtectedRoute>
        )
      }
    ]
  }
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}


