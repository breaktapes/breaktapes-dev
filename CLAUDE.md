# BREAKTAPES — Claude Project Memory (Trunk)

> **Instruction:** After every commit merged to `main`, update this file and all memory documents under `docs/memory/` to reflect new learnings, architectural changes, and session decisions. Keep these files current — they are the source of truth for every Claude session.

---

## Project Overview

**BREAKTAPES** is a single-page app for endurance athletes to track race history, medals, personal bests, upcoming races, and wearable health data.

| Environment | URL | Purpose |
|---|---|---|
| Production | `app.breaktapes.com` | Live users — open sign-up |
| Staging | `dev.breaktapes.com` | Testing — invite-only, no public sign-up |

- **Hosting:** Cloudflare Workers (static assets) via `wrangler.toml`
  - Account ID: `b09f233e618dc7f23bcb247c947eb303`
  - Zone ID: `7d1d8be858893e977e57b0455ed2388f`
  - Assets served from `public/` directory (contains only `index.html`)
- **Production Supabase:** `https://kmdpufauamadwavqsinj.supabase.co` (project: `breaktapes-prod`)
- **Staging Supabase:** `https://yqzycwuyhvzkbofwkazr.supabase.co` (project: `breaktapes-dev`)
- **Local preview:** `python3 -m http.server 3000` (serves from root; access `index.html` directly)

### Deploy commands
```bash
# Production (always from main)
wrangler deploy --env=""

# Staging (from any branch)
wrangler deploy --env staging
```

> **Important:** After editing `index.html`, copy it to `public/` before deploying:
> `cp index.html public/index.html && wrangler deploy --env=""`
> The `public/` directory is the Cloudflare asset source. `index.html` at root is the source of truth for development.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS — single file (`index.html`) |
| Map | Leaflet.js 1.9.4 |
| Backend | Supabase (auth + postgres + storage) |
| Deployment | Cloudflare Pages (wrangler) |
| Fonts | Barlow Condensed (headlines) + Barlow (body) |
| Weather | Open-Meteo API (free, no key required) |
| AI parsing | Claude API (user-supplied key, stored in localStorage) |
| Routing/geocode | OpenRouteService + Nominatim |

---

## Architecture

### Single-file structure (`index.html`)
The entire app lives in one HTML file (~5,800+ lines). Sections are organized as:
1. CSS tokens / reset / component styles
2. HTML markup (pages, modals, landing screen)
3. JavaScript (data, auth, render functions, integrations)

### Page system
Pages use `id="page-*"` with `.page` / `.page.active` CSS classes. Navigation is handled by `go(page)` which sets active class and calls `render(page)`.

Pages: `dashboard`, `pace`, `medals`, `history`, `athlete`, `map`, `training`

### State management
- Local state: `localStorage` via `sv(k,v)` helper
- Remote state: Supabase `app_state` table (synced on auth)
- Race data: `RACES` array (in-memory), synced to Supabase
- Auth: Supabase Auth (email/password), guest mode supported

### Supabase tables
| Table | Purpose |
|---|---|
| `app_state` | Per-user app state (races, settings, athlete profile) |
| `race_catalog` | Global race database (~1,068+ rows, searchable) |
| `race_medal_community` | Community-uploaded medal photos |

---

## Design System

### Color tokens
```
--black:      #000000
--white:      #F5F5F5
--orange:     #FF4D00      (primary accent)
--orange-dim: rgba(255,77,0,0.12)
--orange-glow:rgba(255,77,0,0.25)
--green:      #00FF88      (secondary accent)
--surface:    #0D0D0D
--surface2:   #141414
--surface3:   #1A1A1A
--border:     rgba(245,245,245,0.06)
--border2:    rgba(245,245,245,0.12)
--muted:      rgba(245,245,245,0.35)
--muted2:     rgba(245,245,245,0.18)
```

### Medal tier colors
- Gold: `#FFD770` / `#B8860B` / `#FFF0A0`
- Silver: `#C8D4DC` / `#6A7880` / `#E8F0F4`
- Bronze: `#CD8C5A` / `#7A4420` / `#F0C090`
- Finisher: uses `--orange`

### Typography
- Headlines: `Barlow Condensed` (700/800/900 weight), uppercase, tracked
- Body: `Barlow` (400/500/600)

### Component patterns
- Buttons: `.cta-btn` (orange fill), ghost variants
- Cards: dark surface (`--surface2`/`--surface3`) with subtle border
- Modals: slide-up with backdrop blur, `.open` class toggle
- Grain texture overlay on `body::after` (z-index 9999, mix-blend-mode overlay)
- All borders: thin 1px with very low opacity white

---

## Key Functions Reference

