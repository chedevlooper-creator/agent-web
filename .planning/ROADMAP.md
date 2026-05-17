# Roadmap: Agent Web

**Created:** 2026-05-17
**Mode:** mvp (vertical slices)

## Phase 1: User Registration & Auth Pages
**Goal:** Users can register with username and password
**Mode:** mvp
**Requirements:** AUTH-01, AUTH-02, AUTH-07, DB-01
**Success Criteria:**
1. User can navigate to `/register` and create an account with username + password
2. Password is bcrypt-hashed in the `users` table
3. Duplicate username is rejected with a friendly error
4. New user is persisted to the database

## Phase 2: Login & Session Management
**Goal:** Users can log in, stay logged in across page loads, and log out
**Mode:** mvp
**Requirements:** AUTH-03, AUTH-04, AUTH-05, UI-04, UI-05
**Success Criteria:**
1. User can log in at `/login` with valid credentials
2. Session cookie persists across browser refresh
3. Logout clears the session and redirects to login
4. Unauthenticated users are redirected to `/login`
5. Invalid credentials show an error message

## Phase 3: Auth Middleware & Data Isolation
**Goal:** All API routes are protected; each user sees only their own data
**Mode:** mvp
**Requirements:** AUTH-06, ISOL-01, ISOL-02, ISOL-03, ISOL-04, DB-02, DB-03
**Success Criteria:**
1. Next.js middleware or per-route guard checks session on every API request
2. `userId` foreign key added to sessions, messages, projects, api_keys tables
3. All DB queries filter by `userId` — a user never sees another user's data
4. Migration system updated to handle the schema change
5. Existing data migration adds a default user or marks orphaned records

## Phase 4: UI Polish — User Presence
**Goal:** User can see who they are logged in as and log out from the UI
**Mode:** mvp
**Requirements:** UI-01, UI-02, UI-03
**Success Criteria:**
1. Login page uses the existing dark-first design system (Signal Cockpit theme)
2. Sidebar shows logged-in username with a subtle avatar initial
3. Logout button is visible and accessible from any page
4. After logout, user lands on the login page

## Phase 5: UI/UX & Profile Improvements (v2)
**Goal:** General UI polish, profile page, admin user list
**Mode:** mvp
**Requirements:** (v2) UX-05, UX-06, UX-07
**Success Criteria:**
1. Interface feels more polished and professional
2. User can change their password from a profile page
3. Admin can see a list of registered users
4. Responsive layout works on tablets

## Phase 6: Database Improvements (v2)
**Goal:** Fix N+1 queries, add full-text search, auto-cleanup old files
**Mode:** mvp
**Requirements:** (v2) DB-05, DB-06, DB-07
**Success Criteria:**
1. Session export uses a single batched query instead of N+1
2. Message deletion uses a single WHERE clause instead of loop
3. Session import uses INSERT OR IGNORE instead of individual selects
4. FTS5 virtual table enables message content search
5. Uploaded files older than 7 days are cleaned up

## Phase 7: New Developer Tools (v2)
**Goal:** Add GitHub, database query, and API test tools
**Mode:** mvp
**Requirements:** (v2) TOOL-01, TOOL-02, TOOL-03
**Success Criteria:**
1. Git tool can clone, commit, push, pull from the chat
2. Database query tool can run read-only SQL against the project DB
3. API test tool can send HTTP requests and show responses
4. All new tools follow the existing tool registration pattern

---

## Execution Order

All phases are sequential (each depends on the previous). Phases 1-4 are the MVP for multi-user support.

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Existing data has no userId | High | High | Migration assigns orphaned records to admin user |
| Session cookie security | Medium | High | Use httpOnly, secure, sameSite cookies |
| Migration system fragility | Medium | Medium | Add versioning, test rollback |
| UI changes break existing UX | Low | Medium | Incremental changes, keep current layout |

---

*Roadmap created: 2026-05-17*
*Update when scope changes*
