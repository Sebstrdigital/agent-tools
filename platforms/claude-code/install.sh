#!/bin/bash
#
# Agentic Tools Installer
# Installs agents, skills, and docs into ~/.claude/
#
# Safe install logic:
#   - If target file exists with source_id: seb-claude-tools → overwrite (update)
#   - If target file exists WITHOUT that source_id → install with "sebstrdigital-" prefix
#   - If target file doesn't exist → install as-is
#   - Shows version changes on updates
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_ID="seb-claude-tools"
CLAUDE_DIR="$HOME/.claude"
PREFIX="sebstrdigital-"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

installed=0
updated=0
prefixed=0
skipped=0
removed=0

RETIRED_AGENT_FILES=(
    "test-agent.md"
    "nordic-ux-critic.md"
    "seb-the-boss.md"
)

get_version() {
    local file="$1"
    grep -m1 -E '^(# )?version:' "$file" 2>/dev/null | sed -E 's/^(# )?version: *//' || echo "unknown"
}

check_and_install() {
    local src="$1"
    local target_dir="$2"
    local filename
    filename="$(basename "$src")"

    mkdir -p "$target_dir"

    local target="$target_dir/$filename"
    local src_version
    src_version="$(get_version "$src")"

    local prefixed_name="${PREFIX}${filename}"
    local prefixed_target="$target_dir/$prefixed_name"

    if [ -f "$target" ] && grep -q "source_id: $SOURCE_ID" "$target" 2>/dev/null; then
        # Original filename exists with our source_id — update in place
        local target_version
        target_version="$(get_version "$target")"

        if [ "$src_version" = "$target_version" ]; then
            echo -e "  ${GRAY}current${NC}  $filename ${GRAY}(v$target_version)${NC}"
            skipped=$((skipped + 1))
        else
            cp "$src" "$target"
            echo -e "  ${BLUE}updated${NC}  $filename ${GRAY}v$target_version → v$src_version${NC}"
            updated=$((updated + 1))
        fi
    elif [ -f "$prefixed_target" ] && grep -q "source_id: $SOURCE_ID" "$prefixed_target" 2>/dev/null; then
        # Prefixed version exists with our source_id — update the prefixed file
        local target_version
        target_version="$(get_version "$prefixed_target")"

        if [ "$src_version" = "$target_version" ]; then
            echo -e "  ${GRAY}current${NC}  $prefixed_name ${GRAY}(v$target_version)${NC}"
            skipped=$((skipped + 1))
        else
            cp "$src" "$prefixed_target"
            echo -e "  ${BLUE}updated${NC}  $prefixed_name ${GRAY}v$target_version → v$src_version${NC}"
            updated=$((updated + 1))
        fi
    elif [ -f "$target" ]; then
        # Original exists but belongs to someone else — install with prefix
        cp "$src" "$prefixed_target"
        echo -e "  ${YELLOW}prefixed${NC} $filename → $prefixed_name ${GRAY}(existing file preserved)${NC}"
        prefixed=$((prefixed + 1))
    else
        # No conflict — install directly
        cp "$src" "$target"
        echo -e "  ${GREEN}added${NC}    $filename ${GRAY}(v$src_version)${NC}"
        installed=$((installed + 1))
    fi
}

remove_retired_agent() {
    local filename="$1"
    local target="$CLAUDE_DIR/agents/$filename"
    local prefixed_target="$CLAUDE_DIR/agents/${PREFIX}${filename}"

    if [ -f "$target" ] && grep -q "source_id: $SOURCE_ID" "$target" 2>/dev/null; then
        rm "$target"
        echo -e "  ${BLUE}removed${NC}  $filename ${GRAY}(retired)${NC}"
        removed=$((removed + 1))
    fi

    if [ -f "$prefixed_target" ] && grep -q "source_id: $SOURCE_ID" "$prefixed_target" 2>/dev/null; then
        rm "$prefixed_target"
        echo -e "  ${BLUE}removed${NC}  ${PREFIX}${filename} ${GRAY}(retired)${NC}"
        removed=$((removed + 1))
    fi
}

