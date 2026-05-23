# Visual Consistency Pass — Typography, Spacing, Charts

## Goal

Make the app feel intentional and even throughout: unified font scale, consistent spacing, standardized chart lines and elements. Users should not notice mismatched sizes or irregular rhythm when scanning any screen.

## Context

- **1,068 hardcoded `fontSize` inline style instances** across React components (not using CSS tokens)
- DESIGN.md specifies type tokens `10/12/14/16px` but `tokens.css` implements them as `11/13/16/18px` — discrepancy needs resolution
- Spacing breaks the 4px grid rule in 400+ places (6px and 10px are most common offenders at ~145 uses each)
- Chart stroke widths vary: 1.4, 1.5, 1.8, 2, 2.5 — no canonical value
- Border-radius uses 15+ distinct values across the codebase

## Typography Hierarchy (Pass 1 addition)

Every screen uses exactly 4 levels of text. No screen should have more than 4 distinct font sizes visible at once.

```
Level 1 — Hero metric     : 48px     Barlow Condensed 900  (finish time, streak count, recovery days) [D2: keep 48px]
Level 2 — Section label   : 18px     Barlow Condensed 700  uppercase + tracked (widget title, modal header)
Level 3 — Content         : 15px     Barlow 400–500        (body text, card content, input text)
Level 4 — Meta/caption    : 11–13px  Geist Mono 400        (labels, chart axes, sub-info, badges)
```

Rule: any element must map to exactly one level. If it doesn't fit, it's the wrong element, not a new level.

**Chart hierarchy:** axis labels = Level 4 (11px Geist Mono). Tooltip content = Level 3 (15px Barlow). No chart element should be Level 1 or 2.

---

## Out of Scope

- Color changes
- Layout restructuring
- New features
- Animation/motion changes

---

## Phase 1: Canonical Token Set

**Resolve the DESIGN.md vs tokens.css discrepancy.** Currently two contradictory specs exist:

| Token | DESIGN.md | tokens.css | **Decision (D1)** |
|---|---|---|---|
| `--text-xs` | 10px | 11px | **11px** |
| `--text-sm` | 12px | 13px | **13px** |
| `--text-base` | 14px | 16px | **16px** (keep current, D3) |
| `--text-md` | 16px | 18px | **18px** |

**Add missing large-size tokens** (all currently hardcoded):

```css
/* Add to tokens.css :root */
--text-compact: 14px; /* dense list contexts: race rows, history rows, table cells (D4) */
--text-lg:   20px;  /* widget section headers */
--text-xl:   24px;  /* modal headers, page titles */
--text-2xl:  32px;  /* hero numerals (recovery days, streak count) */
--text-3xl:  48px;  /* primary metric (finish time, momentum score) */

/* Chart-specific */
--chart-stroke:       1.5;   /* canonical sparkline + trend line stroke width */
--chart-axis-size:    var(--text-xs);   /* axis tick labels */
--chart-dot-radius:   3px;
--chart-grid-stroke:  rgba(255,255,255,0.04);

/* Border-radius system (reduce from 15+ values to 6) */
--radius-xs:  4px;   /* badges, tight chips */
--radius-sm:  6px;   /* buttons, inputs, pills */
--radius-md:  8px;   /* cards, surface containers */
--radius-lg: 12px;   /* modals, bottom sheets */
--radius-pill: 20px; /* filter pills, tag pills */
--radius-round: 50%; /* avatars, icons */
```

**Files:** `src/styles/tokens.css`, `DESIGN.md`

**DESIGN.md must be updated in Phase 1** to replace the existing "Type Scale Tokens" section with:
```css
--text-xs:   11px;  /* captions, badges, chart axis labels, sub-labels */
--text-sm:   13px;  /* secondary labels, meta info, filter pills */
--text-base: 16px;  /* body text, inputs, card titles, content */
--text-md:   18px;  /* section headers, modal titles (Barlow Condensed) */
/* Large/hero sizes — always explicit px, never body context */
--text-lg:   20px;  /* widget subheaders */
--text-xl:   24px;  /* page-level titles */
--text-2xl:  32px;  /* large metrics */
--text-3xl:  48px;  /* primary hero metric (finish time, score) */
```