| Function | Purpose |
|---|---|
| `go(page)` | Navigate to a page |
| `render(p)` | Dispatch page render |
| `renderDash()` | Build dashboard view |
| `renderMedals()` | Build medal wall |
| `renderHistory()` | Build race history list |
| `renderAthlete()` | Build athlete profile |
| `renderMap()` | Init Leaflet map + routes |
| `renderGreeting()` | Weather + time greeting |
| `initAuth()` | Bootstrap Supabase auth |
| `loadRaceCatalog()` | Fetch race DB from Supabase |
| `syncRemoteState()` | Push/pull app state to Supabase |
| `callClaude(messages)` | Hit Claude API for AI features |
| `buildPBMap()` | Compute personal bests |
| `submitRace()` | Add race to RACES array |
| `deleteRace(id)` | Remove race |
| `openRaceDetail(id)` | Open race detail modal |

---

## External Integrations

### Supabase Auth
- Email/password sign-up and sign-in
- Guest mode (no account required, data stays local)
- Auth state managed via `refreshAuthState()` / `initAuth()`

### Open-Meteo (Weather)
- Free API, no key required
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Uses browser geolocation; coordinates cached 1hr in localStorage to avoid repeated permission prompts
- Displays 6-hour forecast pills on dashboard greeting

### Claude API (AI race parsing)
- User supplies their own Anthropic API key (stored in localStorage)
- Used for: race text parsing (`parseAI`), race photo parsing (`parsePhoto`), course info lookup (`fetchCourseInfo`), race name autocomplete (`rdLookupRace`)
- Model: `claude-haiku` (fast, cheap)

### Leaflet + OpenRouteService + Nominatim
- Race map page shows route lines between race cities
- Country polygons fetched from `restcountries.com` for hover highlighting
- Geocoding: Nominatim (OpenStreetMap)
- Routing: OpenRouteService

### Strava
- OAuth integration for activity sync
- Token refresh handled client-side
- Activities imported and matched to races by distance/type

---

## Race Catalog

- Stored in Supabase `race_catalog` table
- ~1,068+ rows (refreshed March 2026)
- Fields: `name`, `city`, `country`, `month`, `day`, `distance`, `sport`, `priority` (A/B/C)
- C-priority races excluded from some charts (progress over time graph)
- Migrations: `20260323160000`, `20260323160001`, `20260324120000` (v1 refresh), `20260324130000` (v2), `20260324150000` (v3)

---

## Development Workflow

- All work happens in Claude Code worktrees (`/Users/akrish/DEV/.claude/worktrees/<branch>`)
- PRs merge into `main`
- Branch naming: `claude/<adjective>-<surname>` pattern (e.g. `claude/frosty-wozniak`)
- Deploy: Cloudflare Pages auto-deploys from `main` (or via `wrangler deploy`)

---

## Session History Summary

### Foundational commits
- `ccfbfa8` Initial project setup
- `c199dd2` Supabase authentication added
- `a2bd476` Supabase app state sync
- `5ea4ac2` Replace hardcoded RACE_DB with Supabase `race_catalog` fetch

### Feature work
- `cb291e2` Landing screen for unauthenticated users
- `2fa1d33` Fix browser autofill on dashboard (Safari issue)
- `f7aabc9` PR strip: distance tabs + top-3 gold/silver/bronze cards
- `33f5e68` Split PR strip into Running / Triathlon groups
- `fc90deb` Fix custom distance sorting (90K after Marathon)
- `02e781e` Course Records redesign (formerly Matched Races)
- `269155e` Progress chart: monthly x-axis + average line hover tooltip
- `e213c6f` Total race time in country map tooltip
- `de1c616` Race map rework: remove arcs, add Leaflet routes + hover tooltip
- `ac160f0` Map stat pills moved to bottom-left
- `235a621` Country hover highlight + fix 6-hour weather forecast
- `3fb24bf` Medal Wall: spotlight, PB shimmer, tier badges, achievement system
- `324c478` Medal wall: photo-first with mix-blend-mode multiply
- `471b98b` Community medal photos (Supabase table + frontend)
- `06a27f9` Medal upload workflow: `medals-to-upload/` folder + `upload-medals.sh`
- `88ef04e` Open Wearables: 6 integrations (readiness, training load, VO2, sleep, fatigue, OW workouts)
- `38eb3b6` Race catalog v3 + map/weather/UI improvements
- `12ff4c7` Block dashboard render until auth confirmed

### Infrastructure
- `82fcb9a` race_catalog Supabase migration + seed
- `20260324*` Race catalog v1/v2/v3 refresh migrations
- `20260324160000` race_medal_community migration

---

## Known Issues / Watch Points

- Safari autofill: fixed with `autocomplete="off"` + `readonly` trick on inputs; do not revert
- Geolocation caching: coords cached 1hr in localStorage under key `geo_cache` to avoid repeated browser permission prompts
- Race catalog priority: C-priority races intentionally excluded from progress-over-time chart
- Auth guard: dashboard must not render until `initAuth()` resolves — guard is in place, do not remove
