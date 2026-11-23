#!/bin/bash
# Install an explicitly selected OMP capability without replacing unmanaged content.
set -euo pipefail

usage() {
  echo "Usage: $0 [--agent-dir PATH] SKILL|--workflow|--team-workflow|--agent NAME" >&2
  exit 2
}

agent_dir=""
if [ "${1:-}" = "--agent-dir" ]; then
  [ "$#" -ge 2 ] || usage
  [ -n "$2" ] || usage
  agent_dir=$2
  shift 2
fi
[ "$#" -ge 1 ] || usage
script_dir=$(cd "$(dirname "$0")" && pwd -P)
if [ "$1" = "--workflow" ] || [ "$1" = "--team-workflow" ]; then
  [ "$#" -eq 1 ] || usage
  if [ "$1" = "--team-workflow" ]; then
    source_path="$script_dir/candidates/agent-tools-development-workflow.md"
  else
    source_path="$script_dir/rules/agent-tools-development-workflow.md"
  fi
  target_subdir=rules
  target_name=agent-tools-development-workflow.md
  [ -f "$source_path" ] || { echo "Missing workflow rule: $source_path" >&2; exit 1; }
elif [ "$1" = "--agent" ]; then
  [ "$#" -eq 2 ] || usage
  name=$2
  case "$name" in
    analyst|backend-developer|data-developer|frontend-developer|qa-engineer|software-architect|ui-ux-designer) ;;
    *) echo "Invalid or unsupported agent name: $name" >&2; exit 2 ;;
  esac
  source_path="$script_dir/agents/$name.md"
  if [ ! -f "$source_path" ] || [ -L "$source_path" ]; then
    echo "No regular OMP agent profile found at $source_path" >&2
    exit 1
  fi
  target_subdir=agents
  target_name="$name.md"
else
  [ "$#" -eq 1 ] || usage
  name=$1
  case "$name" in
    ''|*[!a-z0-9-]*|-*) echo "Invalid skill name: $name" >&2; exit 2 ;;
  esac
  source_path="$script_dir/skills/$name"
  if [ ! -f "$source_path/SKILL.md" ] || [ -L "$source_path" ]; then
    echo "No OMP skill found at $source_path/SKILL.md" >&2
    exit 1
  fi
  source_path=$(cd "$source_path" && pwd -P)
  target_subdir=skills
  target_name=$name
fi

if [ -z "$agent_dir" ]; then
  profile=${OMP_PROFILE-${PI_PROFILE-}}
  case "$profile" in
    ''|default) ;;
    *) echo "Named profile detected; specify its agent directory with --agent-dir." >&2; exit 2 ;;
  esac
  if [ -n "${PI_CONFIG_DIR:-}" ] && [ -z "${PI_CODING_AGENT_DIR:-}" ]; then
    echo "PI_CONFIG_DIR is set; specify the agent directory with --agent-dir." >&2
    exit 2
  fi
  agent_dir=${PI_CODING_AGENT_DIR:-$HOME/.omp/agent}
fi

target="$agent_dir/$target_subdir/$target_name"
if [ -L "$target" ]; then
  if [ "$(readlink "$target")" = "$source_path" ]; then
    echo "Already installed: $target -> $source_path"
    exit 0
  fi
  echo "Refusing to replace existing symlink: $target" >&2
  exit 1
fi
if [ -e "$target" ]; then
  echo "Refusing to replace existing path: $target" >&2
  exit 1
fi
mkdir -p "$agent_dir/$target_subdir"
ln -s "$source_path" "$target"
echo "Installed: $target -> $source_path"
