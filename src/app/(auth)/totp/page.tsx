"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, AdminApiError } from "@/lib/admin-api";
import { getCookie } from "@/lib/admin-auth";
import { ShieldCheck, AlertTriangle, ArrowLeft } from "lucide-react";

const CODE_LENGTH = 6;

export default function TotpPage() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const email =
    typeof window !== "undefined" ? sessionStorage.getItem("admin_totp_email") ?? "" : "";
  const next =
    typeof window !== "undefined"
      ? sessionStorage.getItem("admin_totp_next") ?? "/dashboard"
      : "/dashboard";

  // If no pending token → back to login
  useEffect(() => {
    const pending = getCookie("admin_totp_pending");
    if (!pending) {
      router.replace("/login");
    }
    // Focus first input
    inputRefs.current[0]?.focus();
  }, [router]);

  function handleDigitChange(index: number, value: string) {
    // Accept paste of full code
    if (value.length === CODE_LENGTH && /^\d+$/.test(value)) {
      const newDigits = value.split("");
      setDigits(newDigits);
      inputRefs.current[CODE_LENGTH - 1]?.focus();
      submitCode(newDigits.join(""));
      return;
    }

    const digit = value.replace(/\D/g, "").slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits filled
    if (newDigits.every(d => d !== "") && newDigits.join("").length === CODE_LENGTH) {
      submitCode(newDigits.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace") {
      if (digits[index] === "" && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = "";
        setDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = "";
        setDigits(newDigits);
      }
    }
    if (e.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  async function submitCode(code: string) {
    const pendingToken = getCookie("admin_totp_pending");
    if (!pendingToken) {
      router.replace("/login");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { access_token, expires_in } = await authApi.totpVerify(pendingToken, code);
      // Backend sets admin_token on its own origin (localhost:8000).
      // We also set it here for the Next.js origin (localhost:3001) so the
      // middleware can read it. In production both origins are the same domain.
      document.cookie = `admin_token=${access_token}; path=/; SameSite=Strict; max-age=${expires_in}`;
      // Clear the pending token and session storage
      document.cookie = "admin_totp_pending=; path=/; max-age=0";
      sessionStorage.removeItem("admin_totp_email");
      sessionStorage.removeItem("admin_totp_next");
      router.replace(next);
    } catch (err) {
      setLoading(false);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputRefs.current[0]?.focus();

      if (err instanceof AdminApiError) {
        if (err.status === 400 || err.status === 401) {
          setError("Invalid code. Please check your authenticator app.");
        } else if (err.status === 429) {
          setError("Too many attempts. Please wait and try again.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Network error. Please try again.");
      }
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg)" }}
    >
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
            <ShieldCheck className="w-7 h-7" style={{ color: "var(--accent)" }} />
          </div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            Two-Factor Auth
          </h1>
          {email && (
            <p className="text-sm mt-1" style={{ color: "var(--text-3)" }}>
              Signing in as{" "}
              <span style={{ color: "var(--text-2)" }}>{email}</span>
            </p>
          )}
        </div>

        {/* Card */}
        <div className="panel p-8">
          <p className="text-sm mb-6 text-center" style={{ color: "var(--text-2)" }}>
            Enter the 6-digit code from your authenticator app
            (Google Authenticator, Authy, etc.)
          </p>

          {error && (
            <div
              className="flex items-start gap-3 p-3 rounded-xl mb-6 text-sm"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.20)",
                color: "#fca5a5",
              }}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* TOTP digit inputs */}
          <div className="flex gap-3 justify-center mb-8">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={CODE_LENGTH} // allow paste
                value={digit}
                onChange={e => handleDigitChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={loading}
                className="w-12 h-14 text-center text-xl font-mono font-bold rounded-xl transition-all"
                style={{
                  background: digit ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.06)",
                  border: `2px solid ${digit ? "rgba(99,102,241,0.7)" : "rgba(255,255,255,0.18)"}`,
                  color: "var(--text-1)",
                  boxShadow: digit ? "0 0 0 3px rgba(99,102,241,0.15), inset 0 0 0 1px rgba(99,102,241,0.1)" : "none",
                  outline: "none",
                  caretColor: "var(--accent)",
                }}
              />
            ))}
          </div>

          {/* Loading indicator */}
          {loading && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <span
                className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{
                  borderColor: "rgba(99,102,241,0.3)",
                  borderTopColor: "var(--accent)",
                }}
              />
              <span className="text-sm" style={{ color: "var(--text-3)" }}>
                Verifying…
              </span>
            </div>
          )}

          {/* Manual submit (if auto-submit didn't fire) */}
          {!loading && (
            <button
              onClick={() => submitCode(digits.join(""))}
              disabled={digits.some(d => d === "")}
              className="btn-primary w-full justify-center py-3"
            >
              Verify & Sign In
            </button>
          )}
        </div>

        {/* Back link */}
        <button
          onClick={() => router.push("/login")}
          className="flex items-center gap-1.5 text-xs mx-auto mt-4"
          style={{ color: "var(--text-3)" }}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to login
        </button>
      </div>
    </div>
  );
}
