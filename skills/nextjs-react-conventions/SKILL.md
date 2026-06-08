---
name: nextjs-react-conventions
description: >
  Coding conventions, patterns, and project structure for frontend development in
  Next.js (App Router) with TypeScript and React. Use this skill whenever a frontend
  agent needs to produce, review, or scaffold any Next.js code — route segments,
  layouts, components, data fetching, mutations, forms, styling, or tests. Trigger
  on any request involving App Router pages, Server Components, Client Components,
  TanStack Query, Tailwind CSS, React Hook Form / Zod, or frontend project structure.
  Also trigger when the agent needs to decide where state lives, how to split the
  server/client boundary, or how to type API responses and shared domain models.
  Always consult this skill before writing any Next.js / React code to ensure
  first-try-correct, convention-compliant output.
---

# Next.js App Router — Coding Conventions

> **This skill owns how code is written.** The agent brings general React/TypeScript
> knowledge; this skill brings the concrete, project-consistent patterns and defaults.
> Match patterns here first — deviate only with explicit justification.

---

## 1 · Project Structure

```
app/
  (marketing)/          # route group — no URL segment
    page.tsx
    layout.tsx
  dashboard/
    layout.tsx          # dashboard shell (Server Component)
    page.tsx            # dashboard home (Server Component)
    loading.tsx
    error.tsx
    components/         # colocated, dashboard-specific components
      StatsCard.tsx
    posts/
      page.tsx
      [id]/
        page.tsx
        components/
          LikeButton.tsx  # "use client" leaf
  api/                  # Route Handlers only (prefer Server Actions or RSC fetching)
    ...

components/             # truly shared UI primitives
  ui/                   # shadcn-style primitives
    Button.tsx
    Card.tsx
  layout/
    Header.tsx

lib/
  api.ts                # typed fetch wrappers
  utils.ts              # cn(), formatDate(), etc.
  validations.ts        # shared Zod schemas

hooks/                  # shared custom hooks (client-only; "use client" in hook file if needed)
  useDebounce.ts

types/
  api.ts                # API response types
  domain.ts             # shared domain types (mirror backend contracts)

providers/
  QueryProvider.tsx     # "use client" TanStack Query + other context providers

store/                  # Zustand stores — only when threshold is met (§5)
  uiStore.ts
```

**Naming rules:** `PascalCase` for component files, `camelCase` for utilities and hooks.
Route segment folders are `kebab-case`. The file that exports a component matches the
component name: `PostLikeButton.tsx` exports `PostLikeButton`.

→ Full layout reference: `references/project-structure.md`

---

## 2 · Server vs Client Components — THE Central Rule

> **Default is Server. `"use client"` is opt-in. Push it to the leaves.**

| Stays on the server | Forces "use client" |
|---|---|
| `async` data fetching, DB calls, secrets | `useState`, `useReducer`, `useEffect` |
| heavy deps (parse, transform) | Event handlers (`onClick`, `onChange`) |
| components that never need interactivity | Browser APIs (`window`, `localStorage`) |
| static render, SEO-critical content | Context consumers (if context is client-defined) |
| Server Actions | Animations, portals |

### ✅ Correct: server fetches, client leaf handles interaction

```tsx
// app/posts/page.tsx  — Server Component (no directive needed)
import { PostList } from "./components/PostList";
import { LikeButton } from "./components/LikeButton";
import { getPosts } from "@/lib/api";

export default async function PostsPage() {
  const posts = await getPosts();           // fetch on server — no useEffect, no SWR
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>
          <span>{post.title}</span>
          <LikeButton postId={post.id} initialLikes={post.likes} />  {/* client leaf */}
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// app/posts/components/LikeButton.tsx  — Client leaf
"use client";
import { useState } from "react";
import { useLikePost } from "@/hooks/useLikePost";

export function LikeButton({ postId, initialLikes }: LikeButtonProps) {
  const [likes, setLikes] = useState(initialLikes);
  const { mutate } = useLikePost();
  return (
    <button onClick={() => { mutate(postId); setLikes((n) => n + 1); }}>
      ♥ {likes}
    </button>
  );
}
```

### ❌ Don't Do This

```tsx
// ❌ whole page is "use client" just to add a button
"use client";
export default function PostsPage() { /* ... */ }

// ❌ "use client" high in the tree kills RSC for the whole subtree
// ❌ passing non-serializable values (functions, class instances) across the boundary
// ❌ importing server-only modules (db, secret env vars) inside a "use client" file
// ❌ using useEffect to fetch data that could be a Server Component async fetch
```

