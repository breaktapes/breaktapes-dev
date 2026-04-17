# BREAKTAPES — Frontend Design System

> **Rule:** Every frontend change MUST conform to this document. If a change
> requires deviating from any decision here, STOP and ask the user before proceeding.
> This document is the single source of truth. It is updated only intentionally,
> never as a side effect of feature work.

---

## Layout Uniformity Rule

**All layout containers use `display: grid; grid-template-columns: 1fr; gap: 1rem`. No exceptions.**

This applies to every page wrapper, zone container, widget list, and content grouping in the app — current and future. Do not introduce flex-column with custom gaps, or any gap value other than `1rem`, for between-element spacing.

- `.wrap`, `.dash-shell`, `.dash-zone`, `.dash-zone-grid` — all grid, 1fr, 1rem gap
- New page sections, new widget containers, new list layouts — same rule
- **Exempt:** internal widget layouts (e.g., 4-col stat grid, 2-col insight row, inline pill rows). These are within-widget, not between-widget, and may use their own grid/flex as needed.

### Overflow Prevention Rule

**Every grid container must carry `min-width: 0`.**

CSS grid children default `min-width` to `auto`, which lets them grow past their `1fr` column and cause horizontal overflow. The blanket rule:

```css
.wrap { min-width: 0; }
.wrap > * { min-width: 0; }
```

Apply `min-width: 0` to every new grid/flex container that is itself a grid child. For containers that clip content, also add `overflow: hidden`. This is especially load-bearing on iOS Safari where overflowing grid children expand `body.scrollWidth`.

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

> **Implementation note:** Token names in the codebase use legacy names copied verbatim from the original `index.html`. Do NOT rename them — 494+ references exist across the codebase. The semantic concepts below map to these actual CSS variable names.

```css
/* Accent (primary action, active states, CTAs) */
--orange:      #E84E1B;
--orange-ch:   232,78,27;             /* channel var for rgba() gradients */
--orange-dim:  rgba(232,78,27,0.14);
--orange-glow: rgba(232,78,27,0.28);

/* Pro / Achievements */
--gold:        #C8963C;
--gold-dim:    rgba(200,150,60,0.12);
--gold-border: rgba(200,150,60,0.30);
/* gradient shorthands */
--grad-orange: linear-gradient(135deg, #E84E1B 0%, #C03A10 100%);
--grad-gold:   linear-gradient(135deg, #C8963C 0%, #A07030 100%);

/* Health data only — never decorative */
--green:       #00FF88;
--green-ch:    0,255,136;
--green-dim:   rgba(0,255,136,0.12);

/* Purple — triathlon / special variants only */
--purple:      #7C3AED;
--purple-ch:   124,58,237;

/* Surfaces */
--black:       #000000;   /* page background */
--surface:     #0D0D0D;   /* cards, modals */
--surface2:    #141414;   /* nested elements, inputs */
--surface3:    #1A1A1A;   /* hover states, selected */

/* Text */
--white:       #E8E0D5;              /* primary text (warm stone) */
--muted:       rgba(232,224,213,0.40);
--muted2:      rgba(232,224,213,0.20);

/* Borders */
--border:      rgba(245,245,245,0.06);
--border2:     rgba(245,245,245,0.12);

/* Semantic */
--error:       #ff5555;
--error-dim:   rgba(255,85,85,0.14);

/* Flatlay marketplace only */
--flatlay-tile: #F2EDE6;  /* warm cream product tile backgrounds */
--flatlay-text: #111111;
```

### Semantic concept → actual token mapping

| Concept | Token name | Value |
|---|---|---|
| Primary accent | `--orange` | `#E84E1B` |
| Page background | `--black` | `#000000` |
| Card surface | `--surface` | `#0D0D0D` |
| Nested surface | `--surface2` | `#141414` |
| Hover surface | `--surface3` | `#1A1A1A` |
| Primary text | `--white` | `#E8E0D5` |
| Secondary accent | `--green` | `#00FF88` |
| Pro / gold | `--gold` | `#C8963C` |

---

## Color Tokens — Light Mode

Applied via `[data-theme="light"]` on `<html>`. Dark mode is the default. User preference persisted in `localStorage` under key `bt_theme`.

