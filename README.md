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

- Link the repo to Vercel and set the same env vars (use Vercel’s AI Gateway integration for `AI_GATEWAY_API_KEY` if desired).
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
