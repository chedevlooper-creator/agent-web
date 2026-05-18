# Code Review — Phase 1

**Files:** `apps/web/components/settings-panel.tsx`, `apps/web/lib/store.ts`
**Depth:** standard
**Status:** issues_found

## Summary

Reviewed 2 files covering a Zustand chat store (819 lines) and a React settings panel (400 lines). Found **1 critical** bug (error swallowing causes false success feedback), **4 warnings** (logic gaps, fragile patterns, rolling-back confusion), and **4 info items** (dead code, redundancy). The overall code quality is moderate — the store has solid rollback/optimistic-update patterns and good TypeScript hygiene overall, but the key management flow has a dangerous disconnect between store and UI error handling.

## Findings

---

### CR-01: Error swallowing in `saveKey` causes false success feedback — `store.ts:711`, `settings-panel.tsx:108`

**Issue:** The store's `saveKey()` method catches all errors internally and does not rethrow. The UI's `handleSaveKey` wraps the call in a try/catch expecting it to throw on failure, but it never does. Result: the user **always** sees "Anahtar kaydedildi." (key saved) even when the API call fails.

**Risk:** Users believe their API key was saved successfully when it was not. The next chat request fails with an authorization error, and the user has no way to know their key was never persisted.

**Fix:** Either (a) rethrow in `saveKey` so the UI can handle errors, or (b) remove the UI-level try/catch and handle errors entirely in the store. Rethrowing is the cleaner approach since it preserves the separation of concerns.

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

**Issue:** Same pattern as CR-01. `deleteKey` swallows all errors. The UI's `handleDeleteKey` expects throws and sets `setKeyInput("")` / `setSaveMsg(null)` even on failure, giving no indication that the deletion failed.

**Risk:** Users attempt to delete a key but it silently remains on the server. A subsequent key re-entry may not apply because the old key still exists, causing confusing behavior.

**Fix:** Rethrow in `deleteKey` similarly:

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

**Issue:** `setCompareMode(true)` evaluates to `true && s.selectedModels.length > 1`. If the user has 0 or 1 models selected and clicks the compare mode toggle, `setCompareMode(true)` computes to `false` and the toggle appears to do nothing. No feedback is given to the user.

**Risk:** Confusing UX — the user clicks the toggle expecting compare mode to turn on, but nothing happens. They have no indication that they need to select more models first.

**Fix:** Either (a) auto-select additional models when enabling compare mode, (b) show a tooltip/toast explaining the requirement, or (c) let compare mode turn on even with < 2 models and handle the edge case downstream. Option (c) is simplest:

```typescript
// settings-panel.tsx — current
onClick={() => {
  const next = !compareMode;
  setCompareMode(next);
  if (!next) setSelectedModels([]);
}}
```

For option (c), remove the guard in `setCompareMode`:

```typescript
// store.ts — fixed
setCompareMode: (v) =>
  set({ compareMode: v }),
```

And let the UI handle the edge case where compare mode is on but < 2 models are selected.

---

### WR-02: `importFromJson` throws unhandled rejection on malformed JSON — `store.ts:733-734`

**Issue:** `JSON.parse(json)` is called without a try/catch in an async function. If the caller passes invalid JSON, the store throws an unhandled promise rejection. The store's own catch block at line 738 is for the API call, not the JSON parse.

**Risk:** Crashes the reactive store update chain. The import feature becomes a denial-of-service vector against the UI if a user provides malformed import data.

**Fix:** Wrap the parse in a try/catch and either rethrow a typed error or handle gracefully:

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

**Issue:** The `patchLocalMessage` function accesses `_pendingPatches` and `_patchRaf` as properties on the store state, but these are not declared in the `ChatStore` interface. The code relies on a cast to `ChatStore & { _pendingPatches?: Map<string, string>; _patchRaf?: number }` to bypass TypeScript. This mutates Zustand's state object outside the normal `set()` API.

**Risk:** (a) Zustand's internal state shape is not guaranteed to support arbitrary extra properties — future Zustand versions could strip or freeze them. (b) If React strict mode double-invokes effects, the `_patchRaf` guard could leak a dangling `requestAnimationFrame` handle.

**Fix:** Move the pending-patches buffer outside the store entirely — into a module-level `Map` with a dedicated RAF loop, or into a separate React ref that feeds into a single `set()` per frame:

```typescript
// Module-level outside the store
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

**Issue:** When changing providers, `setSelectedModels([])` is called unconditionally. If `compareMode` was true, the user's A/B model selections are lost. The function itself is fine (changing provider should reset config), but there is no confirmation or feedback to the user that their compare mode selections were discarded.

**Risk:** User has carefully selected 2 models for comparison, switches providers out of curiosity, and loses all model selections without warning. This is a data-loss UX bug (minor severity but real).

**Fix:** Either disable compare mode first (giving UI feedback), or show a confirmation when changing provider during active compare mode. At minimum, ensure the state transitions are visible:

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

**Issue:** The component declares:
- `keyInput` state (line 52) — never used
- `handleSaveKey` callback (line 108) — never wired to any element
- `handleDeleteKey` callback (line 123) — never wired to any element
- `hasKeyForProvider` variable (line 54) — never used in the JSX

The "Server API Keys" section (lines 328-371) only shows status indicators; there is no input field or save/delete button. The key management feature appears to be half-implemented in the UI.

**Risk:** Confusing to maintainers. Dead code adds cognitive load and could be mistaken for a live feature. If a future developer adds a key input field, they might assume the existing callbacks work correctly — but they don't (see CR-01).

**Fix:** Either (a) implement the missing key input field, or (b) remove all dead state/handlers and leave only the read-only status display.

---

### IN-02: Dead state — `selectedSkills` and `apiKey` — `store.ts:66,72,181,184`

**Issue:** The `ChatStore` interface defines `selectedSkills: string[]` (line 66) and `apiKey: string` (line 72), both with defaults, but:
- `selectedSkills` has no action to modify it (the skills system uses `enabledSkills` instead)
- `apiKey` is documented as "Not persisted" and has no consumer in either reviewed file

**Risk:** Store bloat. Every unused field in the store is loaded on every selector subscription check.

**Fix:** Remove `selectedSkills` if `enabledSkills` is the canonical field. Remove or deprecate `apiKey` if transient API key input is not a planned feature.

---

### IN-03: `setConfig` redundant spread — `store.ts:649`

**Issue:** `setConfig: (c) => set((s) => ({ ...s, ...c }))` — Zustand's `set()` already performs a shallow merge of the partial state into the store. The `...s` spread is unnecessary.

```typescript
// Current
setConfig: (c) => set((s) => ({ ...s, ...c })),

// Simplified
setConfig: (c) => set(c),
```

**Risk:** None functionally. Minor code smell — every unnecessary spread creates a new object with extra iterations for no benefit.

---

### IN-04: `deleteProject` / `deleteSession` redundant `finally` after catch with `return` — `store.ts:267-269, 369-371`

**Issue:** Both methods follow this pattern:

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

The `finally` block always runs after `catch`, so on error the `syncing: false` set happens twice. On success, `finally` runs once.

**Risk:** Zero — JavaScript semantics guarantee `finally` runs before the `return` takes effect. The redundancy is harmless but signals confusion about how try/catch/finally works.

**Fix:** Remove the `set({ syncing: false })` and `return` from the `catch` block. Let `finally` handle the sync flag for both paths:

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
|----|----------|------|-------------|
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
