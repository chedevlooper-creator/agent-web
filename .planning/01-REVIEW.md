# Code Review — Phase 1

**Files:** `apps/web/components/settings-panel.tsx`, `apps/web/lib/store.ts`
**Depth:** standard
**Status:** issues_found

## Summary

Reviewed 2 files: Zustand chat store (819 lines), React settings panel (400 lines). Found **1 critical** bug (error swallowing causes false success feedback), **4 warnings** (logic gaps, fragile patterns, rollback confusion), **4 info** (dead code, redundancy). Overall code quality moderate — store has solid rollback/optimistic-update patterns and good TypeScript hygiene, but key management flow has dangerous disconnect between store and UI error handling.

## Findings

---

### CR-01: Error swallowing in `saveKey` causes false success feedback — `store.ts:711`, `settings-panel.tsx:108`

**Issue:** Store's `saveKey()` catches all errors internally, does not rethrow. UI's `handleSaveKey` wraps call in try/catch expecting throw on failure, but never happens. Result: user **always** sees "Anahtar kaydedildi." even when API call fails.

**Risk:** Users believe API key saved when not. Next chat request fails with auth error, user cannot know key never persisted.

**Fix:** Either (a) rethrow in `saveKey` so UI can handle errors, or (b) remove UI-level try/catch and handle errors entirely in store. Rethrowing cleaner — preserves separation of concerns.

**Code:**

```typescript
// store.ts — current
saveKey: async (provider, key) => {
  try {
    await apiFetch("/api/keys", {
      method: "POST",
      body: JSON.stringify({ provider, key }),
    });
  } catch (e) {
    console.error("Failed to save API key:", e);
  }
},
```

```typescript
// Fixed
saveKey: async (provider, key) => {
  try {
    await apiFetch("/api/keys", {
      method: "POST",
      body: JSON.stringify({ provider, key }),
    });
  } catch (e) {
    console.error("Failed to save API key:", e);
    throw e; // rethrow so UI layer can react
  },
},
```

---

### CR-01b: Error swallowing in `deleteKey` causes silent failures — `store.ts:722`, `settings-panel.tsx:123`

**Issue:** Same pattern as CR-01. `deleteKey` swallows all errors. UI's `handleDeleteKey` expects throws and sets `setKeyInput("")` / `setSaveMsg(null)` even on failure — no indication deletion failed.

**Risk:** Users attempt to delete key but it silently remains on server. Subsequent key re-entry may not apply because old key still exists.

**Fix:** Rethrow in `deleteKey`:

```typescript
deleteKey: async (provider) => {
  try {
    await apiFetch("/api/keys", {
      method: "DELETE",
      body: JSON.stringify({ provider }),
    });
  } catch (e) {
    console.error("Failed to delete API key:", e);
    throw e;
  }
},
```

---

### WR-01: `setCompareMode` silently ignores enable when < 2 models selected — `store.ts:682`, `settings-panel.tsx:235`

**Issue:** `setCompareMode(true)` evaluates to `true && s.selectedModels.length > 1`. If user has 0 or 1 models selected and clicks compare toggle, `setCompareMode(true)` computes to `false` — toggle appears to do nothing. No feedback given.

**Risk:** Confusing UX — user clicks toggle expecting compare mode on, nothing happens. No indication they need to select more models first.

**Fix:** Either (a) auto-select additional models when enabling compare mode, (b) show tooltip/toast explaining requirement, or (c) let compare mode turn on even with < 2 models and handle edge case downstream. Option (c) simplest:

```typescript
// settings-panel.tsx — current
onClick={() => {
  const next = !compareMode;
  setCompareMode(next);
  if (!next) setSelectedModels([]);
}}
```

For option (c), remove guard in `setCompareMode`:

```typescript
// store.ts — fixed
setCompareMode: (v) =>
  set({ compareMode: v }),
```

Let UI handle edge case where compare mode on but < 2 models selected.

---

### WR-02: `importFromJson` throws unhandled rejection on malformed JSON — `store.ts:733-734`

**Issue:** `JSON.parse(json)` called without try/catch in async function. If caller passes invalid JSON, store throws unhandled promise rejection. Store's catch block at line 738 is for API call, not JSON parse.

**Risk:** Crashes reactive store update chain. Import feature becomes DoS vector against UI if malformed import data provided.

**Fix:** Wrap parse in try/catch:

```typescript
importFromJson: async (json) => {
  let payload;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON format in import data.");
  }
  const result = (await apiFetch("/api/sessions/import", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as { sessions: number; messages: number };
  await get().hydrate();
  return result;
},
```

---

### WR-03: `patchLocalMessage` mutates undeclared store properties — `store.ts:612-617`

**Issue:** `patchLocalMessage` accesses `_pendingPatches` and `_patchRaf` as properties on store state, but not declared in `ChatStore` interface. Relies on cast to `ChatStore & { _pendingPatches?: Map<string, string>; _patchRaf?: number }` to bypass TypeScript. Mutates Zustand state outside normal `set()` API.

**Risk:** (a) Zustand internal state shape not guaranteed to support arbitrary extra properties — future versions could strip or freeze. (b) React strict mode double-invokes effects, `_patchRaf` guard could leak dangling `requestAnimationFrame` handle.

**Fix:** Move pending-patches buffer outside store — module-level `Map` with dedicated RAF loop:

