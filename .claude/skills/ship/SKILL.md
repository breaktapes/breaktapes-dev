# Ship Skill — BREAKTAPES

Run the full release pipeline for BREAKTAPES. Executes autonomously; only stops if tests fail, CI fails, or deploy verification fails.

## Pipeline

### 1. Tests — fail fast
```bash
npm test && npm run test:react
```
If red: stop, report which tests failed, do NOT proceed.

### 2. Commit
If there are uncommitted changes, commit with a conventional message:
```bash
git add -p   # stage relevant files (never add .env or secrets)
git commit -m "type(scope): description"
```
If working tree is already clean, skip.

### 3. Push branch + open PR to staging
```bash
git push origin <branch>
gh pr create --base staging --title "..." --body "..."
```
Use the actual diff to write the PR title and body. Include what changed and why.

### 4. Merge to staging + verify deploy
```bash
gh pr merge <PR> --squash --repo breaktapes/breaktapes-dev
```
Then poll until CI is green:
```bash
gh run list --branch staging --limit 3
```
Once green, verify the live URL:
```bash
curl -sI https://dev.breaktapes.com | head -5
```
Must return HTTP 200. If not, stop and report.

### 5. Merge staging → main + verify prod
```bash
gh pr create --base main --head staging --title "Release: ..." --body "..."
gh pr merge <PR> --squash --repo breaktapes/breaktapes-dev
```
Poll CI on main until green, then verify:
```bash
curl -sI https://app.breaktapes.com | head -5
```
Must return HTTP 200. If not, stop and report.

### 6. Clean up branch + worktree
```bash
git push origin --delete <branch>
git branch -d <branch>
```
**CRITICAL:** Before deleting any worktree, `cd` to the main repo root first:
```bash
cd /Users/akrish/DEV/breaktapes-dev
git worktree remove <path> --force 2>/dev/null || true
git worktree prune
```
NEVER delete the worktree the current shell is rooted in without cd-ing out first.

### 7. Report
Output a final summary:
```
✅ SHIPPED
  Branch:   <branch>
  Staging:  https://dev.breaktapes.com  (PR #N)
  Prod:     https://app.breaktapes.com  (PR #N)
  Commits:  <sha>
  Cleaned:  branch deleted, worktree pruned
```

## Rules
- Never skip tests
- Never force-push main
- Never commit .env files or secrets
- Always verify live URLs — green CI is not enough
- Handle staging/main squash divergence with cherry-pick, no asking
- If any step fails: report exact error, stop pipeline, do not proceed
