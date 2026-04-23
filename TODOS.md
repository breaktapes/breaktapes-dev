# BREAKTAPES — Deferred Work

Items captured during eng reviews. Each entry includes context so future sessions don't have to reconstruct the reasoning.

---

## Achievement badge visual redesign (post-cutover)

**What:** Replace emoji icons in all 19 achievement badges (`Profile.tsx` `ACHIEVEMENTS` array) with proper visual badge design — monochrome text cards or custom SVG badge art.

**Why:** Current V2 implementation uses emoji (🏔 🔥 ⚡ etc) which is inconsistent with BREAKTAPES's "dark archival athletic" identity. V1 had CSS badge art per tier. Identified in `/plan-design-review` 2026-04-21.

**Pros:** Removes AI slop pattern from the Profile page. Makes achievements feel earned rather than generated.

**Cons:** Requires either SVG badge design work (1-2 days) or a design decision on whether to use text-only badges (simpler, ~1 hour).

**Context:** Deferred pre-cutover because it's cosmetic, not functional. Ship achievements working first, polish the visual afterward.

**Option A (fast):** Replace emoji with no icon — just uppercase badge name on dark card with orange border on unlock. Takes ~1hr.
**Option B (proper):** Commission or design per-achievement SVG icons (19 total). Takes 1-2 days.

**Depends on:** React V2 cutover completed.

**Priority:** Low — after cutover confirmed stable.

---

## Migrate legacy Jest tests to vitest

**What:** Convert `tests/*.test.js` (Jest + jsdom SPA snapshot) to vitest format under `src/`.

**Why:** `tests/index.html.spa` is a 23,425-line snapshot of the old vanilla SPA. As the React migration progresses, this snapshot will drift from the real app and eventually produce false positives/negatives. The dual test system (Jest + vitest) also adds confusion about which suite to run after a change.

**Where to start:** Pick one test file (e.g., `tests/utils.test.js`), convert to vitest in `src/__tests__/`, confirm it passes with `npm run test:react`, delete the Jest original.

**Depends on:** React migration feature parity (all pages migrated to React)

**Priority:** Low — after React migration ships to prod

---

## Pro entitlement gate (pre-public-launch blocker)

**What:** Replace `IS_STAGING` / `proAccessGranted` flag in `useAuthStore` with a real entitlement check. Currently all Pro features (themes, widgets) are unlocked for everyone on prod.

**Why:** V1 users who paid for Pro get nothing. New users get Pro for free. Must resolve before open sign-up.

**Options:**
- **A (fast):** Supabase column `user_state.is_pro BOOLEAN DEFAULT false` + manual flip for V1 paid users. Check in `useAuthStore` on login.
- **B (proper):** Stripe Checkout integration + webhook sets `is_pro`. Full payment flow.

**Where to start:** Audit V1 paid user list first (Stripe dashboard or email records). If < 20 users, Option A is fine. If launching to new paying users, Option B is required.

**Depends on:** Nothing blocking — can ship Option A before Option B.

**Priority:** HIGH — blocks public launch.
