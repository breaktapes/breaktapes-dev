# /fix-from-issue — Autonomous Bug Fix Pipeline

Given one or more GitHub issue numbers or bug descriptions, reproduces each bug with a failing test,
iterates until fixed, and opens a PR linking the issue. Multiple issues run in parallel worktrees.

Trigger phrases: "fix issue #N", "fix #N #M", "/fix-from-issue", "fix these issues"

---

## Step 0 — Parse input

Extract issue numbers or descriptions from the user's message.

- Issue numbers: `#123`, `#124`, `#125`
- Raw description: "the race card crashes when time is null"

For raw descriptions with no issue number: create a GitHub issue first via `gh issue create`, then use that number.

If multiple issues given: run all in parallel (one agent per issue). Jump to Step 1 for each.
If single issue: run Step 1 directly without spawning a subagent.

---

## Step 1 — Read the issue

```bash
gh issue view <N> --repo breaktapes/breaktapes-dev
```

Extract:
- Title + description
- Labels (bug / visual / logic / regression)
- Any linked code references or repro steps
- Comments (may contain repro details)

Classify the bug type:
- **Logic bug**: wrong calculation, crash, data corruption → unit test
- **Visual bug**: wrong layout, overflow, missing element → preview_screenshot assertion
- **Integration bug**: auth, Supabase, OAuth → integration test or manual repro steps

---

## Step 2 — Reproduce locally

Read the relevant component/function files. Trace the code path described in the issue.

Confirm the bug exists in the current codebase before writing a test:
- For logic: add a temporary `console.log` or read the function closely to confirm the bad path
- For visual: start the dev server and use `mcp__Claude_Preview__preview_screenshot` at the buggy state

If the bug is **not reproducible** (already fixed or issue is stale):
- Comment on the issue: `gh issue comment <N> --body "Cannot reproduce on current staging. Closing as already fixed."`
- Close: `gh issue close <N>`
- Stop. Report to user.

---

## Step 3 — Write a FAILING test

**Rule:** The test must fail on current code and pass after the fix. Never write a test that already passes.

### For logic bugs — add to existing test file or create new:

```typescript
// tests/<feature>.test.ts  OR  src/__tests__/<feature>.test.ts
describe('Issue #<N>: <title>', () => {
  it('<what should happen that currently does not>', () => {
    // Arrange: set up the exact conditions from the issue
    // Act: call the function
    // Assert: what SHOULD be true (this will fail right now)
    expect(result).toBe(expectedValue)
  })
})
```

### For visual bugs — add a screenshot assertion:

```typescript
// src/__tests__/visual-<N>.test.ts
import { test, expect } from 'vitest'

test('Issue #<N>: <visual condition>', async () => {
  // Use preview_screenshot to capture the buggy state
  // Assert against a known-good condition
  // This test documents the regression even if screenshot comparison is manual
  expect(true).toBe(false) // placeholder — replace with real assertion
})
```

For pure visual bugs where the assertion is human-verified:
- Take a BEFORE screenshot: `mcp__Claude_Preview__preview_screenshot` at relevant viewport
- Save to `designs/issue-<N>/before.png`
- Write the test as a documented repro (failing assertion = `expect(bugCondition).toBe(false)`)

### Commit the failing test:

```bash
git add <test file>
git commit -m "test: reproduce #<N> — <one-line description>"
```

Verify it fails:
```bash
npm test -- --testPathPattern=<file>    # Jest
# OR
npm run test:react -- <file>            # vitest
```

If the test passes (bug already fixed): go back to Step 2, refine the test condition.

---

## Step 4 — Fix iteration loop (max 5 attempts)

### Each iteration:

**4a. Analyze**
- Read the failing test output carefully
- Trace the code path from the test to the root cause
- Form a hypothesis: "The bug is X because Y"

**4b. Fix**
- Make the minimal code change that addresses the root cause
- Do NOT refactor unrelated code
- Do NOT touch test files in the fix commit

**4c. Run full suite**
```bash
npm test && npm run test:react && npx tsc --noEmit
```

**4d. Evaluate**
- Target test now passes → ✅ continue to 4e
- Target test still fails → try different approach, back to 4a
- Existing tests now fail → fix introduced a regression, revert the fix, back to 4a
- TypeScript errors → fix them as part of this iteration

