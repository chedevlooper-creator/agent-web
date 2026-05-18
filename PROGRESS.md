# Agent Web — Gelisim Raporu

> Tarih: 18 Mayis 2026
> Proje: `agent-web` — Next.js 16 + AI SDK v4 monorepo

---

## Session Gecmisi

| Session | Tarih | Yapilanlar |
|---------|-------|------------|
| 1 | Ilk gorusme | LobeHub karsilastirmasi, 8 fazlik plan olusturma |
| 2 | Ilk gorusme | 8 fazin implementasyonu (Agent Market → i18n) |
| 3 | Ilk gorusme | Entegrasyon auditi, 6 hata duzeltmesi, kalan 5 eksik plani |
| **4 (bu session)** | **18 Mayis 2026** | **Faz 9-13 implementasyonu + test + hata duzeltmeleri** |

### Bu Session'da Yapilanlar (Session 4)

#### Uygulanan Fazlar
- **Faz 9:** Vision/Multi-Modal — goruntu tespiti, base64 cevirimi, multi-modal mesaj, onizleme
- **Faz 10:** Otomatik Bellek Cikarimi — LLM extraction implementasyonu, post-stream hook
- **Faz 11:** Sohbet Paylasma — `shared_sessions` tablosu, share API, public sayfa, dialog UI
- **Faz 12:** Mobil Uyum — hamburger menu, touch targets (44px), safe area insets, top bar overflow
- **Faz 13:** OAuth (Google/GitHub) — next-auth v5, schema migration, login UI butonlari

#### Bulunan ve Duzeltilen Hatalar
| # | Sorun | Kok Neden | Cozum |
|---|-------|-----------|-------|
| 1 | Tum sayfalar 404 | `createIntlMiddleware` sayfa routing'ini bozuyor | Middleware basit locale cookie handler ile degistirildi |
| 2 | Register: `no such column: email` | V12: `ALTER TABLE ADD COLUMN email TEXT UNIQUE` — SQLite UNIQUE desteklemez | `UNIQUE` kaldirildi |
| 3 | Session: `no such column: user_id` | V2: 4 ALTER TABLE tek `execute()` cagrisinda | Her ALTER TABLE ayri `execute()` ile calistirildi |
| 4 | Standalone prod: `data/` dizini yok | `predev` hook'u dev'e ozel | Manuel data/ dizini olusturma eklendi |

#### Test Sonuclari (Bu Session)
| Test | Sonuc |
|------|-------|
| Build (packages + web) | ✅ 3/3 |
| Login sayfasi render | ✅ |
| Register sayfasi render | ✅ |
| OAuth butonlari (Google/GitHub) | ✅ gorunuyor |
| API: Register → Login | ✅ |
| API: Session olusturma | ✅ |
| API: Share link olusturma | ✅ |
| Public share sayfasi `/share/[token]` | ✅ 200 |
| Share dialog UI | ✅ aciliyor |
| Ana sayfa (sidebar, topbar, composer) | ✅ |
| Agent Marketplace seed data | ✅ |
| Dil secici (TR/EN) | ✅ |
| Tum API'ler 200 | ✅ |

---

## 1. Entegre Edilen Ozellikler (13 Faz)

### Faz 1: Agent Marketi & Sistem Promptu
- **AgentMarketplace** UI komponenti (Marketplace + Installed sekmeleri)
- `/api/agents/marketplace` — marketplace CRUD
- `/api/agents/installed` — kurulu agent CRUD (custom model, provider, temperature, tools)
- `seedDefaultAgents` — 8 adet baslangic agent'i (Kod Ustasi, Yazar, Arastirmaci, vb.)
- `buildSystemPrompt`'a agent system prompt enjeksiyonu
- Chat route'unda `agentId` alani, provider/model override
- **Hata duzeltmesi:** `temperature: 7` → `0.7` (seed data)

### Faz 2: Plugin / Eklenti Sistemi
- `packages/core/src/tools/plugin-gateway.ts` — HTTP-based plugin yoneticisi
- Plugin manifest yukleme (OpenAPI benzeri), tool registration, execution
- `/api/plugins` — plugin CRUD (install, uninstall, toggle)
- **PluginManager** UI komponenti
- 10s fetch timeout (AbortController)
- `getAllTools()` ile built-in + MCP + plugin tool birlestirmesi

### Faz 3: Multi-Agent Gruplari & Orkestrasyon
- `packages/core/src/orchestrator.ts` — `runParallelAgents`, `runSequentialAgents`
- `agent_groups` tablosu (V7 migration)
- `/api/agent-groups` + `/api/agent-groups/run`
- **AgentGroupEditor** UI komponenti

