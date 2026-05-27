"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Mail, Package, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const urlError = searchParams.get("error");

  const urlErrorMessage = urlError
    ? urlError === "otp_expired"
      ? "This login link has expired. Please request a new one."
      : "Login failed. Please try again."
    : "";

  const displayedError = errorMessage || urlErrorMessage;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/`,
      },
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setSuccessMessage("Check your email for the login link.");
    }

    setLoading(false);
  };

  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-slate-900 p-10 text-white md:flex">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full text-white/[0.06]"
          viewBox="0 0 400 600"
          fill="none"
          aria-hidden="true"
        >
          <rect x="40" y="80" width="170" height="170" rx="14" stroke="currentColor" strokeWidth="2" transform="rotate(-12 125 165)" />
          <rect x="170" y="220" width="190" height="190" rx="14" stroke="currentColor" strokeWidth="2" transform="rotate(8 265 315)" />
          <rect x="60" y="360" width="160" height="160" rx="14" stroke="currentColor" strokeWidth="2" transform="rotate(-6 140 440)" />
        </svg>

        <div className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-900">
            <Package className="h-6 w-6" strokeWidth={2} />
          </div>
          <div>
            <div className="text-xl font-semibold leading-tight">Johnston&apos;s</div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">
              Packaging Ops
            </div>
          </div>
        </div>

        <div className="relative flex items-center justify-between text-xs text-white/50">
          <span>© 2026 Johnston&apos;s</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            v 0.1.0
          </span>
        </div>
      </aside>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            <ShieldCheck className="h-4 w-4" strokeWidth={2} />
            Secure Access
          </div>

          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h1>
          <p className="mt-3 text-base leading-relaxed text-slate-500">
            We&apos;ll email you a secure login link.
            <br />
            No password needed.
          </p>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Work email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-900 bg-white py-3.5 pl-12 pr-4 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-900/5"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send login link"}
              {!loading && (
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              )}
            </button>
          </form>

          {displayedError && (
            <div
              role="alert"
              className="mt-4 flex gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 text-sm text-red-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">{displayedError}</div>
                <div className="mt-0.5 text-red-600/90">
                  Please wait a moment and try again. Contact your admin if this
                  keeps happening.
                </div>
              </div>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-emerald-700"
            >
              {successMessage}
            </div>
          )}

          <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5 text-sm">
            <span className="text-slate-500">Need help?</span>
            <a
              href="mailto:sol@johnstons.ca"
              className="group inline-flex items-center gap-1.5 font-semibold text-slate-900 hover:text-slate-700"
            >
              sol@johnstons.ca
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
