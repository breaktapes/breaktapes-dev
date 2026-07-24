# BREAKTAPES Design System v6

> Status: proposed replacement for `DESIGN.md`
>
> Basis: app audit of the live React product structure, including `Dashboard`,
> `Races`, `Train`, `Profile`, `Discover`, `Compare`, `Settings`,
> `PublicProfile`, `LandingPage`, and `Admin`.

---

## 1. Product Truth

BREAKTAPES is not primarily a generic fitness dashboard.

It is a **premium athlete dossier** that combines:

- race memory and archival pride
- next-race planning
- performance interpretation
- public identity and comparison
- lightweight utility tooling for endurance athletes

The app is strongest when it feels like:

**"Your race life, documented like a dossier and sharpened into next-race intelligence."**

That should be the design center.

Everything in this document follows from that sentence.

---

## 2. What The App Should Feel Like

BREAKTAPES should feel:

- personal, not clinical
- ambitious, not gamified
- premium, not flashy
- readable, not compressed
- athletic, not generic SaaS
- intelligent, not widget-chaotic

The current visual language already has a strong emotional signature:

- dark archival surfaces
- warm stone text
- brick vermilion action color
- trophy gold for achievement

That identity should stay.

What must change is **how that identity is applied**.

The current app too often pushes:

- too many simultaneous cards
- too many small muted labels
- too much uppercase condensed text in support roles
- too much mobile density on laptop layouts

The v6 direction keeps the brand, but restores hierarchy and legibility.

---

## 3. Core Design Decision

### BREAKTAPES is a dossier-first product, not a dashboard-first product.

That means:

- history matters as much as prediction
- records should feel collectible and memorable
- the interface should interpret performance, not just list stats
- profile, races, and export surfaces are first-class, not secondary decoration

The dashboard remains important, but it should behave like a **briefing layer** on top of the dossier, not like a grid of equal-weight widgets.

---

## 4. Product Surface Model

The app actually contains **three different visual systems**. v6 should formalize that instead of forcing one intensity level everywhere.

### A. Marketing System

Used on:

- `breaktapes.com` landing

Should feel:

- cinematic
- high-motion
- bold
- persuasive

Allowed here:

- theatrical gradients
- large-scale scroll choreography
- dramatic glow
- high-emotion copy

### B. Athlete App System

Used on:

- dashboard
- races
- train
- profile
- settings
- discover
- compare
- public profile

Should feel:

- premium
- calm
- sharp
- highly readable
- emotionally athletic without being loud

This is the **primary system**.

### C. Utility / Admin System

Used on:

- admin
- dense settings states
- maintenance / integrity / analytics views

Should feel:

- utilitarian
- fast to scan
- less theatrical
- more explicit

This system should reuse brand colors, but not brand drama.

---

## 5. What Will Work Best For This App

These are the most important v6 decisions.

### 5.1 Make the dashboard a briefing, not a widget warehouse

Current reality:

- `Dashboard.tsx` contains a very large number of individually framed widgets
- editability is powerful
- hierarchy is weak
- laptop readability suffers because too many small explanatory surfaces compete

Best direction:

- keep customization
- reduce default visible modules
- group insight surfaces into clearer families
- give the home screen stronger narrative order

Recommended dashboard order:

1. Morning / race briefing
2. Next race / countdown / focus block
3. Recent form and progress
4. Curated intelligence modules
5. Quick actions

Default visible modules should be closer to **6-8 meaningful surfaces**, not "show as many as fit."

The rest can remain discoverable through:

- edit mode
- detail sheets
- progressive disclosure

### 5.2 Let Races be the emotional center of the product

`Races` is the soul of BREAKTAPES.

It contains:

- archive
- map
- city/country memory
- wishlist / future planning
- passport export

This page should feel like the athlete's **career archive**, not just another screen.

Best direction:

- on mobile: keep map + bottom sheet pattern
- on laptop/desktop: shift to a **true split layout**

Recommended desktop layout:

- left: race archive, year tabs, stats strip, search/sort, export entry
- right: live map / geographic context

This is one of the clearest places where current mobile-led composition should not control laptop experience.

### 5.3 Treat Train as a lab, not a trophy room

`Train` is fundamentally different from `Profile` and `Races`.

It includes:

- pace calculators
- tri projections
- planning utilities
- workout-oriented tools

Best direction:

- cleaner utility rhythm
- bigger form text
- more explicit results panels
- less ornamental chrome

`Train` should feel like a **focused performance lab**.

