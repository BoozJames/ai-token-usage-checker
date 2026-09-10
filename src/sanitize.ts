const SECRET_PATTERN = /(?:sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9_]{8,}|github_pat_[A-Za-z0-9_]{8,}|Bearer\s+\S+)/gi;
const PATH_PATTERN = /(?:[A-Za-z]:\\|\/(?:home|Users)\/)[^\r\n,"']+/g;

export function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(SECRET_PATTERN, "[redacted]")
    .replace(PATH_PATTERN, "[path]")
    .slice(0, 300);
}
