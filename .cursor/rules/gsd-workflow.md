# GSD Workflow — Agent Web

This project uses the GSD (Get Shit Done) workflow for structured development.

## Project State

- **Core value:** Ekip üyeleri AI araçlarını kullanarak birlikte yazılım geliştirebilmeli
- **Current phase:** Phase 1 — User Registration & Auth Pages
- **Source of truth:** `.planning/`

## Quick Commands

| Command | Description |
|---------|-------------|
| `/gsd-progress` | Check current project status |
| `/gsd-discuss-phase 1` | Start gathering context for Phase 1 |
| `/gsd-plan-phase 1` | Plan Phase 1 |
| `/gsd-execute-phase 1` | Execute Phase 1 plans |
| `/gsd-verify-work` | Validate delivered features |

## Important Files

| File | Purpose |
|------|---------|
| `.planning/PROJECT.md` | Project context and requirements |
| `.planning/ROADMAP.md` | Phase breakdown and success criteria |
| `.planning/REQUIREMENTS.md` | Detailed requirements with REQ-IDs |
| `.planning/STATE.md` | Current project state |
| `.planning/config.json` | Workflow preferences |
| `.planning/codebase/` | Codebase analysis documents |

## Rules

1. Always check `.planning/STATE.md` first for current phase
2. Always read relevant `.planning/` files before starting any phase
3. Commit planning docs with descriptive messages
4. Follow the phase structure: discuss → plan → execute → verify
