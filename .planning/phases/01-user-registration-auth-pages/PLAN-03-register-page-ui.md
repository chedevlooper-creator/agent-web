---
id: 01-user-registration-auth-pages-plan3
phase: 1
wave: 1
depends_on:
  - 01-user-registration-auth-pages-plan2
files_modified:
  - apps/web/app/register/page.tsx (create)
  - apps/web/components/auth/register-form.tsx (create)
autonomous: true
requirements:
  - AUTH-01
---

## Objective

Create the `/register` page with a client-component registration form, client-side validation, error display, and redirect on success.

---

## Tasks

### Task 1: Create `apps/web/app/register/page.tsx`

<read_first>
- `apps/web/app/page.tsx` — page component pattern
- `apps/web/app/layout.tsx` — root layout (page renders inside this)
</read_first>

<action>
1. Create directory:

```bash
mkdir -p apps/web/app/register
```

2. Create `apps/web/app/register/page.tsx`:

```typescript
import { RegisterForm } from "@/components/auth/register-form";

export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="brand-wordmark text-2xl mb-1">
            Agent<span>Web</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Create your account to get started
          </p>
        </div>
        <RegisterForm />
        <p className="text-center mt-6 text-xs text-muted-foreground">
          Already have an account?{" "}
          <a
            href="/login"
            className="text-electric hover:text-electric-hover underline underline-offset-2 transition-colors"
          >
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
```
</action>

<acceptance_criteria>
- `apps/web/app/register/page.tsx` exists as a server component (no `"use client"`)
- Renders the `RegisterForm` client component
- Shows "Agent Web" brand wordmark
- Links to `/login` for existing users
- Uses existing CSS variables (`--electric`, `--muted-foreground`, etc.)
</acceptance_criteria>

---

### Task 2: Create `apps/web/components/auth/register-form.tsx`

<read_first>
- `apps/web/components/settings-panel.tsx` — client component pattern with `"use client"`, `useState`, Tailwind styling
- `apps/web/app/globals.css` — design token CSS variables used for colors/borders
- `apps/web/DESIGN_SYSTEM.md` — design system specs for inputs, buttons, cards
</read_first>

<action>
1. Create directory:

```bash
mkdir -p apps/web/components/auth
```

2. Create `apps/web/components/auth/register-form.tsx`:

