export function isMenuAllowed({ uid, roles, access }) {
  // Deny-by-default policy: if no access control is defined, menu is restricted
  // (Set access: { defaultRoles: [...], allowedRoles: [...], allowedUsers: [...] } to grant access)
  if (!access) return false;

  const allowedUsers = Array.isArray(access.allowedUsers)
    ? access.allowedUsers
    : [];
  if (uid != null && allowedUsers.includes(uid)) return true;

  const defaultRoles = Array.isArray(access.defaultRoles)
    ? access.defaultRoles
    : [];
  const allowedRoles = Array.isArray(access.allowedRoles)
    ? access.allowedRoles
    : [];

  const allowed = new Set([...defaultRoles, ...allowedRoles]);
  const userRoles = Array.isArray(roles) ? roles : [];

  for (const r of userRoles) {
    if (allowed.has(r)) return true;
  }
  return false;
}