```css
[data-theme="light"] {
  color-scheme: light;
  --black:    #F5F0E8;
  --surface:  #EDE9E0;
  --surface2: #E4E1DA;
  --surface3: #D8D4CC;
  --white:    #1A1A1A;
  --orange:   #D4421A;
  --orange-ch: 212,66,26;
  --orange-dim:  rgba(212,66,26,0.12);
  --orange-glow: rgba(212,66,26,0.22);
  --muted:    rgba(26,26,26,0.50);
  --muted2:   rgba(26,26,26,0.30);
  --border:   rgba(0,0,0,0.08);
  --border2:  rgba(0,0,0,0.14);
  --green:    #008840;
  --green-dim: rgba(0,136,64,0.12);
  --gold:     #9E6F20;
  --gold-dim: rgba(158,111,32,0.10);
  --gold-border: rgba(158,111,32,0.28);
  --error:    #cc2200;
  --error-dim: rgba(204,34,0,0.12);
  --flatlay-tile: #ffffff;
  --flatlay-text: #111111;
  --shell-top-gradient: #F5F0E8;
  --shell-bottom-gradient: #F5F0E8;
}
```

### Theme Toggle Implementation

```js
// Toggle
const PRO_THEMES = ['deep-space','race-night','obsidian','acid-track','titanium','ember','polar-circuit'];
function setTheme(name) {
  if (PRO_THEMES.includes(name) && !hasProAccess()) { openProModal('themes'); return; }
  document.documentElement.setAttribute('data-theme', name === 'carbon-chrome' ? '' : name);
  localStorage.setItem('bt_theme', name);
}

// Init (restore saved preference, default carbon-chrome)
const savedTheme = localStorage.getItem('bt_theme') || 'carbon-chrome';
if (savedTheme !== 'carbon-chrome') {
  document.documentElement.setAttribute('data-theme', savedTheme);
}
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

CSS font vars:
```css
--headline: 'Barlow Condensed', sans-serif;
--body:     'Barlow', sans-serif;
--mono:     'Geist Mono', monospace;
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
font-family: 'Barlow Condensed', sans-serif;  /* card-v3 value uses Barlow Condensed 900 48px */
font-size: 48px; font-weight: 900;
letter-spacing: -0.02em; line-height: 1;

/* Exception: insight-card data values use Geist Mono */
font-family: 'Geist Mono', monospace;
font-size: 40–48px; font-weight: 300;

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
- **All metric/numeric values:** Geist Mono (except card-v3 values which use Barlow Condensed 900)
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
- `max-width: 360px` — bottom nav labels shrink to 9px (never hide — always show label)

---

## Navigation

### Mobile (≤767px)
Persistent 5-tab bottom nav bar:
```
[ Home ]  [ Races ]  [ Gear ]  [ Train ]  [ You ]
   /       /races     /gear     /train     /you
```
- Touch targets: `min-height: 44px; min-width: 44px` (WCAG minimum)
- Active: `color: var(--orange)`, `stroke: var(--orange)` on SVG
- Inactive: `color: var(--muted)`
- Active indicator: 2px gradient bar at top of tab (`--grad-orange`), spring animation via framer-motion
- Active bg: `linear-gradient(180deg, rgba(232,78,27,0.10) 0%, rgba(232,78,27,0.04) 100%)`
- Press/tap: `transform: scale(0.92)` on `:active`
- Hamburger hidden on mobile (`display: none`)
- Labels: Barlow Condensed 700, 10px, uppercase, 0.08em tracking. At `max-width: 360px`: 9px.

### Desktop (≥768px)
Side menu via hamburger trigger. Bottom nav hidden.

### Page Title Bar (mobile only)
A sticky `#pageTitleBar` element sits at the top of `<main>` (`display: none` on ≥768px, `display: block` on mobile). Updates on every `go(page)` call with the human-readable page name. Uses Barlow Condensed 800, 10px, uppercase, `var(--muted)` color. `pointer-events: none` — purely informational.

### Side Menu Slide Animation
Side menu uses `transform: translateX(100%)` + `display: none` (closed) and `transform: translateX(0)` + `display: flex` (open). **Do NOT revert to `right: -310px` positioning** — it causes iOS Safari to inflate `body.scrollWidth`, creating a full-page horizontal scroll. The `display: none` is toggled with a 350ms delay on close (matches CSS transition) via `_menuCloseTimer` to allow the animation to complete before hiding the element.

### Side Menu Items
Each `.menu-item` wraps its label in `.menu-item-label` with an optional `.menu-item-sub` sub-label (9px, `var(--muted2)`). This provides context at a glance without crowding the nav.

### Settings (mobile)
Accessible via Settings button inside the You/Athlete page — NOT in the hamburger.

### Theme Toggle
- Placed in the header or Settings section
- Sun icon = currently dark (shows "Light mode" label)
- Moon icon = currently light (shows "Dark mode" label)
- Persisted via `localStorage.setItem('bt_theme', name)`, restored on init

---

## Icons

