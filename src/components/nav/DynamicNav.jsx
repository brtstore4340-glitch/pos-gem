import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useResolvedMenus } from "../../features/uiMenus/hooks";

const DEFAULT_STATIC_MENUS = [
  { id: "home", label: "Home", route: "/", group: "primary", order: 0 },
];

export default function DynamicNav({ db, auth, staticMenus = DEFAULT_STATIC_MENUS }) {
  const { resolved, loading } = useResolvedMenus({ db, auth, staticMenus, pageSize: 100, enabled: true });
  const loc = useLocation();

  function renderGroup(title, items) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{title}</div>
        <nav className="flex flex-col gap-1">
          {(items || []).map((m) => {
            const active = loc.pathname === m.route;
            return (
              <Link
                key={m.id}
                to={m.route}
                className={[
                  "rounded px-3 py-2 focus:outline-none focus:ring",
                  active ? "bg-gray-200" : "hover:bg-gray-100",
                ].join(" ")}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <aside className="p-3 space-y-4">
      {loading ? <div className="text-sm opacity-70">Loading menus…</div> : null}
      {renderGroup("Primary", resolved.primary)}
      {renderGroup("Secondary", resolved.secondary)}
      {renderGroup("Admin", resolved.admin)}
    </aside>
  );
}
