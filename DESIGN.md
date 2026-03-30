# BREAKTAPES — Frontend Design System

> **Rule:** Every frontend change MUST conform to this document. If a change
> requires deviating from any decision here, STOP and ask the user before proceeding.
> This document is the single source of truth. It is updated only intentionally,
> never as a side effect of feature work.

---

## Aesthetic Identity

Dark archival athletic. Not generic SaaS dark mode — energetic, personal, nostalgic.
The emotional register is **pride + ambition + memory**. Think sports almanac, not health dashboard.

- Black/near-black surfaces as the foundation — three distinct levels with intentional contrast
- Brick vermilion (`#E84E1B`) as the primary accent — action, fire, achievement. Deliberately distinct from Strava's orange (`#FC4C02`).
- Warm gold (`#C8963C`) for Pro tier and achievements — vintage trophy, not cheap prize ribbon
- Electric green (`#00FF88`) reserved exclusively for live health/wearable data — HRV, readiness, fatigue. Never decorative.
- Warm stone (`#E8E0D5`) replaces cold white — references aged paper, race bibs, the archival quality of the product
- No blues, purples, or generic SaaS palettes

---

## Color Tokens — Dark Mode (canonical, default)

```css
/* Accent */
--accent:        #E84E1B;              /* primary action, active states, CTAs */
--accent-dim:    rgba(232,78,27,0.14); /* tinted backgrounds */
--accent-glow:   rgba(232,78,27,0.28); /* hover glow, radial accents */

/* Pro / Achievements */
--gold:          #C8963C;              /* Pro badge, tier indicator, medal gold */
--gold-dim:      rgba(200,150,60,0.12);
--gold-border:   rgba(200,150,60,0.30);

/* Health data only — never decorative */
--health:        #00FF88;
--health-dim:    rgba(0,255,136,0.12);

/* Surfaces */
--surface-base:  #080808;  /* page background */
--surface-1:     #111111;  /* cards, modals */
--surface-2:     #1C1C1C;  /* nested elements, inputs */
--surface-lift:  #242424;  /* hover states, selected */

/* Text */
--stone:         #E8E0D5;              /* primary text */
--muted:         rgba(232,224,213,0.40);
--muted2:        rgba(232,224,213,0.20);

/* Borders */
--border:        rgba(255,255,255,0.07);
--border2:       rgba(255,255,255,0.14);

/* Semantic */
--error:         #ff5555;
--error-dim:     rgba(255,85,85,0.14);

/* Flatlay marketplace only */
--flatlay-tile:  #F2EDE6;  /* warm cream product tile backgrounds */
--flatlay-text:  #111111;
```

---

## Color Tokens — Light Mode

Applied via `[data-theme="light"]` on `<html>`. Dark mode is the default. User preference persisted in `localStorage` under key `bt_theme`.

```css
[data-theme="light"] {
  /* Surfaces */
  --surface-base:  #F5F0E8;
  --surface-1:     #EDEBE6;
  --surface-2:     #E4E1DA;
  --surface-lift:  #D8D4CC;

  /* Text */
  --stone:         #1A1A1A;
  --muted:         rgba(26,26,26,0.50);
  --muted2:        rgba(26,26,26,0.30);

  /* Borders */
  --border:        rgba(0,0,0,0.08);
  --border2:       rgba(0,0,0,0.14);

  /* Accent (slightly darker for light mode contrast) */
  --accent:        #D4421A;
  --accent-dim:    rgba(212,66,26,0.12);
  --accent-glow:   rgba(212,66,26,0.22);

  /* Gold */
  --gold:          #9E6F20;
  --gold-dim:      rgba(158,111,32,0.10);
  --gold-border:   rgba(158,111,32,0.28);

  /* Health */
  --health:        #008840;
  --health-dim:    rgba(0,136,64,0.12);

  /* Semantic */
  --error:         #cc2200;
  --error-dim:     rgba(204,34,0,0.12);

  /* Flatlay */
  --flatlay-tile:  #ffffff;
  --flatlay-text:  #111111;
}
```

### Theme Toggle Implementation