**Style:** Line icons only.

```html
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <!-- paths here -->
</svg>
```

Rules:
- `stroke-width="1.8"` always (no exceptions without approval)
- `fill="none"` always
- `stroke="currentColor"` always
- Inline SVG only — no external icon libraries
- No emoji as design elements (emoji only in achievement badges)
- No filled/solid icon variants — no `fill="currentColor"` polygons

---

## Modals

- Slide-up from bottom with backdrop blur
- `.open` class toggles visibility
- Swipe-to-close: touch handler on `.modal-drag` and `.modal-head` only, 80px threshold
- `overscroll-behavior: contain` on `.modal-body`
- Body scroll lock: `document.body.style.overflow = 'hidden'` on mount, restored on unmount
- Safe area: `padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px))` on `.modal-foot`
- Landscape: `max-height: 85vh` at `(orientation: landscape) and (max-height: 500px)`
- Always include: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="<title-id>"`
- Wire `id` on modal `<h2>` title to `aria-labelledby` on the outer modal div

---

## Forms & Validation

**Never use `alert()`.** Always use inline field-level feedback via `.fi-error` + `.fg-err-msg`.

```css
.fi-error { border-color: var(--error) !important; }
.fg-err-msg { font-size: 11px; color: var(--error-dim); display: none; margin-top: 3px; }
.fg-err-msg.show { display: block; }
```

### Form Input v3

```css
.fi {
  font-family: var(--body);
  font-size: 14px; font-weight: 400;
  color: var(--white);
  background: linear-gradient(135deg, rgba(20,20,20,0.9) 0%, rgba(15,15,15,0.95) 100%);
  border: 1px solid var(--border2);
  border-radius: 10px;
  padding: 12px 14px;
  outline: none;
  transition: border-color 0.18s, box-shadow 0.18s;
}
.fi::placeholder { color: var(--muted2); }
.fi:focus {
  border-color: rgba(232,78,27,0.5);
  box-shadow: 0 0 0 3px rgba(232,78,27,0.08), inset 0 1px 0 rgba(232,78,27,0.08);
}
```

Focus ring: `box-shadow: 0 0 0 3px rgba(232,78,27,0.08)` — subtle orange glow ring, not a hard outline.

### Safari Autofill — DO NOT TOUCH
`#authEmail` must stay `type="text"` + `autocomplete="off"`. This prevents Safari from incorrectly autofilling the email field. Do NOT change to `type="email"`.

### Password fields
`type="password"` + `autocomplete="current-password"`. Never revert to `type="text"`.

### API key fields
`type="password"` with eye-icon reveal toggle (`.fi-reveal`).

---

## Button v3 System

```css
.btn-v3 {
  position: relative; overflow: hidden;
  font-family: var(--headline);
  font-size: 13px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.10em;
  border: none; border-radius: 10px;
  padding: 12px 24px;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
/* Shimmer sweep on hover via ::after pseudo */
.btn-v3::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%);
  transform: translateX(-150%) skewX(-12deg);
  transition: none;
}
.btn-v3:hover::after { animation: shimmer 0.65s ease; }
.btn-v3:hover { transform: translateY(-2px); }
.btn-v3:active { transform: translateY(0); }
```

### Variants

```css
/* Primary — orange fill + glow shadow */
.btn-primary-v3 {
  background: var(--grad-orange);
  color: #fff;
  box-shadow: 0 4px 20px rgba(232,78,27,0.35), inset 0 1px 0 rgba(255,255,255,0.15);
}
.btn-primary-v3:hover {
  box-shadow: 0 8px 30px rgba(232,78,27,0.55), inset 0 1px 0 rgba(255,255,255,0.15);
}

/* Ghost — orange outline */
.btn-ghost-v3 {
  background: rgba(232,78,27,0.08);
  color: var(--orange);
  border: 1px solid rgba(232,78,27,0.30);
  box-shadow: inset 0 1px 0 rgba(232,78,27,0.10);
}
.btn-ghost-v3:hover {
  background: rgba(232,78,27,0.14);
  border-color: rgba(232,78,27,0.55);
  box-shadow: 0 0 20px rgba(232,78,27,0.20), inset 0 1px 0 rgba(232,78,27,0.15);
}

/* Pro — gold gradient fill, black text */
.btn-pro-v3 {
  background: var(--grad-gold);
  color: #000;
  box-shadow: 0 4px 20px rgba(200,150,60,0.35), inset 0 1px 0 rgba(255,255,255,0.25);
}
.btn-pro-v3:hover {
  box-shadow: 0 8px 30px rgba(200,150,60,0.55), inset 0 1px 0 rgba(255,255,255,0.25);
}

/* Health — green outline */
.btn-health-v3 {
  background: linear-gradient(135deg, rgba(0,255,136,0.14) 0%, rgba(0,200,100,0.08) 100%);
  color: var(--green);
  border: 1px solid rgba(0,255,136,0.30);
  box-shadow: 0 0 16px rgba(0,255,136,0.08);
}
.btn-health-v3:hover {
  box-shadow: 0 0 28px rgba(0,255,136,0.25);
  border-color: rgba(0,255,136,0.55);
}
```

