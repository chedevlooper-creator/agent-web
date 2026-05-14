# Graph Report - C:\Users\isaha\agent-web  (2026-05-14)

## Corpus Check
- Corpus is ~38,680 words - fits in a single context window. You may not need a graph.

## Summary
- 473 nodes · 553 edges · 89 communities (42 shown, 47 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 42 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_MCP ClientManager|MCP Client/Manager]]
- [[_COMMUNITY_Chat & Sessions API|Chat & Sessions API]]
- [[_COMMUNITY_Tools & Subagents|Tools & Subagents]]
- [[_COMMUNITY_API Routes & UI|API Routes & UI]]
- [[_COMMUNITY_Skills Management|Skills Management]]
- [[_COMMUNITY_Memory Management|Memory Management]]
- [[_COMMUNITY_Providers & Approval|Providers & Approval]]
- [[_COMMUNITY_UI Component Library|UI Component Library]]
- [[_COMMUNITY_Core Exports|Core Exports]]
- [[_COMMUNITY_Server & Database|Server & Database]]
- [[_COMMUNITY_Chat Interface|Chat Interface]]
- [[_COMMUNITY_Tool Registry|Tool Registry]]
- [[_COMMUNITY_Cron & Memory UI|Cron & Memory UI]]
- [[_COMMUNITY_Tool Approval UI|Tool Approval UI]]
- [[_COMMUNITY_ID-based CRUD APIs|ID-based CRUD APIs]]
- [[_COMMUNITY_Settings & Providers|Settings & Providers]]
- [[_COMMUNITY_Page Layouts|Page Layouts]]
- [[_COMMUNITY_Agent Dashboard|Agent Dashboard]]
- [[_COMMUNITY_Server Core|Server Core]]
- [[_COMMUNITY_Chat Interface|Chat Interface]]
- [[_COMMUNITY_Cron API|Cron API]]
- [[_COMMUNITY_MCP API|MCP API]]
- [[_COMMUNITY_Skills Files API|Skills Files API]]
- [[_COMMUNITY_Config API|Config API]]
- [[_COMMUNITY_Toolset Manager|Toolset Manager]]
- [[_COMMUNITY_Rate Limiting|Rate Limiting]]
- [[_COMMUNITY_Stream Parsing|Stream Parsing]]
- [[_COMMUNITY_Skills Core|Skills Core]]
- [[_COMMUNITY_AI Gateway Integration|AI Gateway Integration]]
- [[_COMMUNITY_Search API|Search API]]
- [[_COMMUNITY_MCP Manager|MCP Manager]]
- [[_COMMUNITY_Docker Compose|Docker Compose]]
- [[_COMMUNITY_Design System|Design System]]
- [[_COMMUNITY_Code Review Skill|Code Review Skill]]
- [[_COMMUNITY_Web Research Skill|Web Research Skill]]
- [[_COMMUNITY_Brand Assets|Brand Assets]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_MCP Get|MCP Get]]
- [[_COMMUNITY_MCP Delete|MCP Delete]]
- [[_COMMUNITY_Memory Usage|Memory Usage]]
- [[_COMMUNITY_Memory Delete|Memory Delete]]
- [[_COMMUNITY_Streaming Display|Streaming Display]]
- [[_COMMUNITY_Theme Toggle|Theme Toggle]]
- [[_COMMUNITY_Chat Store|Chat Store]]
- [[_COMMUNITY_Badge|Badge]]
- [[_COMMUNITY_Scroll Area|Scroll Area]]
- [[_COMMUNITY_Tooltip|Tooltip]]
- [[_COMMUNITY_API Keys|API Keys]]
- [[_COMMUNITY_API Keys Check|API Keys Check]]
- [[_COMMUNITY_Store|Store]]
- [[_COMMUNITY_Chat Stream|Chat Stream]]
- [[_COMMUNITY_Provider Resolve|Provider Resolve]]
- [[_COMMUNITY_Model Client|Model Client]]
- [[_COMMUNITY_User Approval|User Approval]]
- [[_COMMUNITY_Code Execution|Code Execution]]
- [[_COMMUNITY_Drizzle|Drizzle]]
- [[_COMMUNITY_DB Index|DB Index]]
- [[_COMMUNITY_Docker Dev|Docker Dev]]
- [[_COMMUNITY_Workspace|Workspace]]
- [[_COMMUNITY_Glassmorphism|Glassmorphism]]
- [[_COMMUNITY_Accessibility|Accessibility]]
- [[_COMMUNITY_Plan Skill|Plan Skill]]
- [[_COMMUNITY_File Icon|File Icon]]
- [[_COMMUNITY_Window Icon|Window Icon]]
- [[_COMMUNITY_Community 88|Community 88]]

