# Data Fetching Reference

## Caching Strategy Cheat Sheet

| Scenario | fetch option | Equivalent |
|---|---|---|
| Static, rarely changes | `cache: "force-cache"` | Default (can omit) |
| Time-based revalidation | `next: { revalidate: N }` | ISR — recheck every N seconds |
| Tag-based revalidation | `next: { tags: ["name"] }` | Invalidate via `revalidateTag()` |
| Always fresh | `cache: "no-store"` | Dynamic rendering per request |
| Dynamic route default | (none needed — dynamic route opts out) | Per-request by default |

```ts
// lib/api.ts — canonical fetch wrappers

const API = process.env.API_URL!;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const message = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, message);
  }
  const json: ApiResponse<T> = await res.json();
  return json.data;
}

// Named, typed fetchers
export const getPosts = (filters?: PostFilters) =>
  apiFetch<Post[]>(`/posts${buildQuery(filters)}`, {
    next: { revalidate: 60, tags: ["posts"] },
  });

export const getPost = (id: string) =>
  apiFetch<Post>(`/posts/${id}`, {
    next: { revalidate: 60, tags: [`post-${id}`] },
  });

export const likePost = (id: string) =>
  apiFetch<Post>(`/posts/${id}/like`, { method: "POST", cache: "no-store" });

export const createComment = (data: CommentInput) =>
  apiFetch<Comment>("/comments", {
    method: "POST",
    body: JSON.stringify(data),
    cache: "no-store",
  });

// Error class
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}
```

---

## TanStack Query Conventions

### QueryClient setup

```tsx
// providers/QueryProvider.tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,        // 1 minute default stale time
        retry: (count, err) =>
          err instanceof ApiError && err.status >= 500 ? count < 2 : false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools />}
    </QueryClientProvider>
  );
}
```

### Query key factory pattern

Every resource gets a factory object. Keys are read-only tuples for strict typing.

```ts
// hooks/usePosts.ts
export const postKeys = {
  all:    ()                    => ["posts"] as const,
  lists:  ()                    => ["posts", "list"] as const,
  list:   (f?: PostFilters)     => ["posts", "list", f] as const,
  detail: (id: string)          => ["posts", "detail", id] as const,
};
```

### Query hooks — standard shape

```ts
import { useQuery, keepPreviousData } from "@tanstack/react-query";

export function usePosts(filters?: PostFilters) {
  return useQuery({
    queryKey: postKeys.list(filters),
    queryFn: () => fetchPosts(filters),
    placeholderData: keepPreviousData,   // keeps old data visible during filter change
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: postKeys.detail(id),
    queryFn: () => getPost(id),
    enabled: !!id,
  });
}
```

### Mutation hooks — standard shape

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useLikePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => likePost(postId),
    // Optimistic update
    onMutate: async (postId) => {
      await qc.cancelQueries({ queryKey: postKeys.detail(postId) });
      const previous = qc.getQueryData<Post>(postKeys.detail(postId));
      qc.setQueryData<Post>(postKeys.detail(postId), (old) =>
        old ? { ...old, likes: old.likes + 1 } : old
      );
      return { previous };
    },
    onError: (_err, postId, ctx) => {
      qc.setQueryData(postKeys.detail(postId), ctx?.previous);
    },
    onSettled: (_data, _err, postId) => {
      qc.invalidateQueries({ queryKey: postKeys.detail(postId) });
    },
  });
}
```

### Hydrating RSC data into TanStack Query (advanced)

When initial data is fetched server-side and you also want TanStack Query to manage it
client-side (for refetch, mutations), use `initialData` or the Hydration API:

```tsx
// app/posts/page.tsx — Server Component
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";

export default async function PostsPage() {
  const qc = new QueryClient();
  await qc.prefetchQuery({ queryKey: postKeys.list(), queryFn: getPosts });

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <PostsClient />    {/* "use client" — can call usePosts() and get instant data */}
    </HydrationBoundary>
  );
}
```

Use the Hydration pattern only when the client needs to refetch/mutate the same data
immediately after load. For purely display data, RSC fetch + props is simpler.

---

## Loading and Error States in Client Components

```tsx
"use client";
export function PostsView({ initialFilter }: { initialFilter: string }) {
  const [filter, setFilter] = useState(initialFilter);
  const { data: posts, isLoading, isError, error } = usePosts({ status: filter });

  if (isLoading) return <PostsSkeleton />;
  if (isError) return <ErrorCard message={(error as ApiError).message} />;

  return (
    <>
      <FilterBar value={filter} onChange={setFilter} />
      <ul>{posts!.map((p) => <PostCard key={p.id} post={p} />)}</ul>
    </>
  );
}
```

**Rule:** `isLoading` (first load) vs `isFetching` (any fetch, including refetch).
Show a skeleton on `isLoading`; show a subtle spinner overlay on `isFetching && !isLoading`.

---

## Parallel Data Fetching in Server Components

```tsx
export default async function DashboardPage() {
  // Fire requests in parallel — do NOT await sequentially
  const [stats, recentPosts, user] = await Promise.all([
    getStats(),
    getRecentPosts(),
    getUser(),
  ]);

  return <DashboardView stats={stats} posts={recentPosts} user={user} />;
}
```

Use `<Suspense>` to stream independent sections:

```tsx
export default function DashboardPage() {
  return (
    <>
      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection />      {/* async Server Component — fetches its own data */}
      </Suspense>
      <Suspense fallback={<PostsSkeleton />}>
        <RecentPostsSection />
      </Suspense>
    </>
  );
}
```

This lets `StatsSection` and `RecentPostsSection` stream independently without blocking
each other, even if one is slower.