---

## Dashboard Widgets (Insight Cards)

All analytics dashboard cards share the `.insight-card` pattern.

```css
.insight-card {
  background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%), var(--surface);
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
  background: var(--insight-accent, var(--orange));
  border-radius: 14px 14px 0 0;
}
```

**Per-widget accent colors:**
| Widget | `--insight-accent` |
|---|---|
| Career Momentum | `var(--orange)` |
| Pacing IQ | `var(--green)` |
| Age-Grade | `var(--gold)` |
| Training Streak | `var(--orange)` |
| Race DNA | `var(--orange)` |
| Race Day Forecast | `var(--green)` |
| On This Day | `var(--gold)` |
| Performance Map | `var(--orange)` |

**Kicker labels:** Geist Mono, 9px, uppercase, letter-spacing 0.14em, color = `var(--insight-accent)`
**Widget titles:** Barlow Condensed 900, 13px, uppercase, color = `var(--muted)`
**Data values:** Geist Mono 300, 40–48px
**Sub-labels:** Geist Mono 400, 11px, color = `var(--muted)`

**Sparklines:** No axis labels. Trailing value only in Geist Mono 11px. Let the line speak.

---

## Card System v3

The card-v3 system is used for primary analytics and stat surfaces across the dashboard and profile pages.

```css
.card-v3 {
  position: relative; overflow: hidden;
  border-radius: 16px;
  padding: 20px;
  border: 1px solid var(--border2);
  cursor: pointer;
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
  animation: fadeUp 0.5s ease both;
}

/* 1px gradient top line — variant-colored */
.card-v3::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  opacity: 0.6;
}

/* Shimmer sweep on hover */
.card-v3::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
  transform: translateX(-150%) skewX(-12deg);
}
.card-v3:hover::after { animation: shimmer 0.7s ease; }
.card-v3:hover { transform: translateY(-3px) scale(1.01); }
```

### Card Variants

```css
/* Orange */
.card-orange {
  background: linear-gradient(145deg, rgba(232,78,27,0.13) 0%, rgba(200,150,60,0.06) 60%, rgba(13,13,13,0.8) 100%);
  box-shadow: inset 0 1px 0 rgba(232,78,27,0.18), 0 4px 24px rgba(0,0,0,0.4);
}
.card-orange::before { background: linear-gradient(90deg, rgba(232,78,27,0.6) 0%, rgba(200,150,60,0.3) 100%); }
.card-orange:hover { border-color: rgba(232,78,27,0.35); box-shadow: 0 8px 32px rgba(232,78,27,0.18), inset 0 1px 0 rgba(232,78,27,0.2); }
.card-orange .card-v3-kicker { color: var(--orange); }
.card-orange .card-v3-value  { color: var(--orange); }

/* Green / health */
.card-green {
  background: linear-gradient(145deg, rgba(0,255,136,0.10) 0%, rgba(0,200,100,0.04) 60%, rgba(13,13,13,0.8) 100%);
  box-shadow: inset 0 1px 0 rgba(0,255,136,0.14), 0 4px 24px rgba(0,0,0,0.4);
}
.card-green::before { background: linear-gradient(90deg, rgba(0,255,136,0.6) 0%, rgba(0,200,100,0.2) 100%); }
.card-green:hover { border-color: rgba(0,255,136,0.30); box-shadow: 0 8px 32px rgba(0,255,136,0.12), inset 0 1px 0 rgba(0,255,136,0.16); }
.card-green .card-v3-kicker { color: var(--green); }
.card-green .card-v3-value  { color: var(--green); }

/* Gold */
.card-gold-v3 {
  background: linear-gradient(145deg, rgba(200,150,60,0.13) 0%, rgba(200,150,60,0.05) 60%, rgba(13,13,13,0.8) 100%);
  box-shadow: inset 0 1px 0 rgba(200,150,60,0.18), 0 4px 24px rgba(0,0,0,0.4);
}
.card-gold-v3::before { background: linear-gradient(90deg, rgba(200,150,60,0.7) 0%, rgba(200,150,60,0.2) 100%); }
.card-gold-v3:hover { border-color: rgba(200,150,60,0.35); box-shadow: 0 8px 32px rgba(200,150,60,0.15), inset 0 1px 0 rgba(200,150,60,0.2); }
.card-gold-v3 .card-v3-kicker { color: var(--gold); }
.card-gold-v3 .card-v3-value  { color: var(--gold); }
```

