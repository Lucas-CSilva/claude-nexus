// app/posts/components/PostCard.tsx — Server Component
// Receives server-fetched data as props; children slot accepts any RSC or client content.

import { cn } from "@/lib/utils";
import type { Post } from "./types";

interface PostCardProps {
  post: Post;
  children?: React.ReactNode; // slot for client leaves (e.g. LikeButton)
  className?: string;
}

export function PostCard({ post, children, className }: PostCardProps) {
  return (
    <article
      className={cn(
        "rounded-lg border border-gray-200 bg-white p-5 shadow-sm",
        "transition-shadow hover:shadow-md",
        className,
      )}
    >
      <header className="mb-3 flex items-center gap-3">
        <img
          src={post.author.avatarUrl}
          alt={post.author.name}
          className="h-8 w-8 rounded-full object-cover"
        />
        <div>
          <p className="text-sm font-medium text-gray-900">{post.author.name}</p>
          <time
            dateTime={post.publishedAt}
            className="text-xs text-gray-500"
          >
            {new Date(post.publishedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        </div>
      </header>

      <h2 className="mb-2 text-lg font-semibold text-gray-900">{post.title}</h2>
      <p className="mb-4 line-clamp-3 text-sm text-gray-600">{post.body}</p>

      {/* Client leaf is passed in as children — keeps PostCard a Server Component */}
      <footer className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {post.comments.length} comment{post.comments.length !== 1 ? "s" : ""}
        </span>
        {children}
      </footer>
    </article>
  );
}
