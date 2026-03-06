/**
 * Admin auth helpers — client-side JWT decode + cookie management.
 * Full JWT verification happens server-side (backend FastAPI or Next.js API route).
 */

export interface AdminPermissions {
  can_manage_patterns: boolean;
  can_review_contributions: boolean;
  can_manage_users: boolean;
  can_view_billing: boolean;
  can_manage_config: boolean;
  can_delete_users: boolean;
}

export interface AdminSession {
  id: string;
  email: string;
  full_name: string;
  role: "super_admin" | "admin" | "analyst";
  permissions: AdminPermissions;
  exp: number;
  jti: string;
}

const COOKIE_NAME = "admin_token";
const TOTP_PENDING_COOKIE = "admin_totp_pending";

// ── Cookie helpers ─────────────────────────────────────────────────────────

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()!.split(";").shift() ?? null;
  return null;
}

export function getAdminToken(): string | null {
  return getCookie(COOKIE_NAME);
}

/** Reads the short-lived pending token used between /login and /totp steps */
export function getTotpPendingToken(): string | null {
  return getCookie(TOTP_PENDING_COOKIE);
}

/**
 * Decode the admin JWT payload without verifying signature.
 * Real verification happens on the backend for every API call.
 */
export function decodeToken(token: string): AdminSession | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    // Backend JWT uses "sub" for the admin ID — map it to "id" for the interface.
    if (!payload.id && payload.sub) {
      payload.id = payload.sub;
    }
    return payload as AdminSession;
  } catch {
    return null;
  }
}

/** Get decoded session from the admin_token cookie. Returns null if missing or expired. */
export function getAdminSession(): AdminSession | null {
  const token = getAdminToken();
  if (!token) return null;
  const session = decodeToken(token);
  if (!session) return null;
  // Check expiry client-side as a fast-path (backend enforces authoritatively)
  if (session.exp && session.exp < Math.floor(Date.now() / 1000)) return null;
  return session;
}

export function isLoggedIn(): boolean {
  return getAdminSession() !== null;
}

export function isSuperAdmin(): boolean {
  return getAdminSession()?.role === "super_admin";
}

export function hasPermission(key: keyof AdminPermissions): boolean {
  const session = getAdminSession();
  if (!session) return false;
  if (session.role === "super_admin") return true;
  return session.permissions?.[key] ?? false;
}

/** Format session expiry as a human-readable string */
export function sessionExpiresIn(): string {
  const session = getAdminSession();
  if (!session) return "Expired";
  const diff = session.exp * 1000 - Date.now();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