DESIGN.md must also add the 4-level hierarchy diagram (see "Typography Hierarchy" section above).

---

## Phase 2: Typography Sweep

Replace all hardcoded `fontSize` values with token references. Scope: 1,068 instances across 10 files.

### Mapping table (after Phase 1 token decision)

| Hardcoded | Token | Use case |
|---|---|---|
| 9px, 10px, 11px | `var(--text-xs)` = 11px | captions, badges, chart axis labels |
| 12px, 13px | `var(--text-sm)` = 13px | secondary labels, meta info |
| 14px (compact/dense lists) | `var(--text-compact)` = 14px | race rows, history rows, table cells (D4) |
| 15px, 16px | `var(--text-base)` = 16px | body text, inputs, card content |
| 18px | `var(--text-md)` = 18px | section headers, modal titles |
| 20px, 22px | `var(--text-lg)` = 20px | widget subheaders |
| 24px, 26px | `var(--text-xl)` = 24px | page titles |
| 28px, 32px | `var(--text-2xl)` = 32px | hero numbers |
| 48px, 56px, 64px | `var(--text-3xl)` = 48px | primary hero metric (D2: keep 48px) |

**Files by instance count:**
- `src/pages/Dashboard.tsx` — 434 instances
- `src/pages/Profile.tsx` — 133 instances
- `src/pages/Train.tsx` — 79 instances
- `src/pages/Gear.tsx` — 72 instances
- `src/components/ViewEditRaceModal.tsx` — 38 instances
- `src/pages/Settings.tsx` — 37 instances
- `src/components/AddRaceModal.tsx` — 37 instances
- Others — ~238 instances

### Font-family consistency

`src/lib/charts.ts` hardcodes `fontFamily: 'Barlow'` for axis ticks. Rule (D6):
- **Axis tick labels** (numeric: year, percentage, time) → `var(--mono)` (Geist Mono, tabular-nums)
- **Tooltip content** (copy/labels) → `var(--body)` (Barlow)

Current charts.ts sets both to `'Barlow'` — axis ticks must move to `var(--mono)`.

---

## Phase 3: Spacing Audit

The 4px grid rule (all spacing = multiples of 4) is broken in 400+ instances. Non-compliant values:

| Value | Count | Fix |
|---|---|---|
| 6px | 145 | → 8px (next step up) |
| 10px | 146 | → 8px when between-element gap; → 12px when within-element padding (D5) |
| 14px | 75 | → 16px |
| 3px | 49 | → 4px |
| 5px | 33 | → 4px or 8px |
| 7px | 18 | → 8px |
| 13px | 5 | → 12px |

**Exempt:** 1px and 2px for borders. 3px for border accents (left-border treatment). These are not between-element spacing.

**Token adoption:** Replace raw `8px/12px/16px` pixel values with `var(--sp-2)/var(--sp-3)/var(--sp-4)` where possible.

---

## Phase 4: Chart Standardization

All Recharts chart elements adopt canonical tokens:

### Sparkline.tsx
- `strokeWidth`: 1.8 → `1.5` (canonical `--chart-stroke`)
- No other changes needed — already uses CSS var for color

### AgeGradeChart.tsx + charts.ts
- `fontSize: 11` → `var(--text-xs)` (resolves to `--chart-axis-size`)
- `fontFamily: 'Barlow'` → `var(--body)`
- `strokeDasharray: '3 3'` — keep (consistent across all charts already)
- Dot radius: not defined — add `r: 3` as `--chart-dot-radius`

### Dashboard.tsx inline SVG charts
- Any `strokeWidth` variations → 1.5
- Any `r=` values for dots → 3

---

## Phase 5: Border-radius System

Reduce from 15+ values to the 6-value system defined in Phase 1.

