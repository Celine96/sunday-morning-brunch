"use client";

import { useState, useEffect, useMemo } from "react";
import ProductCard from "../../components/ProductCard";
import Spinner from "../../components/Spinner";
import { getProducts } from "../../lib/api";
import type { ProductSummary } from "../../lib/types";

const CATEGORIES = [
  { label: "전체", value: "all" },
  { label: "블라우스 · 셔츠", value: "blouse" },
  { label: "원피스", value: "dress" },
  { label: "청바지 · 팬츠", value: "pants" },
];

function matchCategory(product: ProductSummary, filterValue: string): boolean {
  if (filterValue === "all") return true;
  // category 필드가 비어있을 수 있으므로 상품명에서도 매칭
  const text = ((product.category || "") + " " + (product.name || "")).toLowerCase();
  switch (filterValue) {
    case "blouse":
      return text.includes("블라우스") || text.includes("셔츠") || text.includes("탑") || text.includes("튜닉") || text.includes("크루넥") || text.includes("blouse") || text.includes("shirt") || text.includes("top");
    case "dress":
      return text.includes("원피스") || text.includes("dress");
    case "pants":
      return text.includes("청바지") || text.includes("팬츠") || text.includes("제깅스") || text.includes("부트컷") || text.includes("스키니") || text.includes("jean") || text.includes("pant");
    default:
      return false;
  }
}

export default function ShopPage() {
  const [allProducts, setAllProducts] = useState<ProductSummary[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("all");
  const pageSize = 100; // fetch all for client-side filtering

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getProducts(1, pageSize);
      setAllProducts(data.products);
    } catch (err) {
      console.error("Failed to load products:", err);
      setError("데이터를 불러올 수 없습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  const filteredProducts = useMemo(() => {
    return allProducts.filter((p) => matchCategory(p, activeCategory));
  }, [allProducts, activeCategory]);

  const displayPageSize = 12;
  const totalPages = Math.ceil(filteredProducts.length / displayPageSize);
  const displayProducts = filteredProducts.slice(
    (page - 1) * displayPageSize,
    page * displayPageSize
  );

  function handleCategoryChange(value: string) {
    setActiveCategory(value);
    setPage(1);
  }

  return (
    <div>
      {/* Hero Banner */}
      <div className="relative -mx-4 -mt-6 mb-8 overflow-hidden">
        <div
          className="px-4 py-16 md:py-24 text-center"
          style={{
            background: "linear-gradient(135deg, #FAF8F5 0%, #F5F0E8 30%, #EDE5D8 60%, #E8DCC8 100%)",
          }}
        >
          <h1 className="font-serif text-3xl md:text-5xl text-warm-800 tracking-wide mb-4">
            Sunday Morning Brunch
          </h1>
          <p className="font-serif text-base md:text-lg text-warm-500 italic tracking-wide">
            느긋한 일요일처럼, 매일을 편안하게
          </p>
          <div className="mt-6 flex justify-center">
            <div className="w-12 h-px bg-warm-400" />
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="mb-8">
        <div className="flex gap-6 border-b border-warm-200">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => handleCategoryChange(cat.value)}
              className={`pb-3 text-sm tracking-wide transition-colors relative ${
                activeCategory === cat.value
                  ? "text-warm-800 font-medium"
                  : "text-warm-400 hover:text-warm-600"
              }`}
            >
              {cat.label}
              {activeCategory === cat.value && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-warm-400 mt-3">
          {filteredProducts.length}개의 상품
        </p>
      </div>

      {isLoading ? (
        <Spinner className="py-12" />
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-warm-400 mb-4">{error}</p>
          <button
            onClick={loadProducts}
            className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm"
          >
            다시 시도
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {displayProducts.map((product) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>

          {displayProducts.length === 0 && (
            <p className="text-center text-warm-400 py-12">해당 카테고리에 상품이 없습니다.</p>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-full text-sm transition-colors ${
                    p === page
                      ? "bg-amber-500 text-white"
                      : "bg-white border border-warm-300 text-warm-600 hover:bg-warm-100"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
