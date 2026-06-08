// app/posts/page.tsx — Server Component
// No "use client" — this is a Server Component by default.
//
// Co-located:
//   loading.tsx  → shown while this async component resolves
//   error.tsx    → catches thrown errors (must be "use client")
//   not-found.tsx → rendered when notFound() is called

import { notFound } from "next/navigation";
import { getPosts } from "./api"; // in a real project: @/lib/api
import { PostCard } from "./PostCard";
import { LikeButton } from "./LikeButton";

interface PageProps {
  searchParams: { status?: string; page?: string };
}

export default async function PostsPage({ searchParams }: PageProps) {
  // Fetch on the server — no useEffect, no SWR, no client-side loading spinner.
  const posts = await getPosts({
    status: searchParams.status === "draft" ? "draft" : "published",
    page: searchParams.page ? Number(searchParams.page) : 1,
  });

  if (!posts.length) {
    // Renders not-found.tsx for this segment
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Posts</h1>
      <ul className="space-y-4">
        {posts.map((post) => (
          <li key={post.id}>
            {/* PostCard is a Server Component — renders the static content */}
            <PostCard post={post}>
              {/* LikeButton is a "use client" leaf — handles interaction */}
              <LikeButton postId={post.id} initialLikes={post.likes} />
            </PostCard>
          </li>
        ))}
      </ul>
    </main>
  );
}

// Optional: export metadata from a Server Component
export const metadata = {
  title: "Posts",
};