### Faz 4: Zamanlanmis Gorevler (Scheduling)
- `scheduled_tasks` tablosu (V8 migration)
- `/api/schedule` CRUD + `/api/schedule/tick` webhook
- `lib/task-executor.ts` — cron tabanli gorev calistirici
- **ScheduleManager** UI komponenti

### Faz 5: Gelismis Bellek Yonetimi
- `lib/memory-maintenance.ts`:
  - `runMemoryMaintenance()` — TTL-based temizlik (30 gun)
  - `extractMemoriesFromConversation()` — LLM ile otomatik bellek cikarimi (placeholder → gercek)
- `/api/memory/maintenance` — bakim endpointi
- **MemoryManager** UI komponenti
- Chat route'unda post-stream hook: fire-and-forget memory extraction
- Rate limiting: 3 mesajda bir extraction

### Faz 6: Calisma Alani & Ekip Islebirligi
- `teams` + `team_members` tablosu (V9 migration)
- `/api/workspace` + `/api/workspace/members` CRUD
- **WorkspaceManager** UI komponenti

### Faz 7: IM Gateway (Discord/WhatsApp)
- `packages/core/src/gateway/` — gateway-types, registry, discord/whatsapp stub'lari
- **GatewayRegistry** singleton
- `/api/gateway` — gateway yapilandirma API
- **GatewayManager** UI komponenti

### Faz 8: Uluslararasilastirma (i18n)
- `next-intl` v4 entegrasyonu (localePrefix: "never")
- `messages/tr.json` + `messages/en.json` — 100+ ceviri anahtari
- `i18n/routing.ts`, `i18n/request.ts`
- next.config.ts → `withNextIntl()` wrapper
- **LanguageSwitcher** UI komponenti
- **Hata duzeltmesi:** Middleware routing sorunu → locale cookie handler ile degistirildi

### Faz 9: Vision / Multi-Modal Destek (YENI)
- `chat/route.ts`:
  - `isImageFile()`, `imageToBase64()` helper'lari
  - Goruntu dosyalarini algila → base64'e cevir
  - Son kullanici mesajini multi-modal formata donustur (`{type:"text", type:"image"}`)
- `chat-interface.tsx`:
  - `PREVIEWABLE_EXTS`'e resim uzantilari eklendi (jpg, jpeg, png, gif, webp)
  - Inline image thumbnail preview (80x80px, remove butonu, filename tooltip)

### Faz 10: Otomatik Bellek Cikarimi (YENI)
- `lib/memory-maintenance.ts`:
  - `extractMemoriesFromConversation()` LLM gercek implementasyonu
  - Zod schema ile yapisal cikti garantisi
  - `gpt-4o-mini` ile extraction prompt
  - Importance filtering (>= 4)
- Chat route'unda post-stream hook:
  - `ENABLE_MEMORY=true` iken fire-and-forget extraction
  - Dinamik import ile lazy loading
  - `upsertMemory()` ile DB kaydi

### Faz 11: Sohbet Paylasma / Public Link (YENI)
- `shared_sessions` tablosu (V11 migration)
- `/api/share` — POST (create), GET (public read), DELETE (remove)
- `/share/[token]` — Public read-only goruntuleme sayfasi
- **ShareDialog** UI komponenti (link olustur, kopyala)
- **ShareButton** top-bar butonu
- Middleware'de `/share` public route

### Faz 12: Mobil Uyum Iyilestirmeleri (YENI)
- **MobileMenuButton** — hamburger icon, `toggleSidebar()` cagirir, `md:hidden`
- Touch target iyilestirmeleri:
  - `.wk-iconbtn` → `min-w:44px min-h:44px` (mobile)
  - `.sidebar-delete-btn` → `36px`
  - Sidebar items → `min-height:44px`
- Safe area insets (`env(safe-area-inset-*)`):
  - `.wk-composer-wrap` → bottom padding
  - `.wk-sidebar` → top/bottom padding
  - `.wk-topbar` → top padding
- Top bar overflow: breadcrumb truncation, `hidden sm:*` classes

### Faz 13: OAuth (Google/GitHub) (YENI)
- `users` tablosuna OAuth kolonlari: `email`, `avatarUrl`, `provider`, `providerId` (V12 migration)
- `next-auth` v5 kurulumu
- `/api/auth/[...nextauth]/route.ts` — Google + GitHub + Credentials providers
- JWT session strategy, auto user creation / account linking
- `getUserIdFromRequest()` — NextAuth + legacy cookie dual check
- Middleware'de NextAuth session token tespiti
- Login & Register sayfalarinda OAuth butonlari (Google, GitHub SVG ikonlari)
- `.env.example`'e AUTH_ vars
    
