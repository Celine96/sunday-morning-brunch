import type {
  Product,
  ProductSummary,
  Review,
  Reply,
  HistoryItem,
  HistoryDetail,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_TIMEOUT_MS = 30_000;

async function fetchAPI<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "API request failed");
    }
    return res.json() as Promise<T>;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("요청 시간이 초과되었습니다. 다시 시도해주세요.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

// --- Shop API ---
export async function getProducts(
  page = 1,
  pageSize = 12
): Promise<{ products: ProductSummary[]; total: number; page: number; page_size: number }> {
  return fetchAPI(`/api/products?page=${page}&page_size=${pageSize}`);
}

export async function getProduct(id: number): Promise<Product> {
  return fetchAPI(`/api/products/${id}`);
}

export async function getProductReviews(productId: number): Promise<{ reviews: Review[] }> {
  return fetchAPI(`/api/products/${productId}/reviews`);
}

export async function getReviewReplies(reviewId: number): Promise<{ replies: Reply[] }> {
  return fetchAPI(`/api/reviews/${reviewId}/replies`);
}

export async function createShopReply(reviewId: number, content: string): Promise<Reply> {
  return fetchAPI(`/api/reviews/${reviewId}/replies`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function updateShopReply(replyId: number, content: string): Promise<Reply> {
  return fetchAPI(`/api/replies/${replyId}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export async function deleteShopReply(replyId: number): Promise<{ success: boolean }> {
  return fetchAPI(`/api/replies/${replyId}`, { method: "DELETE" });
}

export async function getUnrepliedReviews(
  productId?: number
): Promise<{ reviews: Review[] }> {
  const params = productId ? `?product_id=${productId}` : "";
  return fetchAPI(`/api/reviews/unreplied${params}`);
}

// --- Agent API ---
export async function getToneProfile(): Promise<{
  id: number;
  brand_name: string;
  keywords: string[];
  sample_replies?: string[];
  system_prompt?: string;
  created_at: string;
  updated_at?: string;
}> {
  return fetchAPI("/api/agent/tone-profile");
}

export async function createToneProfile(data: {
  brand_name: string;
  keywords: string[];
  sample_replies: string[];
}): Promise<{
  id: number;
  brand_name: string;
  keywords: string[];
  system_prompt: string;
  preview_replies: Array<{ review: string; sentiment: string; reply: string }>;
}> {
  return fetchAPI("/api/agent/tone-profile", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function generateReply(data: {
  review_text: string;
  rating?: number;
  product_name?: string;
  review_id?: number;
  source?: string;
  tone_override?: string;
}): Promise<{
  reply_id: number;
  draft_reply: string;
  candidates: string[];
  sentiment: string;
  confidence: number;
}> {
  return fetchAPI("/api/agent/generate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function generateBatchReplies(
  reviews: Array<{
    review_text: string;
    rating?: number;
    product_name?: string;
    review_id?: number;
    tone_override?: string;
  }>
): Promise<{
  results: Array<{
    reply_id: number;
    draft_reply: string;
    candidates: string[];
    sentiment: string;
    confidence: number;
  }>;
}> {
  return fetchAPI("/api/agent/generate-batch", {
    method: "POST",
    body: JSON.stringify({ reviews }),
  });
}

export async function updateAgentReply(
  replyId: number,
  content: string
): Promise<Reply> {
  return fetchAPI(`/api/agent/replies/${replyId}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
}

export async function confirmReply(
  replyId: number
): Promise<{ id: number; status: string }> {
  return fetchAPI(`/api/agent/replies/${replyId}/confirm`, {
    method: "POST",
  });
}

export async function publishReply(
  replyId: number
): Promise<{ id: number; status: string; shop_reply_id?: number }> {
  return fetchAPI(`/api/agent/replies/${replyId}/publish`, {
    method: "POST",
  });
}

export async function regenerateReply(
  replyId: number
): Promise<{ id: number; new_draft_reply: string; sentiment: string }> {
  return fetchAPI(`/api/agent/replies/${replyId}/regenerate`, {
    method: "POST",
  });
}

export async function getHistory(
  status?: string
): Promise<{ history: HistoryItem[]; total: number; page: number; page_size: number }> {
  const params = status ? `?status=${status}` : "";
  return fetchAPI(`/api/agent/history${params}`);
}

export async function getHistoryDetail(replyId: number): Promise<HistoryDetail> {
  return fetchAPI(`/api/agent/history/${replyId}`);
}
