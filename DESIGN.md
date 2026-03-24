# BREAKTAPES — Frontend Design System

> **Rule:** Every frontend change MUST conform to this document. If a change
> requires deviating from any decision here, STOP and ask the user before proceeding.
> This document is the single source of truth. It is updated only intentionally,
> never as a side effect of feature work.

---

## Aesthetic Identity

Dark athletic. Not generic SaaS dark mode — energetic, competitive, personal.

- Black backgrounds (`#000000`, `#0D0D0D`, `#141414`, `#1A1A1A`)
- Orange as the primary accent: `#FF4D00` — action, achievement, fire
- Green as the secondary accent: `#00FF88` — health, fitness, go
- White at reduced opacity for hierarchy: `#F5F5F5` at 35–55% for muted, 100% for primary
- No blues, purples, or generic SaaS palettes

---

## Color Tokens (canonical — use ONLY these, never hardcode hex)

```css
--black:       #000000
--white:       #F5F5F5
--orange:      #FF4D00       /* primary action, active states */
--orange-dim:  rgba(255,77,0,0.12)
--orange-glow: rgba(255,77,0,0.25)
--green:       #00FF88       /* health data, fitness indicators */
--surface:     #0D0D0D       /* page background */
--surface2:    #141414       /* card background */
--surface3:    #1A1A1A       /* elevated card / nested */
--border:      rgba(245,245,245,0.06)   /* subtle dividers */
--border2:     rgba(245,245,245,0.12)   /* inputs, separators */
--muted:       rgba(245,245,245,0.35)   /* secondary text, inactive icons */
--muted2:      rgba(245,245,245,0.18)   /* decorative only — NOT for text */
--error:       #ff5555       /* form validation border */
--error-dim:   #ff7070       /* form validation message text */
```

**Text contrast minimums (WCAG):**
| Selector | Minimum opacity |
|---|---|
| `.fl` form labels | 55% |
| `.fi::placeholder` | 40% |
| `.hist-sub` sub-info | 45% |
| `.s-tile-label` stat labels | 45% |
| `.menu-section-label` | 35% |
| `.map-pill-label` | decorative — no minimum |
| `.tp-label` | decorative — no minimum |

---

## Typography

**Headline font:** Barlow Condensed — 700/800/900 weight, uppercase, tracked
**Body font:** Barlow — 400/500/600 weight

**Scale tokens:**
```css
--text-xs:   10px   /* captions, badges, sub-labels */
--text-sm:   12px   /* secondary labels, meta info */
--text-base: 14px   /* body text, inputs, card titles */
--text-md:   16px   /* section headers, modal titles */
/* Headlines above 16px: use explicit px values (20/24/32/48) */
```

**Rules:**
- Headlines: Barlow Condensed 700+ with uppercase + `letter-spacing: 0.06em+`
- Body: Barlow regular weight — no uppercase
- Never use font sizes below 10px
- Never use more than 4 distinct sizes on one screen

---

## Spacing Grid

**Base unit: 4px.** All spacing must be a multiple of 4.

```css
--sp-1: 4px;  --sp-2: 8px;  --sp-3: 12px;  --sp-4: 16px;
--sp-5: 20px; --sp-6: 24px; --sp-8: 32px;
```

Use these tokens for all padding, margin, gap values.

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
- Active: `color: var(--orange)`, `stroke: var(--orange)` on SVG
- Inactive: `color: var(--muted)` (35% opacity white)
- Press/tap: `transform: scale(0.92)` on `:active`
- Hamburger hidden on mobile (`display: none`)

### Desktop (≥768px)
Side menu via hamburger trigger. Bottom nav hidden.

### Settings (mobile)
Accessible via Settings button inside the Me/Athlete page — NOT in the hamburger.

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
- No emoji as design elements
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

## Empty States

Every empty state: warmth + primary action + context. Never ship "No items found."

| Surface | Headline | CTA |
|---|---|---|
| History — no races | "No races yet. Every finish line starts with one." | `+ Log your first race` → `openRaceModal()` |
| History — no search results | "No races match — try a different search." | — |
| Medals — no medals | "No medals yet. Every race earns one." | `+ Log a race` → `openRaceModal()` |
| Map — no routes | "No routes yet. Log a race with a city to see your world map." | — |
| Dashboard — no races | "Your story starts here. Log a race →" | inline orange link → `openRaceModal()` |

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
- ARIA live region: `<div aria-live="polite" aria-atomic="true" id="a11y-status" class="sr-only">` — announce dynamic updates
- Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Navigation: `aria-current="page"` on active item in side menu; `class="active"` on active bottom nav tab
- Buttons without visible text: `aria-label`
- Form inputs: `<label for="...">` wired to each input

---

## iOS Safe Area

Required whenever `viewport-fit=cover` is set in the viewport meta tag:

```css
header { padding-top: env(safe-area-inset-top, 0px); height: calc(56px + env(safe-area-inset-top, 0px)); }
main { margin-top: calc(56px + env(safe-area-inset-top, 0px)); }
.modal-foot { padding-bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px)); }
.modal { max-height: calc(92vh - env(safe-area-inset-bottom, 0px)); }
.bottom-nav { padding-bottom: env(safe-area-inset-bottom, 0px); }
main { padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px)); } /* bottom nav clearance */
#page-map { height: calc(100vh - 56px - env(safe-area-inset-top, 0px)); }
```

---

## Brand Copy Voice

Sentence case. Energetic. Athletic. Personal. Never corporate SaaS.

**✅ Correct:**
- "No races yet. Every finish line starts with one."
- "Drop an email to get started."
- "Need a password to race in."
- "Password needs at least 6 characters."

**❌ Wrong:**
- "NO DATA AVAILABLE"
- "Please enter a valid email address."
- "Your all-in-one race tracking solution"
- "An error occurred. Please try again."

---

## App Architecture

- Single-file SPA: all code in `index.html` (~8,000+ lines)
- No build step, no bundler
- Vanilla HTML/CSS/JS
- Supabase for auth + data
- Cloudflare Pages for hosting

### Authentication
- App is **authenticated-only** — no guest mode
- If unauthenticated, the landing screen / auth modal handles it
- Auth state variable: `authUser` (line ~3446)

---

## What This Document Does NOT Cover

- Backend/API design
- Supabase schema
- CI/CD pipeline
- Non-frontend CLAUDE.md rules

**When in doubt about any frontend decision not covered here: STOP and ask the user before implementing.**
