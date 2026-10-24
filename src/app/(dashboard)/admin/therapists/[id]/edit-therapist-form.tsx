"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { editTherapistAction, toggleTherapistStatusAction } from "@/lib/actions/therapist-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { AlertCircle, CheckCircle } from "lucide-react";

interface EditTherapistFormProps {
  therapist: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    specialization: string;
    experienceYears: number;
    maxOpenCases: number;
    openCasesCount: number;
  };
}

export function EditTherapistForm({ therapist }: EditTherapistFormProps) {
  const router = useRouter();
  const [name, setName] = React.useState(therapist.name);
  const [email, setEmail] = React.useState(therapist.email);
  const [phone, setPhone] = React.useState(therapist.phone || "");
  const [specialization, setSpecialization] = React.useState(therapist.specialization);
  const [experienceYears, setExperienceYears] = React.useState(therapist.experienceYears);
  const [maxOpenCases, setMaxOpenCases] = React.useState(therapist.maxOpenCases);
  const [isActive, setIsActive] = React.useState(therapist.isActive);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isToggling, setIsToggling] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const res = await editTherapistAction({
        id: therapist.id,
        name,
        email: email.trim().toLowerCase(),
        phone,
        specialization,
        experienceYears,
        maxOpenCases,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to update therapist");
      } else {
        setSuccess("Therapist profile updated successfully.");
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    const action = isActive ? "deactivate" : "activate";
    if (!confirm(`Are you sure you want to ${action} this therapist?`)) return;

    setIsToggling(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await toggleTherapistStatusAction({
        userId: therapist.id,
        isActive: !isActive,
      });

      if (res.success && res.data) {
        setIsActive(res.data.isActive);
        setSuccess(
          `Therapist profile ${res.data.isActive ? "activated" : "deactivated"} successfully.`
        );
      } else {
        setError(res.error ?? "Failed to update therapist status");
      }
    } catch {
      setError("Failed to change account status");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Edit Clinical Therapist Profile</CardTitle>
              <CardDescription>
                Currently managing {therapist.openCasesCount} active case{therapist.openCasesCount === 1 ? "" : "s"}.
              </CardDescription>
            </div>
            <StatusBadge status={isActive ? "active" : "inactive"} />
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div
              data-testid="therapist-edit-error-message"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div
              data-testid="therapist-edit-success-message"
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"
            >
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              data-testid="therapist-edit-email-input"
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              data-testid="therapist-edit-name-input"
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <Input
              data-testid="therapist-edit-phone-input"
              label="Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />

            <Input
              data-testid="therapist-edit-specialization-input"
              label="Clinical Specialization"
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                data-testid="therapist-edit-experience-input"
                label="Experience (Years)"
                type="number"
                min={0}
                value={experienceYears}
                onChange={(e) => setExperienceYears(parseInt(e.target.value) || 0)}
                required
              />

              <Input
                data-testid="therapist-edit-max-cases-input"
                label="Max Open Cases"
                type="number"
                min={1}
                value={maxOpenCases}
                onChange={(e) => setMaxOpenCases(parseInt(e.target.value) || 1)}
                required
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <Button
                data-testid="therapist-toggle-status-button"
                type="button"
                variant="outline"
                className={
                  isActive
                    ? "text-rose-600 border-rose-200 hover:bg-rose-50"
                    : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                }
                onClick={handleToggleStatus}
                isLoading={isToggling}
              >
                {isActive ? "Deactivate Account" : "Activate Account"}
              </Button>

              <div className="flex items-center gap-3">
                <Link href="/admin/therapists">
                  <Button variant="ghost" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button
                  data-testid="therapist-edit-submit-button"
                  type="submit"
                  isLoading={isLoading}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
