"use client";

import * as React from "react";
import { Icons } from "@/components/ui/icons";

const Eye = Icons.View;
const EyeOff = Icons.View;
const Sparkles = Icons.SuccessRate;
import { Button } from "@/components/ui/button";

interface PasswordInputWithStrengthProps {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onGenerate?: (generated: string) => void;
  placeholder?: string;
  required?: boolean;
  testId?: string;
}

export function calculatePasswordStrength(pwd: string): {
  score: number;
  label: "Weak" | "Fair" | "Good" | "Strong";
  color: string;
  percentage: number;
} {
  if (!pwd) {
    return { score: 0, label: "Weak", color: "bg-slate-200", percentage: 0 };
  }

  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^a-zA-Z0-9]/.test(pwd) || pwd.length >= 12) score++;

  switch (score) {
    case 1:
      return { score: 1, label: "Weak", color: "bg-rose-500", percentage: 25 };
    case 2:
      return { score: 2, label: "Fair", color: "bg-amber-500", percentage: 50 };
    case 3:
      return { score: 3, label: "Good", color: "bg-blue-500", percentage: 75 };
    case 4:
      return { score: 4, label: "Strong", color: "bg-emerald-500", percentage: 100 };
    default:
      return { score: 0, label: "Weak", color: "bg-rose-500", percentage: 10 };
  }
}

export function generateStrongPassword(length = 14): string {
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const symbols = "!@#$%&*?";
  const all = lowercase + uppercase + numbers + symbols;

  let pwd = "";
  pwd += uppercase[Math.floor(Math.random() * uppercase.length)];
  pwd += lowercase[Math.floor(Math.random() * lowercase.length)];
  pwd += numbers[Math.floor(Math.random() * numbers.length)];
  pwd += symbols[Math.floor(Math.random() * symbols.length)];

  for (let i = pwd.length; i < length; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle
  return pwd
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
}

export function PasswordInputWithStrength({
  id = "password",
  name = "password",
  label = "Password",
  value,
  onChange,
  onGenerate,
  placeholder = "Enter password (at least 8 characters with letter & number)",
  required = true,
  testId = "password-input",
}: PasswordInputWithStrengthProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const strength = React.useMemo(() => calculatePasswordStrength(value), [value]);

  const handleGenerate = () => {
    const generated = generateStrongPassword(14);
    onChange(generated);
    if (onGenerate) {
      onGenerate(generated);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-semibold text-slate-700">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <button
          type="button"
          onClick={handleGenerate}
          data-testid="generate-password-btn"
          className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          <span>Generate strong password</span>
        </button>
      </div>

      <div className="relative">
        <input
          id={id}
          name={name}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          data-testid={testId}
          className="w-full rounded-none border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0B7A63] focus:outline-none focus:ring-1 focus:ring-[#0B7A63] transition-all font-mono"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          data-testid={`${testId}-toggle`}
          tabIndex={-1}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-9 w-9 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {/* Password Strength Meter */}
      {value.length > 0 && (
        <div className="space-y-1 pt-1" data-testid="password-strength-meter">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Strength:</span>
            <span
              className={`font-semibold ${
                strength.label === "Weak"
                  ? "text-rose-600"
                  : strength.label === "Fair"
                  ? "text-amber-600"
                  : strength.label === "Good"
                  ? "text-blue-600"
                  : "text-emerald-600"
              }`}
            >
              {strength.label}
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 rounded-none overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${strength.color}`}
              style={{ width: `${strength.percentage}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Must be at least 8 characters with at least one letter and one number.
          </p>
        </div>
      )}
    </div>
  );
}
