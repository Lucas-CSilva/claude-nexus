// app/posts/components/LikeButton.tsx — Client leaf
// "use client" is added here — as narrow and leaf-level as possible.
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useLikePost } from "./useLikePost";

interface LikeButtonProps {
  postId: string;
  initialLikes: number;
}

export function LikeButton({ postId, initialLikes }: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const { mutate, isPending } = useLikePost();

  function handleLike() {
    if (liked || isPending) return;
    setLiked(true);
    mutate(postId);
  }

  return (
    <button
      onClick={handleLike}
      disabled={liked || isPending}
      aria-label={liked ? "Liked" : "Like this post"}
      className={cn(
        // layout + sizing + spacing
        "flex items-center gap-1.5 rounded-full px-3 py-1 text-sm",
        // base colors + border
        "border border-gray-200 bg-white text-gray-500",
        // state
        "transition-colors hover:border-pink-300 hover:text-pink-500",
        liked && "border-pink-300 text-pink-500",
        (liked || isPending) && "cursor-not-allowed opacity-70",
      )}
    >
      <span aria-hidden>{liked ? "♥" : "♡"}</span>
      {/* Optimistic UI: count is updated by the mutation hook's onMutate */}
      <span>{initialLikes}</span>
    </button>
  );
}
