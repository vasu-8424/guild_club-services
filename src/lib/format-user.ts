/**
 * Formats a user display name, appending '(deleted)' if the user has been soft-deleted.
 */
export function formatUserName(
  name: string | null | undefined,
  deletedAt?: Date | null | string
): string {
  if (!name) return "";
  if (deletedAt) {
    if (name.endsWith(" (deleted)")) return name;
    return `${name} (deleted)`;
  }
  return name;
}