remove_retired_command() {
    local filename="$1"
    local target="$CLAUDE_DIR/commands/$filename"
    local prefixed_target="$CLAUDE_DIR/commands/${PREFIX}${filename}"

    if [ -f "$target" ] && grep -q "source_id: $SOURCE_ID" "$target" 2>/dev/null; then
        rm "$target"
        echo -e "  ${BLUE}removed${NC}  $filename ${GRAY}(migrated to skills)${NC}"
        removed=$((removed + 1))
    fi

    if [ -f "$prefixed_target" ] && grep -q "source_id: $SOURCE_ID" "$prefixed_target" 2>/dev/null; then
        rm "$prefixed_target"
        echo -e "  ${BLUE}removed${NC}  ${PREFIX}${filename} ${GRAY}(migrated to skills)${NC}"
        removed=$((removed + 1))
    fi
}

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     Agentic Tools Installer          ║"
echo "║     by Seb @ Sebstrdigital           ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Install agents
echo "Agents → $CLAUDE_DIR/agents/"
for f in "$SCRIPT_DIR"/agents/*.md; do
    [ -f "$f" ] && check_and_install "$f" "$CLAUDE_DIR/agents"
done
for retired_agent in "${RETIRED_AGENT_FILES[@]}"; do
    remove_retired_agent "$retired_agent"
done
echo ""

# Install docs (all subdirectories)
for subdir in "$SCRIPT_DIR"/docs/*/; do
    [ -d "$subdir" ] || continue
    dirname="$(basename "$subdir")"
    echo "Docs → $CLAUDE_DIR/docs/$dirname/"
    for f in "$subdir"*.md; do
        [ -f "$f" ] && check_and_install "$f" "$CLAUDE_DIR/docs/$dirname"
    done
    echo ""
done

# Install top-level docs
for f in "$SCRIPT_DIR"/docs/*.md; do
    if [ -f "$f" ]; then
        echo "Docs → $CLAUDE_DIR/docs/"
        check_and_install "$f" "$CLAUDE_DIR/docs"
        echo ""
    fi
done

# Install lib scripts (shell helpers agents call, e.g. codex-review.sh)
for f in "$SCRIPT_DIR"/lib/*.sh; do
    if [ -f "$f" ]; then
        echo "Lib → $CLAUDE_DIR/lib/"
        check_and_install "$f" "$CLAUDE_DIR/lib"
        chmod +x "$CLAUDE_DIR/lib/$(basename "$f")" "$CLAUDE_DIR/lib/${PREFIX}$(basename "$f")" 2>/dev/null
        echo ""
    fi
done

# Install skills.
# Source layout: skills/<category>/<skill-name>/
# Install layout: ~/.claude/skills/<skill-name>/
# Only adds/updates repo-managed skill dirs — never touches unmanaged skills.
while IFS= read -r -d '' skillfile; do
    skilldir="$(dirname "$skillfile")"
    skillname="$(basename "$skilldir")"
    [ "$skillname" = "_deprecated" ] && continue

    echo "Skills → $CLAUDE_DIR/skills/$skillname/"
    remove_retired_command "$skillname.md"
    for f in "$skilldir"/*.md; do
        [ -f "$f" ] && check_and_install "$f" "$CLAUDE_DIR/skills/$skillname"
    done
    echo ""
done < <(find "$SCRIPT_DIR"/skills -mindepth 3 -maxdepth 3 -name SKILL.md -type f -print0 | sort -z)

# Summary
echo "────────────────────────────────────────"
echo -e "  ${GREEN}Added:${NC}    $installed"
echo -e "  ${BLUE}Updated:${NC}  $updated"
echo -e "  ${GRAY}Current:${NC}  $skipped"
echo -e "  ${YELLOW}Prefixed:${NC} $prefixed"
echo -e "  ${BLUE}Removed:${NC}  $removed"
echo ""
echo "Done. Restart Claude Code to pick up changes."
echo ""
