import { ServiceType } from "@/db/schema";

export interface ClinicalServiceDefinition {
  id: ServiceType;
  label: string;
  description: string;
  badgeClass: string;
}

export const ACTIVE_CLINICAL_SERVICES: readonly ClinicalServiceDefinition[] = [
  {
    id: "speech_therapy",
    label: "Speech Therapy",
    description: "Speech and language rehabilitation therapy",
    badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  {
    id: "swallow_therapy",
    label: "Swallow Therapy",
    description: "Dysphagia rehabilitation and swallowing function recovery",
    badgeClass: "bg-blue-50 text-blue-800 border-blue-200",
  },
  {
    id: "vitalstim_therapy",
    label: "VitalStim Therapy",
    description: "Neuromuscular electrical stimulation for throat muscle re-education",
    badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
  },
] as const;

export const PAST_CLINICAL_SERVICES: readonly ClinicalServiceDefinition[] = [
  {
    id: "physiotherapy",
    label: "Physiotherapy (past)",
    description: "Legacy physiotherapy cases",
    badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
  },
] as const;

// Alias to active services for case creation forms and new cases
export const CLINICAL_SERVICES = ACTIVE_CLINICAL_SERVICES;

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  speech_therapy: "Speech Therapy",
  physiotherapy: "Physiotherapy (past)",
  swallow_therapy: "Swallow Therapy",
  vitalstim_therapy: "VitalStim Therapy",
};

export function getServiceLabel(service?: string | null): string {
  if (!service) return "Unknown Service";
  const normalized = service.toLowerCase().trim();
  if (normalized === "physiotherapy" || normalized === "physio therapy") {
    return "Physiotherapy (past)";
  }
  if (normalized === "speech_therapy" || normalized === "speech therapy") {
    return "Speech Therapy";
  }
  if (normalized in SERVICE_TYPE_LABELS) {
    return SERVICE_TYPE_LABELS[normalized];
  }
  return service.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Returns the active services, plus "Physiotherapy (past)" only if such cases exist.
 */
export function getFilterableServices(existingServices?: string[]): Array<{ id: string; label: string }> {
  const result: Array<{ id: string; label: string }> = ACTIVE_CLINICAL_SERVICES.map((s) => ({
    id: s.id,
    label: s.label,
  }));

  const hasPastPhysio = existingServices?.some(
    (s) => s?.toLowerCase().trim() === "physiotherapy" || s?.toLowerCase().trim() === "physio therapy"
  );

  if (hasPastPhysio) {
    result.push({
      id: "physiotherapy",
      label: "Physiotherapy (past)",
    });
  }

  return result;
}

export type SimplifiedOutcome = "improved" | "partially_improved" | "no_change" | "referred";

export interface OutcomeOption {
  value: SimplifiedOutcome;
  label: string;
  mappedCategory: "successful" | "unsuccessful" | "referred";
  badgeClass: string;
}

export const OUTCOME_OPTIONS: readonly OutcomeOption[] = [
  {
    value: "improved",
    label: "Improved",
    mappedCategory: "successful",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  {
    value: "partially_improved",
    label: "Partially improved",
    mappedCategory: "successful",
    badgeClass: "bg-teal-100 text-teal-800 border-teal-300",
  },
  {
    value: "no_change",
    label: "No change",
    mappedCategory: "unsuccessful",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
  },
  {
    value: "referred",
    label: "Referred",
    mappedCategory: "referred",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
  },
] as const;

export function getOutcomeLabel(outcome?: string | null): string {
  if (!outcome) return "Pending";
  const found = OUTCOME_OPTIONS.find((o) => o.value === outcome);
  if (found) return found.label;
  if (outcome === "successful") return "Successful (Improved)";
  if (outcome === "unsuccessful") return "Unsuccessful (No change)";
  return outcome.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function mapOutcomeToSuccessCategory(
  outcome?: string | null
): "successful" | "unsuccessful" | "referred" | null {
  if (!outcome) return null;
  if (outcome === "improved" || outcome === "partially_improved" || outcome === "successful") {
    return "successful";
  }
  if (outcome === "no_change" || outcome === "unsuccessful") {
    return "unsuccessful";
  }
  if (outcome === "referred") {
    return "referred";
  }
  return null;
}
