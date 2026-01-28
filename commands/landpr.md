Lands a pull request by rebasing it onto main, running the full gate (lint, build, test), and merging it.

The user specified PR: `$ARGUMENTS`

## Process

1. Repo clean: `git status`
2. Identify PR meta (author + head branch):
   ```
   gh pr view --json number,title,author,headRefName,baseRefName --jq '{number, title, author: .author.login, head: .headRefName, base: .baseRefName}'
   contrib=$(gh pr view --json author --jq .author.login)
   head=$(gh pr view --json headRefName --jq .headRefName)
   ```
3. Fast-forward base:
   ```
   git checkout main
   git pull --ff-only
   ```
4. Create temp base branch from `main`:
   ```
   git checkout -b temp/landpr-<number>
   ```
5. Check out PR branch locally: `gh pr checkout <number>`
6. Rebase PR branch onto temp base: `git rebase temp/landpr-<number>`
   - fix conflicts; keep history tidy
7. Fix + tests + changelog:
   - implement fixes + add/adjust tests
   - update `CHANGELOG.md` and mention `#<number>` + `@$contrib`
8. Full gate (BEFORE commit):
   - `pnpm lint && pnpm build && pnpm test`
9. Commit via `committer` (include `#<number>` + contributor in commit message):
   ```
   committer "fix: <summary> (#<number>) (thanks @$contrib)" CHANGELOG.md <changed files>
   land_sha=$(git rev-parse HEAD)
   ```
10. Push updated PR branch (rebase => usually needs force):
    - `git push --force-with-lease`
11. Merge PR:
    - `gh pr merge <number> --merge`
12. Sync `main` + push:
    ```
    git checkout main
    git pull --ff-only
    git push
    ```
13. Comment on PR with what we did + SHAs + thanks:
    ```
    merge_sha=$(gh pr view <number> --json mergeCommit --jq .mergeCommit.oid)
    gh pr comment <number> --body "Landed via temp rebase onto main.

    - Gate: pnpm lint && pnpm build && pnpm test
    - Land commit: $land_sha
    - Merge commit: $merge_sha

    Thanks @$contrib!"
    ```
14. Verify PR state == `MERGED`
15. Delete temp branch:
    ```
    git branch -D temp/landpr-<number>
    ```
