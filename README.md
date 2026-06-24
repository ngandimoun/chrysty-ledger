# Chrysty AI Ledger

AI-powered small business accounting workspaces — track expenses, receipts, and invoices with chat, document extraction, and structured financial assets.

**Production:** https://ledger.chrysty.dev  
**Worker slug:** `ledger`  
**Platform API:** https://api.chrysty.dev

## Stack

- [Next.js 16](https://nextjs.org/) — App Router, React 19, TypeScript
- [Supabase](https://supabase.com/) — shared chrysty project (workspaces, messages, assets, uploads)
- [Moonshot Kimi](https://platform.kimi.ai/) — finance AI chat and document extraction
- [Mastra](https://mastra.ai/) — multi-agent workflows (bulk import, expense analysis, reports)
- [Trigger.dev](https://trigger.dev/) — background jobs
- Gemini — speech-to-text in chat

## Getting started

```bash
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For background jobs in a second terminal:

```bash
npm run trigger:dev
```

## Supabase

Apply migrations in `supabase/migrations/` to the shared **chrysty** Supabase project before first deploy. The `ledger-uploads` storage bucket is required.

## Deploy on Vercel (Pro)

1. Copy `.env.example` values to Vercel project environment variables.
2. Set `NEXT_PUBLIC_APP_URL=https://ledger.chrysty.dev`.
3. In Supabase Auth → URL Configuration, allow `https://ledger.chrysty.dev/auth/callback` (or keep the shared `https://*.chrysty.dev/**` wildcard used by other workers).
4. Use the Supabase **transaction pooler** for `DATABASE_URL` (port `6543`, append `?pgbouncer=true`).
4. Long AI routes use `maxDuration = 300` on Vercel Pro. Keep `SERVERLESS_BUDGET_MS=280000` and the `MOONSHOT_*` timeout values within that budget.
5. Deploy with `next build` (Vercel runs this automatically). Run `npm run typecheck` and `npm run test:smoke` locally first.

Required env vars on Vercel:

- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WORKER_SLUG=ledger`
- `CHRYSTY_API_URL`, `NEXT_PUBLIC_CHRYSTY_API_URL`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_UPLOADS_BUCKET=ledger-uploads`
- `MOONSHOT_API_KEY` (+ Moonshot config from `.env.example`)
- `DATABASE_URL` (Mastra agent workflows)
- `GOOGLE_API_KEY` or `GEMINI_API_KEY` (speech-to-text)
- `TRIGGER_SECRET_KEY`, `TRIGGER_PROJECT_REF`

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run test:smoke` | Smoke tests |
| `npm run trigger:dev` | Trigger.dev local worker |
| `npm run trigger:deploy` | Deploy tasks to Trigger.dev (prod) |
