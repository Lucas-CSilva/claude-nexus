// types/domain.ts  (shown here as feature-example/types.ts)
// These mirror the backend's API contracts — coordinate with the backend conventions skill.

export interface Author {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface Comment {
  id: string;
  body: string;
  author: Author;
  createdAt: string; // ISO 8601 — parse to Date at the use site if needed
}

export interface Post {
  id: string;
  title: string;
  body: string;
  likes: number;
  author: Author;
  comments: Comment[];
  publishedAt: string;
}

// API envelope — matches backend's generic wrapper
export interface ApiResponse<T> {
  data: T;
  meta?: {
    total: number;
    page: number;
    perPage: number;
  };
}

// Filter types — derived from query params
export interface PostFilters {
  status?: "published" | "draft";
  authorId?: string;
  page?: number;
}