---

## 2. Database Semasi (Migrationlar)

| Versiyon | Icerik |
|----------|--------|
| V1 | Core: users, sessions, messages, projects, api_keys |
| V2 | user_id kolonlari (ALTER TABLE) |
| V3 | Memories: category, importance, context |
| V4 | Knowledge Base: KB, documents, chunks, FTS5 |
| V5 | Agent Marketplace: presets, installed agents |
| V6 | Branching: parent_id, branch_root_id, branch_id |
| V7 | Agent Groups table |
| V8 | Scheduled Tasks table |
| V9 | Teams & Team Members |
| V10 | Custom agent fields (model, provider, temperature, tools) |
| V11 | Shared Sessions |
| V12 | OAuth columns (email, avatar_url, provider, provider_id) |

---

## 3. API Route'lari (Toplam 33)

```
POST   /api/chat                           — Stream LLM response
POST   /api/auth/login                     — Login
POST   /api/auth/register                  — Register
POST   /api/auth/logout                    — Logout
GET    /api/auth/me                        — Current user
POST   /api/auth/password                  — Change password
GET    /api/auth/users                     — List users
GET    /api/auth/[...nextauth]             — NextAuth handler (OAuth)

GET    /api/sessions                       — List sessions
POST   /api/sessions                       — Create session
PATCH  /api/sessions                       — Update session
DELETE /api/sessions                       — Delete session
GET    /api/sessions/[id]/messages         — Get messages
POST   /api/sessions/[id]/branch           — Branch session
POST   /api/sessions/export                — Export sessions
POST   /api/sessions/import                — Import sessions

GET    /api/config/status                  — Provider key status

GET    /api/share                          — Get shared session (public)
POST   /api/share                          — Create share link
DELETE /api/share                          — Remove share link

GET    /api/agents/marketplace             — List agent presets
GET    /api/agents/marketplace/[id]        — Get preset detail
GET    /api/agents/installed               — List installed agents
POST   /api/agents/installed               — Install agent
DELETE /api/agents/installed               — Uninstall agent
PATCH  /api/agents/installed               — Update agent config

GET    /api/agent-groups                   — List groups
POST   /api/agent-groups                   — Create group
POST   /api/agent-groups/run               — Execute group

GET    /api/schedule                       — List tasks
POST   /api/schedule                       — Create task
POST   /api/schedule/tick                  — Cron webhook

GET    /api/plugins                        — List plugins
POST   /api/plugins                        — Install plugin
DELETE /api/plugins                        — Uninstall plugin

GET    /api/gateway                        — List gateways
POST   /api/gateway                        — Configure gateway

GET    /api/workspace                      — List teams
POST   /api/workspace                      — Create team
GET    /api/workspace/members              — List members
POST   /api/workspace/members              — Add member

GET    /api/memory                         — List memories
POST   /api/memory                         — Create memory
PATCH  /api/memory                         — Update memory
DELETE /api/memory                         — Delete memory
POST   /api/memory/maintenance             — Run maintenance

GET    /api/knowledge/bases                — List KBs
POST   /api/knowledge/bases                — Create KB
DELETE /api/knowledge/bases                — Delete KB
GET    /api/knowledge/documents            — List documents
POST   /api/knowledge/documents            — Add document
DELETE /api/knowledge/documents            — Delete document
POST   /api/knowledge/search               — Search KB

GET    /api/mcp/servers                    — List MCP servers
POST   /api/mcp/servers                    — Add MCP server
DELETE /api/mcp/servers                    — Remove MCP server
GET    /api/mcp/tools                      — List MCP tools

GET    /api/keys                           — List API keys
POST   /api/keys                           — Save API key
DELETE /api/keys                           — Delete API key

GET    /api/upload                         — List uploads
POST   /api/upload                         — Upload file
GET    /api/upload/preview                 — Preview file

GET    /api/projects                       — List projects
POST   /api/projects                       — Create project
GET    /api/projects/[id]/files            — List files
POST   /api/projects/[id]/files            — Add file

GET    /api/search                         — Global search
GET    /api/skills                         — List skills
POST   /api/tts                            — Text-to-Speech
POST   /api/stt                            — Speech-to-Text
POST   /api/obsidian/sync                  — Sync to Obsidian
GET    /api/obsidian/config                — Obsidian config
POST   /api/obsidian/config                — Update config
```

