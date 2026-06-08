// lib/validations.ts  (shown here as feature-example/validations.ts)
import { z } from "zod";

export const commentSchema = z.object({
  postId: z.string().uuid("Invalid post ID"),
  body: z
    .string()
    .min(1, "Comment cannot be empty")
    .max(500, "Comment must be 500 characters or fewer"),
});

export type CommentInput = z.infer<typeof commentSchema>;
