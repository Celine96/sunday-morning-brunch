"use client";

import Link from "next/link";
import StarRating from "./StarRating";
import ProductImage from "./ProductImage";

interface ProductCardProps {
  id: number;
  name: string;
  price: number;
  image_url?: string;
  rating?: number;
  review_count: number;
}

const DEMO_COLORS = [
  ["#F5E6D3", "#D4B896", "#8B7355"],
  ["#E8D5C4", "#C9A88E", "#6B5B4B"],
  ["#F0E0D0", "#B8A090", "#706058"],
  ["#E0D0C0", "#C0A890", "#907868"],
];

function formatKRW(usdPrice: number): string {
  const krw = Math.round((usdPrice * 1300) / 100) * 100;
  return krw.toLocaleString("ko-KR");
}

function formatOriginalKRW(usdPrice: number): string {
  const original = Math.round((usdPrice * 1300) / (0.8 * 100)) * 100;
  return original.toLocaleString("ko-KR");
}

export default function ProductCard({
  id,
  name,
  price,
  image_url,
  rating,
  review_count,
}: ProductCardProps) {
  const colors = DEMO_COLORS[id % DEMO_COLORS.length];
  const krwPrice = formatKRW(price);
  const originalPrice = formatOriginalKRW(price);

  return (
    <Link href={`/shop/products/${id}`}>
      <div className="rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer bg-white border border-warm-200 hover:-translate-y-1">
        <div className="aspect-[3/4] bg-cream-100 relative flex items-center justify-center overflow-hidden">
          <ProductImage src={image_url} alt={name} size="sm" />
        </div>
        <div className="p-3.5">
          <h3 className="text-sm font-medium text-warm-800 line-clamp-2 min-h-[2.5rem] leading-snug">
            {name}
          </h3>

          {/* Color chips */}
          <div className="mt-2 flex gap-1.5">
            {colors.map((color, idx) => (
              <span
                key={idx}
                className="w-3.5 h-3.5 rounded-full border border-warm-200"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          {/* Price */}
          <div className="mt-2">
            <span className="text-xs text-warm-400 line-through mr-2">
              {originalPrice}원
            </span>
            <span className="text-xs text-red-500 font-medium">20%</span>
          </div>
          <p className="text-base font-bold text-warm-800">
            {krwPrice}원
          </p>

          <div className="mt-1.5 flex items-center gap-1">
            <StarRating rating={Math.round(rating || 0)} />
            <span className="text-xs text-warm-400">({review_count})</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
