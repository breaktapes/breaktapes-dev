# BREAKTAPES Landing — Build Spec

> Production marketing landing for BREAKTAPES. Cinematic, scroll-driven, with a live
> in-app demo. This is the source of truth for the landing build. Decisions captured
> from the scoping session on 2026-06-01.

---

## Global system

- **Where:** in-app logged-out screen (`AuthGate → LandingScreen` → `LandingPage`) now;
  public `breaktapes.com` serving deferred (currently a 301 redirect worker).
- **Mood:** darker, cinematic — deep blacks, spotlight/vignette lighting. Orange (`--orange`)
  primary; **green** (`--green`) for PR / positive / momentum beats only.
- **Motion:** GSAP ScrollTrigger (pinning + scrubbed timelines) **+** Framer Motion.
  Full cinematic on desktop **and** mobile. `prefers-reduced-motion` → fades-only fallback
  (always respected, regardless of the "cinematic everywhere" default).
- **Engine deps:** `framer-motion` (installed v12.40) **+** `gsap` (+ ScrollTrigger).
- **Headline:** "Every Finish Line, Remembered."
- **Sub-headline:** "From start line to medal wall — your whole racing life in one place."
- **Top chrome:** floating BREAK/TAPES wordmark (left) + Sign in (ghost) + Get Started
  (orange) right; fades in after the hero. Thin orange **scroll-progress bar** pinned to the
  top edge.
- **Unified "I am a…" selector:** Marathoner / Triathlete / Everyday. Default **neutral
  (show all)**. Re-themes feature emphasis **and** the live-demo persona together.
- **Primary CTA:** "Get Started" → existing Clerk **sign-up** modal. Auth modal preserved.
- **Analytics:** PostHog events on CTA clicks, demo open, persona pick, audience tab switch,
  FAQ open.

---

## Section order

1. **Intro loader** — finish-line tape pulled taut + **stopwatch counts up**, then the tape
   **snaps** (orange recoil) and whips away to reveal the hero. ("BREAKTAPES" = breaking the
   finish tape.)
2. **Hero** — headline + sub + CTA + proof row; keeps the tilted **dashboard mockup**;
   cinematic staggered entrance + scroll parallax.
3. **"I am a…" selector** — themes the page (default neutral / show all).
4. **Feature showcases (4)** — GSAP pinned / scrubbed scrollytelling, parallax depth, with one
   horizontal-scroll gallery beat:
   - Race History (great-circle arc map)
   - Auto PRs (count-up numbers, green PR badges)
   - Medal Wall (tier-disc grid)
   - **Wearables — WHOOP live; Strava / Garmin / Apple Health / COROS / Oura "Coming soon"**
     (only WHOOP is production-authorized — do not claim the others as available).
5. **Phone-scroll centerpiece** — a device pins center-screen and cycles through real app
   screens (Dashboard → Medal Wall → Map → Analytics) as you scroll. The signature beat.
6. **How it works** — 3 numbered steps + mini-mockups: Sign up → Log races → Track everything.
7. **Live sandbox** — auto-loads on approach (lazy-mount), **persona switcher**, **guided
   3-page switcher** (Dashboard / Races / Profile), embedded iframe + "Open full demo ↗",
   **~20-race** medium data per persona, browse + light interaction (edits reset on reload).
8. **Stats band** — capability stats: 1,068+ catalog races · 9 distance PRs tracked ·
   analytics widgets · 100% your data. (No user-count brags — pre-launch.)
9. **Testimonials** — rotating spotlight, **5** placeholder quotes (clearly swappable).
10. **FAQ** — accordion:
    - Is it free? → *free to start, Pro tier later.*
    - Do I need an AI/API key? → *no.*
    - Which wearables work? → *WHOOP now, more coming.*
    - Is my data private & exportable? → *yes — your data is yours, export anytime.*
11. **Final CTA** — "Start logging your finish lines."
12. **Footer** — minimal (wordmark, tagline, Privacy / Terms / Help, copyright).

---

## Demo personas (sandbox)

Three selectable personas, ~20 races each (medium richness), shared with the unified selector:

- **Marathoner** — road marathoner, fast times, full medal wall.
- **Triathlete** — swim/bike/run, IRONMAN, multi-discipline.
- **Everyday** — mid-pack hobby runner, relatable times.

Demo runs in an isolated mode: fake `authUser`, seeded Zustand stores, in-memory persistence,
Supabase sync + Clerk short-circuited. Embedded via iframe of a `/demo` route.

---

## Build phases (each ships + is independently reviewable)

- **Phase A — Cinematic shell:** intro loader, hero, floating nav, scroll-progress bar,
  unified "I am a…" selector, GSAP scrollytelling on the 4 existing showcases. Adds `gsap`.
- **Phase B — Signature + audience:** phone-scroll pinned centerpiece + per-audience depth
  wired to the selector.
- **Phase C — Content:** How it works, Testimonials (rotating spotlight), FAQ (accordion).
- **Phase D — Live sandbox:** `/demo` route in demo mode (fake authUser, seeded stores,
  in-memory persistence, Supabase/Clerk short-circuited), 3 personas, embedded iframe +
  full-screen escape. Heaviest; isolated last.

---

## Risks / open items

- **Sandbox (D)** is the hardest: ~100 components gate on `authUser` / stores; demo mode must
  satisfy every gate without real auth. Iframe isolation protects real user data. Real
  engineering, not just UI.
- **Full cinematic on mobile** carries real perf risk (GSAP pinning on low-end phones). Build,
  measure FPS, flag/soften any janky beat.
- **breaktapes.com public serving** still needs a deploy/routing decision later; cinematic
  React won't SSR well for crawlers.
- **Testimonials + share/OG image** are placeholders / deferred until real content is supplied.

---

_Last updated: 2026-06-01._
