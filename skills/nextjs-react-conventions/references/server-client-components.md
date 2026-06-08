# Server vs Client Components — Deep Reference

## The Decision Tree

```
Does this component need:
  - useState / useReducer?          → "use client"
  - useEffect / lifecycle?          → "use client"
  - onClick, onChange, etc.?        → "use client"
  - browser APIs (window, etc.)?    → "use client"
  - Context that's client-defined?  → "use client"
  - Animations / portals?           → "use client"

Otherwise → Server Component (default, no directive)
```

When in doubt: **start Server, add "use client" only when the compiler or runtime tells you to.**

---

## Patterns

### Pattern 1: Server parent, client leaf (most common)

```tsx
// Server Component — fetches, renders structure
export default async function PostPage({ params }: { params: { id: string } }) {
  const post = await getPost(params.id);
  if (!post) notFound();

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.body}</p>
      {/* Only the interactive part is a client component */}
      <LikeButton postId={post.id} initialLikes={post.likes} />
      <CommentSection postId={post.id} initialComments={post.comments} />
    </article>
  );
}
```

### Pattern 2: Passing children through client components (avoids over-clientifying)

When a client component needs to wrap server content (e.g., an accordion), pass the
server content as `children` — it's evaluated on the server and passed as a prop.

```tsx
// "use client" — wraps server-rendered children
"use client";
export function Accordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(!open)}>{title}</button>
      {open && children}
    </div>
  );
}

// Server Component — server content passed into client component
export default async function FAQPage() {
  const faqs = await getFAQs();
  return faqs.map((faq) => (
    <Accordion key={faq.id} title={faq.question}>
      {/* This JSX is a Server Component — rendered on server, passed as prop */}
      <MarkdownContent content={faq.answer} />
    </Accordion>
  ));
}
```

### Pattern 3: Context providers isolated at the boundary

Providers are always `"use client"`, but the root layout is a Server Component.
The key is that the provider accepts `children` — the server tree flows through.

```tsx
// providers/ThemeProvider.tsx
"use client";
import { ThemeProvider as NextThemes } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return <NextThemes attribute="class">{children}</NextThemes>;
}

// app/layout.tsx — Server Component
import { ThemeProvider } from "@/providers/ThemeProvider";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

### Pattern 4: Interleaving server data into client components via props

The server/client boundary transfers data as serializable props. The rule:
**serialize on the server side of the boundary.**

```tsx
// ✅ Serializable: primitives, plain objects, arrays, Date (as ISO string)
<Chart data={chartData} title={post.title} createdAt={post.createdAt.toISOString()} />

// ❌ NOT serializable across the boundary:
<Component fn={myFunction} />         // functions
<Component instance={new MyClass()} /> // class instances
<Component symbol={Symbol("x")} />    // symbols
<Component element={<OtherComp />} />  // JSX elements (except via children pattern above)
```

---

## Anti-patterns Catalogue

### ❌ Marking a whole page "use client"

```tsx
// ❌ This disables RSC for the entire page subtree
"use client";
export default function PostsPage() {
  const [filter, setFilter] = useState("all");
  const posts = usePosts(filter);    // now using client-side fetch for initial data
  // ...
}

// ✅ Server page fetches initial data; small client component handles the filter
export default async function PostsPage({ searchParams }: PageProps) {
  const filter = searchParams.filter ?? "all";
  const posts = await getPosts(filter);          // server fetch
  return (
    <>
      <FilterBar currentFilter={filter} />       // "use client" — handles URL update
      <PostList posts={posts} />                 // Server Component
    </>
  );
}
```

### ❌ "use client" high in the component tree

```tsx
// ❌ This entire feature tree is now client-only
"use client";
export function DashboardFeature() {
  // Has useState so it's client — but its subtree (DataGrid, Charts, etc.) also becomes client
  const [page, setPage] = useState(1);
  return <DataGrid page={page} onPageChange={setPage} />;
}

// ✅ Extract just the stateful part
export async function DashboardFeature() {          // Server Component
  const data = await getDashboardData();
  return <DataGridWithPagination initialData={data} />;
}

"use client";
export function DataGridWithPagination({ initialData }: Props) {
  const [page, setPage] = useState(1);              // Only this subtree is client
  // ...
}
```

### ❌ Importing server-only code in a client component

```tsx
// ❌ lib/db.ts imports 'server-only' — this will throw at build time
"use client";
import { db } from "@/lib/db";       // hard error: server-only module in client bundle
```

Add `import "server-only"` at the top of any module that must never reach the client.

### ❌ useEffect for data that should be RSC

```tsx
// ❌ This works but misses the point of RSC
"use client";
export function PostList() {
  const [posts, setPosts] = useState([]);
  useEffect(() => {
    fetch("/api/posts").then(r => r.json()).then(setPosts);
  }, []);
  // initial render is empty → layout shift, no SSR, no caching
}

// ✅ Fetch in a Server Component; use TanStack Query only for post-load mutations
export default async function PostList() {
  const posts = await getPosts();   // rendered on server, cached, SSR'd
  return /* ... */;
}
```

---

## Server Actions

Server Actions are `async` functions marked `"use server"`. Use them for:
- Form submissions with progressive enhancement
- Mutations that don't need optimistic UI
- Operations that need direct server-side access (DB, secrets)

```ts
// app/posts/actions.ts
"use server";
import { revalidateTag } from "next/cache";
import { commentSchema } from "@/lib/validations";

export async function createComment(input: unknown) {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.flatten() };

  await db.comment.create({ data: parsed.data });
  revalidateTag("comments");
  return { success: true };
}
```

**Use TanStack Query mutations instead** when: you need loading state in the UI,
optimistic updates, or you're already in a client component with query context.
Server Actions + TanStack Query can coexist — call the Server Action inside a
`mutationFn`.
