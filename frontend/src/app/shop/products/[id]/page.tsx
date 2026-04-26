"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import StarRating from "../../../../components/StarRating";
import Spinner from "../../../../components/Spinner";
import ProductImage from "../../../../components/ProductImage";
import ReviewItem from "../../../../components/ReviewItem";
import { getProduct } from "../../../../lib/api";
import type { Product } from "../../../../lib/types";

const SIZES = ["S", "M", "L", "XL"];
const DEMO_COLORS = [
  { name: "Cream", hex: "#F5E6D3" },
  { name: "Mocha", hex: "#D4B896" },
  { name: "Brown", hex: "#8B7355" },
  { name: "Charcoal", hex: "#5C5242" },
];

function formatKRW(usdPrice: number): string {
  const krw = Math.round((usdPrice * 1300) / 100) * 100;
  return krw.toLocaleString("ko-KR");
}

function formatOriginalKRW(usdPrice: number): string {
  const original = Math.round((usdPrice * 1300) / (0.8 * 100)) * 100;
  return original.toLocaleString("ko-KR");
}

export default function ProductDetailPage() {
  const params = useParams();
  const productId = Number(params.id);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // selectedSize, selectedColor: 데모 UI용 상태 (추후 장바구니 연동 시 활용)
  const [selectedSize, setSelectedSize] = useState("M");
  const [selectedColor, setSelectedColor] = useState(0);
  const [mainImageIdx, setMainImageIdx] = useState(0);

  useEffect(() => {
    if (Number.isNaN(productId)) {
      setError("잘못된 상품 ID입니다.");
      setIsLoading(false);
      return;
    }
    loadProduct();

    // FAB에서 대댓글 게시 시 자동 새로고침
    const handleReplyPublished = () => loadProduct();
    window.addEventListener("reply-published", handleReplyPublished);
    return () => window.removeEventListener("reply-published", handleReplyPublished);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function loadProduct() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProduct(productId);
      setProduct(data);
    } catch (err) {
      console.error("Failed to load product:", err);
      setError("데이터를 불러올 수 없습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return <Spinner className="py-12" />;
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-warm-400 mb-4">{error}</p>
        <button
          onClick={loadProduct}
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!product) {
    return <div className="text-center py-12 text-warm-400">상품을 찾을 수 없습니다.</div>;
  }

  // Generate thumbnail list - only show gallery if multiple unique images exist
  const thumbnails = product.image_url ? [product.image_url] : [];

  const krwPrice = formatKRW(product.price);
  const originalPrice = formatOriginalKRW(product.price);

  return (
    <div>
      <Link href="/shop" className="text-sm text-warm-400 hover:text-amber-600 mb-6 inline-flex items-center gap-1 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        목록으로
      </Link>

      {/* Product Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Image Gallery */}
        <div>
          <div className="aspect-square bg-cream-100 rounded-xl overflow-hidden relative flex items-center justify-center">
            <ProductImage
              src={thumbnails.length > 0 ? thumbnails[mainImageIdx] : undefined}
              alt={product.name}
              size="lg"
            />
          </div>
          {/* Thumbnails - only show if multiple unique images */}
          {thumbnails.length > 1 && (
            <div className="mt-3 flex gap-2">
              {thumbnails.map((thumb, idx) => (
                <button
                  key={idx}
                  onClick={() => setMainImageIdx(idx)}
                  className={`w-16 h-16 rounded-lg overflow-hidden relative flex-shrink-0 border-2 transition-colors ${
                    mainImageIdx === idx
                      ? "border-amber-500"
                      : "border-warm-200 hover:border-warm-400"
                  }`}
                >
                  <ProductImage src={thumb} alt={`${product.name} ${idx + 1}`} size="sm" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex flex-col">
          {product.category && (
            <p className="text-xs text-warm-400 uppercase tracking-widest mb-2">{product.category}</p>
          )}
          <h1 className="font-serif text-2xl md:text-3xl text-warm-800 mb-3">{product.name}</h1>

          <div className="flex items-center gap-2 mb-4">
            <StarRating rating={Math.round(product.rating || 0)} size="text-lg" />
            <span className="text-sm text-warm-400">({product.reviews.length}개 리뷰)</span>
          </div>

          {/* Price */}
          <div className="border-t border-b border-warm-200 py-4 mb-6">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-warm-800">{krwPrice}원</span>
              <span className="text-sm text-warm-400 line-through">{originalPrice}원</span>
              <span className="text-sm font-semibold text-red-500">20%</span>
            </div>
          </div>

          {product.description && (
            <p className="text-sm text-warm-600 leading-relaxed mb-6">{product.description}</p>
          )}

          {/* Color Options */}
          <div className="mb-5">
            <p className="text-xs text-warm-500 mb-2 font-medium uppercase tracking-wide">
              Color - {DEMO_COLORS[selectedColor].name}
            </p>
            <div className="flex gap-2">
              {DEMO_COLORS.map((color, idx) => (
                <button
                  key={color.name}
                  onClick={() => setSelectedColor(idx)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    selectedColor === idx
                      ? "border-warm-800 scale-110"
                      : "border-warm-200 hover:border-warm-400"
                  }`}
                  style={{ backgroundColor: color.hex }}
                  aria-label={color.name}
                />
              ))}
            </div>
          </div>

          {/* Size Options */}
          <div className="mb-6">
            <p className="text-xs text-warm-500 mb-2 font-medium uppercase tracking-wide">Size</p>
            <div className="flex gap-2">
              {SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`w-12 h-10 rounded-lg text-sm font-medium transition-all border ${
                    selectedSize === size
                      ? "bg-warm-800 text-cream-100 border-warm-800"
                      : "bg-white text-warm-600 border-warm-300 hover:border-warm-500"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-auto">
            <button className="flex-1 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors text-sm">
              장바구니 담기
            </button>
            <button className="flex-1 py-3 bg-warm-800 text-cream-100 rounded-xl font-medium hover:bg-warm-900 transition-colors text-sm">
              바로 구매
            </button>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="border-t border-warm-200 pt-8">
        <h2 className="font-serif text-xl text-warm-800 mb-6">
          리뷰 ({product.reviews.length}개)
        </h2>
        <div className="space-y-4">
          {product.reviews.map((review) => (
            <ReviewItem key={review.id} {...review} />
          ))}
          {product.reviews.length === 0 && (
            <p className="text-center text-warm-400 py-8">아직 리뷰가 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
