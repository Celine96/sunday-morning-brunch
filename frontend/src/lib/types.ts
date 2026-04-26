export interface Reply {
  id: number;
  review_id: number;
  content: string;
  author: string;
  status: string;
  sentiment?: string;
  confidence?: number;
  created_at: string;
  updated_at?: string;
  published_at?: string | null;
}

export interface Review {
  id: number;
  product_id: number;
  author: string;
  rating: number;
  content: string;
  sentiment?: string;
  sentiment_score?: number;
  created_at: string;
  replies: Reply[];
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category?: string;
  rating?: number;
  review_count: number;
  reviews: Review[];
}

export interface ProductSummary {
  id: number;
  name: string;
  price: number;
  image_url?: string;
  category?: string;
  rating?: number;
  review_count: number;
}

export interface HistoryItem {
  id: number;
  review_id: number;
  review_summary: string;
  reply_text: string;
  full_reply_text: string;
  sentiment: string;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface HistoryDetail {
  reply: {
    id: number;
    content: string;
    status: string;
    sentiment: string;
    confidence: number;
    created_at: string;
  };
  review: {
    id: number;
    content: string;
    rating: number;
    author: string;
  } | null;
  history: Array<{
    id: number;
    action: string;
    content_snapshot: string;
    created_at: string;
  }>;
}

export interface GeneratedReply {
  reply_id: number;
  draft_reply: string;
  sentiment: string;
  confidence: number;
  status: string;
}
