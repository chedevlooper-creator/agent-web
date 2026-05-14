---
name: find-skills
description: "This skill should be used when discovering, searching for, or installing agent skills from the open skills ecosystem. This includes finding skills by keyword, installing skills from GitHub URLs, listing available skills in a repository, updating skills, or checking for skill updates. Trigger keywords: skills, find skill, install skill, npx skills, skills.sh, skill search, add skill."
---

# Find Skills

## Overview

Guide users through discovering and installing skills from the open agent skills ecosystem via the Skills CLI (`npx skills`).

## Commands

- `npx skills find [query]` — Search for skills by keyword
- `npx skills add <package>` — Install a skill from GitHub or other sources
- `npx skills add <owner/repo> -l` — List available skills in a repo before installing
- `npx skills check` — Check for skill updates
- `npx skills update` — Update all installed skills

## Installation Patterns

### Install from a GitHub URL

```bash
# List available skills first
npx skills add https://github.com/anthropics/skills -l

# Install all skills from the repo
npx skills add https://github.com/anthropics/skills --all

# Install a specific skill
npx skills add https://github.com/anthropics/skills -s design-skills -g -y

# Shorthand format also works
npx skills add anthropics/skills --all
```

### Common flags

- `-g` — Install globally (user-level)
- `-y` — Skip confirmation prompts
- `-s <name>` — Select a specific skill from a multi-skill repo
- `-l` — List available skills without installing

## Quality Guidelines

Before recommending a skill, verify:

1. **Install count** — Prefer skills with 1K+ installs. Be cautious with anything under 100.
2. **Source reputation** — Official sources (`vercel-labs`, `anthropics`, `microsoft`) are preferred.
3. **GitHub stars** — A skill from a repo with <100 stars should be treated with skepticism.

## Presenting Options

When recommending skills, include:

1. Skill name and what it does
2. Install count and source
3. Install command
4. Link to skills.sh for details

## No Matches Found

If no relevant skills exist:
1. Acknowledge that no existing skill was found
2. Offer to help with the task directly using general capabilities
3. Suggest the user could create their own skill with `npx skills init`

## Browse

Leaderboard and skill directory: https://skills.sh/