→ Detailed decision tree + patterns: `references/server-client-components.md`

---

## 3 · Data Fetching & Server State

### Server Components — initial/render-time data

```tsx
// Fetch directly in async Server Component; use Next.js fetch options for caching.
const data = await fetch(`${process.env.API_URL}/posts`, {
  next: { revalidate: 60 },              // ISR: revalidate every 60 s
});
// OR: next: { tags: ["posts"] }         // on-demand revalidation via revalidateTag()
// OR: cache: "no-store"                 // always fresh (dynamic route)
```

### TanStack Query — post-load / interactive server state

TanStack Query is the default for **client-side server state**: mutations, refetch-on-focus,
infinite scroll, polling, optimistic updates. It does **not** replace RSC for initial data.

```tsx
// hooks/usePosts.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPosts, likePost } from "@/lib/api";
import type { Post } from "@/types/domain";

// Query key convention: ["resource", { filters }]
export const postKeys = {
  all: () => ["posts"] as const,
  list: (filters?: PostFilters) => ["posts", "list", filters] as const,
  detail: (id: string) => ["posts", "detail", id] as const,
};

export function usePosts(filters?: PostFilters) {
  return useQuery({
    queryKey: postKeys.list(filters),
    queryFn: () => fetchPosts(filters),
  });
}

export function useLikePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => likePost(postId),
    onSuccess: (_, postId) => {
      qc.invalidateQueries({ queryKey: postKeys.detail(postId) });
    },
  });
}
```

```tsx
// providers/QueryProvider.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
// Mount in app/layout.tsx (root Server Component wraps it — provider itself is client)
```

### Typed API layer

```tsx
// lib/api.ts
import type { Post, ApiResponse } from "@/types/api";

export async function getPosts(): Promise<Post[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/posts`);
  if (!res.ok) throw new Error("Failed to fetch posts");
  const json: ApiResponse<Post[]> = await res.json();
  return json.data;
}
```

→ Full patterns + error handling: `references/data-fetching.md`

---

## 4 · Forms & Validation

**Default:** React Hook Form + Zod.

```tsx
// Server-side schema in lib/validations.ts (shared with Server Actions if used)
import { z } from "zod";
export const commentSchema = z.object({
  body: z.string().min(1).max(500),
  postId: z.string().uuid(),
});
export type CommentInput = z.infer<typeof commentSchema>;
```

```tsx
// Client form component
"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { commentSchema, type CommentInput } from "@/lib/validations";
import { useCreateComment } from "@/hooks/useComments";

export function CommentForm({ postId }: { postId: string }) {
  const { register, handleSubmit, formState: { errors } } = useForm<CommentInput>({
    resolver: zodResolver(commentSchema),
    defaultValues: { postId },
  });
  const { mutate, isPending } = useCreateComment();

  return (
    <form onSubmit={handleSubmit((data) => mutate(data))}>
      <textarea {...register("body")} />
      {errors.body && <p className="text-red-500 text-sm">{errors.body.message}</p>}
      <button type="submit" disabled={isPending}>Submit</button>
    </form>
  );
}
```

**Server Actions:** use when a mutation naturally lives server-side (no client state
dependency, progressive enhancement needed). Co-locate `actions.ts` in the route folder.
Still validate with Zod on the server — never trust client input.

---

## 5 · Client State Management

**Default: `useState` / `useContext`.** These cover almost all UI state.

**Zustand threshold:** introduce a store only when all of these are true:
1. State is needed in 3+ unrelated subtrees (not just prop-drilling two levels).
2. Lifting state to a common ancestor is impractical or causes excessive re-renders.
3. The state is genuinely global UI state (e.g., shopping cart, multi-step wizard, sidebar open state synced across disconnected areas).

```ts
// store/uiStore.ts  — only when threshold is met
import { create } from "zustand";

interface UIStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
}));
```

One concern per store. No god-store. Server state lives in TanStack Query, not Zustand.

---

## 6 · Styling — Tailwind CSS

```tsx
// lib/utils.ts — cn() helper (clsx + tailwind-merge)
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

