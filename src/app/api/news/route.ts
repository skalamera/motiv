import { createClient } from "@/lib/supabase/server";
import { fetchCarNews } from "@/lib/news";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const make = new URL(req.url).searchParams.get("make");
  if (!make?.trim()) {
    return Response.json({ error: "make required" }, { status: 400 });
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
    const articles = await fetchCarNews(
      `${make.trim()} automotive car news`,
      key,
    );
    return Response.json({ articles, configured: true });
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
