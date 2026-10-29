/**
 * Single source of truth for HTTP security response headers.
 *
 * Used by:
 *   - next.config.ts  → headers() function (applies to all routes)
 *
 * Rules:
 *   - Permissions-Policy MUST allow geolocation=(self) so the therapist
 *     LocationGate component can call navigator.geolocation.getCurrentPosition.
 *   - Only list directives the app actively uses; omit everything else.
 */
export const securityHeaders: Array<{ key: string; value: string }> = [
  // Enforce HTTPS
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // Prevent clickjacking
  { key: "X-Frame-Options", value: "DENY" },
  // Prevent MIME-type sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Limit referrer information sent to third parties
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /**
   * Permissions-Policy: allow geolocation only from the same origin (self).
   * The therapist daily board requires navigator.geolocation to record
   * branch sign-in location.
   */
  { key: "Permissions-Policy", value: "geolocation=(self)" },
  // Content Security Policy
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://generativelanguage.googleapis.com https://api.anthropic.com https://*.neon.tech",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];
