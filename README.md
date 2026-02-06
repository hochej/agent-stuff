# Agent Stuff

A collection of useful agentic coding configurations and skills for easy syncing
across machines.

> This repository is heavily inspired by (and essentially a fork of)
> [mitsuhiko/agent-stuff](https://github.com/mitsuhiko/agent-stuff) by Armin
> Ronacher. Many skills, extensions, and the overall structure originate from
> his work. Check it out!

## Contents

### `commands/` - Custom slash commands (prompt templates)

- `handoff.md` - `/handoff` Creates detailed handoff plan for session
  continuation
- `landpr.md` - `/landpr` Lands a PR by rebasing onto main, running the gate,
  and merging
- `pickup.md` - `/pickup` Resumes work from previous handoff session

### `pi-extensions/` - Pi extensions for enhanced functionality

- `answer.ts` - Q&A extraction hook with interactive TUI for answering questions
  from assistant responses
- `plan-mode/` - Read-only exploration mode (`/plan` or Ctrl+Alt+P) restricting
  tools to safe read-only commands
- `review.ts` - `/review` command for code review (uncommitted, branch, commit,
  custom). Ctrl+R shortcut
- `ssh.ts` - SSH remote execution — delegates tool operations to a remote
  machine via SSH
- `session-breakdown.ts` - `/session-breakdown` interactive TUI showing session
  usage and cost over 7/30/90 days with GitHub-style contribution graph
- `todos.ts` - `/todos` command for file-based todo management

### `skills/` - Pi agent skills for enhanced capabilities

- `beautiful-mermaid/` - Render Mermaid diagrams as themed SVGs or ASCII/Unicode
  text
- `brave-search/` - Web search and content extraction via Brave Search API
- `doc-coauthoring/` - Structured workflow for co-authoring documentation,
  proposals, and specs
- `frontend-design/` - Distinctive, production-grade frontend interface design
- `github/` - GitHub CLI (`gh`) for issues, PRs, CI runs, and API queries
- `kapitan/` - Operate Kapitan configuration management projects
- `kueue/` - Manage Kueue, the Kubernetes-native job queuing system
- `oracle/` - Second-model review using @steipete/oracle CLI
- `runme/` - Create and execute runnable Markdown notebooks
- `tmux/` - Remote control tmux sessions
- `web-browser/` - Web browsing via Chrome DevTools Protocol (CDP)

### `bin/` - Standalone scripts (installed to `~/.local/bin`)

- `committer` - Commits specific files with a given message

## Installation

Clone this repo and run the install script:

```bash
git clone <your-repo-url> ~/dev/agent-stuff
cd ~/dev/agent-stuff
./install.sh
```

This will symlink:

- Skills to `~/.pi/agent/skills/`
- Prompt templates (`commands/*.md`) to `~/.pi/agent/prompts/`
- Extensions (`pi-extensions/*.ts`) to `~/.pi/agent/extensions/`
- Bin scripts to `~/.local/bin/`

## Updating

After pulling changes:

```bash
git pull
./install.sh  # Re-run to pick up new items
```

## Adding new items

1. Add the file/directory under the appropriate folder (`skills/`, `commands/`,
   `pi-extensions/`, `bin/`)
2. Run `./install.sh` to create the symlinks
3. Commit and push

## Notes

- Node.js dependencies (`node_modules/`) are not tracked. Run `npm install` in
  skills that need it (e.g., `brave-search`).
- Some skills may require API keys or additional setup (check individual
  SKILL.md files).
- Extension directories (e.g., `plan-mode/`) need to be symlinked manually —
  `install.sh` currently only handles `*.ts` extension files.
- Ensure `~/.local/bin` is in your `PATH` for bin scripts to work.
