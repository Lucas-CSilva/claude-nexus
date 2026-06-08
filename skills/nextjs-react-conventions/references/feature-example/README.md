# Feature Example: Posts

A complete worked example demonstrating all conventions together:
- Server Component page fetching data at render time
- Client leaf component (LikeButton) with TanStack Query mutation
- Comment form with React Hook Form + Zod validation
- Tailwind + cn() styling
- Types aligned with backend contracts
- Component test (React Testing Library)

## Files

```
feature-example/
├── README.md                 ← you are here
├── types.ts                  ← domain types (go in types/domain.ts in a real project)
├── api.ts                    ← fetch wrappers (go in lib/api.ts)
├── validations.ts            ← Zod schemas (go in lib/validations.ts)
├── page.tsx                  ← Server Component page
├── PostCard.tsx              ← Server Component
├── LikeButton.tsx            ← "use client" leaf
├── useLikePost.ts            ← TanStack Query mutation hook
├── CommentForm.tsx           ← "use client" form
└── LikeButton.test.tsx       ← component test
```

## What this demonstrates

| Convention | Where |
|---|---|
| `async` Server Component data fetch | `page.tsx` |
| Server parent → client leaf pattern | `page.tsx` + `LikeButton.tsx` |
| TanStack Query mutation + optimistic update | `useLikePost.ts` |
| Query key factory | `useLikePost.ts` |
| Typed API layer | `api.ts` |
| React Hook Form + Zod | `CommentForm.tsx` + `validations.ts` |
| cn() conditional classes | `LikeButton.tsx`, `PostCard.tsx` |
| Component test | `LikeButton.test.tsx` |
| error.tsx / loading.tsx | referenced in `page.tsx` comments |
