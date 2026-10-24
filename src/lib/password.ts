import crypto from "crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "@#!$";
const ALL = UPPER + LOWER + DIGITS + SPECIAL;

/**
 * Generates a cryptographically secure temporary password.
 * Always contains at least one uppercase, lowercase, digit, and special char.
 * Length: 12 characters by default.
 */
export function generateTempPassword(length = 12): string {
  const randomBytes = crypto.randomBytes(length + 4);
  let pass = "";

  // Guarantee at least one of each required character class
  pass += UPPER[randomBytes[0] % UPPER.length];
  pass += LOWER[randomBytes[1] % LOWER.length];
  pass += DIGITS[randomBytes[2] % DIGITS.length];
  pass += SPECIAL[randomBytes[3] % SPECIAL.length];

  // Fill remaining length with random chars from full set
  for (let i = 4; i < length; i++) {
    pass += ALL[randomBytes[i] % ALL.length];
  }

  // Fisher–Yates shuffle using fresh random bytes
  const shuffleBytes = crypto.randomBytes(length);
  const arr = pass.split("");
  for (let i = arr.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr.join("");
}

/**
 * Generates a cryptographically secure URL-safe random token (hex string).
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}