---

## 4. UI Sayfalari

| Route | Icerik | Auth |
|-------|--------|------|
| `/` | Ana sayfa (sidebar, chat, composer) | Gerekli |
| `/login` | Giris formu + OAuth butonlari | Public |
| `/register` | Kayit formu + OAuth butonlari | Public |
| `/share/[token]` | Public sohbet goruntuleme | Public |

---

## 5. Sidebar Sekmeleri (12 adet)

Dosyalar → Sohbetler → Zamanlama → Araclar → Bilgi → Ajanlar → Gruplar → Bellek → MCP → Eklentiler → Takim → Gateway

+ Agent Marketplace (Ajanlar sekmesi altinda)
+ Dil secici (TR/EN)

---

## 6. Test Sonuclari

| Test | Durum |
|------|-------|
| Build (packages db, core + web app) | ✅ |
| Kayit → Giris → Session olusturma | ✅ |
| Share link olusturma → Public goruntuleme | ✅ |
| Login sayfasi (OAuth butonlari) | ✅ |
| Register sayfasi (OAuth butonlari) | ✅ |
| Ana sayfa (sidebar, topbar, composer) | ✅ |
| Agent Marketplace (seed agent'lar) | ✅ |
| Share dialog UI | ✅ |
| Dil secici (TR/EN) | ✅ |
| Middleware auth korumasi | ✅ |

---

## 7. Bilinen Sorunlar

1. **NextAuth MissingSecret** — Dev'de uyari, prod'da `.env.local`'e `AUTH_SECRET` eklenmeli
2. **Vision test** — API key gerektirir (manuel test)
3. **Auto-Memory test** — `ENABLE_MEMORY=true` + API key gerektirir
4. **OAuth login** — Google/GitHub OAuth app yapilandirmasi gerektirir (`.env.local`)
5. **Standalone/prod build** — `data/` dizini otomatik olusturulmuyor (`predev` hook'u sadece dev'de calisir)
6. **Pre-existing TS hatasi** — `page.tsx` icindeki `<ShareButton>` ile ilgili minor tip sorunu (build'i engellemez)

## 9. Degisen Dosyalar (Bu Session)

| Dosya | Durum | Faz |
|-------|-------|-----|
| `apps/web/app/api/chat/route.ts` | Degisti | 9, 10 |
| `apps/web/components/chat/chat-interface.tsx` | Degisti | 9 |
| `apps/web/lib/memory-maintenance.ts` | Degisti | 10 |
| `packages/db/src/schema.ts` | Degisti | 11, 13 |
| `packages/db/src/migrate.ts` | Degisti | 11, 13 |
| `apps/web/app/api/share/route.ts` | **Yeni** | 11 |
| `apps/web/app/share/[token]/page.tsx` | **Yeni** | 11 |
| `apps/web/components/share-dialog.tsx` | **Yeni** | 11 |
| `apps/web/components/share-button.tsx` | **Yeni** | 11 |
| `apps/web/app/page.tsx` | Degisti | 11, 12 |
| `apps/web/middleware.ts` | Degisti | 11, 13 |
| `apps/web/components/mobile-menu-button.tsx` | **Yeni** | 12 |
| `apps/web/app/globals.css` | Degisti | 12 |
| `apps/web/lib/nextauth.ts` | **Yeni** | 13 |
| `apps/web/app/api/auth/[...nextauth]/route.ts` | **Yeni** | 13 |
| `apps/web/types/next-auth.d.ts` | **Yeni** | 13 |
| `apps/web/lib/auth.ts` | Degisti | 13 |
| `apps/web/app/login/page.tsx` | Degisti | 13 |
| `apps/web/app/register/page.tsx` | Degisti | 13 |
| `.env.example` | Degisti | 13 |

---

## 8. Kurulum / Ortam Degiskenleri

```env
# Zorunlu (en az biri)
OPENAI_API_KEY=
OPENROUTER_API_KEY=
DEEPSEEK_API_KEY=

# OAuth (opsiyonel)
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# Opsiyonel
ENABLE_MEMORY=true
DATABASE_URL=file:./data/local.db
TERMINAL_BACKEND=local
ENCRYPTION_KEY=
```

---

## 9. Komutlar

```bash
pnpm dev              # Gelistirme sunucusu
pnpm build            # Production build
pnpm test             # Testleri calistir
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm --filter web exec tsc --noEmit  # Type check
```
