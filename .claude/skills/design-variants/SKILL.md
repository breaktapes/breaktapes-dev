# /design-variants — Parallel Design Exploration

Spawns 4 parallel subagents, each implementing a distinct design direction for a component.
Never merges anything. Produces a screenshot gallery + comparison doc for the user to choose from.

Trigger phrases: "upgrade this UI/UX", "give me options", "design variants", "show me alternatives", "/design-variants"

---

## Step 0 — Identify the target

If the user didn't name a specific component, ask:
> Which component or page section should I explore? (e.g. "race card", "dashboard hero", "medals grid")

Once confirmed, proceed.

---

## Step 1 — Spawn 4 parallel agents

Use the Agent tool with `isolation: "worktree"` for each. Send all 4 in a single message (parallel).

Each agent receives a self-contained brief (below). Replace `<COMPONENT>` with the actual component name/file path.

### Agent 1 — Minimalist / Typographic
```
You are a UI engineer on the BREAKTAPES React app (TypeScript + Vite).
Worktree is already set up — work in the current directory.

TASK: Redesign <COMPONENT> in a minimalist/typographic direction.
- Strip all decorative elements (gradients, borders, icons where possible)
- Let data breathe: generous whitespace, large type hierarchy
- Monospace or condensed type for numbers/stats
- Palette: near-black surfaces, single accent color max
- No illustrations, no imagery

Steps:
1. Read the component file. Read DESIGN.md and CLAUDE.md for tokens.
2. Implement the redesign.
3. Run `npm run dev` in the background (it will use port 5173).
4. Use mcp__Claude_Preview__preview_screenshot at http://localhost:5173 width=1280 → save to designs/variant-1/desktop.png
5. Use mcp__Claude_Preview__preview_screenshot at http://localhost:5173 width=390 → save to designs/variant-1/mobile.png
6. Write designs/variant-1/notes.md: 3-bullet tradeoffs (pros/cons/best-for)
7. Do NOT commit. Do NOT push. Do NOT touch any other component.
```

### Agent 2 — Marketplace / Flatlay
```
You are a UI engineer on the BREAKTAPES React app (TypeScript + Vite).
Worktree is already set up — work in the current directory.

TASK: Redesign <COMPONENT> in a marketplace/flatlay direction.
- Card-forward: imagery or color-block hero area per item
- Product-card aesthetic: price-tag feel, clear hierarchy of name → meta → action
- Subtle shadows, rounded cards, warm neutrals or brand orange
- Feels like a premium e-commerce shelf

Steps:
1. Read the component file. Read DESIGN.md and CLAUDE.md for tokens.
2. Implement the redesign.
3. Run `npm run dev` in the background.
4. Use mcp__Claude_Preview__preview_screenshot at http://localhost:5173 width=1280 → save to designs/variant-2/desktop.png
5. Use mcp__Claude_Preview__preview_screenshot at http://localhost:5173 width=390 → save to designs/variant-2/mobile.png
6. Write designs/variant-2/notes.md: 3-bullet tradeoffs
7. Do NOT commit. Do NOT push. Do NOT touch any other component.
```

### Agent 3 — Data-Dense Dashboard
```
You are a UI engineer on the BREAKTAPES React app (TypeScript + Vite).
Worktree is already set up — work in the current directory.

TASK: Redesign <COMPONENT> in a data-dense dashboard direction.
- Pack maximum useful data into minimum space
- Tabular/grid layout, small but legible type
- Inline sparklines or mini-charts where meaningful
- Feels like a Bloomberg terminal or Strava athlete breakdown
- No wasted whitespace — every pixel earns its place

Steps:
1. Read the component file. Read DESIGN.md and CLAUDE.md for tokens.
2. Implement the redesign.
3. Run `npm run dev` in the background.
4. Use mcp__Claude_Preview__preview_screenshot at http://localhost:5173 width=1280 → save to designs/variant-3/desktop.png
5. Use mcp__Claude_Preview__preview_screenshot at http://localhost:5173 width=390 → save to designs/variant-3/mobile.png
6. Write designs/variant-3/notes.md: 3-bullet tradeoffs
7. Do NOT commit. Do NOT push. Do NOT touch any other component.
```