## God Nodes (most connected - your core abstractions)
1. `MemoryManager` - 19 edges
2. `SkillManager` - 18 edges
3. `ToolRegistry` - 16 edges
4. `Button` - 14 edges
5. `McpManager` - 12 edges
6. `cn()` - 11 edges
7. `ScrollArea()` - 9 edges
8. `ToolRegistry` - 9 edges
9. `McpSseClient` - 8 edges
10. `McpStdioClient` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Globe Icon` --semantically_similar_to--> `Web Research Skill`  [INFERRED] [semantically similar]
  apps/web/public/globe.svg → packages/core/src/skills/bundled/web-research/SKILL.md
- `POST()` --calls--> `badRequest()`  [INFERRED]
  apps/web/app/api/chat/route.ts → packages/core/src/errors.ts
- `GET()` --calls--> `listProviders()`  [INFERRED]
  apps/web/app/api/provider/route.ts → packages/core/src/providers/resolver.ts
- `executeJob()` --calls--> `runChatStream()`  [INFERRED]
  apps/web/lib/cron.ts → packages/core/src/chat/engine.ts
- `initializeServer()` --calls--> `ensureSchema()`  [INFERRED]
  apps/web/lib/server-init.ts → packages/db/src/index.ts

## Hyperedges (group relationships)
- **Agent Tooling UI** — chat_interface_ChatInterface, tool_panel_ToolPanel, tool_approval_modal_ToolApprovalModal, toolset_manager_ToolsetManager, subagent_dashboard_SubagentDashboard [INFERRED 0.80]
- **Base UI Wrappers** — ui_button_Button, ui_avatar_Avatar, ui_badge_Badge, ui_card_Card, ui_dropdown_menu_DropdownMenu, ui_input_Input, ui_scroll_area_ScrollArea, ui_separator_Separator, ui_textarea_Textarea, ui_tooltip_Tooltip [INFERRED 0.80]

## Communities (89 total, 47 thin omitted)

### Community 0 - "MCP Client/Manager"
Cohesion: 0.11
Nodes (3): McpManager, McpSseClient, McpStdioClient

### Community 1 - "Chat & Sessions API"
Cohesion: 0.09
Nodes (14): POST(), runChatStream(), POST(), getApiKeyForProvider(), hasApiKeyForProvider(), errorResponse(), checkApiRateLimit(), checkChatRateLimit() (+6 more)

### Community 2 - "Tools & Subagents"
Cohesion: 0.11
Nodes (5): SubagentManager, safePath(), safePathWithProtection(), isPathInsideBase(), validatePath()

### Community 3 - "API Routes & UI"
Cohesion: 0.09
Nodes (28): Search API, Sessions API, Session Detail API, Skills API, Skills Hub API, Skill Detail API, New Skills API, New Skill Detail API (+20 more)

### Community 4 - "Skills Management"
Cohesion: 0.11
Nodes (5): incrementVersion(), SkillManager, parseSkillMarkdown(), parseYamlSimple(), parseYamlValue()

### Community 5 - "Memory Management"
Cohesion: 0.16
Nodes (3): MemoryManager, getMemoryUsage(), GET()

### Community 6 - "Providers & Approval"
Cohesion: 0.15
Nodes (11): GET(), POST(), createModelClient(), getProviderConfig(), listProviders(), normalizeOpenAiBaseUrl(), resolveProvider(), checkCommandApproval() (+3 more)

### Community 8 - "Core Exports"
Cohesion: 0.11
Nodes (19): checkCommandApproval, browserTools, delegateTools, fileTools, ensureSchema, getMemoryUsage, searchSessions, SubagentManager (+11 more)

### Community 9 - "Server & Database"
Cohesion: 0.17
Nodes (8): checkAndRunCronJobs(), executeJob(), parseCronSchedule(), startCronScheduler(), initializeServer(), ensureSchema(), initFts5(), Toaster

### Community 10 - "Chat Interface"
Cohesion: 0.13
Nodes (16): ChatInterface, handleApproval, handleSend, streamParser, Chat API (/api/chat), Approval API (/api/chat/approve), Sessions API (/api/sessions), Tool Execution UI (+8 more)

### Community 14 - "ID-based CRUD APIs"
Cohesion: 0.36
Nodes (3): DELETE(), GET(), PATCH()

### Community 20 - "Server Core"
Cohesion: 0.33
Nodes (7): checkAndRunCronJobs, executeJob, parseCronSchedule, startCronScheduler, runChatStream, MemoryManager, initializeServer

### Community 34 - "Toolset Manager"
Cohesion: 0.67
Nodes (3): Subagents API (/api/subagents), Subagent Management UI, SubagentDashboard

### Community 35 - "Rate Limiting"
Cohesion: 0.67
Nodes (3): Tools API (/api/tools), TOOLSET_GROUPS, ToolsetManager

### Community 36 - "Stream Parsing"
Cohesion: 0.67
Nodes (3): checkApiRateLimit, checkChatRateLimit, rateLimit

### Community 37 - "Skills Core"
Cohesion: 0.67
Nodes (3): collectStream, parseStreamLine, streamParser

### Community 38 - "AI Gateway Integration"
Cohesion: 0.67
Nodes (3): SkillManager, parseSkillMarkdown, skills_new table

### Community 39 - "Search API"
Cohesion: 1.0
Nodes (3): AI Gateway, 9Router Gateway Skill, 9Router Chat Skill

## Knowledge Gaps
- **89 isolated node(s):** `RootLayout`, `Home Page`, `PATCH /api/cron/[id]`, `DELETE /api/cron/[id]`, `GET /api/mcp/[id]` (+84 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **47 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `runChatStream()` connect `Chat & Sessions API` to `Server & Database`, `Providers & Approval`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `MemoryManager` connect `Memory Management` to `Providers & Approval`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **What connects `RootLayout`, `Home Page`, `PATCH /api/cron/[id]` to the rest of the system?**
  _89 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `MCP Client/Manager` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `Chat & Sessions API` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Tools & Subagents` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._
- **Should `API Routes & UI` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._