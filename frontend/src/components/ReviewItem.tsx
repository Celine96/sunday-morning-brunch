"use client";

import StarRating from "./StarRating";

interface Reply {
  id: number;
  content: string;
  author: string;
  status: string;
  created_at: string;
}

interface ReviewItemProps {
  id: number;
  author: string;
  rating: number;
  content: string;
  created_at: string;
  replies: Reply[];
}

export default function ReviewItem({
  author,
  rating,
  content,
  created_at,
  replies,
}: ReviewItemProps) {
  const publishedReplies = replies.filter((r) => r.status === "published");
  const date = new Date(created_at).toLocaleDateString("ko-KR");

  return (
    <div className="border border-warm-200 rounded-xl p-5 bg-white/80">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {/* Author avatar placeholder */}
        <span className="w-7 h-7 rounded-full bg-cream-300 flex items-center justify-center text-xs text-warm-600 font-medium">
          {author.charAt(0).toUpperCase()}
        </span>
        <span className="font-medium text-sm text-warm-800">{author}</span>
        <StarRating rating={rating} />
        <span className="text-xs text-warm-400">{date}</span>
        {/* Verified purchase badge */}
        <span className="ml-auto text-[10px] bg-green-50 text-green-600 border border-green-200 rounded-full px-2 py-0.5">
          인증 구매
        </span>
      </div>
      <p className="text-sm text-warm-700 whitespace-pre-wrap leading-relaxed">{content}</p>

      {publishedReplies.length > 0 && (
        <div className="mt-4 ml-4 space-y-2">
          {publishedReplies.map((reply) => (
            <div
              key={reply.id}
              className="bg-amber-50/70 border-l-4 border-amber-400 p-3 rounded-r-xl"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-amber-700">
                  Sunday Morning Brunch
                </span>
                <span className="text-xs text-warm-400">
                  {new Date(reply.created_at).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="text-sm text-warm-700 whitespace-pre-wrap">
                {reply.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {publishedReplies.length === 0 && (
        <div className="mt-2 ml-4 text-xs text-warm-300 italic">
          (대댓글 없음)
        </div>
      )}
    </div>
  );
}
