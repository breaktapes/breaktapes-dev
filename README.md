# BREAKTAPES

Single-page app for endurance athletes — track race history, medals, personal bests, upcoming races, and wearable health data.

- **Production:** [app.breaktapes.com](https://app.breaktapes.com)
- **Staging:** [dev.breaktapes.com](https://dev.breaktapes.com)

## Local preview

```bash
python3 -m http.server 3000
```

Then open `http://localhost:3000` in your browser.

## Project structure

- `index.html` — entire app (single-file SPA, ~10,000 lines of HTML/CSS/JS)
- `public/index.html` — deploy copy (always synced: `cp index.html public/index.html`)
- `supabase/` — Supabase project config + database migrations
- `tests/` — Jest + jsdom test suite (`npm test`)
- `CLAUDE.md` — project memory and architecture reference
- `DESIGN.md` — frontend design system (read before any UI changes)
- `.claude/skills/` — gstack skills for Claude Code workflows

## Tests

```bash
npm test              # run all tests (67 tests)
npm run test:coverage # with coverage report
```

## Deploy

Cloudflare Workers via GitHub Actions — push to `staging` branch deploys to `dev.breaktapes.com`, push to `main` deploys to `app.breaktapes.com`. See `CLAUDE.md` for the full pipeline and manual deploy instructions.