### Mapping
| Current | Token | Where |
|---|---|---|
| 2px, 3px, 4px | `var(--radius-xs)` = 4px | badges, tight chips |
| 5px, 6px, 7px | `var(--radius-sm)` = 6px | buttons, inputs |
| 8px | `var(--radius-md)` = 8px | cards (already most common — 91 uses) |
| 10px, 12px | `var(--radius-lg)` = 12px | modals, sheets |
| 14px, 16px | `var(--radius-lg)` = 12px | |
| 20px, 100px, 999px | `var(--radius-pill)` = 20px | pills, tags |
| 50% | `var(--radius-round)` | avatars |

---

## Acceptance Criteria

- [ ] tokens.css has one canonical value per `--text-*` token (no DESIGN.md discrepancy)
- [ ] DESIGN.md type scale table matches tokens.css exactly
- [ ] No hardcoded `fontSize` values outside of `tokens.css` itself (or documented exceptions)
- [ ] All spacing between elements is a 4px multiple
- [ ] All chart stroke widths = 1.5
- [ ] All chart axis labels use `var(--text-xs)` and `var(--body)` font
- [ ] Scrollable modals (AddRaceModal, ViewEditRaceModal, EditProfileModal) reflow correctly after font-size changes — test with long content at 375px
- [ ] Any interactive element that currently uses `padding: 6px` vertically must be audited — replacing 6→8 must not drop total touch target height below 44px
- [ ] Border-radius reduced to ≤ 6 distinct values, all tokenized

## Implementation Notes

- Do NOT change the meaning of any element during this pass — this is purely cosmetic
- If a context-specific font size was intentional (e.g. a very specific metric display), document it with a comment
- Test at 375px and 1280px after each phase — smallest viewport magnifies spacing errors

---

## Implementation Tasks

Synthesized from this review's findings. Each task derives from a specific finding above.

- [ ] **T1 (P1, human: ~1h / CC: ~10min)** — tokens.css + DESIGN.md — Resolve token discrepancy + add missing scale tokens + CI grep gate
  - Surfaced by: Pass 1 + Pass 5 — DESIGN.md type scale contradicts tokens.css; 7 tokens missing (compact, lg, xl, 2xl, 3xl, chart-stroke, radius-*)
  - Files: `src/styles/tokens.css`, `DESIGN.md`
  - **B3 fix:** DESIGN.md line 213 currently says `--text-base: 14px` — must be corrected to `16px` in this task
  - **B2 CI gate:** add a CI check (or vitest test) that runs `grep -r "fontSize: '\\d" src/` and fails if any hardcoded pixel value remains outside tokens.css. Locks the gain permanently.
  - Verify: grep `--text-xs` in tokens.css returns `11px`, DESIGN.md type scale matches tokens.css exactly, CI grep gate is wired

- [ ] **T2 (P1, human: ~3h / CC: ~20min)** — Dashboard.tsx — Typography sweep (434 instances)
  - Surfaced by: Pass 1 — 434 hardcoded fontSize values bypassing token system
  - Files: `src/pages/Dashboard.tsx`
  - Verify: `grep "fontSize:" src/pages/Dashboard.tsx` returns only var(--text-*) references

- [ ] **T3 (P2, human: ~2h / CC: ~15min)** — All src/ files — Typography sweep (636 instances across 30 files)
  - Surfaced by: Pass 1 — all .tsx/.ts files EXCEPT Dashboard.tsx (T2) and chart files (T4)
  - Files: ALL src/**/*.tsx and src/**/*.ts with fontSize instances (30 files total — not just the 9 originally listed)
  - **Exemption rule (A2):** canvas 2D `ctx.font` strings in RaceShareCard.tsx are EXEMPT — canvas API cannot use CSS vars and must stay hardcoded. Only React inline `style={{...}}` objects are in scope.
  - **14px judgment rule (B1):** do NOT bulk-map all 14px → `--text-compact`. Decide per instance: buttons/inputs/labels → `var(--text-sm)` (13px); dense list rows/table cells → `var(--text-compact)` (14px); standard body → `var(--text-base)` (16px).
  - Verify: `grep -r "fontSize:" src/ --include="*.tsx" --include="*.ts"` returns only `var(--text-*)` references; verify chart render screenshot (A3)