```js
// Toggle
function setTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  sv('bt_theme', mode);
}

// Init (restore saved preference, default dark)
const savedTheme = lv('bt_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
```

Toggle button: sun/moon SVG icon in the header or Settings page. Label: "Light mode" / "Dark mode". Never show both simultaneously.

### Light Mode Key Rules
- Do NOT use pure white (`#ffffff`) as a surface in light mode — always warm stone cream
- The personality must feel identical to dark mode — same typography weight, same grain texture, same component shapes
- Grain texture overlay remains active in both modes (mix-blend-mode: overlay)

---

## Text Contrast Minimums (WCAG)

| Selector | Min opacity (dark) | Min opacity (light) |
|---|---|---|
| `.fl` form labels | 55% | 65% |
| `.fi::placeholder` | 40% | 45% |
| `.hist-sub` sub-info | 45% | 50% |
| `.s-tile-label` stat labels | 45% | 50% |
| `.menu-section-label` | 35% | 40% |
| `.map-pill-label` | decorative | decorative |
| `.tp-label` | decorative | decorative |

---

## Typography

**Headline font:** Barlow Condensed — 700/800/900 weight, uppercase, tracked
**Body font:** Barlow — 400/500/600 weight
**Data/metrics font:** Geist Mono — 300/400/500 weight, tabular-nums

### Loading
```html
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500;600&family=Geist+Mono:wght@300;400;500&display=swap" rel="stylesheet">
```

### Type Scale Tokens
```css
--text-xs:   10px;  /* captions, badges, sub-labels */
--text-sm:   12px;  /* secondary labels, meta info */
--text-base: 14px;  /* body text, inputs, card titles */
--text-md:   16px;  /* section headers, modal titles */
/* Headlines above 16px: use explicit px values (20/24/32/48) */
```

### Data/Metrics Type Scale
```css
/* Hero metric — finish times, career totals, momentum scores */
font-family: 'Geist Mono', monospace;
font-size: 48–72px; font-weight: 300;
letter-spacing: -0.02em;

/* Primary metric — split times, pace, scores */
font-family: 'Geist Mono', monospace;
font-size: 20–28px; font-weight: 400;
font-variant-numeric: tabular-nums;

/* Micro metric — sparkline labels, stat secondary, axis ticks */
font-family: 'Geist Mono', monospace;
font-size: 10–12px; font-weight: 400;
color: var(--muted);
```

### Rules
- **All metric/numeric values:** Geist Mono, never Barlow
- **Headlines:** Barlow Condensed 700+ with uppercase + `letter-spacing: 0.06em+`
- **Body:** Barlow regular weight — no uppercase
- **Filter pills, category tags:** Geist Mono lowercase (not uppercase)
- Never use font sizes below 10px
- Never use more than 4 distinct sizes on one screen

---

## Spacing Grid

**Base unit: 4px.** All spacing must be a multiple of 4.

```css
--sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px;  --sp-4: 16px;
--sp-5: 20px; --sp-6: 24px; --sp-8: 32px;
```

**Flatlay marketplace exception:** uses 8px base unit for more generous whitespace. Product card padding: 20px minimum.

---

## Breakpoints

**3-tier system — do not add new breakpoints without explicit user approval.**

| Tier | Query | Layout |
|---|---|---|
| Mobile | `max-width: 767px` | Single column, bottom nav, safe area insets |
| Tablet | `768px – 1023px` | Two-column cards, no bottom nav |
| Desktop | `min-width: 1024px` | Full layout, 860px max-width wrap |

Sub-mobile (existing patterns only — do not add new ones):
- `max-width: 480px` — compact input/label adjustments
- `max-width: 420px` — extreme micro-adjustments
- `max-width: 360px` — icon-only bottom nav (labels hidden)

---

## Navigation

### Mobile (≤767px)
Persistent 5-tab bottom nav bar:
```
[ Home ]  [ History ]  [ Medals ]  [ Map ]  [ Me ]
```
- Touch targets: `min-height: 48px; min-width: 44px` (WCAG minimum)
- Active: `color: var(--accent)`, `stroke: var(--accent)` on SVG
- Inactive: `color: var(--muted)`
- Press/tap: `transform: scale(0.92)` on `:active`
- Hamburger hidden on mobile (`display: none`)

