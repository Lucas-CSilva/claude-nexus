// lib/api.ts  (shown here as feature-example/api.ts)
import type { Post, Comment, ApiResponse, PostFilters } from "./types";

const API = process.env.API_URL!; // server-only env var

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, body);
  }
  const json: ApiResponse<T> = await res.json();
  return json.data;
}

function buildQuery(params?: Record<string, unknown>): string {
  if (!params) return "";
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
  return qs.toString() ? `?${qs}` : "";
}

// ─── Named, typed fetchers ───────────────────────────────────────────────────

export const getPosts = (filters?: PostFilters) =>
  apiFetch<Post[]>(`/posts${buildQuery(filters as Record<string, unknown>)}`, {
    next: { revalidate: 60, tags: ["posts"] },
  });

export const getPost = (id: string) =>
  apiFetch<Post>(`/posts/${id}`, {
    next: { revalidate: 60, tags: [`post-${id}`] },
  });

// Client-side only (called from TanStack Query mutations)
export const likePost = (id: string) =>
  apiFetch<Post>(`/posts/${id}/like`, {
    method: "POST",
    cache: "no-store",
  });

export const createComment = (data: { postId: string; body: string }) =>
  apiFetch<Comment>("/comments", {
    method: "POST",
    body: JSON.stringify(data),
    cache: "no-store",
  });
