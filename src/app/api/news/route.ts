import { createClient } from "@/lib/supabase/server";
import {
  fetchCarNews,
  mergeNewsArticlesByRecency,
  MAX_MAKES_PER_REQUEST,
  type NewsArticle,
} from "@/lib/news";

function parseMakes(url: URL): string[] {
  const multi = url.searchParams.get("makes");
  const single = url.searchParams.get("make");
  if (multi?.trim()) {
    const list = multi
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);
    return [...new Set(list)].slice(0, MAX_MAKES_PER_REQUEST);
  }
  if (single?.trim()) {
    return [single.trim()];
  }
  return [];
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const makes = parseMakes(new URL(req.url));
  if (makes.length === 0) {
    return Response.json(
      { error: "make or makes query parameter required" },
      { status: 400 },
    );
  }

  const key = process.env.NEWS_API_KEY;
  if (!key) {
    return Response.json({
      articles: [],
      configured: false,
      message: "Set NEWS_API_KEY for automotive headlines.",
    });
  }

  try {
    const perMake = await Promise.all(
      makes.map((make) =>
        fetchCarNews(`${make} automotive car news`, key).catch((err) => {
          console.error(`News fetch for ${make}:`, err);
          return [] as NewsArticle[];
        }),
      ),
    );
    const articles = mergeNewsArticlesByRecency(perMake);
    return Response.json({
      articles,
      configured: true,
      makes,
    });
  } catch (e) {
    console.error(e);
    return Response.json(
      {
        articles: [],
        configured: true,
        error: e instanceof Error ? e.message : "News request failed",
      },
      { status: 502 },
    );
  }
}
