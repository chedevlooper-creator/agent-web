---
name: web-research
description: Perform deep web research using search and scraping tools. Multi-step research with source verification.
version: 1.0.0
metadata:
  hermes:
    tags: [research, web, search]
    category: productivity
    requires_toolsets: [web]
---

# Web Research Skill

## When to Use
Use when the user asks you to research a topic, find current information, or gather data from the web.

## Procedure
1. Start with a broad `web_search` query to get an overview
2. Identify 3-5 promising sources from the search results
3. Use `web_scrape` on the most relevant URLs to extract detailed content
4. Cross-reference information across sources
5. Synthesize findings into a structured response
6. Always cite URLs for claims

## Research Format
```
## Topic: [Research topic]

### Key Findings
- Finding 1 (source: URL)
- Finding 2 (source: URL)

### Details
[Synthesized content with citations]

### Sources
1. [Title](URL) - [Brief summary]
2. ...
```

## Pitfalls
- Don't rely on a single source
- Check dates of information for currency
- Note when information conflicts between sources
- If web_search fails, try alternative queries

## Verification
Present at least 2-3 independent sources for key claims.