- [ ] **T4 (P1, human: ~30min / CC: ~5min)** — charts.ts + Sparkline — Chart standardisation
  - Surfaced by: Pass 6 — strokeWidth varies 1.4–2.5, axis fontFamily wrong ('Barlow' → var(--mono))
  - Files: `src/lib/charts.ts`, `src/components/Sparkline.tsx`, `src/components/AgeGradeChart.tsx`
  - **Note (A3):** changing `tick.fontSize` from number `11` to string `'var(--text-xs)'` is a type change — Recharts accepts both (SVG font-size), but screenshot the chart after T4 to verify render.
  - Verify: Sparkline strokeWidth=1.5, getChartTheme() axis tick uses `var(--mono)` + `fontSize: 'var(--text-xs)'`

---

## Eng Review Decisions (2026-05-23)

**D1 — Scope staging:** T1+T2+T3+T4 ship as PR 1 (typography + charts). T5+T6+T7 (spacing, border-radius, touch targets) ship as a follow-up PR. Reason: 1,070 fontSize + 403 spacing changes in one diff is too large to bisect if a visual regression occurs.

**A1 — T3 scope expanded:** Plan originally listed 9 named files. Actual codebase has 30 files with fontSize instances (32 total minus Dashboard=T2 and 3 chart files=T4). T3 now covers all `src/**/*.tsx` and `src/**/*.ts`.

**A2 — Canvas exemption:** `ctx.font` strings in canvas 2D draw functions (RaceShareCard.tsx drawCard) are permanently exempt. Canvas API cannot resolve CSS variables. Only React `style={{...}}` inline objects are in scope.

**A3 — Recharts type change:** `tick.fontSize: 11` (number) → `'var(--text-xs)'` (string). Type-safe in React.CSSProperties + SVG. Must screenshot chart render after T4.

**B1 — 14px is not monolithic:** 14px appears in buttons, inputs, and list rows. Bulk-replace to `--text-compact` is wrong for ~50% of instances. Each 14px instance requires a contextual judgment call.

**B2 — CI grep gate:** Add a CI check to fail if any hardcoded `fontSize: 'Npx'` pattern remains in `src/`. Prevents regression after the sweep.

**B3 — DESIGN.md line 213:** Currently says `--text-base: 14px`. Must be corrected to `16px` as part of T1.

---

- [ ] **T5 (P2, human: ~2h / CC: ~15min)** — All components — Spacing audit
  - Surfaced by: Pass 6 — 400+ instances of non-4px-multiple spacing (6/10/14/3/5/7px)
  - Files: All .tsx files
  - Rule: between-element gaps (margin, gap) → round to nearest 4px multiple; within-element padding at 10px → 12px; at 6px → 8px

- [ ] **T6 (P2, human: ~1h / CC: ~10min)** — tokens.css + all components — Border-radius consolidation
  - Surfaced by: Pass 4 — 15+ distinct radius values, needs 6-token system
  - Files: `src/styles/tokens.css`, then all .tsx
  - Verify: `grep "borderRadius" src/ -r` returns only var(--radius-*) references

- [ ] **T7 (P3, human: ~30min / CC: ~5min)** — AddRaceModal + ViewEditRaceModal — Touch target audit post-spacing
  - Surfaced by: Pass 6 — 6px→8px change may drop button heights below 44px WCAG minimum
  - Files: `src/components/AddRaceModal.tsx`, `src/components/ViewEditRaceModal.tsx`
  - Verify: All interactive elements ≥44px at 375px viewport

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 6 findings (A1–A3, B1–B3); scope staged T1–T4 first |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAN | score: 3/10 → 9/10, 6 decisions |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0
**VERDICT:** Design Review CLEAR. Eng Review CLEAR. Ready to implement T1 → T2 → T3 → T4.