### Card Typography

```css
.card-v3-kicker {
  font-family: var(--mono);
  font-size: 9px; font-weight: 400;
  letter-spacing: 0.18em; text-transform: uppercase;
  margin-bottom: 6px;
}
.card-v3-title {
  font-family: var(--headline);
  font-size: 13px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--muted); margin-bottom: 12px;
}
.card-v3-value {
  font-family: var(--headline);   /* Barlow Condensed 900 — NOT Geist Mono */
  font-size: 48px; font-weight: 900;
  letter-spacing: -0.02em; line-height: 1;
  margin-bottom: 6px;
}
.card-v3-sub { font-size: 11px; color: var(--muted2); }
```

> **Note:** `card-v3-value` uses **Barlow Condensed 900** at 48px — NOT Geist Mono. This differs from the general data metrics rule which specifies Geist Mono. Card-v3 values are headline numbers, not precision data.

---

## Motion System

Six named keyframe animations. Use these — do not define new ones without approval.

```css
@keyframes shimmer {
  0%   { transform: translateX(-150%) skewX(-12deg); }
  100% { transform: translateX(350%)  skewX(-12deg); }
}
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulseGlow {
  0%,100% { box-shadow: 0 0 6px rgba(0,255,136,0.4); }
  50%     { box-shadow: 0 0 16px rgba(0,255,136,0.9); }
}
@keyframes breathe {
  0%,100% { opacity: 0.6; transform: scale(1); }
  50%     { opacity: 1;   transform: scale(1.15); }
}
@keyframes orbFloat {
  0%,100% { transform: translate(0, 0) scale(1); }
  33%     { transform: translate(30px, -20px) scale(1.05); }
  66%     { transform: translate(-20px, 15px) scale(0.95); }
}
@keyframes gradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

| Animation | Usage |
|---|---|
| `shimmer` | Hover sweep on cards + buttons (via `::after` pseudo, `translateX(-150%) skewX(-12deg)`) |
| `fadeUp` | Section + card entry — `0.5–0.8s ease both`, staggered delays on lists |
| `breathe` | Sport status dot, live health indicator — scale 1→1.15 pulse |
| `pulseGlow` | Orange glow on active states — `pulseGlowOrange` variant uses orange shadows |
| `orbFloat` | Ambient background orbs, achievement badge float |
| `gradientShift` | PB time celebration, gradient text — requires `background-size: 200% auto` |

---

## Tag System

```css
/* Base tag */
.tag {
  font-family: var(--headline);
  font-size: 9px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.08em;
  padding: 5px 10px; border-radius: 5px;
  border: 1px solid var(--border2);
  color: var(--muted);
  transition: border-color 0.15s, color 0.15s, box-shadow 0.15s;
}
.tag:hover { border-color: rgba(245,245,245,0.25); color: var(--white); }

/* PB — orange fill */
.tag-pb  { border-color: rgba(232,78,27,.35); color: var(--orange); background: rgba(232,78,27,.08); }
.tag-pb:hover { box-shadow: 0 0 12px rgba(232,78,27,0.2); }

/* A-Race — orange outline only */
.tag-a   { border-color: rgba(232,78,27,.35); color: var(--orange); }

/* World Major — gold */
.tag-wm  { border-color: rgba(200,150,60,.35); color: var(--gold); background: rgba(200,150,60,.08); }
.tag-wm:hover { box-shadow: 0 0 12px rgba(200,150,60,0.2); }

