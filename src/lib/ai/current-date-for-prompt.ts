/**
 * Per-request “as of” context for every model call. Evaluated on the server when
 * the API runs (often UTC on Vercel); include in system prompts or instruction text.
 */
export function currentDateForPrompt(): string {
  const now = new Date();
  const iso = now.toISOString();
  const utcCalendar = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return `**Current date and time (UTC):** ${utcCalendar} — ISO-8601: ${iso}. Use this when interpreting “today,” seasons, how old a document or TSB might be, warranty windows, and elapsed mileage/time since last service.`;
}