### Desktop (≥768px)
Side menu via hamburger trigger. Bottom nav hidden.

### Settings (mobile)
Accessible via Settings button inside the Me/Athlete page — NOT in the hamburger.

### Theme Toggle
- Placed in the header or Settings section
- Sun icon = currently dark (shows "Light mode" label)
- Moon icon = currently light (shows "Dark mode" label)
- Persisted via `sv('bt_theme', mode)`, restored on init

---

## Icons

**Style:** Line icons only.

```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
  <!-- paths here -->
</svg>
```

Rules:
- `stroke-width="1.8"` always (no exceptions without approval)
- `fill="none"` always
- `stroke="currentColor"` always
- Inline SVG only — no external icon libraries
- No emoji as design elements (emoji only in achievement badges)
- No filled/solid icon variants

---

## Modals

- Slide-up from bottom with backdrop blur
- `.open` class toggles visibility
- Swipe-to-close: touch handler on `.modal-drag` and `.modal-head` only, 80px threshold
- `overscroll-behavior: contain` on `.modal-body`
- Safe area: `padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px))` on `.modal-foot`
- Landscape: `max-height: 85vh` at `(orientation: landscape) and (max-height: 500px)`
- Always include: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="<title-id>"`

---

## Forms & Validation

**Never use `alert()`.** Always use inline field-level feedback via `.fi-error` + `.fg-err-msg`.

```css
.fi-error { border-color: var(--error) !important; }
.fg-err-msg { font-size: 11px; color: var(--error-dim); display: none; margin-top: 3px; }
.fg-err-msg.show { display: block; }
```

### Safari Autofill — DO NOT TOUCH
`#authEmail` must stay `type="text"` + `autocomplete="off"`. This prevents Safari from incorrectly autofilling the email field. Do NOT change to `type="email"`.

### Password fields
`type="password"` + `autocomplete="current-password"`. Never revert to `type="text"`.

### API key fields
`type="password"` with eye-icon reveal toggle (`.fi-reveal`).

---

## Dashboard Widgets (Insight Cards)

All analytics dashboard cards share the `.insight-card` pattern.

```css
.insight-card {
  background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%), var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 16px;
  position: relative;
  overflow: hidden;
  min-height: 148px;
}

/* 3px accent line at top — color set per widget via --insight-accent */
.insight-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 3px;
  background: var(--insight-accent, var(--accent));
  border-radius: 14px 14px 0 0;
}
```

**Per-widget accent colors:**
| Widget | `--insight-accent` |
|---|---|
| Career Momentum | `var(--accent)` |
| Pacing IQ | `var(--health)` |
| Age-Grade | `var(--gold)` |
| Training Streak | `var(--accent)` |
| Race DNA | `var(--accent)` |
| Race Day Forecast | `var(--health)` |
| On This Day | `var(--gold)` |
| Performance Map | `var(--accent)` |

**Kicker labels:** Geist Mono, 9px, uppercase, letter-spacing 0.14em, color = `var(--insight-accent)`
**Widget titles:** Barlow Condensed 900, 13px, uppercase, color = `var(--muted)`
**Data values:** Geist Mono 300, 40–48px
**Sub-labels:** Geist Mono 400, 11px, color = `var(--muted)`

**Sparklines:** No axis labels. Trailing value only in Geist Mono 11px. Let the line speak.

---

## Pro Tier System

### Badge
```html
<span class="pro-pill">PRO</span>
```
```css
.pro-pill {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700; font-size: 10px;
  text-transform: uppercase; letter-spacing: 0.10em;
  color: var(--gold);
  background: var(--gold-dim);
  border: 1px solid var(--gold-border);
  border-radius: 4px;
  padding: 2px 7px;
  display: inline-flex; align-items: center;
}
```
- Width fits text — never fixed-width
- Placed inline with content title — never floating over card imagery
- Gold accent line (3px) on insight cards that are Pro-gated

### Locked States
**Do NOT use blur overlays.** Blur is punitive — it hides the content completely.

