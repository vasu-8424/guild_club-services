import { ServiceType } from "@/db/schema";

export interface ClinicalServiceDefinition {
  id: ServiceType;
  label: string;
  description: string;
  badgeClass: string;
}

export const CLINICAL_SERVICES: readonly ClinicalServiceDefinition[] = [
  {
    id: "physiotherapy",
    label: "Physiotherapy",
    description: "Physical rehabilitation and mobility improvement therapy",
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

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  physiotherapy: "Physiotherapy",
  swallow_therapy: "Swallow Therapy",
  vitalstim_therapy: "VitalStim Therapy",
};

export function getServiceLabel(service?: string | null): string {
  if (!service) return "Unknown Service";
  if (service in SERVICE_TYPE_LABELS) {
    return SERVICE_TYPE_LABELS[service as ServiceType];
  }
  return service.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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