/* Health / wearable */
.tag-health { border-color: rgba(0,255,136,.30); color: var(--green); background: rgba(0,255,136,.06); }
.tag-health:hover { box-shadow: 0 0 12px rgba(0,255,136,0.15); }
```

---

## Pro Tier System

### Badge (v3 — solid gold fill)
```html
<span class="pro-pill">PRO</span>
```
```css
.pro-pill {
  font-family: var(--headline);
  font-weight: 700; font-size: 10px;
  text-transform: uppercase; letter-spacing: 0.10em;
  color: #000;                        /* dark text on gold bg */
  background: var(--grad-gold);       /* solid gold gradient fill */
  border-radius: 4px;
  padding: 3px 9px;
  display: inline-flex; align-items: center;
  box-shadow: 0 2px 10px rgba(200,150,60,0.35);
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
CTA:        Full-width button, --grad-gold fill, #000 text, Barlow Condensed 700
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
- **No `--orange` (brick red) anywhere in this section** — it fights with product photography
- Card tiles use `var(--flatlay-tile)` (#F2EDE6 dark / #ffffff light) — warm cream lightbox treatment
- Category filter pills use `var(--white)` active state — no orange highlight

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
  border-color: var(--white);
  color: var(--white);
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
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px; padding: 14px 16px;
  display: flex; align-items: center; justify-content: space-between;
}

/* Priority A — hero treatment */
.upcoming-row.priority-a {
  min-height: 80px;
  background: linear-gradient(90deg, var(--orange-dim) 0%, transparent 60%), var(--surface);
  border-color: rgba(232,78,27,0.14);
}
```

- **Race name:** Barlow Condensed 800, 15px, uppercase
- **Meta (sport + location):** Barlow 400, 12px, `var(--muted)`
- **Date:** Geist Mono 12px, `var(--orange)`
- **Countdown days:** Geist Mono 11px, `var(--muted)`

---

## Race History — Canonical Pattern

The race list uses a specific container + row system. This is the canonical pattern — do not deviate.

```css
.race-list-wrap {
  background: linear-gradient(145deg, #141414 0%, #111013 100%);
  border: 1px solid var(--border2);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.4);
}

.race-row {
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 0 16px;
  align-items: center;
  position: relative;
  transition: background 0.18s ease;
}
.race-row:last-child { border-bottom: none; }
.race-row:hover { background: rgba(255,255,255,0.025); }
```

### iOS Calendar Date Chip

```css
.race-date-chip {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 44px; min-height: 50px; flex-shrink: 0;
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 10px;
  padding: 5px 6px 6px;
  gap: 2px;
}
.race-date-chip-mon {
  font-family: var(--mono);
  font-size: 8px; font-weight: 600;
  letter-spacing: 0.10em; text-transform: uppercase;
  color: var(--orange); line-height: 1;
}
.race-date-chip-day {
  font-family: var(--headline);
  font-size: 26px; font-weight: 900;
  color: var(--white); line-height: 1;
  letter-spacing: -0.02em;
}
/* PB rows: gold-tinted chip */
.race-row.is-pb .race-date-chip {
  border-color: rgba(200,150,60,0.35);
  background: linear-gradient(145deg, #1A1400 0%, #141414 100%);
}
```

### Race Row Typography

```css
.race-name {
  font-family: var(--headline);
  font-size: 14px; font-weight: 800;
  text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--white); margin-bottom: 3px;
}
.race-meta { font-size: 11px; color: var(--muted); }
.race-time {
  font-family: var(--headline);
  font-size: 20px; font-weight: 900;
  color: var(--orange); letter-spacing: -0.01em;
}
```

### PB Row — Gold Diagonal Treatment

```css
.race-row.is-pb {
  background: linear-gradient(105deg,
    rgba(232,78,27,0.11) 0%,
    rgba(200,150,60,0.07) 45%,
    transparent 72%
  );
  border-bottom-color: rgba(200,150,60,0.14);
  box-shadow: inset 0 1px 0 rgba(200,150,60,0.55), 0 -1px 12px rgba(200,150,60,0.06);
}
/* 3px left accent bar */
.race-row.is-pb::before {
  content: '';
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  border-radius: 0 2px 2px 0;
  background: linear-gradient(180deg, #E84E1B 0%, rgba(200,150,60,0.45) 100%);
}
.race-row.is-pb .race-time { color: #C8963C; }

/* Perpetual shimmer on PB rows */
.race-row.is-pb::after {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(200,150,60,0.06) 50%, transparent 100%);
  animation: shimmer 4s ease-in-out infinite;
  pointer-events: none;
}
```

### Year Divider

```css
.yr-b {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 20px;
}
.yr-b-dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--orange);
  animation: pulseGlowOrange 2.5s ease-in-out infinite;
  flex-shrink: 0;
}
.yr-b-label {
  font-family: var(--headline);
  font-size: 11px; font-weight: 900;
  text-transform: uppercase; letter-spacing: 0.22em;
  color: var(--orange);
}
.yr-b::after {
  content: ''; flex: 1; height: 1px;
  background: linear-gradient(90deg, rgba(232,78,27,0.25) 0%, transparent 100%);
}
```

### PB Badge Pill

```css
.pb-badge {
  display: inline-flex; align-items: center;
  font-family: var(--mono);
  font-size: 8px; font-weight: 500;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--orange);
  background: rgba(232,78,27,0.11);
  border: 1px solid rgba(232,78,27,0.28);
  border-radius: 3px; padding: 2px 6px;
  margin-left: 8px; vertical-align: middle;
}
```

---

## Personal Bests Cards

Horizontal scrolling card strip, one card per distance.

```css
.pb-scroll {
  display: flex; gap: 14px;
  overflow-x: auto; padding-bottom: 4px;
  scrollbar-width: none;
}
.pb-scroll::-webkit-scrollbar { display: none; }

