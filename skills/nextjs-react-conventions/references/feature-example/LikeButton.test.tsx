// app/posts/components/LikeButton.test.tsx
// Tests the client-side LikeButton component using React Testing Library.

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LikeButton } from "./LikeButton";
import { likePost } from "./api";

// ─── Mock the API layer ──────────────────────────────────────────────────────
jest.mock("./api", () => ({
  likePost: jest.fn(),
}));
const mockLikePost = likePost as jest.MockedFunction<typeof likePost>;

// ─── Test utility: wrap component with QueryClientProvider ───────────────────
function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("LikeButton", () => {
  beforeEach(() => {
    mockLikePost.mockResolvedValue({ id: "1", likes: 6 } as never);
  });

  afterEach(() => jest.clearAllMocks());

  it("renders the initial like count", () => {
    render(<LikeButton postId="1" initialLikes={5} />, { wrapper: createWrapper() });
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("calls likePost with the correct postId when clicked", async () => {
    render(<LikeButton postId="post-abc" initialLikes={3} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /like/i }));
    await waitFor(() => expect(mockLikePost).toHaveBeenCalledWith("post-abc"));
  });

  it("disables the button after clicking to prevent double-likes", async () => {
    render(<LikeButton postId="1" initialLikes={5} />, { wrapper: createWrapper() });
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(btn).toBeDisabled();
  });

  it("updates aria-label to 'Liked' after clicking", async () => {
    render(<LikeButton postId="1" initialLikes={5} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /like this post/i }));
    expect(screen.getByRole("button", { name: /liked/i })).toBeInTheDocument();
  });
});

// ─── How to test a Server Component ─────────────────────────────────────────
// Server Components are async functions. Test them by calling them as async
// functions and asserting on the returned JSX, or render with RTL's render()
// after mocking the data-fetching layer.
//
// Example (PostCard is a sync Server Component so it renders fine with RTL):
//
// import { PostCard } from "./PostCard";
// it("renders post title", () => {
//   render(<PostCard post={mockPost} />);
//   expect(screen.getByRole("heading", { name: mockPost.title })).toBeInTheDocument();
// });
//
// For async Server Components (pages), mock the fetch layer and test the
// rendered output, or use Next.js's own testing integration (next/jest).
