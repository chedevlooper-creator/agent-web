---
id: 01-user-registration-auth-pages-plan03
phase: 1
wave: 1
depends_on:
  - PLAN-02
files_modified:
  - apps/web/app/register/page.tsx
  - apps/web/app/register/layout.tsx
autonomous: true
requirements:
  - AUTH-01
---

# Plan 03: Register Page UI

## Objective

Create the user-facing registration page with a form that matches the existing dark-first "Signal Cockpit" design system.

## Tasks

### Task 3.1: Create register page

<read_first>
- apps/web/app/page.tsx (existing page pattern with "use client")
- apps/web/components/chat/welcome-hero.tsx (existing component for visual reference)
- apps/web/app/globals.css (CSS variables for the design system)
- apps/web/tailwind.config.ts (Tailwind theme)
</read_first>

<action>
Create `apps/web/app/register/page.tsx`:

1. Add `"use client"` directive
2. Create a centered page with dark background matching the Signal Cockpit theme
3. Form fields: username (text input), password (password input)
4. Submit button with loading state
5. Display validation errors inline
6. On success, show success message with link to /login
7. Link to /login for existing users: "Already have an account? Log in"

Use the existing CSS variables from globals.css for consistent styling:
- Use `bg-gray-900` or `bg-[#0a0a0a]` for background
- Use the electric/lime accent color for buttons and highlights
- Simple, clean form design with proper spacing

```tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Render centered card with form
  // On success: green checkmark + "Account created! Redirecting..."
  // On error: red error message
  // Form: two fields + submit button + link to login
}
```

No layout.tsx needed — the root layout already provides the shell. Just the page component.
</action>

<acceptance_criteria>
- `apps/web/app/register/page.tsx` exists with "use client" directive
- Page renders at `/register` with a centered form
- Form has username and password inputs and submit button
- Validation errors from API are displayed to user
- Successful registration shows success message and redirects to /login
- Link to /login is present
- Design matches the existing dark theme (consistent colors, spacing, typography)
</acceptance_criteria>

## Verification Criteria

1. Navigate to `/register` — form is displayed with proper dark theme
2. Submit with empty fields — validation error is shown
3. Submit with valid data — success message appears, redirects to /login
4. Try registering with an existing username — error "Username is already taken" displayed

## must_haves

- Registration form is functional and styled consistently
- Error messages are user-friendly
- Successful registration provides clear feedback
