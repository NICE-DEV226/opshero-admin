"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { authApi, AdminApiError } from "@/lib/admin-api";
import { Shield, Eye, EyeOff, AlertTriangle } from "lucide-react";

const schema = z.object({
  email: z.string().email("Valid email required"),
  password: z.string().min(1, "Password required"),
});
type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const [next, setNext] = useState("/dashboard");

  // Read ?next= param on client only (avoids useSearchParams + Suspense issues)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setNext(params.get("next") ?? "/dashboard");
  }, []);

  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    setServerError(null);
    try {
      const res = await authApi.login(data.email, data.password);
      document.cookie = `admin_totp_pending=${res.pending_token}; path=/; SameSite=Strict; max-age=300`;
      sessionStorage.setItem("admin_totp_email", data.email);
      sessionStorage.setItem("admin_totp_next", next);
      router.push("/totp");
    } catch (err) {
      if (err instanceof AdminApiError) {
        if (err.status === 429) {
          setServerError("Too many failed attempts. Account locked for 15 minutes.");
        } else if (err.status === 401 || err.status === 400) {
          setServerError("Invalid email or password.");
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError("Network error. Please try again.");
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative w-full max-w-md mx-auto px-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{
              background: "rgba(99,102,241,0.12)",
              border: "1px solid rgba(99,102,241,0.25)",
              boxShadow: "0 0 32px rgba(99,102,241,0.15)",
            }}
          >
            <Shield className="w-7 h-7" style={{ color: "var(--accent)" }} />
          </div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            OpsHero Admin
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
            Restricted access — authorized personnel only
          </p>
        </div>

        {/* Card */}
        <div className="panel p-8">
          <h2 className="font-display text-lg font-semibold mb-6" style={{ color: "var(--text-1)" }}>
            Sign in to Admin Panel
          </h2>

          {serverError && (
            <div
              className="flex items-start gap-3 p-3 rounded-xl mb-5 text-sm"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.20)",
                color: "#fca5a5",
              }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-2)" }}>
                Email address
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="admin@opshero.dev"
                {...register("email")}
                className="input"
                style={errors.email ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
              />
              {errors.email && (
                <p className="mt-1 text-xs" style={{ color: "#fca5a5" }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-2)" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  {...register("password")}
                  className="input pr-10"
                  style={errors.password ? { borderColor: "rgba(239,68,68,0.5)" } : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--text-3)" }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs" style={{ color: "#fca5a5" }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full justify-center py-3 mt-2"
            >
              {isSubmitting ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2 animate-spin"
                    style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
                  />
                  Verifying…
                </>
              ) : (
                "Continue to 2FA →"
              )}
            </button>
          </form>

          {/* Security note */}
          <p className="text-xs text-center mt-6" style={{ color: "var(--text-3)" }}>
            After password verification, you will need your TOTP authenticator app.
          </p>
        </div>

        {/* Footer */}
        <p className="text-xs text-center mt-6" style={{ color: "var(--text-3)" }}>
          All access attempts are logged and monitored.
        </p>
      </div>
    </div>
  );
}
