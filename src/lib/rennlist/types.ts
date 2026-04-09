const RENNLIST_FORUMS_BASE = "https://rennlist.com/forums";

/** vBulletin "today's posts" search - stable (unlike ephemeral searchid URLs). */
export const RENNLIST_TODAY_POSTS_URL = `${RENNLIST_FORUMS_BASE}/search.php?do=getdaily`;

export type RennlistTodayThread = {
  title: string;
  url: string;
  lastActivityText: string;
  forumName: string | null;
  forumUrl: string | null;
};

export type RennlistTodayFetchResult =
  | {
      ok: true;
      threads: RennlistTodayThread[];
      fetchedAt: string;
      sourceUrl: string;
    }
  | { ok: false; error: string; sourceUrl: string };