// Usage
<div className={cn(
  "rounded-lg border p-4 text-sm",          // base
  isActive && "border-blue-500 bg-blue-50",  // conditional
  className,                                  // external override
)} />
```

**Class ordering convention (Prettier plugin enforced):**
layout → sizing → spacing → typography → color → border → effect → state variants.

**Extract a component** when the same set of utilities recurs in 3+ places with the same
semantics. Don't extract just to shorten a line.

**Global CSS:** only in `app/globals.css` (imported in root layout). Use for CSS variables,
base resets, and font-face declarations. No global component styles — use Tailwind.

**Theming:** via `tailwind.config.ts` `theme.extend` (colors, spacing, fonts). Never
hardcode color values in JSX — always use Tailwind tokens.

---

## 7 · TypeScript Conventions

```ts
// types/domain.ts — domain types that mirror backend contracts
export interface Post {
  id: string;
  title: string;
  body: string;
  likes: number;
  author: Author;
  createdAt: string;   // ISO string from API; parse to Date at the use site if needed
}

// types/api.ts — API envelope
export interface ApiResponse<T> {
  data: T;
  meta?: { total: number; page: number };
}

// Component props: use interface for public API, type for local/derived shapes
interface LikeButtonProps {
  postId: string;
  initialLikes: number;
}

// ❌ Avoid any. Use unknown + type guard, or the correct generic.
// ❌ Don't cast with `as T` unless you've validated the shape (Zod parse).
// ✅ Return types on exported functions; infer for local helpers.
// ✅ Strict null checks: handle undefined/null explicitly.
```

**type vs interface:** `interface` for component props and public API shapes (extensible);
`type` for unions, intersections, mapped types, and local derived shapes.

---

## 8 · Error & Loading UX (App Router conventions)

```
app/dashboard/
  page.tsx          — happy path
  loading.tsx       — shown while page.tsx suspends (instant skeleton)
  error.tsx         — "use client" error boundary for this segment
  not-found.tsx     — rendered by notFound() call in page.tsx
```

```tsx
// loading.tsx — Server Component, shown immediately
export default function DashboardLoading() {
  return <DashboardSkeleton />;
}

// error.tsx — must be "use client"
"use client";
export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return <ErrorCard message={error.message} onRetry={reset} />;
}
```

Use `<Suspense>` for partial loading within a page (stream independent data sections).
Don't wrap an entire page in `<Suspense>` when `loading.tsx` already handles it.

---

## 9 · Testing Conventions

- **Client Components:** React Testing Library + Jest/Vitest. Test behavior, not implementation.
- **Server Components:** Render with `@testing-library/react` in a test environment; mock
  `fetch` or data layer. Keep tests focused on output markup, not internal async details.
- **Hooks:** `renderHook` from RTL. Wrap with `QueryClientWrapper` for TanStack Query hooks.
- **File location:** colocated `__tests__/` folder or `ComponentName.test.tsx` beside the component.

```tsx
// LikeButton.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { LikeButton } from "./LikeButton";
import { createWrapper } from "@/test/utils";  // QueryClient wrapper

test("increments like count on click", async () => {
  render(<LikeButton postId="1" initialLikes={5} />, { wrapper: createWrapper() });
  fireEvent.click(screen.getByRole("button"));
  expect(screen.getByText(/6/)).toBeInTheDocument();
});
```

→ Test structure, Server Component testing patterns: `references/testing.md`

---

## 10 · Naming & Code Style Summary

| Thing | Convention | Example |
|---|---|---|
| Component file | PascalCase | `PostLikeButton.tsx` |
| Utility / lib | camelCase | `formatDate.ts` |
| Hook | `useX.ts` | `useLikePost.ts` |
| Route folder | kebab-case | `my-profile/` |
| Route group | `(name)/` | `(marketing)/` |
| Server Action file | `actions.ts` | `app/posts/actions.ts` |
| Store file | camelCase + `Store` | `uiStore.ts` |
| Zod schema var | camelCase + `Schema` | `commentSchema` |
| Query key factory | camelCase + `Keys` | `postKeys` |

---

## Cross-Skill Integration

- **Diagrams** (component hierarchy, server/client data flow, fetch/mutation sequence):
  author with the **mermaid** skill. Do not inline ad-hoc diagram syntax.
- **Requirements traceability:** frontend work references requirement IDs from the
  technical spec produced by the **project-docs** skill.
- **API types** in `types/domain.ts` must align with the backend contracts defined by
  the backend conventions skill — coordinate on the contract before writing client types.

---

## Reference Files

| File | When to read |
|---|---|
| `references/project-structure.md` | Scaffolding a new feature or route; unsure where a file belongs |
| `references/server-client-components.md` | Deciding the server/client split; complex component trees |
| `references/data-fetching.md` | Caching strategy, error handling, TanStack Query advanced patterns |
| `references/feature-example/` | A complete worked example: Server page + client leaf + mutation + form + test |
