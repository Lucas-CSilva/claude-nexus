// app/posts/hooks/useLikePost.ts
// TanStack Query mutation hook — lives in a "use client" context (called from client components).
// No "use client" directive needed in hook files — the directive is only for component files
// that import this from a Server Component context. Hooks are always client-side by nature.
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { likePost, ApiError } from "./api";
import type { Post } from "./types";

// Query key factory — centralizes all keys for the posts resource
export const postKeys = {
  all:    ()              => ["posts"] as const,
  lists:  ()              => ["posts", "list"] as const,
  list:   (f?: unknown)   => ["posts", "list", f] as const,
  detail: (id: string)    => ["posts", "detail", id] as const,
};

export function useLikePost() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => likePost(postId),

    // Optimistic update: increment immediately, roll back on error
    onMutate: async (postId) => {
      // Cancel any in-flight queries for this post
      await qc.cancelQueries({ queryKey: postKeys.detail(postId) });

      // Snapshot current data for rollback
      const previous = qc.getQueryData<Post>(postKeys.detail(postId));

      // Optimistically increment likes
      qc.setQueryData<Post>(postKeys.detail(postId), (old) =>
        old ? { ...old, likes: old.likes + 1 } : old,
      );

      return { previous, postId };
    },

    onError: (_err, _postId, ctx) => {
      // Roll back to previous data on error
      if (ctx?.previous) {
        qc.setQueryData(postKeys.detail(ctx.postId), ctx.previous);
      }
    },

    onSettled: (_data, _err, postId) => {
      // Always sync with server after mutation settles
      qc.invalidateQueries({ queryKey: postKeys.detail(postId) });
      qc.invalidateQueries({ queryKey: postKeys.lists() });
    },
  });
}
