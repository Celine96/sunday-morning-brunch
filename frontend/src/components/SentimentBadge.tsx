"use client";

const sentimentConfig: Record<string, { label: string; className: string }> = {
  positive: { label: "긍정", className: "bg-green-100 text-green-800" },
  negative: { label: "부정", className: "bg-red-100 text-red-800" },
  inquiry: { label: "문의", className: "bg-blue-100 text-blue-800" },
  other: { label: "기타", className: "bg-gray-100 text-gray-800" },
};

export default function SentimentBadge({
  sentiment,
  confidence,
}: {
  sentiment: string;
  confidence?: number;
}) {
  const config = sentimentConfig[sentiment] || sentimentConfig.other;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {config.label}
      {confidence !== undefined && (
        <span className="text-[10px] opacity-70">{Math.round(confidence * 100)}%</span>
      )}
    </span>
  );
}