```typescript
// Module-level outside store
const pendingMessagePatches = new Map<string, string>();
let patchRafId: number | null = null;

function flushMessagePatches() {
  const patches = new Map(pendingMessagePatches);
  pendingMessagePatches.clear();
  patchRafId = null;
  if (patches.size === 0) return;
  useChatStore.setState((s) => ({
    sessions: s.sessions.map((ses) => {
      if (ses.id !== s.activeSessionId) return ses;
      return {
        ...ses,
        messages: ses.messages.map((m) =>
          patches.has(m.id) ? { ...m, content: patches.get(m.id)! } : m
        ),
      };
    }),
  }));
}

export const patchLocalMessage = (id: string, content: string) => {
  pendingMessagePatches.set(id, content);
  if (!patchRafId) {
    patchRafId = requestAnimationFrame(flushMessagePatches);
  }
};
```

---

### WR-04: `handleProviderChange` silently discards compare mode state — `settings-panel.tsx:133-138`

**Issue:** When changing providers, `setSelectedModels([])` called unconditionally. If `compareMode` was true, A/B model selections lost. Function itself fine (changing provider should reset config), but no confirmation or feedback that compare mode selections discarded.

**Risk:** User selected 2 models for comparison, switches providers out of curiosity, loses all model selections without warning. Minor-severity data-loss UX bug.

**Fix:** Either disable compare mode first (giving UI feedback), or show confirmation when changing provider during active compare mode.

```typescript
// settings-panel.tsx — improved
const handleProviderChange = (v: string) => {
  const p = PROVIDERS.find((x) => x.value === v);
  if (!p) return;
  setConfig({ provider: v, model: p.models[0] });
  if (compareMode) {
    setCompareMode(false);
    setSelectedModels([]);
  } else {
    setSelectedModels([]);
  }
};
```

---

### IN-01: Dead code — `keyInput`, `handleSaveKey`, `handleDeleteKey`, `hasKeyForProvider` — `settings-panel.tsx:52,108,123,54`

**Issue:** Component declares `keyInput` state (line 52) — never used. `handleSaveKey` callback (line 108) — never wired to any element. `handleDeleteKey` callback (line 123) — never wired. `hasKeyForProvider` variable (line 54) — never used in JSX.

"Server API Keys" section (lines 328-371) only shows status indicators. No input field or save/delete button. Key management feature half-implemented in UI.

**Risk:** Confusing to maintainers. Dead code adds cognitive load. Future developer adding key input field might assume existing callbacks work correctly — but they don't (see CR-01).

**Fix:** Either (a) implement missing key input field, or (b) remove all dead state/handlers, leave only read-only status display.

---

### IN-02: Dead state — `selectedSkills` and `apiKey` — `store.ts:66,72,181,184`

**Issue:** `ChatStore` defines `selectedSkills: string[]` (line 66) and `apiKey: string` (line 72), both with defaults, but `selectedSkills` has no action to modify it (skills system uses `enabledSkills` instead). `apiKey` documented as "Not persisted", has no consumer in either reviewed file.

**Risk:** Store bloat. Every unused field loaded on every selector subscription check.

**Fix:** Remove `selectedSkills` if `enabledSkills` canonical. Remove or deprecate `apiKey` if transient API key input not planned.

---

### IN-03: `setConfig` redundant spread — `store.ts:649`

**Issue:** `setConfig: (c) => set((s) => ({ ...s, ...c }))` — Zustand `set()` already shallow-merges partial state. `...s` spread unnecessary.

```typescript
// Current
setConfig: (c) => set((s) => ({ ...s, ...c })),

// Simplified
setConfig: (c) => set(c),
```

**Risk:** None functionally. Minor code smell — every unnecessary spread creates new object with extra iterations for no benefit.

---

### IN-04: `deleteProject` / `deleteSession` redundant `finally` after catch with `return` — `store.ts:267-269, 369-371`

**Issue:** Both methods follow:

```typescript
try { ... }
catch (e) {
  // rollback
  set({ syncing: false });
  return;      // ← return in catch
} finally {
  set({ syncing: false });  // ← same set, always runs
}
// ... continuation ...
```

`finally` always runs after `catch`, so on error `syncing: false` set happens twice. On success, `finally` runs once.

**Risk:** Zero — JavaScript guarantees `finally` runs before `return` takes effect. Harmless redundancy but signals confusion about try/catch/finally.

**Fix:** Remove `set({ syncing: false })` and `return` from `catch`. Let `finally` handle sync flag for both paths:

```typescript
try {
  await apiFetch(...);
} catch (e) {
  console.error("...", e);
  if (deletedProject) { /* rollback */ }
  return; // return only — no set({ syncing: false })
} finally {
  set({ syncing: false });
}
```

---

## Summary of Findings

| ID | Severity | File | Description |
|---|---|---|---|
| CR-01 | CRITICAL | `store.ts:711`, `settings-panel.tsx:108` | `saveKey` swallows errors, UI shows false success |
| CR-01b | CRITICAL | `store.ts:722`, `settings-panel.tsx:123` | `deleteKey` swallows errors, UI silently fails |
| WR-01 | WARNING | `store.ts:682`, `settings-panel.tsx:235` | Compare toggle silently ignored when < 2 models selected |
| WR-02 | WARNING | `store.ts:733-734` | `importFromJson` crashes on malformed JSON |
| WR-03 | WARNING | `store.ts:612-617` | `patchLocalMessage` mutates undeclared store properties |
| WR-04 | WARNING | `settings-panel.tsx:133-138` | Provider change silently discards compare mode selections |
| IN-01 | INFO | `settings-panel.tsx:52,108,123,54` | Dead handlers and state for key management |
| IN-02 | INFO | `store.ts:66,72,181,184` | Dead state fields `selectedSkills` and `apiKey` |
| IN-03 | INFO | `store.ts:649` | Redundant spread in `setConfig` |
| IN-04 | INFO | `store.ts:267,369` | Redundant `finally` after catch-with-return |

**Totals:** 2 critical, 4 warnings, 4 info

---

_Reviewed: 2026-05-17T14:03:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
