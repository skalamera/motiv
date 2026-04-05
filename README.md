# Motiv

AI-powered car maintenance and diagnostics: schedules, owner manuals, NHTSA recalls, news, and a multimodal **Ask Motiv** assistant (Vercel AI SDK + Google Gemini via **AI Gateway**).

## Stack

- **Next.js 16** (App Router, TypeScript)
- **Supabase** — Auth, Postgres, Storage (`manuals`, `chat-attachments`)
- **Vercel AI SDK** — `streamText`, `useChat`, `generateObject`
- **Tailwind CSS v4** + shadcn/ui (Base UI)

## Setup

1. **Clone & install**

   ```bash
   npm install
   ```

2. **Supabase**

   - Create a project at [supabase.com](https://supabase.com).
   - Run the SQL in [`supabase/migrations/20250405120000_init.sql`](supabase/migrations/20250405120000_init.sql) (SQL editor or Supabase CLI).
   - Enable **Email** auth (or add OAuth) under Authentication.

3. **Environment**

   Copy [`.env.example`](.env.example) to `.env.local` and fill in:

   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` — server-only; used to load owner-manual PDFs for the AI (keep secret).
   - `AI_GATEWAY_API_KEY` — from [Vercel AI Gateway](https://vercel.com/docs/ai-gateway) (Gemini via Gateway / BYOK).
   - `NEWS_API_KEY` — optional; [NewsAPI.org](https://newsapi.org) for the News page.

4. **Dev**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign up, add a car, upload a manual PDF, then use **Ask Motiv** and **Maintenance**.

## Deploy (Vercel)

Production URL: **https://motiv-azure.vercel.app**

### Supabase Auth URLs (required for deployed auth)

In the [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Authentication** → **URL Configuration**:

| Setting | Value |
|--------|--------|
| **Site URL** | `https://motiv-azure.vercel.app` |
| **Additional Redirect URLs** | `https://motiv-azure.vercel.app/**` |

Wildcards are supported; see [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls). Add more rows if you use preview deployments (e.g. `https://motiv-git-*-stephens-projects-345f928b.vercel.app/**`) or a custom domain later.

### Push env vars to Vercel (CLI)

1. Copy [`.env.example`](.env.example) to **`.env.local`** and fill in real values (from Supabase **Project Settings → API** and Vercel **AI Gateway**).
2. From the repo root:

   ```bash
   chmod +x scripts/sync-env-to-vercel.sh
   ./scripts/sync-env-to-vercel.sh
   ```

   This runs `vercel env add` for **production**, **preview**, and **development** for:  
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `AI_GATEWAY_API_KEY`, and optional `NEWS_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`.

3. Trigger a **Redeploy** in Vercel (Deployments → … → Redeploy) so the new variables are picked up.

You can also paste the same keys in the Vercel project → **Settings → Environment Variables** UI.

- From Cursor, the **Vercel MCP** `deploy_to_vercel` tool can deploy the linked project from this workspace.

## Logos

- `public/logo_full.svg` — wordmark for auth and expanded sidebar.
- `public/logo_border_no_text.svg` — icon / favicon.

## API notes

- **Recalls:** `GET /api/recalls?carId=` → NHTSA `api.nhtsa.gov` (may rate-limit or block some networks).
- **News:** `GET /api/news?make=` → NewsAPI.
- **Chat:** `POST /api/chat` — UI message stream; optional `carId` and `queryMode` (`auto` | `maintenance` | `issue` | `visual`).
- **Schedule generation:** `POST /api/maintenance/generate` `{ carId }` — AI fills `maintenance_schedules` (replaces non-custom rows).

## License

Private / your org — adjust as needed.
