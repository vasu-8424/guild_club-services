/**
 * Single source of truth for Application Version and Build ID
 */
export const APP_VERSION = "v1.6";

export function getBuildId(): string {
  return (
    process.env.NEXT_PUBLIC_BUILD_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ||
    "gcs-live"
  );
}

