// app/posts/[id]/components/CommentForm.tsx — Client Component
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commentSchema, type CommentInput } from "./validations";
import { createComment } from "./api";
import { postKeys } from "./useLikePost";
import { cn } from "@/lib/utils";

interface CommentFormProps {
  postId: string;
}

export function CommentForm({ postId }: CommentFormProps) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CommentInput>({
    resolver: zodResolver(commentSchema),
    defaultValues: { postId, body: "" },
  });

  const { mutate, isPending, isError, error } = useMutation({
    mutationFn: createComment,
    onSuccess: () => {
      reset();
      qc.invalidateQueries({ queryKey: postKeys.detail(postId) });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutate(data))}
      className="mt-6 space-y-3"
      noValidate
    >
      <label htmlFor="comment-body" className="block text-sm font-medium text-gray-700">
        Leave a comment
      </label>

      <textarea
        id="comment-body"
        rows={3}
        placeholder="What do you think?"
        {...register("body")}
        className={cn(
          "w-full rounded-lg border px-3 py-2 text-sm",
          "placeholder:text-gray-400 focus:outline-none focus:ring-2",
          errors.body
            ? "border-red-400 focus:ring-red-300"
            : "border-gray-300 focus:ring-blue-300",
        )}
      />

      {errors.body && (
        <p role="alert" className="text-xs text-red-500">
          {errors.body.message}
        </p>
      )}

      {isError && (
        <p role="alert" className="text-xs text-red-500">
          Failed to post comment. Please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending || isSubmitting}
        className={cn(
          "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white",
          "hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        {isPending ? "Posting…" : "Post comment"}
      </button>
    </form>
  );
}