**4e. Commit the fix**
```bash
git add <changed files — never .env or secrets>
git commit -m "fix(<scope>): <description> — closes #<N>"
```

### If loop exhausts 5 iterations without a passing suite:
- STOP
- Report to user: show all 5 attempts, the failure output from each, and your best hypothesis for why the bug is hard to fix
- Do NOT open a PR
- Leave the failing test committed (it documents the bug)

---

## Step 5 — Visual verification (if visual bug)

After a successful fix:

```
mcp__Claude_Preview__preview_screenshot at relevant URL, width=1280 → designs/issue-<N>/after-desktop.png
mcp__Claude_Preview__preview_screenshot at relevant URL, width=390  → designs/issue-<N>/after-mobile.png
```

Create `designs/issue-<N>/RESULT.md`:
```markdown
## Issue #<N> — Visual Fix Verification

**Before:** ![before](before.png)
**After (desktop):** ![after desktop](after-desktop.png)
**After (mobile):** ![after mobile](after-mobile.png)

Fix: <one-line description of what changed>
```

Include this file in the fix commit or as a follow-up commit.

---

## Step 6 — Open PR

```bash
git push origin <branch>

gh pr create \
  --base staging \
  --title "fix: <issue title> (#<N>)" \
  --body "$(cat <<'EOF'
## Summary

Fixes #<N> — <issue title>

**Root cause:** <one sentence>
**Fix:** <one sentence>

## Reproduction test

Added `<test file>` — committed separately as `test: reproduce #<N>` so the failing → passing transition is visible in the diff.

## Test results

- `npm test` ✅ (<count> tests)
- `npm run test:react` ✅ (<count> tests)
- `npx tsc --noEmit` ✅

## Visual verification (if applicable)

<embed before/after screenshots from designs/issue-N/ if visual bug>

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
EOF
)"
```

**PR commit structure must be:**
1. `test: reproduce #<N> — <description>` (failing test)
2. `fix(<scope>): <description> — closes #<N>` (the fix, which makes test green)
3. (optional) `chore: add visual verification for #<N>` (screenshots)

---

## Parallel execution (multiple issues)

When given multiple issue numbers, spawn one Agent per issue using `isolation: "worktree"`.
Send all agents in a single message (parallel).

Each agent brief:
```
You are a bug-fix engineer on the BREAKTAPES React app.
Your isolated worktree is already set up — work in the current directory.

Follow the /fix-from-issue workflow for issue #<N>:
1. `gh issue view <N> --repo breaktapes/breaktapes-dev` to read the issue
2. Reproduce locally
3. Write a FAILING test, commit as "test: reproduce #<N>"
4. Fix (max 5 iterations), commit as "fix: ... closes #<N>"
5. If visual bug, screenshot before/after into designs/issue-<N>/
6. Open PR to staging

Rules:
- Never touch other components
- Never skip the failing test step
- If not reproducible, close the issue and stop
- Report back: PR URL or failure reason

Repo: breaktapes/breaktapes-dev
Base branch for PR: staging
```

After all agents complete, compile results:

```
## /fix-from-issue Results

| Issue | Status | PR | Iterations |
|-------|--------|----|------------|
| #N    | ✅ Fixed | #PR_N | 2 |
| #M    | ✅ Fixed | #PR_M | 1 |
| #Z    | ❌ Failed (5 iterations) | — | 5 |
```

For failed issues: paste the final error output and best hypothesis.

---

## Stop conditions

| Condition | Action |
|-----------|--------|
| Bug not reproducible | Close issue, report, stop |
| Test passes before fix (already fixed) | Close issue, report, stop |
| 5 iterations, still failing | Report with full failure log, no PR |
| Fix breaks existing tests | Revert, count as failed iteration |
| TypeScript errors introduced | Must fix in same iteration, counts against the 5 |

---

## Rules

- ALWAYS commit the failing test BEFORE the fix — this is the whole point
- NEVER write a test that already passes
- NEVER squash the test + fix into one commit — keep them separate
- NEVER touch unrelated code
- NEVER merge the PR — user reviews and merges
- ALWAYS run the full suite (`npm test && npm run test:react && tsc`) before declaring success
- For visual bugs: screenshots are required — do not skip
