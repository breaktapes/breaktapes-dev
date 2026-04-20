# /ship-autonomous — BREAKTAPES Autonomous Release Pipeline

Executes the full release pipeline without confirmation. Stops ONLY if:
- Tests fail and auto-fix fails after 2 attempts
- CI fails after the deploy
- Visual regression detected in screenshots

Extends `/ship`. CLAUDE.md conventions apply throughout.

---

## Step 1 — Tests (auto-fix on failure)

```bash
npm test && npm run test:react && npx tsc --noEmit
```

**If green:** proceed.

**If red:** attempt auto-fix (max 2 iterations):
1. Read the exact error output
2. Fix the failing test or the code causing the failure
3. Re-run the full suite
4. If still red after 2 attempts: **STOP. Report failures. Ask user.**

Never skip tests. Never proceed with a red suite.

---

## Step 2 — Commit (if needed)

If working tree has uncommitted changes:

```bash
git status
git add <specific files — never .env or secrets>
git commit -m "type(scope): description based on actual diff"
```

Write the commit message from the actual diff — not a generic placeholder.
If tree is already clean, skip.

---

## Step 3 — Push + PR to staging

```bash
git push origin <branch>
gh pr create \
  --base staging \
  --title "<type>: <summary>" \
  --body "$(cat <<'EOF'
## Summary
<bullet points from actual diff>

## Test plan
- [ ] npm test passes
- [ ] npm run test:react passes
- [ ] tsc --noEmit clean
- [ ] Staging deploy verified via curl
- [ ] Visual screenshots reviewed

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
EOF
)"
```

PR title and body must reflect the actual changes. No generic copy.

---

## Step 4 — Poll CI on staging branch

After PR merge, poll until deploy workflow completes:

```bash
# Merge the PR first
gh pr merge <PR_NUMBER> --squash --repo breaktapes/breaktapes-dev

# Then poll (check every 30s, timeout 10min)
for i in $(seq 1 20); do
  STATUS=$(gh run list --branch staging --limit 1 --json status,conclusion -q '.[0] | "\(.status) \(.conclusion)"')
  echo "[$i/20] $STATUS"
  [[ "$STATUS" == "completed success" ]] && break
  [[ "$STATUS" == "completed failure" ]] && echo "CI FAILED" && exit 1
  sleep 30
done
```

**If CI fails:** STOP. Show the failed run URL. Ask user.

---

## Step 5 — Visual screenshot comparison (staging)

Once CI is green, capture staging at both viewports:

```
mcp__Claude_Preview__preview_screenshot at https://dev.breaktapes.com, width=1280 (desktop)
mcp__Claude_Preview__preview_screenshot at https://dev.breaktapes.com, width=390 (mobile)
```

**Baseline:** compare against the last screenshots in `SHIP_LOG.md` (if any exist).

**Regression check — stop and ask if ANY of these are true:**
- Layout broken (content clipped, overflow, nav missing)
- White/blank screen
- Auth wall visible when it shouldn't be (or vice versa)
- Major visual element missing vs baseline

**If no baseline exists yet:** treat first run as baseline, proceed.
**If visuals look good:** proceed. Note any minor diffs in the ship log.

---

## Step 6 — Merge staging → main

```bash
gh pr create \
  --base main \
  --head staging \
  --title "Release: <date> — <summary>" \
  --body "Promoted from staging. Staging verified ✓"

gh pr merge <PR_NUMBER> --squash --repo breaktapes/breaktapes-dev
```

---

## Step 7 — Poll CI on main + verify prod

```bash
# Poll main CI (same pattern as step 4)
for i in $(seq 1 20); do
  STATUS=$(gh run list --branch main --limit 1 --json status,conclusion -q '.[0] | "\(.status) \(.conclusion)"')
  echo "[$i/20] $STATUS"
  [[ "$STATUS" == "completed success" ]] && break
  [[ "$STATUS" == "completed failure" ]] && echo "PROD CI FAILED" && exit 1
  sleep 30
done

# Verify live
curl -sI https://app.breaktapes.com | head -5
```

Must return HTTP 200. If not: STOP. Report. Ask user.

---

## Step 8 — Cleanup

**CRITICAL — worktree safety:**

```bash
CURRENT_WT=$(pwd)
MAIN_REPO="/Users/akrish/DEV/breaktapes-dev"

# 1. Delete remote + local branch
git push origin --delete <branch> 2>/dev/null || true
git -C "$MAIN_REPO" branch -d <branch> 2>/dev/null || true

# 2. Only remove the worktree if we are NOT currently inside it
if [[ "$CURRENT_WT" != *"<worktree-path>"* ]]; then
  cd "$MAIN_REPO"
  git worktree remove <worktree-path> --force 2>/dev/null || true
else
  echo "⚠️  Skipping worktree delete — shell is rooted here."
  echo "    Run manually: cd $MAIN_REPO && git worktree remove <path>"
fi

git -C "$MAIN_REPO" worktree prune
```

Never delete the worktree the current shell is inside of. Always cd to main repo first.

---

## Step 9 — Write SHIP_LOG.md

Append to `SHIP_LOG.md` in the repo root:

```markdown
## <YYYY-MM-DD HH:MM> — <branch>

**Staging PR:** #N — https://github.com/breaktapes/breaktapes-dev/pull/N
**Prod PR:**    #N — https://github.com/breaktapes/breaktapes-dev/pull/N
**Commits:**    <sha>
**Tests:**      npm test ✓ | test:react ✓ | tsc ✓
**Staging:**    https://dev.breaktapes.com — HTTP 200 ✓
**Prod:**       https://app.breaktapes.com — HTTP 200 ✓
**Visuals:**    desktop ✓ mobile ✓ [baseline: <first/updated>]
**Cleanup:**    branch deleted ✓ | worktree pruned ✓/skipped (in-use)

---
```

If SHIP_LOG.md doesn't exist yet, create it with a `# Ship Log` header first.

---

## Stop Conditions (the only times to pause and ask)

| Condition | Action |
|-----------|--------|
| Tests still red after 2 auto-fix attempts | STOP — show failures, ask |
| CI fails on staging | STOP — show run URL, ask |
| CI fails on main | STOP — show run URL, ask |
| Visual regression detected | STOP — show screenshots, describe diff, ask |
| Prod curl returns non-200 | STOP — show response, ask |

Everything else: proceed silently.

---

## Final Output

```
🚀 SHIPPED AUTONOMOUSLY
  Branch:    <branch>
  Staging:   https://dev.breaktapes.com  (PR #N)
  Prod:      https://app.breaktapes.com  (PR #N)
  Tests:     all green
  Visuals:   desktop + mobile OK
  Cleanup:   branch deleted, worktree pruned
  Log:       SHIP_LOG.md updated
```
