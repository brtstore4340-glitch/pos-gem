import { useCallback, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { fetchUiMenusPage } from "./firestoreUiMenus";
import { isMenuAllowed } from "./rbac";
import { resolveMenus } from "./placement";

export function useUserClaimsRoles(auth) {
  const [uid, setUid] = useState(null);
  const [roles, setRoles] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!auth) return;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUid(null);
        setRoles([]);
        setReady(true);
        return;
      }

      setUid(user.uid);
      try {
        const token = await user.getIdTokenResult(true);
        const claimRoles = token?.claims?.roles;
        setRoles(Array.isArray(claimRoles) ? claimRoles : []);
      } finally {
        setReady(true);
      }
    });

    return () => unsub();
  }, [auth]);

  return { uid, roles, ready };
}

export function useUiMenus({ db, pageSize = 50, enabled = true }) {
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadFirst = useCallback(async () => {
    if (!db || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUiMenusPage(db, { pageSize, cursor: null });
      setItems(res.items || []);
      setHasMore(Boolean(res.hasMore));
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [db, enabled, pageSize]);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  return { items, loading, error, hasMore };
}

export function useResolvedMenus({
  db,
  auth,
  staticMenus = [],
  pageSize = 100,
  enabled = true,
}) {
  const { uid, roles, ready: authReady } = useUserClaimsRoles(auth);
  const {
    items: dynamicMenus,
    loading,
    error,
  } = useUiMenus({ db, pageSize, enabled });

  const filteredDynamic = useMemo(() => {
    if (!authReady) return [];
    return (dynamicMenus || [])
      .filter((m) => m.enabled ?? true)
      .filter((m) => isMenuAllowed({ uid, roles, access: m.access }))
      .map((m) => ({
        id: m.id,
        label: m.label,
        route: m.route,
        enabled: m.enabled,
        order: m.order,
        placement: m.placement,
        access: m.access,
        group: m?.placement?.group ?? "primary",
      }));
  }, [dynamicMenus, uid, roles, authReady]);

  const normalizedStatic = useMemo(() => {
    return (staticMenus || []).map((m) => ({
      id: m.id,
      label: m.label,
      route: m.route,
      enabled: m.enabled ?? true,
      order: m.order ?? 9999,
      placement: m.placement ?? {
        mode: "append_end",
        refId: null,
        index: null,
        group: m.group ?? "primary",
      },
      access: m.access ?? null,
      group: m.group ?? "primary",
    }));
  }, [staticMenus]);

  const resolved = useMemo(() => {
    return resolveMenus({
      staticMenus: normalizedStatic,
      dynamicMenus: filteredDynamic,
    });
  }, [normalizedStatic, filteredDynamic]);

  return { resolved, loading, error, uid, roles };
}
