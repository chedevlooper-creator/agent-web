---
name: plan
description: Create a structured implementation plan for a given request. Inspects context if needed, writes markdown plan, saves result.
version: 1.0.0
metadata:
  hermes:
    tags: [planning, workflow]
    category: productivity
---

# Planning Skill

## When to Use
Use this skill when the user asks you to plan, design, or outline an implementation approach for any task.

## Procedure
1. Understand the user's request thoroughly
2. If needed, inspect the project structure using `list_files` and `read_file`
3. Create a structured markdown plan with:
   - **Summary**: Brief overview of what will be built
   - **Architecture**: Key design decisions and trade-offs
   - **Steps**: Ordered list of implementation steps
   - **Files**: List of files to be created or modified
   - **Risks**: Potential issues or blockers
4. Save the plan under `.hermes/plans/` directory

## Plan Format
```markdown
# Plan: [Title]

## Summary
[Brief description]

## Architecture
[Key decisions]

## Steps
1. [Step 1]
2. [Step 2]
...

## Files Changed
- [file path]: [action]

## Risks
- [Potential issue]
```

## Pitfalls
- Don't over-engineer simple tasks
- Always consider the existing codebase before proposing new architecture
- Keep plans actionable with clear file paths

## Verification
Ask the user if they approve the plan before proceeding with implementation.
