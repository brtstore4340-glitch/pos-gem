function normalizeGroup(g) {
  if (g === "primary" || g === "secondary" || g === "admin") return g;
  return "primary";
}

function normalizeMode(m) {
  if (
    m === "append_end" ||
    m === "before_ref" ||
    m === "after_ref" ||
    m === "at_index"
  )
    return m;
  return "append_end";
}

export function applyPlacement(items, group) {
  const filtered = (items || [])
    .filter(
      (i) =>
        (i.enabled ?? true) &&
        normalizeGroup(i?.placement?.group ?? i.group) === group,
    )
    .sort((a, b) => Number(a.order ?? 9999) - Number(b.order ?? 9999));

  const result = [];
  const seen = new Set();

  for (const item of filtered) {
    if (!item?.id) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);

    const placement = item.placement || {};
    const mode = normalizeMode(placement.mode);
    const refId = placement.refId ?? null;
    const atIndex = placement.index ?? null;

    if (mode === "append_end") {
      result.push(item);
      continue;
    }

    if ((mode === "before_ref" || mode === "after_ref") && refId) {
      const idx = result.findIndex((x) => x.id === refId);
      if (idx === -1) result.push(item);
      else result.splice(mode === "before_ref" ? idx : idx + 1, 0, item);
      continue;
    }

    if (mode === "at_index") {
      const idx = Number.isInteger(atIndex) ? atIndex : null;
      if (idx === null || idx < 0 || idx > result.length) result.push(item);
      else result.splice(idx, 0, item);
      continue;
    }

    result.push(item);
  }

  return result;
}

export function resolveMenus({ staticMenus = [], dynamicMenus = [] }) {
  const all = [...staticMenus, ...dynamicMenus];
  return {
    primary: applyPlacement(all, "primary"),
    secondary: applyPlacement(all, "secondary"),
    admin: applyPlacement(all, "admin"),
  };
}
