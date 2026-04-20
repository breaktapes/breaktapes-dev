# BREAKTAPES

Race history, medals, personal bests, upcoming races and wearable data for endurance athletes.

- **Production:** [app.breaktapes.com](https://app.breaktapes.com)
- **Staging:** [dev.breaktapes.com](https://dev.breaktapes.com)

## Local Development

```bash
cp .env.example .env   # fill in Supabase URL + anon key (see comments inside)
npm install
npm run dev            # Vite dev server at http://localhost:5173
```

## Project Structure

- `src/` — React app (pages, components, stores, hooks, lib)
- `worker/index.js` — Cloudflare Worker (SSR for `/u/:username` public profiles)
- `supabase/` — Supabase config + database migrations
- `tests/` — Legacy Jest/jsdom tests (SPA snapshot, kept for regression coverage)
- `CLAUDE.md` — Project memory and architecture reference (primary source of truth)
- `DESIGN.md` — Frontend design system (read before any UI change)
- `.claude/skills/` — gstack skills for Claude Code workflows

## Tests

```bash
npm test                # Legacy Jest tests (SPA snapshot)
npm run test:react      # Vitest + React Testing Library (React components)
npm run test:coverage   # Coverage report
```

## Deploy

Push to `staging` → auto-deploys to `dev.breaktapes.com`.
Push to `main` → auto-deploys to `app.breaktapes.com`.
Cloudflare Workers via GitHub Actions. See `CLAUDE.md` for the full pipeline and manual deploy instructions.
