# Agent Stuff

A collection of useful agentic coding configurations and skills for easy syncing across machines.

## Contents

- `commands/` - Custom slash commands
  - `handoff.md` - `/handoff` Creates detailed handoff plan for session continuation
  - `pickup.md` - `/pickup` Resumes work from previous handoff session
- `skills/` - Pi agent skills for enhanced capabilities
  - `brave-search/` - Web search via Brave Search API
  - `frontend-design/` - Distinctive frontend interface design
  - `oracle/` - Second-model review using @steipete/oracle CLI
  - `tmux/` - Remote control tmux sessions
  - `web-browser/` - Puppeteer-based web browsing via CDP (requires `npm i` in scripts/)

## Installation

Clone this repo and run the install script:

```bash
git clone <your-repo-url> ~/dev/agent-stuff
cd ~/dev/agent-stuff
./install.sh
```

This will symlink:
- Skills to `~/.pi/agent/skills/`
- Commands to `~/.pi/agent/commands/`

## Updating

After pulling changes:

```bash
git pull
./install.sh  # Re-run to pick up new skills
```

## Adding new skills

1. Add the skill directory under `skills/`
2. Run `./install.sh` to create the symlink
3. Commit and push

## Notes

- Node.js dependencies (`node_modules/`) are not tracked. Run `npm install` in skills that need it (e.g., `brave-search`).
- Some skills may require API keys or additional setup (check individual SKILL.md files).