It still belongs to the BREAKTAPES brand, but it should be calmer and more legible than the landing page or trophy surfaces.

### 5.4 Treat Profile as an athlete dossier, not a stats dump

`Profile.tsx` is already a deep page with:

- hero
- medal wall
- achievements
- PBs
- signature distances
- age-grade
- timeline
- heatmap
- majors / qualifiers
- race personality
- injuries
- goals

This is extremely valuable depth.

Best direction:

- present it editorially
- create stronger section rhythm
- make each section feel like a chapter
- use fewer competing visual treatments per screen depth

Profile should feel like:

**"an enduring personal record you want to revisit"**

not:

**"another screen of cards."**

### 5.5 Move readability from preference to system rule

The user's complaint is correct.

Laptop readability is currently the biggest design quality issue.

v6 must treat readability as a **hard system constraint**.

---

## 6. New UX Hierarchy

### Primary Jobs

These are the jobs the app must visibly support:

1. Remember my race life
2. Prepare for my next race
3. Understand my performance arc
4. Show who I am as an athlete
5. Find and compare what comes next

Every major surface should map clearly to one of those jobs.

### Navigation Roles

Recommended top-level app roles:

- `Home` = briefing
- `Races` = archive
- `Train` = lab
- `You` = dossier

Secondary, not primary identity:

- `Discover`
- `Compare`
- `Settings`

Future / optional subsystem:

- `Gear`

Important:

`Gear` should not shape the primary design language today.

It exists, but the app's core identity is not commerce-first.

---

## 7. Layout System

v6 should introduce a more honest layout model.

### Breakpoints

Use four tiers:

- Mobile: `0-767`
- Tablet: `768-1023`
- Laptop: `1024-1439`
- Wide Desktop: `1440+`

Reason:

the current system under-specifies the laptop tier, which is exactly where the readability issue is felt most.

### Layout Rules

#### Mobile

- single-column
- bottom nav
- bottom sheets
- compact but readable

#### Tablet

- single-column primary flow
- occasional two-column card groups
- keep touch-first patterns

#### Laptop

- use width for readability, not density
- split panes become allowed
- section spacing increases
- support text gets larger
- side panels and wider cards replace stacked micro-panels

#### Wide Desktop

- preserve readable line length
- do not simply keep stretching cards
- use max widths and multi-column systems intentionally

### Non-Negotiable Desktop Rule

On laptop and above, do **not** let mobile compression dictate page structure if the job benefits from wider spatial organization.

Examples:

- `Races`: split archive + map
- `Train`: forms left, results right
- `Compare`: more symmetric side-by-side columns
- `Settings`: grouped panels instead of long mobile stack

---

## 8. Typography

The font family choices are directionally right.

Keep:

- `Barlow Condensed` for display and section emphasis
- `Barlow` for body copy and explanatory interface text
- `Geist Mono` for metrics, chips, axes, and technical detail

What changes is scope and floor.

### Type Roles

#### Display

- `Barlow Condensed`
- use for key titles, major section framing, and rare statement numbers
- never for long explanatory copy

#### Body

- `Barlow`
- use for any sentence the user truly needs to read
- this becomes the default for settings copy, descriptions, notes, helper text

#### Technical

- `Geist Mono`
- use by default for timing, pace, labels, chips, dates, measured values, and actionable numbers
- do not let it dominate paragraph-like reading

### v6 Size Scale

- `48px` display metric
- `32px` feature number / card hero
- `24px` page title
- `18px` section title
- `16px` body default
- `14px` support / helper / dense readable text
- `12px` meta and labels
- `11px` decorative micro text only

### Readability Rules

- `12px` is the minimum for informative text
- `13-14px` is preferred for laptop support copy
- `9-11px` cannot carry required reading load
- uppercase condensed text is for short labels only
- long labels, helper text, descriptions, and settings explanations use sentence-case body text
- body/support line-height should usually sit between `1.45` and `1.6`
- prose line length should target roughly `60-72ch`

### Biggest Typography Change

The app should stop using its most expressive font for low-level repeated metadata.

That means:

- less uppercase condensed repetition
- most important numbers move to `Geist Mono` at sturdier weights
- more sentence-case support text
- higher contrast for explanation

### Numeric System

v6 treats numbers as a first-class system, not as incidental text.

Every number in the app must map to one of these categories:

#### 1. Countdown numerals

Used for:

- race countdowns
- days / hours / minutes / seconds
- weeks-to-race summaries

Rules:

- `Geist Mono`
- tabular numerals required
- large enough to read at a glance from laptop distance
- separators quieter than the digits
- only one countdown logic per race surface

#### 2. Hero performance values

Used for:

- finish times
- PB times
- predicted finish times
- course-fit / momentum / score hero values

Rules:

- default to `Geist Mono`
- `500` weight minimum
- large, isolated, and visually dominant
- labels must be quieter than values

#### 3. Pace and zone values

Used for:

- `min/km`
- `min/mi`
- VDOT-derived pacing outputs
- split targets

Rules:

- always `Geist Mono`
- tabular numerals required
- never smaller than supporting explanatory text when they are the primary output
- range values should align visually and avoid cramped separators

#### 4. Archive and stat counts

Used for:

- races
- countries
- cities
- medals
- yearly totals
- distance totals

Rules:

- `Geist Mono`
- stronger than their label
- compact, but not decorative

#### 5. Score / percent numerics

Used for:

- VDOT
- age grade
- course fit
- readiness-like internal percentages
- progress toward goals

Rules:

- `Geist Mono`
- percentages must read as numbers first, badges second
- if a score is central to the card, it needs hero treatment

#### 6. Micro numerics

Used for:

- dates
- axis values
- list-side metadata
- small units

Rules:

- `Geist Mono`
- only small if clearly secondary
- never combine tiny size with low contrast if the user still needs to interpret it

### Canonical Numeric Rules

- All actionable numeric values use `Geist Mono`
- All actionable numeric values use tabular numerals
- `font-weight: 500` is the default numeric floor
- Numeric tracking should be slightly tightened, not heavily compressed
- Labels around numbers should usually use `Barlow` or restrained `Barlow Condensed`, never overpower the value itself
- A surface should not mix multiple numeric scales unless the hierarchy is obvious

---

## 9. Color System

Keep the current semantic logic.

### Core Semantics

- Orange = action, momentum, athletic heat
- Gold = achievement, premium, export, trophy energy
- Stone = readable text
- Purple = tri / special domain accent only

### v6 Change

Use fewer simultaneous emphases on a single screen.

Current risk:

- orange accent
- gold accent
- green callout
- multiple glows
- muted microcopy

all appearing at once.

That weakens hierarchy.

### v6 Rule

Each surface gets:

- one dominant accent
- one optional secondary accent
- one readable neutral text system

If green appears, it should mean something live or physiological.

It should never be decorative.

### Theme System

Keep the theme system, but apply stricter readability checks.

All themes must preserve:

- contrast
- legible support text
- stable semantic mappings

Premium themes can vary mood.

They cannot vary basic readability quality.

---

## 10. Motion System

Motion should support:

- entry
- focus
- achievement
- loading
- state confirmation

Motion should not constantly compete with reading.

### Keep

- subtle fade/slide entry
- occasional shimmer for loading or highlight
- celebratory motion for PB / milestone moments
- small active-state glow

### Reduce

- perpetual shimmer on resting content
- too many independent animated surfaces on one screen
- decorative motion inside utility/admin contexts

### Page-Level Motion Intent

- Marketing: cinematic
- Athlete app: restrained
- Admin: near-static

---

## 11. Component System

v6 should simplify the number of visual component archetypes.

The app currently behaves as though too many surfaces are custom.

Reduce to these primary classes:

### 11.1 Hero Block

Used for:

- race briefing
- athlete hero
- public profile hero
- next-race focus

Characteristics:

- strongest hierarchy
- large display text
- one clear emotional emphasis

### 11.2 Insight Card

Used for:

- dashboard intelligence
- forecast / comparison summaries

Characteristics:

- one headline idea
- one primary metric
- one explanatory line
- optional secondary cue

### 11.3 Archive Row

Used for:

- race history
- activities
- compare rows
- admin list-style entities

Characteristics:

- scan-first
- strong left anchor
- compact but readable

### 11.4 Utility Panel

Used for:

- calculators
- settings groups
- admin controls

Characteristics:

- less decorative
- higher clarity
- larger form text

### 11.5 Editorial Section Shell

Used for:

- profile chapters
- public profile sections
- landing sub-sections

Characteristics:

- rhythm and grouping
- typographic pacing
- section-level atmosphere without dense chrome

### 11.6 Overlay Surface

Used for:

- bottom sheets
- modals
- detail panels
- search sheets

Characteristics:

- mobile: sheet-first
- laptop+: centered modal or side panel when readability improves

---

## 12. Page-by-Page Direction

