"use client";

import * as React from "react";
import Link from "next/link";
import { createTherapistAction } from "@/lib/actions/therapist-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PasswordInputWithStrength } from "@/components/auth/password-input-with-strength";
import { CredentialsSuccessModal } from "@/components/auth/credentials-success-modal";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

export function CreateTherapistForm() {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [specialization, setSpecialization] = React.useState("Cognitive Behavioral Therapy (CBT)");
  const [experienceYears, setExperienceYears] = React.useState(3);
  const [maxOpenCases, setMaxOpenCases] = React.useState(10);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [emailCredentials, setEmailCredentials] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = React.useState<{
    email: string;
    password: string;
    userId?: string;
    emailWarning?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("Password must be at least 8 characters long and contain both letters and numbers.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await createTherapistAction({
        name,
        email,
        phone,
        specialization,
        experienceYears,
        maxOpenCases,
        password,
        confirmPassword,
        emailCredentials,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to register therapist");
        setIsLoading(false);
        return;
      }

      // Display one-time credentials modal with typed password
      setCreatedCredentials({
        email: email.trim().toLowerCase(),
        password,
        userId: res.data?.id,
        emailWarning: res.data?.emailWarning,
      });
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratedPassword = (generated: string) => {
    setPassword(generated);
    setConfirmPassword(generated);
  };

  if (createdCredentials) {
    return (
      <CredentialsSuccessModal
        roleLabel="therapist"
        email={createdCredentials.email}
        password={createdCredentials.password}
        returnHref={`/admin/therapists?created=true&name=${encodeURIComponent(name || "Practitioner")}`}
        returnLabel="Done & Return to Directory"
      />
    );
  }

  return (
    <Card className="max-w-xl mx-auto shadow-sm">
      <CardHeader>
        <CardTitle>Register Clinical Therapist</CardTitle>
        <CardDescription>
          Configure the clinician profile and access credentials.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div
            data-testid="therapist-error-message"
            className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Practitioner Profile */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
              1. Practitioner Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input
                  data-testid="therapist-name-input"
                  label="Full Name"
                  placeholder="Dr. Rajesh Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <Input
                data-testid="therapist-email-input"
                label="Email Address"
                type="email"
                placeholder="rajesh.sharma@guildclub.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                data-testid="therapist-phone-input"
                label="Phone Number"
                type="tel"
                placeholder="+91 98765 12345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Section 2: Credentials & Access */}
          <div className="space-y-3.5 pt-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
              2. Credentials & Access
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <PasswordInputWithStrength
                  id="therapist-password"
                  name="password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  onGenerate={handleGeneratedPassword}
                  testId="therapist-password-input"
                  required
                />
              </div>

              {/* Confirm Password */}
              <div className="sm:col-span-2 space-y-1.5">
                <label
                  htmlFor="therapist-confirm-password"
                  className="text-xs font-medium text-slate-700"
                >
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="therapist-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm therapist password"
                    data-testid="therapist-confirm-password-input"
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20 shadow-2xs hover:border-slate-300 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Email Credentials Checkbox */}
              <div className="sm:col-span-2 pt-2">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="therapist-email-credentials"
                    data-testid="therapist-email-credentials-checkbox"
                    checked={emailCredentials}
                    onChange={(e) => setEmailCredentials(e.target.checked)}
                    className="h-4 w-4 rounded-none border-slate-300 text-[#0B7A63] focus:ring-[#0B7A63] cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Email these login details to the therapist
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-1 ml-6">
                  When checked, the temporary password and login link will be sent directly to the therapist.
                </p>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="sticky bottom-0 bg-white/95 py-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 z-10">
            <Link href="/admin/therapists" className="w-full sm:w-auto">
              <Button variant="secondary" type="button" className="w-full sm:w-auto">
                Cancel
              </Button>
            </Link>
            <Button
              data-testid="therapist-submit-button"
              type="submit"
              variant="primary"
              isLoading={isLoading}
              className="w-full sm:w-auto"
            >
              Save Therapist
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