### Agent 4 — Playful / Illustrated
```
You are a UI engineer on the BREAKTAPES React app (TypeScript + Vite).
Worktree is already set up — work in the current directory.

TASK: Redesign <COMPONENT> in a playful/illustrated direction.
- Bold color blocks, emoji or icon-forward layout
- Personality: feels like a personal running journal, not an enterprise app
- Use existing brand colors at higher saturation/opacity
- Celebrate the data: big numbers, milestone callouts, confetti-style accents (CSS only)

Steps:
1. Read the component file. Read DESIGN.md and CLAUDE.md for tokens.
2. Implement the redesign.
3. Run `npm run dev` in the background.
4. Use mcp__Claude_Preview__preview_screenshot at http://localhost:5173 width=1280 → save to designs/variant-4/desktop.png
5. Use mcp__Claude_Preview__preview_screenshot at http://localhost:5173 width=390 → save to designs/variant-4/mobile.png
6. Write designs/variant-4/notes.md: 3-bullet tradeoffs
7. Do NOT commit. Do NOT push. Do NOT touch any other component.
```

---

## Step 2 — Wait for all 4 agents

All 4 run in parallel. Wait until all complete before proceeding.

---

## Step 3 — Build comparison gallery

Once all agents finish, create `designs/COMPARISON.md` in the main worktree:

```markdown
# Design Variants — <COMPONENT> — <DATE>

Pick a direction. Nothing is merged. To ship a variant: `git checkout designs/variant-N -- <component-file>`

---

## Variant 1 — Minimalist / Typographic

| Desktop | Mobile |
|---------|--------|
| ![desktop](variant-1/desktop.png) | ![mobile](variant-1/mobile.png) |

<paste variant-1/notes.md content>

---

## Variant 2 — Marketplace / Flatlay

| Desktop | Mobile |
|---------|--------|
| ![desktop](variant-2/desktop.png) | ![mobile](variant-2/mobile.png) |

<paste variant-2/notes.md content>

---

## Variant 3 — Data-Dense Dashboard

| Desktop | Mobile |
|---------|--------|
| ![desktop](variant-3/desktop.png) | ![mobile](variant-3/mobile.png) |

<paste variant-3/notes.md content>

---

## Variant 4 — Playful / Illustrated

| Desktop | Mobile |
|---------|--------|
| ![desktop](variant-4/desktop.png) | ![mobile](variant-4/mobile.png) |

<paste variant-4/notes.md content>

---

## How to apply a variant

```bash
# Apply variant N's component changes to your current branch:
git checkout designs/variant-N -- <path/to/component>
```

Or tell Claude: "apply variant 2" and it will cherry-pick the file change.
```

---

## Step 4 — Present to user

Tell the user:
- Gallery is at `designs/COMPARISON.md`
- Which variant you personally think fits the existing BREAKTAPES brand best (and why, 1 sentence)
- How to apply their pick: "say 'apply variant N' and I'll copy the file to your working branch"

**Never merge, never commit to staging/main, never push.**

---

## Rules

- All 4 agents run in parallel — never sequential
- Each agent uses an isolated worktree (`isolation: "worktree"`)
- Screenshots at both 1280px (desktop) and 390px (mobile) — always both
- No agent touches files outside the target component + its direct style imports
- If an agent fails (dev server port conflict, screenshot timeout): note failure in COMPARISON.md, continue with remaining variants
- The user decides which variant ships — Claude never auto-applies

---

## CLAUDE.md routing addition

Add to CLAUDE.md skill routing section:
- UI redesign, "give me options", "upgrade this UI/UX", "show me alternatives" → invoke design-variants
