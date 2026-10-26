"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { loginAction } from "@/lib/actions/auth-actions";
import { Button } from "@/components/ui/button";
import { Icons } from "@/components/ui/icons";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [generalError, setGeneralError] = React.useState<string | null>(
    errorParam === "access_removed"
      ? "Your access has been removed."
      : errorParam === "account_deactivated"
      ? "Your account has been deactivated. Please contact an administrator."
      : null
  );
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setFieldErrors({});
    setIsLoading(true);

    try {
      const res = await loginAction({ email, password });

      if (!res.success) {
        if (res.fieldErrors) {
          setFieldErrors(res.fieldErrors);
        }
        if (res.error) {
          setGeneralError(res.error);
        }
        setIsLoading(false);
        return;
      }

      const redirectParam = searchParams.get("redirect");
      const dest =
        redirectParam && redirectParam.startsWith("/") && !redirectParam.startsWith("//")
          ? redirectParam
          : res.redirectTo || "/admin/dashboard";
      router.push(dest);
      router.refresh();
    } catch (err: any) {
      setGeneralError(err.message || "An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans">
      {/* Left Marketing / Hero Panel (Hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-slate-900 p-12 relative overflow-hidden border-r border-slate-800">
        <div className="absolute inset-0 bg-radial from-[#0B7A63]/25 via-transparent to-transparent pointer-events-none" />

        {/* Top Brand Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-none bg-[#0B7A63] text-white shadow-xs">
            <Icons.Analytics className="h-6 w-6" />
          </div>
          <div>
            <span className="text-lg font-semibold tracking-tight text-white block">
              Guild Club Services
            </span>
            <span className="text-xs font-semibold text-[#0F9D7A] uppercase tracking-wider block">
              Clinical Care Platform
            </span>
          </div>
        </div>

        {/* Center Tagline & Illustration Callout */}
        <div className="relative z-10 max-w-md space-y-6">
          <div className="inline-flex items-center gap-2 rounded-none bg-slate-800 px-3 py-1 text-xs font-semibold text-teal-300 border border-slate-700">
            <Icons.Security className="h-4 w-4 text-[#0F9D7A]" />
            <span>Secure Therapy Case Management</span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-white leading-tight">
            Empowering compassionate care through seamless case coordination.
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            A unified clinical portal for therapists, clinic administrators, and supervisors. Managing referrals, session tracking, and clinical progression with complete audit transparency.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            <div className="flex items-start gap-2.5">
              <Icons.Success className="h-4 w-4 text-[#0F9D7A] shrink-0 mt-0.5" />
              <span className="text-xs text-slate-200">End-to-End Case Lifecycle</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Icons.Success className="h-4 w-4 text-[#0F9D7A] shrink-0 mt-0.5" />
              <span className="text-xs text-slate-200">Date-Wise Audit Trails</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Icons.Success className="h-4 w-4 text-[#0F9D7A] shrink-0 mt-0.5" />
              <span className="text-xs text-slate-200">Role-Based Access Control</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Icons.Success className="h-4 w-4 text-[#0F9D7A] shrink-0 mt-0.5" />
              <span className="text-xs text-slate-200">Asia/Kolkata Synchronized</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-xs text-slate-500">
          &copy; {new Date().getFullYear()} Guild Club Services. Authorized personnel only.
        </div>
      </div>

      {/* Right Login Card Panel */}
      <div className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-12 xl:px-20">
        <div className="mx-auto w-full max-w-md space-y-6">
          {/* Mobile Header (Shown only on small screens) */}
          <div className="lg:hidden text-center mb-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-none bg-[#0B7A63] text-white shadow-xs mb-3">
              <Icons.Analytics className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Guild Club Services
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Therapy Case Management Portal
            </p>
          </div>

          {/* Centered Login Card: Sharp corners, top accent */}
          <div className="rounded-none border border-slate-200 border-t-2 border-t-[#0B7A63] bg-white p-7 sm:p-8 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                Sign in to your account
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Enter your authorized credentials to access your dashboard.
              </p>
            </div>

            {generalError && (
              <div
                data-testid="login-error-message"
                className="mb-5 flex items-start gap-2.5 rounded-none border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800"
              >
                <Icons.Alert className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{generalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Field */}
              <div className="space-y-1.5 text-left">
                <label
                  htmlFor="email-input"
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                >
                  Email address
                </label>
                <div className="relative">
                  <input
                    id="email-input"
                    data-testid="login-email-input"
                    type="email"
                    placeholder="staff@guildclub.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    className="w-full rounded-none border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:border-slate-400 focus:border-[#0B7A63] focus:outline-none focus:ring-1 focus:ring-[#0B7A63]"
                  />
                </div>
                {fieldErrors.email && (
                  <p data-testid="login-email-input-error" className="text-xs text-rose-600 font-medium">{fieldErrors.email}</p>
                )}
              </div>

              {/* Password Field with Show/Hide toggle */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password-input"
                    className="block text-xs font-semibold uppercase tracking-wider text-slate-700"
                  >
                    Password
                  </label>
                </div>
                <div className="relative">
                  <input
                    id="password-input"
                    data-testid="login-password-input"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="w-full rounded-none border border-slate-300 bg-white px-3.5 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-[0_1px_0_rgba(15,23,42,0.04)] hover:border-slate-400 focus:border-[#0B7A63] focus:outline-none focus:ring-1 focus:ring-[#0B7A63]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <Icons.View className="h-4 w-4" />
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-xs text-rose-600 font-medium">{fieldErrors.password}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                data-testid="login-submit-button"
                type="submit"
                className="w-full mt-3 font-semibold"
                isLoading={isLoading}
              >
                Sign in
              </Button>
            </form>

            {/* Note */}
            <div className="mt-6 border-t border-slate-100 pt-4 text-center">
              <p className="text-xs text-slate-500">
                Guild Club Services is an invite-only internal portal. Contact your clinic administrator for account credentials.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="h-8 w-8 animate-spin rounded-none border-4 border-[#0B7A63] border-t-transparent" />
        </div>
      }
    >
      <LoginForm />
    </React.Suspense>
  );
}