.pb-card {
  position: relative;
  min-width: 188px; max-width: 188px;
  border: 1px solid var(--border2);
  border-radius: 18px;
  padding: 18px 16px 14px;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
}

/* Run variant — green left border */
.pb-card-run {
  background: linear-gradient(145deg, #141414 0%, rgba(0,255,136,0.06) 100%);
  border-left: 3px solid #00FF88;
  box-shadow: inset 0 1px 0 rgba(0,255,136,0.10), 0 4px 20px rgba(0,0,0,0.4);
}
.pb-card-run:hover {
  transform: translateY(-3px);
  border-color: rgba(0,255,136,0.55);
  box-shadow: 0 0 10px rgba(0,255,136,0.18), inset 0 1px 0 rgba(0,255,136,0.12);
}

/* Tri variant — purple left border */
.pb-card-tri {
  background: linear-gradient(145deg, #141414 0%, rgba(124,58,237,0.08) 100%);
  border-left: 3px solid #7C3AED;
  box-shadow: inset 0 1px 0 rgba(124,58,237,0.10), 0 4px 20px rgba(0,0,0,0.4);
}
.pb-card-tri:hover {
  transform: translateY(-3px);
  border-color: rgba(124,58,237,0.55);
  box-shadow: 0 0 10px rgba(124,58,237,0.20), inset 0 1px 0 rgba(124,58,237,0.12);
}

/* Gold shimmer on time text on hover */
.pb-card:hover .pb-card-time {
  background: linear-gradient(135deg, #FFE066 0%, #C8963C 45%, #FFD700 70%, #C8963C 100%);
  background-size: 200% auto;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: gradientShift 2s ease infinite;
}

/* Shimmer sweep on hover */
.pb-card::before {
  content: '';
  position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
  transform: translateX(-150%) skewX(-12deg);
}
.pb-card:hover::before { animation: shimmer 0.7s ease; }
```

### PB Card Typography

```css
.pb-card-dist {
  font-family: var(--headline);
  font-size: 10px; font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--muted2); margin-bottom: 6px;
}
.pb-card-time {
  font-family: var(--headline);
  font-size: 32px; font-weight: 900;
  letter-spacing: -0.01em; line-height: 1;
  margin-bottom: 10px;
}
.pb-card-time-run { color: #00FF88; }
.pb-card-time-tri { color: #7C3AED; }
.pb-card-race { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

### Sport Header

```css
.pb-sport-hdr {
  display: flex; align-items: center; gap: 10px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}
.pb-sport-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.pb-sport-dot-run  { background: #00FF88; animation: breathe 2s ease-in-out infinite; box-shadow: 0 0 8px rgba(0,255,136,0.6); }
.pb-sport-dot-tri  { background: #7C3AED; animation: breathe 2s ease-in-out infinite 0.5s; box-shadow: 0 0 8px rgba(124,58,237,0.6); }
.pb-sport-name {
  font-family: var(--headline);
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--muted);
}
```

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
- **Locked:** `var(--surface2)` bg, `opacity: 0.5`
- Emoji only for badge icons — SVG icons feel too cold for this context
- Badge label: Geist Mono 8px, uppercase

---

## Medal Tier Colors

```
Gold:     border #C8963C / bg rgba(200,150,60,0.12) / text #C8963C
Silver:   border #C8D4DC / bg rgba(200,212,220,0.10)
Bronze:   border #CD8C5A / bg rgba(205,140,90,0.10)
Finisher: border var(--orange) / bg var(--orange-dim)
```

Gold medal uses the same `--gold` token as Pro tier — consistent vocabulary: gold = achievement + earned.

---

## Race Cards (History) — Simple Variant

For compact contexts (modal, sidebar) that don't use the full canonical race row:

```html
<div class="race-card">
  <div>
    <div class="race-name">Boston Marathon</div>
    <div class="race-meta">Apr 15, 2024 · Full Marathon · Boston, USA</div>
  </div>
  <div>
    <div class="race-time">2:58:44</div>   <!-- Barlow Condensed 900 -->
    <div class="race-placing">342 / 28,409</div>
  </div>
</div>
```

- **Race name:** Barlow Condensed 800, 15–16px, uppercase
- **Time:** Barlow Condensed 900, 20px — orange accent color
- **Meta/placing:** Barlow/Geist Mono 11–12px, `var(--muted)`

---

## Empty States

Every empty state: warmth + primary action + context. Never "No items found."

| Surface | Headline | CTA |
|---|---|---|
| Races — no races | "No races yet. Every finish line starts with one." | `+ Log your first race` → open AddRaceModal |
| Races — no search results | "No races match — try a different search." | — |
| Medals — no medals | "No medals yet. Every race earns one." | `+ Log a race` → open AddRaceModal |
| Map — no routes | "No routes yet. Log a race with a city to see your world map." | — |
| Dashboard — no races | "Your story starts here. Log a race →" | inline orange link → open AddRaceModal |

CSS pattern: `.hist-empty { text-align: center; padding: 3rem 1rem; }` with Barlow Condensed 700 headline.

---

## Accessibility (required, not optional)

```css
:focus-visible { outline: 2px solid var(--orange); outline-offset: 3px; border-radius: 3px; }
:focus:not(:focus-visible) { outline: none; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
```

Requirements:
- All interactive elements: `min-height: 44px; min-width: 44px`
- ARIA live region: `<div aria-live="polite" aria-atomic="true" id="a11y-status" class="sr-only">`
- Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on outer div; `id` on title `<h2>`
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

- **Framework:** React 18 + TypeScript
- **Build:** Vite
- **Routing:** react-router-dom v6 (`/`, `/races`, `/gear`, `/train`, `/you`, `/settings`)
- **State management:** Zustand
- **Auth + data:** Supabase
- **Hosting:** Cloudflare Workers (static assets via wrangler)
- **Global styles:** `src/styles/tokens.css` (CSS variables) + `src/styles/index.css` (global rules + reset)
- **Component styles:** Inline style objects (React `style` prop) for component-scoped styles
- **Fonts:** Google Fonts loaded in `index.html` `<head>`

### Redirects
```
/pace     → /         (legacy)
/history  → /races    (legacy)
/map      → /races    (legacy, map is embedded in races page)
```

### Authentication
- App is **authenticated-only** — no guest mode
- If unauthenticated, the landing screen / auth modal handles it
- Auth state: `useAuthStore` (Zustand) with `authUser`, `proAccessGranted`, etc.
- Pro features unlocked on staging (`dev.breaktapes.com`) for beta testers

---

## What This Document Does NOT Cover

- Backend/API design
- Supabase schema
- CI/CD pipeline
- Non-frontend CLAUDE.md rules

**When in doubt about any frontend decision not covered here: STOP and ask the user before implementing.**

---

## Theme System

Themes are applied via `data-theme` attribute on `<html>`. Stored in `localStorage` under `bt_theme`. Default is `carbon-chrome` (the `:root` values). Pro themes are gated by `hasProAccess()` / `proAccessGranted` in `useAuthStore`.

### Typography rule (non-negotiable)
**All themes share identical typography.** Barlow Condensed / Barlow / Geist Mono weights, sizes, and letter-spacing NEVER change between themes. Only color tokens change.

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
| 2026-03-30 | Restricted --green (#00FF88) to live health data only | Was being used decoratively; should signal real-time wearable data exclusively |
| 2026-04-16 | React migration — vanilla index.html → React 18 + TypeScript + Vite | Scale, type safety, component reuse. Token names retained from index.html for zero-diff migration. |
| 2026-04-16 | Nav tabs renamed: History→Races, Medals→Gear, Map embedded in Races, Me→You | Clearer labeling: "Races" covers all race surfaces including map; "You" is friendlier than "Me" |
| 2026-04-16 | Token names retained as legacy (--orange not --accent, --white not --stone) | 494+ references — renaming would require a separate focused migration. DESIGN.md now documents actual names. |
| 2026-04-16 | Pro pill updated: solid gold fill (--grad-gold) + #000 text, not bordered outline | Solid fill reads as earned/premium in context. Preview v3 canonical. |
| 2026-04-16 | Form input v3: gradient background + 3px orange glow ring on focus | Gradient bg adds depth; glow ring is softer than hard outline, matches card-v3 shimmer language |
| 2026-04-16 | Card v3 values use Barlow Condensed 900 (not Geist Mono) | Hero numbers like "87" or "−4:12" read as performance headlines, not precision data. |
| 2026-04-17 | DESIGN.md comprehensively updated from breaktapes-design-preview-v3.html | Preview is canonical visual reference. All card, button, race history, PB, motion, and tag patterns extracted. |
