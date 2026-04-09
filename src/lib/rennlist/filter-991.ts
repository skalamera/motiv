import type { RennlistTodayThread } from "@/lib/rennlist/types";

/**
 * Keeps threads that are plausibly 991.2–related: explicit "991.2" in copy, or
 * posted under Rennlist's 991-generation forum slugs / forum names (excludes 992).
 */
export function is991GenRelatedThread(t: RennlistTodayThread): boolean {
  const title = (t.title || "").toLowerCase();
  const forum = (t.forumName || "").toLowerCase();
  const url = (t.url || "").toLowerCase();
  const forumUrl = (t.forumUrl || "").toLowerCase();
  const blob = `${title} ${forum}`;

  if (/\b991\.2\b/.test(blob) || /\b991-2\b/.test(blob)) return true;

  if (url.includes("/forums/991") || forumUrl.includes("/forums/991")) return true;
  if (/\/991[-/]/i.test(url) || forumUrl.includes("/991-")) return true;

  if (/\b991\b/.test(forum) && !/\b992\b/.test(forum)) return true;

  return false;
}
