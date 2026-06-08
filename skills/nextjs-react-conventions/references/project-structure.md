# Project Structure Reference

## Full Directory Layout

```
my-app/
├── app/                          # Next.js App Router root
│   ├── layout.tsx                # Root layout (HTML shell, providers)
│   ├── page.tsx                  # / route
│   ├── globals.css               # Global styles (imported in root layout only)
│   ├── not-found.tsx             # Global 404
│   │
│   ├── (marketing)/              # Route group — no URL prefix
│   │   ├── layout.tsx
│   │   ├── page.tsx              # /
│   │   ├── about/
│   │   │   └── page.tsx          # /about
│   │   └── pricing/
│   │       └── page.tsx          # /pricing
│   │
│   ├── (app)/                    # Authenticated app shell
│   │   ├── layout.tsx            # Auth guard, shell chrome
│   │   ├── dashboard/
│   │   │   ├── layout.tsx        # Dashboard nav
│   │   │   ├── page.tsx          # /dashboard
│   │   │   ├── loading.tsx
│   │   │   ├── error.tsx
│   │   │   └── components/       # ← colocated, dashboard-only
│   │   │       ├── StatsCard.tsx
│   │   │       └── RecentActivity.tsx
│   │   │
│   │   └── posts/
│   │       ├── page.tsx          # /posts
│   │       ├── loading.tsx
│   │       ├── error.tsx
│   │       ├── actions.ts        # Server Actions for this route
│   │       ├── components/       # ← colocated, posts-only
│   │       │   ├── PostCard.tsx
│   │       │   └── LikeButton.tsx    # "use client" leaf
│   │       └── [id]/
│   │           ├── page.tsx      # /posts/[id]
│   │           ├── not-found.tsx
│   │           └── components/
│   │               └── CommentForm.tsx   # "use client"
│   │
│   └── api/                      # Route Handlers (REST endpoints if needed)
│       └── webhooks/
│           └── stripe/
│               └── route.ts
│
├── components/                   # Truly shared, reusable UI
│   ├── ui/                       # Primitives (shadcn-style or custom)
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Dialog.tsx
│   │   └── Input.tsx
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── Sidebar.tsx
│   └── forms/
│       └── FieldError.tsx
│
├── hooks/                        # Shared custom hooks
│   ├── useDebounce.ts
│   └── useMediaQuery.ts
│
├── lib/                          # Non-component utilities
│   ├── api.ts                    # Typed fetch wrappers
│   ├── utils.ts                  # cn(), formatDate(), etc.
│   └── validations.ts            # Shared Zod schemas
│
├── providers/                    # React context providers (all "use client")
│   ├── QueryProvider.tsx
│   └── ThemeProvider.tsx
│
├── store/                        # Zustand stores (only when threshold is met)
│   └── uiStore.ts
│
├── types/                        # TypeScript type definitions
│   ├── api.ts                    # API response envelopes
│   └── domain.ts                 # Domain types (mirror backend contracts)
│
├── test/                         # Shared test utilities
│   ├── utils.tsx                 # QueryClient wrapper, custom render
│   └── mocks/
│       └── handlers.ts           # MSW handlers
│
├── public/                       # Static assets
├── tailwind.config.ts
├── next.config.ts
└── tsconfig.json
```

---

## Colocation Rule

> Code lives as close to where it's used as possible.

1. **Route-specific component:** `app/[route]/components/`
2. **Shared across 2+ routes but within a feature domain:** `components/[domain]/`
3. **Truly universal primitive:** `components/ui/`

Apply the same rule to hooks: a hook used only in `posts/` lives in `app/(app)/posts/hooks/`
(or `components/` folder level if shared). A hook used app-wide lives in `hooks/`.

---

## Root Layout Pattern

```tsx
// app/layout.tsx
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import "@/app/globals.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
```

Providers that need `"use client"` (QueryProvider, ThemeProvider) are isolated in
`providers/`. The root layout itself remains a Server Component.

---

## Naming Quick Reference

| Artifact | Convention | Notes |
|---|---|---|
| Component file | `PascalCase.tsx` | File name = export name |
| Page | `page.tsx` | Always lowercase (Next.js convention) |
| Layout | `layout.tsx` | Always lowercase |
| Loading | `loading.tsx` | Always lowercase |
| Error | `error.tsx` | Must be `"use client"` |
| Not found | `not-found.tsx` | Always lowercase |
| Server Action | `actions.ts` | Colocated in route folder |
| Route Handler | `route.ts` | In `app/api/[path]/route.ts` |
| Hook | `useX.ts` (camelCase) | Prefix `use` always |
| Utility | `camelCase.ts` | No suffix needed |
| Store | `camelCase + Store.ts` | e.g., `uiStore.ts` |
| Zod schema | `camelCase + Schema` (variable) | e.g., `const postSchema = z.object(...)` |
| Type | `PascalCase` | `interface Post`, `type PostFilters` |
| Route segment | `kebab-case/` | e.g., `my-profile/` |
| Route group | `(kebab-case)/` | e.g., `(marketing)/` |

---

## Environment Variables

- `process.env.NEXT_PUBLIC_*` — exposed to the browser; safe for API base URLs.
- `process.env.*` (no prefix) — server-only; never referenced in `"use client"` files.
- Use `server-only` package import in modules that must never ship to the client:

```ts
// lib/db.ts
import "server-only";
// ... database client setup
```