Instead: content renders at `opacity: 0.35`, no blur. A single line at the bottom of the card:
```
"Unlock with Pro ↗"
```
in Geist Mono 11px, `var(--muted)` color, with the "↗ Upgrade" link in `var(--gold)`.

On hover: content brightens to `opacity: 0.55`, thin `var(--gold)` border appears (200ms transition). No modal fires on hover — only on explicit click.

**Rationale:** The athlete can see what's there. That's aspirational. Blur says "this is hidden from you." Fade says "this is waiting for you."

### Pro Upgrade Modal
```
Headline:   "YOUR RACE CAREER, UNREDACTED."
Sub-copy:   "Pro unlocks deeper analysis — the numbers behind your numbers."
CTA:        Full-width button, --gold fill, #080808 text, Barlow Condensed 700
```
Single column. No pricing table layout. Three lines of copy. One button.

### AI Intelligence Cards
```css
.ai-card {
  border-left: 2px solid rgba(200,150,60,0.6);
  border-right: 1px solid var(--border);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  border-radius: 0 14px 14px 0;
}
```
Small `AI` badge: Geist Mono 9px, gold, top-right corner. Same gold border treatment as Pro.

---

## Flatlay Marketplace

The marketplace is a **fully distinct visual zone**. Users should feel they've entered a different room.

