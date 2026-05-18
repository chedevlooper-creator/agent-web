# Graph Report - agent-web  (2026-05-17)

## Corpus Check
- 98 files · ~41,540 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 311 nodes · 534 edges · 41 communities (38 shown, 3 thin omitted)
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 116 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `950406c2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 38 edges
2. `getUserIdFromRequest()` - 33 edges
3. `ready()` - 30 edges
4. `cn()` - 20 edges
5. `validateSession()` - 10 edges
6. `POST()` - 8 edges
7. `getObsidianConfig()` - 8 edges
8. `findUserByUsername()` - 7 edges
9. `listMessages()` - 7 edges
10. `listMemories()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `getContextThreshold()`  [INFERRED]
  apps/web/app/api/chat/route.ts → packages/core/src/context.ts
- `GET()` --calls--> `getDb()`  [INFERRED]
  apps/web/app/api/projects/[id]/files/route.ts → packages/db/src/client.ts
- `GET()` --calls--> `ensureMigrated()`  [INFERRED]
  apps/web/app/api/search/route.ts → packages/db/src/migrate.ts
- `GET()` --calls--> `getDb()`  [INFERRED]
  apps/web/app/api/search/route.ts → packages/db/src/client.ts
- `ensureDb()` --calls--> `ensureMigrated()`  [INFERRED]
  apps/web/lib/auth.ts → packages/db/src/migrate.ts

## Communities (41 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (7): FilePreviewBar(), cn(), estimateTokens(), getErrorMessage(), Badge(), Skeleton(), TooltipContent()

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (38): DELETE(), GET(), POST(), addMessage(), clearMessages(), createProject(), createSession(), deleteApiKey() (+30 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (27): DELETE(), GET(), POST(), GET(), POST(), getUserIdFromRequest(), getObsidianConfig(), getSession() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (8): getAllowedBase(), resolveSafePath(), decodeHtml(), extractTitle(), decodeDdgUrl(), decodeHtml(), parseDuckDuckGo(), stripTags()

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (19): createSession(), createUser(), deleteSession(), ensureDb(), findUserByUsername(), generateToken(), hashPassword(), isReservedUsername() (+11 more)

### Community 5 - "Community 5"
Cohesion: 0.13
Nodes (10): genId(), rollbackSessions(), snapshotSessions(), useActiveMessages(), useActiveSession(), useIsEmptySession(), DELETE(), GET() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (3): groupOf(), startOfDay(), getToolIcon()

### Community 7 - "Community 7"
Cohesion: 0.42
Nodes (7): buildSystemPrompt(), getServerApiKey(), POST(), countMessagesTokens(), countTokens(), getContextThreshold(), trimToTokenLimit()

### Community 8 - "Community 8"
Cohesion: 0.46
Nodes (7): isSafePath(), parseCSVLine(), POST(), previewCSV(), previewExcel(), previewJSON(), previewText()

### Community 9 - "Community 9"
Cohesion: 0.39
Nodes (4): executeCodeInDocker(), truncateOutput(), executeCodeLocally(), truncateOutput()

### Community 10 - "Community 10"
Cohesion: 0.43
Nodes (3): executeDocker(), executeLocal(), isBlocked()

### Community 11 - "Community 11"
Cohesion: 0.47
Nodes (4): GET(), listFilesRecursive(), ensureMigrated(), runMigrations()

### Community 13 - "Community 13"
Cohesion: 0.83
Nodes (3): ensureDir(), fileExists(), POST()

### Community 14 - "Community 14"
Cohesion: 0.83
Nodes (3): decrypt(), encrypt(), getEncryptionKey()

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `genId()` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.197) - this node is a cross-community bridge._
- **Why does `cn()` connect `Community 0` to `Community 5`, `Community 6`?**
  _High betweenness centrality (0.168) - this node is a cross-community bridge._
- **Why does `getUserIdFromRequest()` connect `Community 2` to `Community 1`, `Community 4`, `Community 5`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **Are the 37 inferred relationships involving `getDb()` (e.g. with `GET()` and `GET()`) actually correct?**
  _`getDb()` has 37 INFERRED edges - model-reasoned connections that need verification._
- **Are the 22 inferred relationships involving `getUserIdFromRequest()` (e.g. with `GET()` and `POST()`) actually correct?**
  _`getUserIdFromRequest()` has 22 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `validateSession()` (e.g. with `GET()` and `POST()`) actually correct?**
  _`validateSession()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._