```typescript
"use client";

import { useState, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Loader2, Check, AlertCircle, Eye, EyeOff, User, Lock } from "lucide-react";

interface FieldError {
  field: string;
  message: string;
}

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const getFieldError = (field: string): string | undefined =>
    errors.find((e) => e.field === field)?.message;

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setErrors([]);
      setGeneralError(null);

      // Client-side validation
      const clientErrors: FieldError[] = [];
      if (username.length < 3 || username.length > 32) {
        clientErrors.push({ field: "username", message: "Username must be 3–32 characters" });
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
        clientErrors.push({
          field: "username",
          message: "Only letters, numbers, underscores, and hyphens",
        });
      }
      if (password.length < 8) {
        clientErrors.push({ field: "password", message: "Password must be at least 8 characters" });
      }
      if (password.length > 128) {
        clientErrors.push({ field: "password", message: "Password is too long" });
      }
      if (clientErrors.length > 0) {
        setErrors(clientErrors);
        return;
      }

      setSubmitting(true);
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 409) {
            setErrors([{ field: "username", message: data.error || "Username is already taken" }]);
          } else if (res.status === 400 && data.details) {
            const fieldErrors: FieldError[] = [];
            if (data.details.username) {
              fieldErrors.push({ field: "username", message: data.details.username.join(", ") });
            }
            if (data.details.password) {
              fieldErrors.push({ field: "password", message: data.details.password.join(", ") });
            }
            setErrors(fieldErrors.length > 0 ? fieldErrors : [{ field: "username", message: "Invalid input" }]);
          } else {
            setGeneralError(data.error || "Registration failed. Please try again.");
          }
          return;
        }

        // Success — redirect to login
        router.push("/login");
      } catch {
        setGeneralError("Network error. Please check your connection.");
      } finally {
        setSubmitting(false);
      }
    },
    [username, password, router]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card p-6 space-y-5 animate-scale-in"
      noValidate
    >
      {/* General error */}
      {generalError && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive-muted border border-destructive/20 text-destructive text-sm">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      {/* Username */}
      <div className="space-y-1.5">
        <label htmlFor="register-username" className="section-label">
          Username
        </label>
        <div className="relative">
          <User
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            id="register-username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setErrors((prev) => prev.filter((e) => e.field !== "username"));
            }}
            placeholder="Choose a username"
            autoComplete="username"
            autoFocus
            maxLength={32}
            className={cn(
              "min-h-[44px] w-full pl-10 pr-3 rounded-xl text-sm",
              "bg-surface-muted border",
              "placeholder:text-muted-foreground/40",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30",
              "transition-[border-color,box-shadow,background-color] duration-200",
              getFieldError("username")
                ? "border-destructive/50 focus:ring-destructive/20 focus:border-destructive/30"
                : "border-border-muted"
            )}
          />
        </div>
        {getFieldError("username") && (
          <p className="text-xs text-destructive mt-1">{getFieldError("username")}</p>
        )}
        <p className="text-[10px] text-muted-foreground/50">
          3–32 characters. Letters, numbers, underscores, hyphens.
        </p>
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <label htmlFor="register-password" className="section-label">
          Password
        </label>
        <div className="relative">
          <Lock
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            id="register-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErrors((prev) => prev.filter((e) => e.field !== "password"));
            }}
            placeholder="Min 8 characters"
            autoComplete="new-password"
            maxLength={128}
            className={cn(
              "min-h-[44px] w-full pl-10 pr-12 rounded-xl text-sm",
              "bg-surface-muted border",
              "placeholder:text-muted-foreground/40",
              "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30",
              "transition-[border-color,box-shadow,background-color] duration-200",
              getFieldError("password")
                ? "border-destructive/50 focus:ring-destructive/20 focus:border-destructive/30"
                : "border-border-muted"
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {getFieldError("password") && (
          <p className="text-xs text-destructive mt-1">{getFieldError("password")}</p>
        )}
        <p className="text-[10px] text-muted-foreground/50">
          Minimum 8 characters. No complexity requirements.
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className={cn(
          "min-h-[44px] w-full flex items-center justify-center gap-2 px-4 rounded-xl text-sm font-medium",
          "transition-[opacity,transform,background-color] duration-200",
          "active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          submitting
            ? "bg-primary/60 text-black cursor-not-allowed"
            : "bg-primary text-black hover:opacity-90"
        )}
      >
        {submitting ? (
          <>
            <Loader2 size={15} className="animate-spin" />
            Creating account&hellip;
          </>
        ) : (
          <>
            <Check size={15} />
            Create Account
          </>
        )}
      </button>
    </form>
  );
}
```
</action>

<acceptance_criteria>
- `apps/web/components/auth/register-form.tsx` exists with `"use client"` directive
- Form has username input, password input (with show/hide toggle), and submit button
- Client-side validation runs before POST: username length 3-32, regex, password min 8
- On validation error, inline error messages shown below the relevant field
- On 409 (duplicate), shows "Username is already taken" error
- On 400, shows field-level validation errors from server
- On 200, redirects to `/login` via `router.push("/login")`
- Loading state: submit button shows spinner + "Creating account…" text, disabled state
- Design: dark theme using glass-card, CSS variables, section-label, primary button per Signal Cockpit design system
- `noValidate` on form to use custom validation instead of browser default
</acceptance_criteria>

---

## Verification Criteria

1. Navigate to `/register` — page renders with brand wordmark, form fields, and login link
2. Submit empty form — client-side validation errors appear
3. Submit with username < 3 chars — error shown
4. Submit with invalid characters (`@`, space, emoji) — error shown
5. Submit with valid data — POST to `/api/auth/register`, on 201 redirects to `/login`
6. Submit with existing username — "Username is already taken" error shown
7. Password show/hide toggle works
8. Loading state: button shows spinner and is disabled during submission
9. Styling matches dark Signal Cockpit theme (glass-card, electric accents)

## Must Haves

- Client-side validation before network request (instant feedback)
- Inline field-level error messages (not just a generic banner)
- Loading/disabled state on submit button
- Redirect to `/login` on successful registration
- "Already have an account? Sign in" link to `/login`
- Dark theme using existing CSS design tokens