### Dashboard

Purpose:

- orient me now
- tell me what matters next
- surface a small number of smart insights

Design rules:

- default home must be calmer
- fewer visible widgets
- stronger section framing
- better explanatory copy size
- edit mode remains powerful but visually secondary

### Races

Purpose:

- preserve history
- explore career geography
- log and review race records

Design rules:

- this is an archive page, not a dashboard page
- desktop uses split-pane list/map
- year grouping and PB rows remain central
- export/passport entry gets elevated as a hero capability

### Train

Purpose:

- calculate
- prepare

Design rules:

- cleaner utility styling
- larger forms and result panels
- strong distinction between calculators and planning outputs

### Profile / You

Purpose:

- present athlete identity
- turn stats into story

Design rules:

- chaptered layout
- clearer section breaks
- fewer competing gradients
- hero and medals feel premium
- support text gets more room to breathe

### Discover

Purpose:

- browse possible next races
- plan future season

Design rules:

- catalog tone
- filter clarity
- editorial race cards
- stronger planning CTA hierarchy

### Compare

Purpose:

- social proof
- rivalry
- perspective

Design rules:

- symmetric composition
- obvious winners/contrasts
- easy scan of the important differences

### Settings

Purpose:

- manage account and visibility
- adjust preference and theme

Design rules:

- utility over flair
- no tiny support copy
- toggles and status rows must be unmistakable

### Public Profile

Purpose:

- athlete showcase
- recruiting / sharing / identity

Design rules:

- polished and proud
- less cramped than internal dashboard surfaces
- export and public share language should align

### Admin

Purpose:

- operational control
- analytics
- integrity / debugging

Design rules:

- utilitarian
- denser than athlete app, but clearer
- less atmospheric styling
- more obvious tables, bars, statuses, and filters

---

## 13. What We Stop Doing

v6 explicitly stops these patterns.

### Stop 1

Do not use `9-11px` text for anything the user genuinely needs to read on laptop.

### Stop 2

Do not stack multiple lines of uppercase condensed metadata when sentence-case body text would parse faster.

### Stop 3

Do not give every concept its own equally weighted card on the home screen.

### Stop 4

Do not use the same visual intensity for marketing, athlete app, and admin.

### Stop 5

Do not keep mobile overlay structures unchanged on desktop when split layouts would work better.

### Stop 6

Do not use `--muted2` for informational copy.

### Stop 7

Do not treat Gear as a primary brand-defining surface until it becomes a primary product job again.

---

## 14. What We Double Down On

### Double Down 1

Race history and export are unique. Keep investing there.

### Double Down 2

PBs, medals, countries raced, and passport-style surfaces are emotionally memorable differentiators.

### Double Down 3

The dashboard becomes much stronger when it feels like a curated briefing rather than a customizable warehouse.

### Double Down 4

The app wins when it interprets race life as identity, not only performance telemetry.

### Double Down 5

The dark archival athletic tone is good and should stay.

It just needs better restraint and readability discipline.

---

## 15. Recommended Visual North Star

If v6 is executed correctly, the app should feel like:

- the athlete equivalent of a premium dossier
- part race archive
- part performance briefing
- part public identity card
- part training utility lab

Not:

- a crypto dashboard
- a generic health app
- a moodboard-heavy concept landing everywhere
- a widget graveyard

---

## 16. Implementation Priorities

This is the order that will create the most value.

### Priority 1

Rewrite the readability rules and typography floor.

### Priority 2

Redesign the dashboard around briefing hierarchy.

### Priority 3

Introduce proper laptop/desktop layout patterns, especially for `Races`, `Train`, and `Settings`.

### Priority 4

Normalize component archetypes:

- hero block
- insight card
- archive row
- utility panel
- overlay surface

### Priority 5

Refine profile/public/export surfaces into one coherent dossier family.

### Priority 6

Separate admin and utility styling from the more emotional athlete-facing system.

---

## 17. Success Criteria

v6 is successful when:

- the app remains unmistakably BREAKTAPES
- laptop readability feels materially better without zoom
- dashboard feels more intentional and less noisy
- races/profile/export feel like the emotional heart of the product
- train/settings/admin feel clearer and more usable
- the product reads as one coherent system, not several unrelated card languages

---

## 18. Canonical Summary

The best version of BREAKTAPES is:

**an athlete dossier with next-race intelligence**

The design system should therefore optimize for:

- memory
- ambition
- interpretation
- readability
- hierarchy

not raw density.
