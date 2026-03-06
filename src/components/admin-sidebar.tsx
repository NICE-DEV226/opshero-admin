"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Braces,
  GitPullRequest,
  Users,
  BrainCog,
  TrendingUp,
  CreditCard,
  ShieldAlert,
  Megaphone,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Terminal,
  CircleDot,
  Mail,
  MessageSquare,
} from "lucide-react";
import { authApi } from "@/lib/admin-api";
import { getAdminSession, sessionExpiresIn } from "@/lib/admin-auth";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard",      icon: LayoutDashboard },
  { href: "/patterns",  label: "Patterns",       icon: Braces },
  { href: "/contributions", label: "Contributions", icon: GitPullRequest, badge: "7" },
  { href: "/users",     label: "Users",          icon: Users },
  { href: "/llm",       label: "LLM / Costs",    icon: BrainCog },
  { href: "/learning",  label: "Auto-Learning",  icon: TrendingUp },
  { href: "/feedback",  label: "Feedback",       icon: MessageSquare },
  { href: "/billing",   label: "Billing",        icon: CreditCard },
  { href: "/audit",     label: "Audit Log",      icon: ShieldAlert },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/config",    label: "Config",         icon: Settings },
  { href: "/email",     label: "Email",          icon: Mail },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const session = getAdminSession();

  async function handleLogout() {
    try { await authApi.logout(); } catch { /* ignore */ }
    document.cookie = "admin_token=; path=/; max-age=0";
    window.location.href = "/login";
  }

  return (
    <aside
      className="flex flex-col h-full transition-all duration-300"
      style={{
        width: collapsed ? "72px" : "240px",
        background: "var(--surface)",
        borderRight: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-4"
        style={{ borderBottom: "1px solid var(--border)", minHeight: "64px" }}
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
          style={{
            background: "rgba(99,102,241,0.12)",
            border: "1px solid rgba(99,102,241,0.25)",
          }}
        >
          <Terminal className="w-4 h-4" style={{ color: "var(--accent)" }} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <div className="font-display font-bold text-sm leading-tight" style={{ color: "var(--text-1)" }}>
              OpsHero
            </div>
            <div className="text-xs" style={{ color: "var(--accent)" }}>
              Admin Panel
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="ml-auto flex-shrink-0 rounded-md p-1 transition-colors"
          style={{ color: "var(--text-3)" }}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Online indicator */}
      {!collapsed && (
        <div
          className="flex items-center gap-2 px-4 py-2 text-xs"
          style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)" }}
        >
          <CircleDot className="w-3 h-3" style={{ color: "#22c55e" }} />
          Online · Session expires in {sessionExpiresIn()}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`admin-nav-link${active ? " active" : ""}`}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{label}</span>
                  {badge && (
                    <span
                      className="ml-auto text-xs px-1.5 py-0.5 rounded-md font-semibold"
                      style={{
                        background: "rgba(99,102,241,0.15)",
                        color: "var(--accent)",
                        border: "1px solid rgba(99,102,241,0.25)",
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User + logout */}
      <div style={{ borderTop: "1px solid var(--border)" }} className="p-2">
        {!collapsed && session && (
          <div className="px-3 py-2 mb-1">
            <div className="text-xs font-medium truncate" style={{ color: "var(--text-1)" }}>
              {session.full_name || session.email}
            </div>
            <div
              className="text-xs capitalize"
              style={{ color: session.role === "super_admin" ? "var(--accent)" : "var(--text-3)" }}
            >
              {session.role.replace("_", " ")}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="admin-nav-link w-full text-left"
          title={collapsed ? "Sign out" : undefined}
          style={{ color: "var(--text-3)" }}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
