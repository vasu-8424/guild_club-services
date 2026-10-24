"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createCaseAction } from "@/lib/actions/case-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react";
import type { CasePriority } from "@/db/schema";

interface TherapistOption {
  id: string;
  name: string;
  specialization: string;
  openCases: number;
  maxOpenCases: number;
}

interface CreateCaseFormProps {
  therapists: TherapistOption[];
}

export function CreateCaseForm({ therapists }: CreateCaseFormProps) {
  const router = useRouter();

  // Client Details
  const [clientName, setClientName] = React.useState("");
  const [clientEmail, setClientEmail] = React.useState("");
  const [clientPhone, setClientPhone] = React.useState("");
  const [clientAge, setClientAge] = React.useState(28);
  const [clientGender, setClientGender] = React.useState("Female");
  const [clientEmergencyContact, setClientEmergencyContact] = React.useState("");

  // Case Details
  const [category, setCategory] = React.useState("Individual Therapy");
  const [priority, setPriority] = React.useState<CasePriority>("medium");
  const [presentingIssues, setPresentingIssues] = React.useState("");
  const [initialNotes, setInitialNotes] = React.useState("");
  const [assignedTherapistId, setAssignedTherapistId] = React.useState("");

  const [error, setError] = React.useState<string | null>(null);
  const [createdCaseNumber, setCreatedCaseNumber] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const selectedTherapist = therapists.find((t) => t.id === assignedTherapistId);
  const isSelectedAtCapacity =
    selectedTherapist &&
    selectedTherapist.openCases >= selectedTherapist.maxOpenCases;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await createCaseAction({
        clientName,
        clientEmail,
        clientPhone,
        clientAge,
        clientGender,
        clientEmergencyContact: clientEmergencyContact || undefined,
        category,
        priority,
        presentingIssues,
        initialNotes: initialNotes || undefined,
        assignedTherapistId: assignedTherapistId || undefined,
      });

      if (!res.success) {
        setError(res.error ?? "Failed to create case");
        setIsLoading(false);
        return;
      }

      setCreatedCaseNumber(res.data?.caseNumber ?? "Created");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (createdCaseNumber) {
    return (
      <Card className="max-w-xl mx-auto border-emerald-200">
        <CardHeader className="bg-emerald-50/50 rounded-t-2xl border-b border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-emerald-900">
                Case Intake Created Successfully!
              </CardTitle>
              <CardDescription data-testid="case-created-number" className="text-emerald-700 text-xs font-mono font-bold">
                Assigned Case Number: {createdCaseNumber}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <p className="text-sm text-slate-600">
            Client profile has been registered and the case record has been generated.
            {assignedTherapistId
              ? " An assignment notification email has been queued for the therapist."
              : " The case is listed in 'New' status ready for future assignment."}
          </p>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link href="/admin/cases">
              <Button data-testid="case-done-button">Go to Cases Directory</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl mx-auto">
      {error && (
        <div data-testid="case-error-message" className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. Client Information */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base">1. Client Demographic Details</CardTitle>
          <CardDescription className="text-xs">
            Personal and contact information for the individual seeking therapy.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              data-testid="case-client-name-input"
              label="Client Full Name"
              placeholder="Aarav Sen"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
              autoFocus
            />

            <Input
              data-testid="case-client-email-input"
              label="Client Email"
              type="email"
              placeholder="aarav.sen@example.com"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              data-testid="case-client-phone-input"
              label="Client Phone"
              type="tel"
              placeholder="+91 98765 00000"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              required
            />

            <Input
              data-testid="case-client-age-input"
              label="Age"
              type="number"
              min={1}
              max={120}
              value={clientAge}
              onChange={(e) => setClientAge(parseInt(e.target.value) || 1)}
              required
            />

            <Select
              data-testid="case-client-gender-select"
              label="Gender"
              value={clientGender}
              onChange={(e) => setClientGender(e.target.value)}
            >
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Non-binary">Non-binary</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </Select>
          </div>

          <Input
            data-testid="case-client-emergency-input"
            label="Emergency Contact (Optional)"
            placeholder="Family member name and phone"
            value={clientEmergencyContact}
            onChange={(e) => setClientEmergencyContact(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* 2. Clinical Case Information */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base">2. Clinical Case Particulars</CardTitle>
          <CardDescription className="text-xs">
            Presenting issues, category, and triage priority level.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              data-testid="case-category-select"
              label="Therapy Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="Individual Therapy">Individual Therapy</option>
              <option value="Cognitive Behavioral Therapy (CBT)">
                Cognitive Behavioral Therapy (CBT)
              </option>
              <option value="Anxiety & Stress Management">
                Anxiety & Stress Management
              </option>
              <option value="Depression & Mood Disorders">
                Depression & Mood Disorders
              </option>
              <option value="Trauma & PTSD">Trauma & PTSD</option>
              <option value="Relationship & Couples Counseling">
                Relationship & Couples Counseling
              </option>
              <option value="Adolescent Counseling">
                Adolescent Counseling
              </option>
            </Select>

            <Select
              data-testid="case-priority-select"
              label="Priority Triage"
              value={priority}
              onChange={(e) => setPriority(e.target.value as CasePriority)}
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent / Immediate Attention</option>
            </Select>
          </div>

          <Textarea
            data-testid="case-presenting-issues-input"
            label="Presenting Issues / Symptoms Description"
            placeholder="Describe the client's current emotional state, clinical concerns, and key background..."
            rows={4}
            value={presentingIssues}
            onChange={(e) => setPresentingIssues(e.target.value)}
            required
            helperText="Minimum 5 characters required."
          />

          <Textarea
            data-testid="case-notes-input"
            label="Initial Intake Notes (Optional)"
            placeholder="Any internal notes or directives for the therapist..."
            rows={2}
            value={initialNotes}
            onChange={(e) => setInitialNotes(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* 3. Practitioner Assignment */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base">3. Initial Practitioner Assignment (Optional)</CardTitle>
          <CardDescription className="text-xs">
            Assign to an active therapist now, or leave unassigned to triage later.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <Select
            data-testid="case-therapist-select"
            label="Assign to Therapist"
            value={assignedTherapistId}
            onChange={(e) => setAssignedTherapistId(e.target.value)}
          >
            <option value="">Leave Unassigned (Status: New)</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.specialization} ({t.openCases}/{t.maxOpenCases} cases)
              </option>
            ))}
          </Select>

          {isSelectedAtCapacity && (
            <div data-testid="case-capacity-warning" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
              <span>
                <strong>Notice:</strong> {selectedTherapist?.name} is currently at or above their maximum case capacity ({selectedTherapist?.openCases}/{selectedTherapist?.maxOpenCases}). Assignment will proceed if confirmed.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky Action Footer */}
      <div className="sticky bottom-0 bg-slate-50/95 py-3.5 backdrop-blur-xs border-t border-slate-200/80 z-20 flex items-center justify-end gap-3 mt-6">
        <Link href="/admin/cases">
          <Button variant="outline" type="button">
            Cancel
          </Button>
        </Link>
        <Button data-testid="case-submit-button" type="submit" size="md" isLoading={isLoading}>
          Create Case Intake
        </Button>
      </div>
    </form>
  );
}
