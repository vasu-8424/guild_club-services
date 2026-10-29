"use client";

import * as React from "react";
import Link from "next/link";
import { createAdminAction } from "@/lib/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PasswordInputWithStrength } from "@/components/auth/password-input-with-strength";
import { CredentialsSuccessModal } from "@/components/auth/credentials-success-modal";
import { AlertCircle, Eye, EyeOff } from "lucide-react";

interface BranchOption {
  id: string;
  name: string;
  isActive: boolean;
}

interface CreateAdminFormProps {
  branches?: BranchOption[];
  defaultBranchId?: string | null;
}

export function CreateAdminForm({
  branches = [],
  defaultBranchId,
}: CreateAdminFormProps) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [emailCredentials, setEmailCredentials] = React.useState(true);
  const [branchList, setBranchList] = React.useState<BranchOption[]>(
    branches.filter((b) => b.isActive)
  );
  const [selectedBranchIds, setSelectedBranchIds] = React.useState<string[]>(() => {
    const active = branches.filter((b) => b.isActive);
    if (
      defaultBranchId &&
      active.some((b) => b.id === defaultBranchId)
    ) {
      return [defaultBranchId];
    }
    return active.length > 0 ? [active[0].id] : [];
  });
  const [branchError, setBranchError] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = React.useState<{
    email: string;
    password: string;
    userId?: string;
    branchNames?: string[];
    emailWarning?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  // Client-side fallback if branches were not provided via SSR props
  React.useEffect(() => {
    if (branches.length === 0) {
      import("@/lib/actions/branch-actions").then(({ getBranchesAction }) => {
        getBranchesAction(false).then((res) => {
          if (res.success && res.branches) {
            const activeOnly = res.branches.filter((b) => b.isActive);
            setBranchList(activeOnly);
            setSelectedBranchIds((prev) => {
              if (prev.length > 0) return prev;
              if (
                defaultBranchId &&
                activeOnly.some((b) => b.id === defaultBranchId)
              ) {
                return [defaultBranchId];
              }
              return activeOnly.length > 0 ? [activeOnly[0].id] : [];
            });
          }
        });
      });
    }
  }, [branches, defaultBranchId]);

  const handleToggleBranch = (branchId: string) => {
    setBranchError(null);
    setSelectedBranchIds((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBranchError(null);

    // Validate Branch selection: at least one branch is required
    if (selectedBranchIds.length === 0) {
      setBranchError("Choose at least one branch");
      return;
    }

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
      const res = await createAdminAction({
        name,
        email,
        phone,
        password,
        confirmPassword,
        branchIds: selectedBranchIds,
        emailCredentials,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to create administrator");
        setIsLoading(false);
        return;
      }

      const assignedBranchNames = branchList
        .filter((b) => selectedBranchIds.includes(b.id))
        .map((b) => b.name);

      // Display one-time credentials modal with the typed password and branch names
      setCreatedCredentials({
        email: email.trim().toLowerCase(),
        password,
        userId: res.data?.id,
        branchNames: res.data?.branchNames || assignedBranchNames,
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
        roleLabel="admin"
        email={createdCredentials.email}
        password={createdCredentials.password}
        userId={createdCredentials.userId}
        branchNames={createdCredentials.branchNames}
        emailWarning={createdCredentials.emailWarning}
        returnHref="/super-admin/admins"
      />
    );
  }

  return (
    <Card className="max-w-xl mx-auto shadow-sm rounded-none border-slate-200">
      <CardHeader>
        <CardTitle>Create Administrator Account</CardTitle>
        <CardDescription>
          Configure the administrator profile and access credentials.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div
            data-testid="admin-error-message"
            className="mb-5 flex items-start gap-2.5 rounded-none border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Administrator Information */}
          <div className="space-y-3.5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
              1. Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input
                  data-testid="admin-name-input"
                  label="Full Name"
                  placeholder="Dr. Emily Thorne"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <Input
                data-testid="admin-email-input"
                label="Email Address"
                type="email"
                placeholder="emily.thorne@guildclub.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                data-testid="admin-phone-input"
                label="Phone Number (Optional)"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Section 2: Branch access */}
          <div className="space-y-3.5 pt-2" data-testid="admin-branches-section">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
              2. Branch access
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Assigned branches <span className="text-rose-500">*</span>
                </label>
                {selectedBranchIds.length > 0 && (
                  <span className="text-[11px] font-medium text-slate-500">
                    {selectedBranchIds.length} branch{selectedBranchIds.length === 1 ? "" : "es"} selected
                  </span>
                )}
              </div>
              <p
                data-testid="assigned-branches-helper"
                className="text-[11px] text-slate-500"
              >
                The administrator can see only the selected branches. Required: choose at least one.
              </p>

              {branchError && (
                <div
                  data-testid="branch-error-message"
                  className="flex items-center gap-2 rounded-none border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{branchError}</span>
                </div>
              )}

              <div
                data-testid="assigned-branches-field"
                className="space-y-2 pt-1"
              >
                {branchList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">
                    Loading active branches...
                  </p>
                ) : (
                  branchList.map((branch) => {
                    const isSelected = selectedBranchIds.includes(branch.id);
                    return (
                      <div
                        key={branch.id}
                        data-testid={`branch-row-${branch.id}`}
                        onClick={(e) => {
                          if ((e.target as HTMLElement).tagName.toLowerCase() !== "input") {
                            handleToggleBranch(branch.id);
                          }
                        }}
                        className={`flex items-center justify-between p-3 border cursor-pointer select-none transition-colors rounded-none ${
                          isSelected
                            ? "border-[#0B7A63] bg-[#0B7A63]/5 text-slate-900"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            id={`branch-checkbox-${branch.id}`}
                            data-testid={`branch-checkbox-${branch.id}`}
                            checked={isSelected}
                            onChange={() => handleToggleBranch(branch.id)}
                            className="h-4 w-4 rounded-none border-slate-300 text-[#0B7A63] focus:ring-[#0B7A63] cursor-pointer"
                          />
                          <label
                            htmlFor={`branch-checkbox-${branch.id}`}
                            className="text-sm font-semibold cursor-pointer"
                            onClick={(e) => e.preventDefault()}
                          >
                            {branch.name}
                          </label>
                        </div>
                        {isSelected && (
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0B7A63] bg-[#0B7A63]/10 px-2 py-0.5 rounded-none">
                            Selected
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Credentials and access */}
          <div className="space-y-3.5 pt-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
              3. Credentials and access
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <PasswordInputWithStrength
                  id="admin-password"
                  name="password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  onGenerate={handleGeneratedPassword}
                  testId="admin-password-input"
                  required
                />
              </div>

              {/* Confirm Password */}
              <div className="sm:col-span-2 space-y-1.5">
                <label
                  htmlFor="admin-confirm-password"
                  className="text-xs font-medium text-slate-700"
                >
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="admin-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm administrator password"
                    data-testid="admin-confirm-password-input"
                    required
                    className="w-full rounded-none border border-slate-200 bg-white px-3.5 py-2 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0B7A63] focus:outline-none focus:ring-1 focus:ring-[#0B7A63] shadow-2xs hover:border-slate-300 font-mono"
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
                    id="admin-email-credentials"
                    data-testid="admin-email-credentials-checkbox"
                    checked={emailCredentials}
                    onChange={(e) => setEmailCredentials(e.target.checked)}
                    className="h-4 w-4 rounded-none border-slate-300 text-[#0B7A63] focus:ring-[#0B7A63] cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Email these login details to the admin
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 mt-1 ml-6">
                  When checked, the temporary password and login link will be sent directly to the administrator.
                </p>
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="sticky bottom-0 bg-white/95 py-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-3 z-10">
            <Link href="/super-admin/admins" className="w-full sm:w-auto">
              <Button variant="secondary" type="button" className="w-full sm:w-auto">
                Cancel
              </Button>
            </Link>
            <Button
              data-testid="admin-submit-button"
              type="submit"
              variant="primary"
              isLoading={isLoading}
              className="w-full sm:w-auto"
            >
              Save Administrator
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
