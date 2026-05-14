---
name: code-review
description: Systematic code review checklist and procedures. Use when reviewing code, pull requests, or code quality.
version: 1.0.0
metadata:
  hermes:
    tags: [code, review, quality]
    category: devops
    requires_toolsets: [file]
---

# Code Review Skill

## When to Use
Use when asked to review code, audit a file, check for bugs, or evaluate code quality.

## Review Checklist

### Correctness
- [ ] Does the code do what it's supposed to do?
- [ ] Are edge cases handled?
- [ ] Are error cases handled properly?
- [ ] Are there any race conditions or async issues?

### Security
- [ ] Any SQL injection, XSS, or other injection risks?
- [ ] Are secrets/credentials properly protected?
- [ ] Is user input validated/sanitized?
- [ ] Are file paths safe (no path traversal)?

### Performance
- [ ] Any N+1 query patterns?
- [ ] Unnecessary computations or re-renders?
- [ ] Memory leaks or large object retention?
- [ ] Appropriate caching usage?

### Maintainability
- [ ] Is the code readable and self-documenting?
- [ ] Are function/method names descriptive?
- [ ] Is there unnecessary duplication?
- [ ] Are there appropriate tests?

### Architecture
- [ ] Does this fit the existing patterns in the codebase?
- [ ] Are dependencies appropriate?
- [ ] Is there proper separation of concerns?

## Procedure
1. Read the file(s) to review
2. Go through the checklist systematically
3. Provide specific, actionable feedback with file:line references
4. Prioritize findings by severity: Critical, High, Medium, Low
5. Suggest concrete fixes

## Output Format
```
file:line: [severity] Issue description. Suggested fix.
```

## Pitfalls
- Don't nitpick formatting unless it changes meaning
- Focus on bugs, security, and architecture over style
- Consider the context and constraints of the codebase
