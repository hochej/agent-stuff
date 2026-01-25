#!/bin/bash

# Install script for agent-stuff
# Creates symlinks from this repo to ~/.pi/agent/skills/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="$SCRIPT_DIR/skills"
SKILLS_DST="$HOME/.pi/agent/skills"

echo "Installing agent-stuff from $SCRIPT_DIR"

# Create destination directory if it doesn't exist
mkdir -p "$SKILLS_DST"

# Link each skill
for skill_dir in "$SKILLS_SRC"/*/; do
    skill_name=$(basename "$skill_dir")
    src="$SKILLS_SRC/$skill_name"
    dst="$SKILLS_DST/$skill_name"
    
    if [ -L "$dst" ]; then
        echo "  Removing existing symlink: $dst"
        rm "$dst"
    elif [ -d "$dst" ]; then
        echo "  Warning: $dst exists and is not a symlink. Skipping."
        echo "           Remove it manually if you want to use the repo version."
        continue
    fi
    
    echo "  Linking: $skill_name"
    ln -s "$src" "$dst"
    
    # Install npm dependencies if package.json exists
    if [ -f "$src/package.json" ]; then
        echo "    Installing npm dependencies for $skill_name..."
        (cd "$src" && npm install --silent)
    fi
done

echo ""
echo "Done! Skills installed to $SKILLS_DST"
