#!/bin/bash

# Install script for agent-stuff
# Creates symlinks from this repo to ~/.pi/agent/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing agent-stuff from $SCRIPT_DIR"

# --- Install Skills ---
SKILLS_SRC="$SCRIPT_DIR/skills"
SKILLS_DST="$HOME/.pi/agent/skills"

if [ -d "$SKILLS_SRC" ]; then
    mkdir -p "$SKILLS_DST"
    echo ""
    echo "Installing skills..."
    
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
fi

# --- Install Commands ---
COMMANDS_SRC="$SCRIPT_DIR/commands"
COMMANDS_DST="$HOME/.pi/agent/commands"

if [ -d "$COMMANDS_SRC" ]; then
    mkdir -p "$COMMANDS_DST"
    echo ""
    echo "Installing commands..."
    
    for cmd_file in "$COMMANDS_SRC"/*.md; do
        [ -f "$cmd_file" ] || continue
        cmd_name=$(basename "$cmd_file")
        src="$cmd_file"
        dst="$COMMANDS_DST/$cmd_name"
        
        if [ -L "$dst" ]; then
            rm "$dst"
        elif [ -f "$dst" ]; then
            echo "  Warning: $dst exists and is not a symlink. Skipping."
            continue
        fi
        
        echo "  Linking: $cmd_name"
        ln -s "$src" "$dst"
    done
fi

# --- Install Bin Scripts ---
BIN_SRC="$SCRIPT_DIR/bin"
BIN_DST="$HOME/.local/bin"

if [ -d "$BIN_SRC" ]; then
    mkdir -p "$BIN_DST"
    echo ""
    echo "Installing bin scripts..."
    
    for bin_file in "$BIN_SRC"/*; do
        [ -f "$bin_file" ] || continue
        bin_name=$(basename "$bin_file")
        src="$bin_file"
        dst="$BIN_DST/$bin_name"
        
        if [ -L "$dst" ]; then
            rm "$dst"
        elif [ -f "$dst" ]; then
            echo "  Warning: $dst exists and is not a symlink. Skipping."
            continue
        fi
        
        echo "  Linking: $bin_name"
        ln -s "$src" "$dst"
    done
    
    # Check if ~/.local/bin is in PATH
    if [[ ":$PATH:" != *":$BIN_DST:"* ]]; then
        echo ""
        echo "  Note: $BIN_DST is not in your PATH."
        echo "  Add this to your shell profile:"
        echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
    fi
fi

# --- Install Extensions ---
EXTENSIONS_SRC="$SCRIPT_DIR/pi-extensions"
EXTENSIONS_DST="$HOME/.pi/agent/extensions"

if [ -d "$EXTENSIONS_SRC" ]; then
    mkdir -p "$EXTENSIONS_DST"
    echo ""
    echo "Installing extensions..."
    
    for ext_file in "$EXTENSIONS_SRC"/*.ts; do
        [ -f "$ext_file" ] || continue
        ext_name=$(basename "$ext_file")
        src="$ext_file"
        dst="$EXTENSIONS_DST/$ext_name"
        
        if [ -L "$dst" ]; then
            rm "$dst"
        elif [ -f "$dst" ]; then
            echo "  Warning: $dst exists and is not a symlink. Skipping."
            continue
        fi
        
        echo "  Linking: $ext_name"
        ln -s "$src" "$dst"
    done
fi

echo ""
echo "Done!"
echo "  Skills:     $SKILLS_DST"
echo "  Commands:   $COMMANDS_DST"
echo "  Bin:        $BIN_DST"
echo "  Extensions: $EXTENSIONS_DST"
