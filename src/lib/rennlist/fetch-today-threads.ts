import { load } from "cheerio";
import type {
  RennlistTodayFetchResult,
  RennlistTodayThread,
} from "@/lib/rennlist/types";
import { RENNLIST_TODAY_POSTS_URL } from "@/lib/rennlist/types";
import { is991GenRelatedThread } from "@/lib/rennlist/filter-991";

const RENNLIST_FORUMS_BASE = "https://rennlist.com/forums";

const MAX_PAGES = 5;

/** Strip control chars that can break JSON / clients. */
function safeSnippet(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
}

function absForumUrl(href: string | undefined): string | null {
  if (!href?.trim()) return null;
  const h = href.trim();
  if (h.startsWith("http")) return h;
  return `${RENNLIST_FORUMS_BASE}/${h.replace(/^\//, "")}`;
}

function resolveRennlistHref(href: string): string {
  const h = href.replace(/&amp;/g, "&").trim();
  if (h.startsWith("http://") || h.startsWith("https://")) return h;
  if (h.startsWith("//")) return `https:${h}`;
  if (h.startsWith("/")) return `https://rennlist.com${h}`;
  return `${RENNLIST_FORUMS_BASE}/${h}`;
}

function parseSearchPage(
  html: string,
  threads: RennlistTodayThread[],
  seen: Set<string>,
): string | null {
  const $ = load(html);

  $("div.trow.text-center").each((_, el) => {
    const $row = $(el);
    const $a = $row.find('a[id^="thread_title_"]').first();
    if (!$a.length) return;

    const href = $a.attr("href")?.trim();
    if (!href) return;

    const url = absForumUrl(href);
    if (!url || seen.has(url)) return;
    seen.add(url);

    const title = safeSnippet($a.text().replace(/\s+/g, " "));
    if (!title) return;

    const $last = $row
      .find('.tcell.alt2.smallfont[title^="Replies:"] .text-right')
      .first();
    const lastActivityText = safeSnippet(
      $last
        .text()
        .replace(/\s+/g, " ")
        .replace(/\s*by\s+/i, " - "),
    );

    const $forumCell = $row
      .children("div.tcell.alt1.text-left")
      .filter((__, cell) => !$(cell).attr("id"))
      .first();
    const $forumA = $forumCell.find("a").first();
    const forumName =
      safeSnippet($forumA.text().replace(/\s+/g, " ")) || null;
    const forumHref = $forumA.attr("href");
    const forumUrl = forumHref ? absForumUrl(forumHref) : null;

    threads.push({
      title,
      url,
      lastActivityText: lastActivityText || "-",
      forumName,
      forumUrl,
    });
  });

  const nextHref = $("link[rel='next']").attr("href");
  return nextHref ? resolveRennlistHref(nextHref) : null;
}

const fetchOpts: RequestInit = {
  headers: {
    Accept: "text/html,application/xhtml+xml",
    "User-Agent": "Motiv/1.0 (Rennlist today-posts reader; contact app owner)",
  },
  next: { revalidate: 300 },
};

export async function fetchRennlistTodayThreads(): Promise<RennlistTodayFetchResult> {
  const sourceUrl = RENNLIST_TODAY_POSTS_URL;
  try {
    let html: string;
    try {
      const res = await fetch(sourceUrl, fetchOpts);
      if (!res.ok) {
        return {
          ok: false,
          error: `Rennlist returned HTTP ${res.status}`,
          sourceUrl,
        };
      }
      html = await res.text();
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Network error",
        sourceUrl,
      };
    }

    const threads: RennlistTodayThread[] = [];
    const seen = new Set<string>();
    let nextUrl: string | null;
    try {
      nextUrl = parseSearchPage(html, threads, seen);
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof Error
            ? `Could not parse Rennlist: ${e.message}`
            : "Could not parse Rennlist HTML",
        sourceUrl,
      };
    }

    for (let p = 1; p < MAX_PAGES && nextUrl; p++) {
      try {
        const res = await fetch(nextUrl, fetchOpts);
        if (!res.ok) break;
        const pageHtml = await res.text();
        nextUrl = parseSearchPage(pageHtml, threads, seen);
      } catch {
        break;
      }
    }

    const filtered = threads.filter(is991GenRelatedThread);

    return {
      ok: true,
      threads: filtered,
      fetchedAt: new Date().toISOString(),
      sourceUrl,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error ? e.message : "Unexpected error loading Rennlist",
      sourceUrl,
    };
  }
}
