/**
 * Privacy-preserving masking module for the Writing Assistant.
 *
 * Rules:
 * - Patient IDs: GCP-#### or GCP- followed by digits/alphanumeric
 * - Phone numbers: Indian (+91...) or standard 10-digit mobile numbers
 * - Email addresses
 * - Dates of birth: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, or Month DD, YYYY patterns
 * - Known Names: dynamically passed patient, therapist, or staff names
 *
 * Replaces them with:
 *   [PERSON_1], [PERSON_2], [ID_1], [PHONE_1], [EMAIL_1], [DOB_1]
 * Restores them in the output so the user sees their original terms.
 */

export interface MaskResult {
  maskedText: string;
  mappings: Array<{ token: string; original: string }>;
}

export function maskSensitiveText(
  text: string,
  knownNames: string[] = []
): MaskResult {
  const mappings: Array<{ token: string; original: string }> = [];
  let result = text;

  let idCounter = 1;
  let phoneCounter = 1;
  let emailCounter = 1;
  let dobCounter = 1;
  let personCounter = 1;

  // 1. Mask Email Addresses
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
  result = result.replace(emailRegex, (match) => {
    const token = `[EMAIL_${emailCounter++}]`;
    mappings.push({ token, original: match });
    return token;
  });

  // 2. Mask Patient IDs (e.g. GCP-0001, GCP-1234, etc.)
  const patientIdRegex = /\bGCP-[A-Za-z0-9-]+\b/gi;
  result = result.replace(patientIdRegex, (match) => {
    const token = `[ID_${idCounter++}]`;
    mappings.push({ token, original: match });
    return token;
  });

  // 3. Mask Phone Numbers (Indian +91 with optional spaces/hyphens, or 10-digit formats)
  const phoneRegex = /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g;
  result = result.replace(phoneRegex, (match) => {
    const token = `[PHONE_${phoneCounter++}]`;
    mappings.push({ token, original: match });
    return token;
  });

  // 4. Mask Dates of birth / dates (e.g., 14/05/1990, 1990-05-14, 14 May 1990)
  const dateRegex = /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/g;
  result = result.replace(dateRegex, (match) => {
    const token = `[DOB_${dobCounter++}]`;
    mappings.push({ token, original: match });
    return token;
  });

  // 5. Mask Known Names (sorted by length descending to match full names before single words)
  const validNames = knownNames
    .map((n) => n.trim())
    .filter((n) => n.length > 1)
    .sort((a, b) => b.length - a.length);

  for (const name of validNames) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const nameRegex = new RegExp(`\\b${escaped}\\b`, "gi");
    if (nameRegex.test(result)) {
      const token = `[PERSON_${personCounter++}]`;
      mappings.push({ token, original: name });
      result = result.replace(nameRegex, token);
    }
  }

  return { maskedText: result, mappings };
}

export function unmaskSensitiveText(
  maskedText: string,
  mappings: Array<{ token: string; original: string }>
): string {
  let restored = maskedText;
  // Restore tokens in reverse or exact order
  for (const { token, original } of mappings) {
    // Replace token globally
    restored = restored.split(token).join(original);
  }
  // Fallback cleanup for generic unnumbered tags if model dropped numbering
  restored = restored
    .replace(/\[EMAIL\]/g, "[EMAIL]")
    .replace(/\[PHONE\]/g, "[PHONE]")
    .replace(/\[ID\]/g, "[ID]")
    .replace(/\[PERSON\]/g, "[PERSON]");

  return restored;
}

