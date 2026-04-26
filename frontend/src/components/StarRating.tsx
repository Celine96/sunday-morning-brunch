"use client";

export default function StarRating({
  rating,
  size = "text-sm",
}: {
  rating: number;
  size?: string;
}) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span key={i} className={`${size} ${i <= rating ? "text-amber-400" : "text-gray-300"}`}>
        ★
      </span>
    );
  }
  return (
    <span className="inline-flex" aria-label={`${rating} out of 5 stars`} role="img">
      {stars}
    </span>
  );
}
