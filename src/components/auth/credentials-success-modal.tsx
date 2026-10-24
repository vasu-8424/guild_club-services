"use client";

import * as React from "react";
import Link from "next/link";
import { Icons } from "@/components/ui/icons";

const CheckCircle = Icons.Success;
const Copy = Icons.View;
const Check = Icons.Check;
const ShieldAlert = Icons.Security;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface CredentialsSuccessModalProps {
  roleLabel: "admin" | "therapist";
  email: string;
  password?: string;
  returnHref?: string;
  returnLabel?: string;
  title?: string;
  onDone?: () => void;
}

export function CredentialsSuccessModal({
  roleLabel,
  email,
  password,
  returnHref = "",
  returnLabel = "Done & Return to List",
  title,
  onDone,
}: CredentialsSuccessModalProps) {
  const [copiedEmail, setCopiedEmail] = React.useState(false);
  const [copiedPassword, setCopiedPassword] = React.useState(false);
  const [copiedAll, setCopiedAll] = React.useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const copyPassword = () => {
    if (password) {
      navigator.clipboard.writeText(password);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };

  const copyAllCredentials = () => {
    const creds = `Email: ${email}\nPassword: ${password || ""}`;
    navigator.clipboard.writeText(creds);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <Card className="max-w-xl mx-auto border-emerald-200 shadow-md">
      <CardHeader className="bg-emerald-50/60 rounded-t-2xl border-b border-emerald-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-emerald-950 font-bold capitalize">
              {title || `${roleLabel} Account Created Successfully!`}
            </CardTitle>
            <CardDescription className="text-emerald-800 text-xs">
              Direct login credentials have been configured.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        {/* Security Warning Notice */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div>
            <span className="font-semibold block mb-0.5">One-time Credential View:</span>
            <span>
              Share these details with the {roleLabel}. The password cannot be viewed again.
            </span>
          </div>
        </div>

        {/* Credentials Display Box */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
          {/* Email Row */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span>Email Address:</span>
              <button
                type="button"
                onClick={copyEmail}
                data-testid="copy-email-button"
                className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium text-xs"
              >
                {copiedEmail ? (
                  <>
                    <Check className="h-3 w-3" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy Email</span>
                  </>
                )}
              </button>
            </div>
            <code
              data-testid="credentials-email"
              className="block rounded-lg bg-white p-2.5 font-mono text-sm font-medium text-slate-900 border border-slate-200 select-all"
            >
              {email}
            </code>
          </div>

          {/* Password Row */}
          {password && (
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Password:</span>
                <button
                  type="button"
                  onClick={copyPassword}
                  data-testid="copy-password-button"
                  className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-medium text-xs"
                >
                  {copiedPassword ? (
                    <>
                      <Check className="h-3 w-3" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy Password</span>
                    </>
                  )}
                </button>
              </div>
              <code
                data-testid="credentials-password"
                className="block rounded-lg bg-white p-2.5 font-mono text-sm font-semibold text-slate-900 border border-slate-200 select-all"
              >
                {password}
              </code>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={copyAllCredentials}
            data-testid="copy-credentials-button"
            className="w-full sm:w-auto flex items-center gap-2 text-xs"
          >
            {copiedAll ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedAll ? "Copied All Credentials!" : "Copy credentials"}</span>
          </Button>

          {onDone ? (
            <Button
              type="button"
              data-testid="done-button"
              onClick={onDone}
              className="w-full sm:w-auto"
            >
              {returnLabel}
            </Button>
          ) : (
            <Link href={returnHref} className="w-full sm:w-auto">
              <Button data-testid="done-button" className="w-full">
                {returnLabel}
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