### Color rules inside marketplace
- **No `--accent` (brick red) anywhere in this section** — it fights with product photography
- Card tiles use `var(--flatlay-tile)` (#F2EDE6 dark / #ffffff light) — warm cream lightbox treatment
- Category filter pills use `var(--stone)` active state — no orange highlight

### Grid and spacing
- 8px base unit (vs 4px elsewhere) — more breathing room
- Product tiles: portrait aspect ratio preferred (3:4)
- No card borders on tiles — whitespace does the separation

### Typography inside marketplace
- **Headlines:** Barlow Condensed 800 in `var(--flatlay-text)` (#111111) — inverts from rest of app on light tiles
- **Brand names:** Barlow Condensed 500, 10–11px uppercase, muted
- **Product names:** Barlow Condensed 800, 14px uppercase
- **Prices:** Geist Mono 400, 12–14px
- **Category filter pills:** Geist Mono 11px, lowercase (not uppercase — reads as a catalog reference code system)

### Category filter pattern
```css
.flatlay-filter {
  font-family: 'Geist Mono', monospace;
  font-size: 11px; text-transform: lowercase;
  padding: 6px 14px; border-radius: 20px;
  border: 1px solid var(--border2);
  color: var(--muted); background: transparent;
}
.flatlay-filter.active {
  background: rgba(232,224,213,0.10);
  border-color: var(--stone);
  color: var(--stone);
}
```

### Browse vs. detail
Browse is editorial — photography makes the case. No "Add to Cart" in browse view. Tap opens a detail sheet with the action. Star ratings not shown in browse view.

---

## Upcoming Race Cards

Priority-based sizing system: A (hero), B (standard), C (compact).

```css
/* Base */
.upcoming-row {
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 10px; padding: 14px 16px;
  display: flex; align-items: center; justify-content: space-between;
}

/* Priority A — hero treatment */
.upcoming-row.priority-a {
  min-height: 80px;
  background: linear-gradient(90deg, var(--accent-dim) 0%, transparent 60%), var(--surface-1);
  border-color: rgba(232,78,27,0.14);
}
```

- **Race name:** Barlow Condensed 800, 15px, uppercase
- **Meta (sport + location):** Barlow 400, 12px, `var(--muted)`
- **Date:** Geist Mono 12px, `var(--accent)`
- **Countdown days:** Geist Mono 11px, `var(--muted)`

---

## Achievement Surfaces

### Hero block
```css
.ach-hero {
  background: linear-gradient(135deg,
    rgba(232,78,27,0.14) 0%,
    rgba(232,78,27,0.04) 32%,
    rgba(0,255,136,0.08) 100%
  );
}
.ach-hero::after {
  /* Green radial glow — bottom right, 240px diameter */
  background: radial-gradient(circle, rgba(0,255,136,0.12), transparent 70%);
}
```

- **Unlock count:** Barlow Condensed 900, 64px
- **Label:** Geist Mono 10px, uppercase, `var(--muted)`

### Achievement badges
- Fixed 72×72px, 12px border radius
- **Unlocked:** `rgba(232,78,27,0.08)` bg, `rgba(232,78,27,0.22)` border, shadow present
- **Locked:** `var(--surface-2)` bg, `opacity: 0.5`
- Emoji only for badge icons — SVG icons feel too cold for this context
- Badge label: Geist Mono 8px, uppercase

---

## Medal Tier Colors

```
Gold:     border #C8963C / bg rgba(200,150,60,0.12) / text #C8963C
Silver:   border #C8D4DC / bg rgba(200,212,220,0.10)
Bronze:   border #CD8C5A / bg rgba(205,140,90,0.10)
Finisher: border var(--accent) / bg var(--accent-dim)
```

Gold medal uses the same `--gold` token as Pro tier — consistent vocabulary: gold = achievement + earned.

---

## Race Cards (History)

```html
<div class="race-card">
  <div>
    <div class="race-name">Boston Marathon</div>
    <div class="race-meta">Apr 15, 2024 · Full Marathon · Boston, USA</div>
  </div>
  <div>
    <div class="race-time">2:58:44</div>   <!-- Geist Mono 300 -->
    <div class="race-placing">342 / 28,409</div>
  </div>
</div>
```

- **Race name:** Barlow Condensed 800, 15–16px, uppercase
- **Time:** Geist Mono 300, 20px — visually lighter than the headline
- **Meta/placing:** Barlow/Geist Mono 11–12px, `var(--muted)`

---

## Empty States

Every empty state: warmth + primary action + context. Never "No items found."

| Surface | Headline | CTA |
|---|---|---|
| History — no races | "No races yet. Every finish line starts with one." | `+ Log your first race` → `openRaceModal()` |
| History — no search results | "No races match — try a different search." | — |
| Medals — no medals | "No medals yet. Every race earns one." | `+ Log a race` → `openRaceModal()` |
| Map — no routes | "No routes yet. Log a race with a city to see your world map." | — |
| Dashboard — no races | "Your story starts here. Log a race →" | inline accent link → `openRaceModal()` |

CSS pattern: `.hist-empty { text-align: center; padding: 3rem 1rem; }` with Barlow Condensed 700 headline.

---

## Accessibility (required, not optional)

```css
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 3px; }
:focus:not(:focus-visible) { outline: none; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
```

Requirements:
- All interactive elements: `min-height: 44px; min-width: 44px`
- ARIA live region: `<div aria-live="polite" aria-atomic="true" id="a11y-status" class="sr-only">`
- Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Navigation: `aria-current="page"` on active item; `class="active"` on active bottom nav tab
- Buttons without visible text: `aria-label`
- Form inputs: `<label for="...">` wired to each input
- Light mode: re-test all text contrast ratios when switching theme

---

## iOS Safe Area

Required whenever `viewport-fit=cover` is set in the viewport meta tag:

```css
header { padding-top: env(safe-area-inset-top, 0px); height: calc(56px + env(safe-area-inset-top, 0px)); }
main { margin-top: calc(56px + env(safe-area-inset-top, 0px)); }
.modal-foot { padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px)); }
.modal { max-height: calc(92vh - env(safe-area-inset-bottom, 0px)); }
.bottom-nav { padding-bottom: env(safe-area-inset-bottom, 0px); }
main { padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)); }
#page-map { height: calc(100vh - 56px - env(safe-area-inset-top, 0px)); }
```

---

## Brand Copy Voice

Sentence case. Energetic. Athletic. Personal. Never corporate SaaS.

**✅ Correct:**
- "No races yet. Every finish line starts with one."
- "Your race career, unredacted."
- "Drop an email to get started."
- "Password needs at least 6 characters."

**❌ Wrong:**
- "NO DATA AVAILABLE"
- "Please enter a valid email address."
- "Your all-in-one race tracking solution"
- "An error occurred. Please try again."

---

## App Architecture

- Single-file SPA: all code in `index.html` (~10,000+ lines)
- No build step, no bundler
- Vanilla HTML/CSS/JS
- Supabase for auth + data
- Cloudflare Pages for hosting

### Authentication
- App is **authenticated-only** — no guest mode
- If unauthenticated, the landing screen / auth modal handles it
- Auth state variable: `authUser`

---

## What This Document Does NOT Cover

- Backend/API design
- Supabase schema
- CI/CD pipeline
- Non-frontend CLAUDE.md rules

**When in doubt about any frontend decision not covered here: STOP and ask the user before implementing.**

---

## Theme System

Themes are applied via `data-theme` attribute on `<html>`. Stored in `localStorage` under `bt_theme`. Default is `carbon-chrome` (the `:root` values). Pro themes are gated by `hasProAccess()`.

### Typography rule (non-negotiable)
**All themes share identical typography.** Barlow Condensed / Barlow / Geist Mono weights, sizes, and letter-spacing NEVER change between themes. Only color tokens change.

### Theme init
```js
const savedTheme = localStorage.getItem('bt_theme') || 'carbon-chrome';
if (savedTheme !== 'carbon-chrome') {
  document.documentElement.setAttribute('data-theme', savedTheme);
}
```

### `setTheme(name)` — guarded by Pro access
```js
const PRO_THEMES = ['deep-space','race-night','obsidian','acid-track','titanium','ember','polar-circuit'];
function setTheme(name) {
  if (PRO_THEMES.includes(name) && !hasProAccess()) { openProModal('themes'); return; }
  document.documentElement.setAttribute('data-theme', name === 'carbon-chrome' ? '' : name);
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('bt_theme', name);
}
```

### Token overrides per theme (only changes from `:root`)

**`[data-theme="light"]`** — always available (free)
```css
color-scheme: light;
--black: #F5F0E8;  --surface: #EDE9E0;  --surface2: #E4E1DA;  --surface3: #D8D4CC;
--white: #1A1A1A;  --orange: #D4421A;
--orange-dim: rgba(212,66,26,0.12);  --orange-glow: rgba(212,66,26,0.22);
--muted: rgba(26,26,26,0.50);  --muted2: rgba(26,26,26,0.30);
--border: rgba(0,0,0,0.08);  --border2: rgba(0,0,0,0.14);
--green: #008840;  --green-dim: rgba(0,136,64,0.12);
--shell-top-gradient: #F5F0E8;  --shell-bottom-gradient: #F5F0E8;
```

**`[data-theme="deep-space"]`** — Pro
```css
--black: #020206;  --surface: #0A0A14;  --surface2: #12121C;  --surface3: #1A1A26;
--white: #D8DCFF;  --orange: #5B6EF5;
--orange-dim: rgba(91,110,245,0.14);  --orange-glow: rgba(91,110,245,0.28);
--muted: rgba(216,220,255,0.40);  --muted2: rgba(216,220,255,0.20);
--border: rgba(91,110,245,0.10);  --border2: rgba(91,110,245,0.18);
```

**`[data-theme="race-night"]`** — Pro
```css
--black: #050505;  --surface: #0D0D0D;  --surface2: #161616;  --surface3: #1F1F1F;
--white: #F5F5F5;  --orange: #E8F000;
--orange-dim: rgba(232,240,0,0.12);  --orange-glow: rgba(232,240,0,0.25);
--muted: rgba(245,245,245,0.38);  --muted2: rgba(245,245,245,0.18);
--border: rgba(232,240,0,0.08);  --border2: rgba(232,240,0,0.16);
```

**`[data-theme="obsidian"]`** — Pro
```css
--black: #000000;  --surface: #080808;  --surface2: #101010;  --surface3: #181818;
--white: #E4EAF0;  --orange: #B8C4D0;
--orange-dim: rgba(184,196,208,0.12);  --orange-glow: rgba(184,196,208,0.24);
--muted: rgba(228,234,240,0.38);  --muted2: rgba(228,234,240,0.18);
--border: rgba(255,255,255,0.07);  --border2: rgba(255,255,255,0.13);
```

**`[data-theme="acid-track"]`** — Pro
```css
--black: #030603;  --surface: #080E08;  --surface2: #0F160F;  --surface3: #161E16;
--white: #E0F0E0;  --orange: #39FF14;  --green: #39FF14;
--orange-dim: rgba(57,255,20,0.12);  --orange-glow: rgba(57,255,20,0.25);
--muted: rgba(224,240,224,0.40);  --muted2: rgba(224,240,224,0.20);
--border: rgba(57,255,20,0.08);  --border2: rgba(57,255,20,0.16);
```

**`[data-theme="titanium"]`** — Pro
```css
--black: #080A0C;  --surface: #10141A;  --surface2: #181E26;  --surface3: #202830;
--white: #CDD6E0;  --orange: #8FA0B0;
--orange-dim: rgba(143,160,176,0.12);  --orange-glow: rgba(143,160,176,0.25);
--muted: rgba(205,214,224,0.40);  --muted2: rgba(205,214,224,0.20);
--border: rgba(255,255,255,0.07);  --border2: rgba(255,255,255,0.13);
```

**`[data-theme="ember"]`** — Pro
```css
--black: #0A0400;  --surface: #140800;  --surface2: #1E0D00;  --surface3: #281200;
--white: #F0E0CC;  --orange: #FF8C00;
--orange-dim: rgba(255,140,0,0.14);  --orange-glow: rgba(255,140,0,0.28);
--muted: rgba(240,224,204,0.40);  --muted2: rgba(240,224,204,0.20);
--border: rgba(255,140,0,0.08);  --border2: rgba(255,140,0,0.16);
```

**`[data-theme="polar-circuit"]`** — Pro
```css
--black: #020810;  --surface: #060E18;  --surface2: #0C1420;  --surface3: #121A28;
--white: #CCE8F4;  --orange: #00C4F0;
--orange-dim: rgba(0,196,240,0.12);  --orange-glow: rgba(0,196,240,0.25);
--muted: rgba(204,232,244,0.40);  --muted2: rgba(204,232,244,0.20);
--border: rgba(0,196,240,0.08);  --border2: rgba(0,196,240,0.16);
```

### Theme picker UI
Location: Settings modal, above the API key section.
- Free users see CARBON + CHROME + LIGHT as available; 7 Pro themes show locked `PRO` pill
- Tapping a locked theme calls `openProModal('themes')` instead of applying
- Active theme row: `border-left: 2px solid var(--orange)` + slight surface lift background
- Each row: 36×36px swatch (bg = surface color, bottom strip = accent), name in Barlow Condensed 700 uppercase, PRO pill if locked

---

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-03-30 | Accent shifted from #FF4D00 to #E84E1B | Too close to Strava's #FC4C02 — brand differentiation risk; brick vermilion has archival warmth |
| 2026-03-30 | Added Geist Mono as dedicated data/metrics font | Numbers had no visual distinction from body text; Geist Mono + Barlow Condensed creates legible rhythm |
| 2026-03-30 | Added warm stone light mode (#F5F0E8 surfaces) | User request; NOT a generic white inversion — same archival personality in daylight |
| 2026-03-30 | Added --gold (#C8963C) for Pro + achievement medal gold | Vintage trophy vs cheap prize ribbon; consistent vocabulary across Pro badge + medal tier |
| 2026-03-30 | Documented dashboard widget system (insight cards + --insight-accent) | 10 analytics widgets landed in Sessions 7-8 with no DESIGN.md coverage |
| 2026-03-30 | Documented Pro tier locked state pattern (opacity fade, not blur) | Blur is punitive; opacity fade at 35% is aspirational — user sees what they're unlocking |
| 2026-03-30 | Documented Flatlay marketplace as fully distinct zone | No orange accent inside marketplace; warm cream tiles; Geist Mono lowercase filter pills |
| 2026-03-30 | Documented upcoming race card priority system (A/B/C) | Gradient + border treatment for Priority A; pure surface for B/C |
| 2026-03-30 | Documented achievement surface patterns | Hero gradient (orange+green), unlocked badge glow, locked at 50% opacity |
| 2026-03-30 | Restricted --health (#00FF88) to live health data only | Was being used decoratively; should signal real-time wearable data exclusively |
