export function isMenuAllowed({ uid, roles, access }) {
  if (!access) return true;

  const allowedUsers = Array.isArray(access.allowedUsers) ? access.allowedUsers : [];
  if (uid && allowedUsers.includes(uid)) return true;

  const defaultRoles = Array.isArray(access.defaultRoles) ? access.defaultRoles : [];
  const allowedRoles = Array.isArray(access.allowedRoles) ? access.allowedRoles : [];

  const allowed = new Set([...defaultRoles, ...allowedRoles]);
  const userRoles = Array.isArray(roles) ? roles : [];

  for (const r of userRoles) {
    if (allowed.has(r)) return true;
  }
  return false;
}
