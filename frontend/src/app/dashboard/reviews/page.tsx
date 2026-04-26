"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SentimentBadge from "../../../components/SentimentBadge";
import StatusBadge from "../../../components/StatusBadge";
import StarRating from "../../../components/StarRating";
import Spinner from "../../../components/Spinner";
import {
  getProducts,
  getUnrepliedReviews,
  generateReply,
  generateBatchReplies,
  updateAgentReply,
  confirmReply,
  publishReply,
} from "../../../lib/api";

interface ProductSummary {
  id: number;
  name: string;
  image_url?: string;
  review_count: number;
}

interface UnrepliedReview {
  id: number;
  product_id: number;
  product_name?: string;
  author: string;
  rating: number;
  content: string;
  created_at: string;
}

interface GroupedReviews {
  product: ProductSummary;
  reviews: UnrepliedReview[];
  isExpanded: boolean;
}

interface GeneratedResult {
  reply_id: number;
  review_id: number;
  draft_reply: string;
  candidates: string[];
  selectedCandidate: number;
  sentiment: string;
  confidence: number;
  status: string;
  review_text: string;
  isEditing: boolean;
  editContent: string;
}

export default function ReviewsPage() {
  const [groups, setGroups] = useState<GroupedReviews[]>([]);
  const [selectedReviews, setSelectedReviews] = useState<Set<number>>(new Set());
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toneOverride, setToneOverride] = useState<string>("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoadingData(true);
    setLoadError(null);
    try {
      let productsRes, unrepliedRes;
      try {
        productsRes = await getProducts(1, 100);
      } catch (e) {
        console.error("getProducts failed:", e);
        productsRes = { products: [] };
      }
      try {
        unrepliedRes = await getUnrepliedReviews();
      } catch (e) {
        console.error("getUnrepliedReviews failed:", e);
        unrepliedRes = { reviews: [] };
      }

      const products: ProductSummary[] = productsRes.products || [];
      const unreplied: UnrepliedReview[] = unrepliedRes.reviews || [];

      // 상품별로 그루핑
      const productMap = new Map<number, ProductSummary>();
      products.forEach((p: ProductSummary) => productMap.set(p.id, p));

      const groupMap = new Map<number, UnrepliedReview[]>();
      unreplied.forEach((r: UnrepliedReview) => {
        const pid = r.product_id;
        if (!groupMap.has(pid)) groupMap.set(pid, []);
        groupMap.get(pid)!.push(r);
      });

      const grouped: GroupedReviews[] = [];
      groupMap.forEach((reviews, productId) => {
        const product = productMap.get(productId) || {
          id: productId,
          name: `상품 #${productId}`,
          review_count: reviews.length,
        };
        grouped.push({ product, reviews, isExpanded: true });
      });

      // 미답변 많은 순으로 정렬
      grouped.sort((a, b) => b.reviews.length - a.reviews.length);
      setGroups(grouped);
    } catch (err) {
      console.error("Failed to load data:", err);
      setLoadError("데이터를 불러올 수 없습니다. 다시 시도해주세요.");
    } finally {
      setIsLoadingData(false);
    }
  }

  function toggleGroup(productId: number) {
    setGroups((prev) =>
      prev.map((g) =>
        g.product.id === productId ? { ...g, isExpanded: !g.isExpanded } : g
      )
    );
  }

  function toggleReview(reviewId: number) {
    setSelectedReviews((prev) => {
      const next = new Set(prev);
      if (next.has(reviewId)) next.delete(reviewId);
      else next.add(reviewId);
      return next;
    });
  }

  function toggleProductAll(productId: number) {
    const group = groups.find((g) => g.product.id === productId);
    if (!group) return;
    const reviewIds = group.reviews.map((r) => r.id);
    const allSelected = reviewIds.every((id) => selectedReviews.has(id));

    setSelectedReviews((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        reviewIds.forEach((id) => next.delete(id));
      } else {
        reviewIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function selectAll() {
    const allIds = groups.flatMap((g) => g.reviews.map((r) => r.id));
    setSelectedReviews(new Set(allIds));
  }

  function deselectAll() {
    setSelectedReviews(new Set());
  }

  async function handleBatchGenerate() {
    if (selectedReviews.size === 0) {
      setError("대댓글을 생성할 리뷰를 선택해주세요.");
      return;
    }

    setIsGenerating(true);
    setError("");

    // 선택된 리뷰 수집
    const selectedList: UnrepliedReview[] = [];
    groups.forEach((g) => {
      g.reviews.forEach((r) => {
        if (selectedReviews.has(r.id)) selectedList.push(r);
      });
    });

    try {
      const reviews = selectedList.map((r) => ({
        review_text: r.content,
        rating: r.rating,
        review_id: r.id,
        product_name: groups.find((g) => g.product.id === r.product_id)?.product.name,
        tone_override: toneOverride || undefined,
      }));

      const response = await generateBatchReplies(reviews);
      const newResults: GeneratedResult[] = response.results.map(
        (r: { reply_id: number; draft_reply: string; candidates: string[]; sentiment: string; confidence: number }, i: number) => ({
          reply_id: r.reply_id,
          review_id: selectedList[i].id,
          draft_reply: r.draft_reply,
          candidates: r.candidates || [r.draft_reply],
          selectedCandidate: 0,
          sentiment: r.sentiment,
          confidence: r.confidence,
          status: "draft",
          review_text: selectedList[i].content,
          isEditing: false,
          editContent: r.draft_reply,
        })
      );

      setResults((prev) => [...newResults, ...prev]);
      // 생성 완료된 리뷰는 선택 해제
      setSelectedReviews(new Set());
      // 미답변 목록은 게시 후에 새로고침 (1차 검토 → 2차 반영 흐름)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "일괄 생성에 실패했습니다.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleToneChange(index: number, newTone: string) {
    const item = results[index];
    setError("");
    updateResult(index, { status: "regenerating" as string });
    try {
      const result = await generateReply({
        review_text: item.review_text,
        review_id: item.review_id,
        source: "batch",
        tone_override: newTone || undefined,
      });
      const candidates = result.candidates || [result.draft_reply];
      updateResult(index, {
        reply_id: result.reply_id,
        draft_reply: candidates[0],
        candidates,
        selectedCandidate: 0,
        sentiment: result.sentiment,
        confidence: result.confidence,
        editContent: candidates[0],
        status: "draft",
        isEditing: false,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "말투 변경에 실패했습니다.");
      updateResult(index, { status: "draft" });
    }
  }

  async function handleSaveEdit(index: number) {
    const item = results[index];
    try {
      await updateAgentReply(item.reply_id, item.editContent);
      updateResult(index, { draft_reply: item.editContent, isEditing: false });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "수정에 실패했습니다.");
    }
  }

  async function handleConfirm(index: number) {
    const item = results[index];
    try {
      await confirmReply(item.reply_id);
      updateResult(index, { status: "confirmed" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "확정에 실패했습니다.");
    }
  }

  async function handlePublish(index: number) {
    const item = results[index];
    try {
      await publishReply(item.reply_id);
      updateResult(index, { status: "published" });
      window.dispatchEvent(new CustomEvent("reply-published"));
      // 게시 완료 후 미답변 목록 새로고침
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "게시에 실패했습니다.");
    }
  }

  async function handleConfirmAll() {
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "draft") await handleConfirm(i);
    }
  }

  async function handlePublishAll() {
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === "confirmed" || results[i].status === "draft") {
        await handlePublish(i);
      }
    }
  }

  async function handleQuickPublish(index: number) {
    const item = results[index];
    try {
      await confirmReply(item.reply_id);
      updateResult(index, { status: "confirmed" });
      await publishReply(item.reply_id);
      updateResult(index, { status: "published" });
      window.dispatchEvent(new CustomEvent("reply-published"));
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "바로 게시에 실패했습니다.");
    }
  }

  function getFilteredGroups(): GroupedReviews[] {
    if (ratingFilter === null) return groups;
    return groups
      .map((g) => ({
        ...g,
        reviews: g.reviews.filter((r) => r.rating === ratingFilter),
      }))
      .filter((g) => g.reviews.length > 0);
  }

  const filteredGroups = getFilteredGroups();

  function updateResult(index: number, updates: Partial<GeneratedResult>) {
    setResults((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  }

  const totalUnreplied = groups.reduce((sum, g) => sum + g.reviews.length, 0);
  const filteredTotalUnreplied = filteredGroups.reduce((sum, g) => sum + g.reviews.length, 0);

  if (isLoadingData) {
    return <Spinner className="py-12" />;
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">리뷰 대댓글 관리</h1>
      <p className="text-sm text-gray-500 mb-6">
        미답변 리뷰를 상품별로 확인하고, 선택하여 대댓글을 일괄 생성합니다.
      </p>

      {/* Error */}
      {(error || loadError) && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
          {error || loadError}
          {loadError && (
            <button onClick={loadData} className="ml-2 underline font-medium">
              다시 시도
            </button>
          )}
        </div>
      )}

      {/* ===== 1차: 생성 결과 검토 영역 (미답변 목록 위에 배치) ===== */}
      {results.length > 0 && (
        <div className="mb-8 border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">
              📝 1차 검토: 생성된 대댓글 ({results.length}건)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleConfirmAll}
                className="px-3 py-1.5 text-xs bg-yellow-500 text-white rounded hover:bg-yellow-600"
              >
                전체 확정
              </button>
              <button
                onClick={handlePublishAll}
                className="px-3 py-1.5 text-xs bg-green-500 text-white rounded hover:bg-green-600"
              >
                2차 반영: 전체 게시
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            각 리뷰마다 3개의 후보가 생성됩니다. 마음에 드는 후보를 선택하고 수정한 뒤, 확정 → 게시로 반영하세요.
          </p>

          <div className="space-y-3">
            {results.map((item, index) => (
              <div key={item.reply_id} className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="mb-3">
                  <span className="text-xs text-gray-500">리뷰:</span>
                  <p className="text-sm text-gray-700">&ldquo;{item.review_text}&rdquo;</p>
                  <div className="flex items-center gap-2 mt-1">
                    <SentimentBadge sentiment={item.sentiment} confidence={item.confidence} />
                    <StatusBadge status={item.status} />
                  </div>
                </div>

                {/* 3개 후보 카드 */}
                {item.candidates && item.candidates.length > 1 && !item.isEditing && item.status !== "published" && (
                  <div className="mb-3">
                    <span className="text-xs text-gray-500 font-medium">대댓글 후보 ({item.candidates.length}개) — 카드를 클릭하여 채택하세요:</span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                      {item.candidates.map((candidate, ci) => (
                        <div
                          key={ci}
                          role="button"
                          tabIndex={0}
                          onClick={() => updateResult(index, {
                            selectedCandidate: ci,
                            draft_reply: candidate,
                            editContent: candidate,
                          })}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); updateResult(index, { selectedCandidate: ci, draft_reply: candidate, editContent: candidate }); } }}
                          className={`relative flex flex-col rounded-xl shadow-sm p-4 cursor-pointer transition-all ${
                            item.selectedCandidate === ci
                              ? "border-2 border-amber-400 bg-amber-50/60 shadow-md"
                              : "border border-gray-200 bg-white hover:border-gray-300 hover:shadow"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              item.selectedCandidate === ci
                                ? "bg-amber-200 text-amber-800"
                                : "bg-gray-100 text-gray-500"
                            }`}>
                              후보 {ci + 1}
                            </span>
                            <SentimentBadge sentiment={item.sentiment} confidence={item.confidence} />
                          </div>
                          <p className="text-sm text-gray-700 flex-1 leading-relaxed mb-3">{candidate}</p>
                          <div className="flex gap-2 mt-auto">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateResult(index, {
                                  selectedCandidate: ci,
                                  draft_reply: candidate,
                                  editContent: candidate,
                                  isEditing: true,
                                });
                              }}
                              className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              수정
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateResult(index, {
                                  selectedCandidate: ci,
                                  draft_reply: candidate,
                                  editContent: candidate,
                                });
                                handleQuickPublish(index);
                              }}
                              className="flex-1 px-3 py-1.5 text-xs bg-lime-500 text-white rounded-lg hover:bg-lime-600 font-medium transition-colors"
                            >
                              바로 게시
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 채택된 대댓글 (수정 모드 또는 후보 1개일 때) */}
                {(item.isEditing || (item.candidates && item.candidates.length <= 1) || item.status === "published") && (
                <div>
                  <span className="text-xs text-gray-500">
                    {item.candidates && item.candidates.length > 1 ? "채택된 대댓글:" : "대댓글 초안:"}
                  </span>
                  {item.isEditing ? (
                    <textarea
                      value={item.editContent}
                      onChange={(e) => updateResult(index, { editContent: e.target.value })}
                      className="w-full border border-amber-300 rounded-lg p-3 text-sm min-h-[80px] mt-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-gray-700 mt-1 whitespace-pre-wrap">
                      {item.draft_reply}
                    </div>
                  )}
                </div>
                )}

                {item.status !== "published" && (
                  <div className="flex gap-2 mt-3">
                    {item.isEditing ? (
                      <>
                        <button onClick={() => handleSaveEdit(index)} className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600">저장</button>
                        <button onClick={() => updateResult(index, { isEditing: false, editContent: item.draft_reply })} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
                      </>
                    ) : (
                      <>
                        {item.candidates && item.candidates.length <= 1 && (
                          <button onClick={() => updateResult(index, { isEditing: true })} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">수정</button>
                        )}
                        <select
                          onChange={(e) => { if (e.target.value) { handleToneChange(index, e.target.value); e.target.value = ""; } }}
                          className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                          aria-label="말투 변경"
                          disabled={item.status === ("regenerating" as string)}
                        >
                          <option value="">말투 변경</option>
                          <option value="friendly">친근한 톤</option>
                          <option value="professional">전문적인 톤</option>
                          <option value="emotional">감성적인 톤</option>
                        </select>
                        <button onClick={() => handleConfirm(index)} disabled={item.status === "confirmed"} className="px-3 py-1.5 text-xs bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50">확정</button>
                        <button onClick={() => handlePublish(index)} className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600">게시</button>
                      </>
                    )}
                  </div>
                )}

                {item.status === "published" && (
                  <div className="mt-2 text-xs text-green-600 font-medium">✅ 게시 완료</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 2차: 미답변 리뷰 큐 ===== */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900">
            미답변 리뷰 ({totalUnreplied}건{ratingFilter !== null ? ` / ${ratingFilter}점 ${filteredTotalUnreplied}건` : ""})
          </h2>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              전체 선택
            </button>
            <button
              onClick={deselectAll}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              선택 해제
            </button>
          </div>
        </div>

        {/* 별점 필터 + 상단 일괄 생성 버튼 */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 font-medium mr-1">별점:</span>
            {[null, 1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating ?? "all"}
                onClick={() => setRatingFilter(rating)}
                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                  ratingFilter === rating
                    ? "bg-amber-500 text-white shadow-sm"
                    : rating !== null && rating <= 2
                      ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {rating === null ? "전체" : `${"★".repeat(rating)}${rating}`}
              </button>
            ))}
          </div>
          {selectedReviews.size > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={toneOverride}
                onChange={(e) => setToneOverride(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs"
                aria-label="말투 선택"
              >
                <option value="">기본 톤</option>
                <option value="friendly">친근한 톤</option>
                <option value="professional">전문적인 톤</option>
                <option value="emotional">감성적인 톤</option>
              </select>
              <button
                onClick={handleBatchGenerate}
                disabled={isGenerating}
                className="px-4 py-1.5 text-xs bg-lime-500 text-white rounded-lg hover:bg-lime-600 font-medium disabled:opacity-50 shadow-sm"
              >
                {isGenerating ? "생성 중..." : `선택한 ${selectedReviews.size}건 일괄 생성`}
              </button>
            </div>
          )}
        </div>

        {totalUnreplied === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">모든 리뷰에 대댓글이 작성되었습니다!</p>
          </div>
        ) : filteredTotalUnreplied === 0 ? (
          <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500">해당 별점의 미답변 리뷰가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map((group) => {
              const reviewIds = group.reviews.map((r) => r.id);
              const selectedCount = reviewIds.filter((id) => selectedReviews.has(id)).length;
              const allSelected = selectedCount === reviewIds.length;

              return (
                <div key={group.product.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* 상품 헤더 */}
                  <div
                    role="button"
                    tabIndex={0}
                    className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                    onClick={() => toggleGroup(group.product.id)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleGroup(group.product.id); } }}
                  >
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => { e.stopPropagation(); toggleProductAll(group.product.id); }}
                      className="w-4 h-4 text-amber-500 rounded border-gray-300 focus:ring-amber-400"
                      aria-label={`${group.product.name} 전체 선택`}
                    />
                    <span className="text-sm">{group.isExpanded ? "▼" : "▶"}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate block">
                        {group.product.name}
                      </span>
                    </div>
                    <span className="text-xs text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
                      {group.reviews.length}건 미답변
                    </span>
                    {selectedCount > 0 && (
                      <span className="text-xs text-blue-600 font-medium">
                        {selectedCount}건 선택
                      </span>
                    )}
                    <Link
                      href={`/shop/products/${group.product.id}`}
                      className="text-xs text-gray-400 hover:text-amber-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      상품 &rarr;
                    </Link>
                  </div>

                  {/* 리뷰 목록 */}
                  {group.isExpanded && (
                    <div className="divide-y divide-gray-100">
                      {group.reviews.map((review) => (
                        <label
                          key={review.id}
                          className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-amber-50/50 transition-colors ${
                            selectedReviews.has(review.id) ? "bg-amber-50/30" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedReviews.has(review.id)}
                            onChange={() => toggleReview(review.id)}
                            className="w-4 h-4 mt-1 text-amber-500 rounded border-gray-300 focus:ring-amber-400"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <StarRating rating={review.rating} size="text-xs" />
                              <span className="text-xs text-gray-500 font-medium">
                                {new Date(review.created_at).toLocaleDateString("ko-KR")}
                              </span>
                              <span className="text-xs text-gray-400">{review.author}</span>
                              {review.product_name && (
                                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                  {review.product_name}
                                </span>
                              )}
                              {!review.product_name && (
                                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                  {group.product.name}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-700 line-clamp-3">{review.content}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 일괄 생성 버튼 */}
        {selectedReviews.size > 0 && (
          <div className="sticky bottom-0 mt-4 bg-white border border-amber-200 rounded-lg p-4 shadow-lg">
            <div className="flex items-center gap-3 mb-3">
              <label className="text-xs text-gray-600 font-medium whitespace-nowrap">말투 선택:</label>
              <select
                value={toneOverride}
                onChange={(e) => setToneOverride(e.target.value)}
                className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm"
                aria-label="말투 선택"
              >
                <option value="">기본 (브랜드 톤)</option>
                <option value="friendly">😊 친근한 톤</option>
                <option value="professional">💼 전문적인 톤</option>
                <option value="emotional">💛 감성적인 톤</option>
              </select>
            </div>
            <button
              onClick={handleBatchGenerate}
              disabled={isGenerating}
              className="w-full py-3 bg-lime-500 text-white rounded-lg hover:bg-lime-600 font-medium text-sm disabled:opacity-50"
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  {selectedReviews.size}건 대댓글 생성 중... (후보 3개씩)
                </span>
              ) : (
                `선택한 ${selectedReviews.size}건 대댓글 일괄 생성 (후보 3개씩)`
              )}
            </button>
          </div>
        )}
      </div>

      {/* 기존 생성 결과 블록은 상단으로 이동 완료 */}
    </div>
  );
}
