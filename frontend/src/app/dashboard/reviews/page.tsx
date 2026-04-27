"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  getToneProfile,
  unpublishReply,
} from "../../../lib/api";
import { formatDate } from "../../../lib/utils";

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
  sentiment?: string;
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

// 톤 라벨 배열 (중립적 라벨)
const TONE_LABELS = ["후보 A", "후보 B", "후보 C"];

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
  // keywordFilter 제거됨 (UI에서 사용하지 않음)
  // 인라인 생성: 리뷰 ID → 생성 결과 매핑
  const [inlineResults, setInlineResults] = useState<Map<number, GeneratedResult>>(new Map());
  const [inlineLoading, setInlineLoading] = useState<Set<number>>(new Set());
  // 확장된 리뷰 카드 (클릭하여 인라인 AI 생성) — Set으로 다중 펼침 지원
  const [expandedReviewIds, setExpandedReviewIds] = useState<Set<number>>(new Set());
  // 톤 프로필 설정 여부
  const [hasToneProfile, setHasToneProfile] = useState<boolean>(true);
  // Undo 토스트
  const [undoToast, setUndoToast] = useState<{ replyId: number; reviewId: number; message: string } | null>(null);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadData();
  }, []);

  // cleanup undoTimer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
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
      // 톤 프로필 존재 여부 확인
      try {
        await getToneProfile();
        setHasToneProfile(true);
      } catch {
        setHasToneProfile(false);
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

      // 인라인 결과로 매핑
      setInlineResults((prev) => {
        const next = new Map(prev);
        newResults.forEach((result) => {
          next.set(result.review_id, result);
        });
        return next;
      });
      // 기존 results에도 추가 (일괄 관리용)
      setResults((prev) => [...newResults, ...prev]);
      // 생성된 리뷰 카드를 자동으로 펼쳐서 후보 3개 확인 가능하게
      setExpandedReviewIds((prev) => {
        const next = new Set(prev);
        newResults.forEach((r) => next.add(r.review_id));
        return next;
      });
      // 생성 완료된 리뷰는 선택 해제
      setSelectedReviews(new Set());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "일괄 생성에 실패했습니다.");
    } finally {
      setIsGenerating(false);
    }
  }

  // 개별 리뷰 클릭 시 인라인 AI 생성
  async function handleInlineGenerate(review: UnrepliedReview) {
    if (inlineLoading.has(review.id)) return;
    setInlineLoading((prev) => new Set(prev).add(review.id));
    setError("");
    try {
      const productName = groups.find((g) => g.product.id === review.product_id)?.product.name;
      const result = await generateReply({
        review_text: review.content,
        review_id: review.id,
        source: "batch",
        tone_override: toneOverride || undefined,
        product_name: productName,
      });
      const candidates = result.candidates || [result.draft_reply];
      const genResult: GeneratedResult = {
        reply_id: result.reply_id,
        review_id: review.id,
        draft_reply: candidates[0],
        candidates,
        selectedCandidate: 0,
        sentiment: result.sentiment,
        confidence: result.confidence,
        status: "draft",
        review_text: review.content,
        isEditing: false,
        editContent: candidates[0],
      };
      setInlineResults((prev) => new Map(prev).set(review.id, genResult));
      // results 배열에도 추가
      setResults((prev) => [genResult, ...prev.filter((r) => r.review_id !== review.id)]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "답변 생성에 실패했습니다.");
    } finally {
      setInlineLoading((prev) => {
        const next = new Set(prev);
        next.delete(review.id);
        return next;
      });
    }
  }

  function updateInlineResult(reviewId: number, updates: Partial<GeneratedResult>) {
    setInlineResults((prev) => {
      const next = new Map(prev);
      const existing = next.get(reviewId);
      if (existing) {
        next.set(reviewId, { ...existing, ...updates });
      }
      return next;
    });
    // results 배열도 동기화
    setResults((prev) =>
      prev.map((item) => (item.review_id === reviewId ? { ...item, ...updates } : item))
    );
  }

  async function handleInlineToneChange(reviewId: number, newTone: string) {
    const item = inlineResults.get(reviewId);
    if (!item) return;
    setError("");
    updateInlineResult(reviewId, { status: "regenerating" as string });
    try {
      const result = await generateReply({
        review_text: item.review_text,
        review_id: item.review_id,
        source: "batch",
        tone_override: newTone || undefined,
      });
      const candidates = result.candidates || [result.draft_reply];
      updateInlineResult(reviewId, {
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
      updateInlineResult(reviewId, { status: "draft" });
    }
  }

  async function handleInlineSaveEdit(reviewId: number) {
    const item = inlineResults.get(reviewId);
    if (!item) return;
    try {
      await updateAgentReply(item.reply_id, item.editContent);
      updateInlineResult(reviewId, { draft_reply: item.editContent, isEditing: false });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "수정에 실패했습니다.");
    }
  }

  async function handlePublish(index: number) {
    const item = results[index];
    try {
      // confirm 단계를 자동으로 처리 (draft → confirmed → published)
      if (item.status === "draft") {
        await confirmReply(item.reply_id);
      }
      await publishReply(item.reply_id);
      updateResult(index, { status: "published" });
      updateInlineResult(item.review_id, { status: "published" });
      window.dispatchEvent(new CustomEvent("reply-published"));
      // 게시 완료 후 미답변 목록 새로고침
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "게시에 실패했습니다.");
    }
  }

  async function handleInlineQuickPublish(reviewId: number) {
    const item = inlineResults.get(reviewId);
    if (!item) return;
    try {
      await confirmReply(item.reply_id);
      updateInlineResult(reviewId, { status: "confirmed" });
      try {
        await publishReply(item.reply_id);
      } catch {
        setError("게시에 실패했습니다. 확정 상태로 유지됩니다.");
        return;
      }
      updateInlineResult(reviewId, { status: "published" });
      window.dispatchEvent(new CustomEvent("reply-published"));
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoToast({ replyId: item.reply_id, reviewId, message: "대댓글이 게시되었습니다." });
      const timer = setTimeout(() => setUndoToast(null), 5000);
      undoTimerRef.current = timer;
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "바로 게시에 실패했습니다.");
    }
  }

  async function handlePublishAll() {
    const snapshot = results.map((r, i) => ({ ...r, _index: i }));
    for (const item of snapshot) {
      if (item.status !== "published") {
        await handlePublish(item._index);
      }
    }
  }

  const filteredGroups = useMemo(() => {
    let filtered = groups;
    if (ratingFilter !== null) {
      filtered = filtered
        .map((g) => ({
          ...g,
          reviews: g.reviews.filter((r) => r.rating === ratingFilter),
        }))
        .filter((g) => g.reviews.length > 0);
    }
    return filtered;
  }, [groups, ratingFilter]);

  function updateResult(index: number, updates: Partial<GeneratedResult>) {
    setResults((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  }

  const totalUnreplied = groups.reduce((sum, g) => sum + g.reviews.length, 0);
  const filteredTotalUnreplied = filteredGroups.reduce((sum, g) => sum + g.reviews.length, 0);

  // 요약 통계
  const allReviews = useMemo(() => groups.flatMap((g) => g.reviews), [groups]);
  const positiveCount = useMemo(() => allReviews.filter((r) => r.rating >= 4).length, [allReviews]);
  const negativeCount = useMemo(() => allReviews.filter((r) => r.rating <= 2).length, [allReviews]);
  const inquiryCount = useMemo(() => allReviews.filter((r) => r.rating === 3).length, [allReviews]);
  const urgentCount = negativeCount; // 1-2점 = 긴급 대응 (동일 조건)
  // keywords 제거됨 (UI에서 사용하지 않음)

  if (isLoadingData) {
    return <Spinner className="py-12" />;
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">리뷰 AI 비서</h1>
      <p className="text-sm text-gray-500 mb-6">
        미답변 리뷰를 분석하고, AI가 추천하는 답변을 검토하여 원클릭으로 게시합니다.
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

      {/* 톤 미설정 배너 */}
      {!hasToneProfile && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm p-4 rounded-lg mb-4 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
          <div>
            <p className="font-medium">브랜드 톤이 설정되지 않았습니다.</p>
            <p className="text-xs text-amber-600 mt-0.5">먼저 톤을 설정해야 브랜드에 맞는 대댓글을 생성할 수 있어요.</p>
            <Link href="/dashboard/tone" className="text-xs font-bold text-amber-700 hover:text-amber-900 mt-1.5 inline-block underline underline-offset-2">
              톤 설정하러 가기 &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* ===== 상단 대시보드 요약 ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {/* 총 미답변 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"/></svg>
            <span className="text-xs text-gray-500 font-medium">총 미답변</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalUnreplied}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
        {/* 긍정 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941"/></svg>
            <span className="text-xs text-gray-500 font-medium">긍정 리뷰</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{positiveCount}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
        {/* 부정 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6L9 12.75l4.286-4.286a11.948 11.948 0 014.306 6.43l.776 2.898m0 0l3.182-5.511m-3.182 5.51l-5.511-3.181"/></svg>
            <span className="text-xs text-gray-500 font-medium">부정 리뷰</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{negativeCount}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
        {/* 긴급 대응 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
            <span className="text-xs text-gray-500 font-medium">긴급 대응</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{urgentCount}<span className="text-sm font-normal text-gray-400 ml-1">건</span></p>
        </div>
      </div>

      {/* 감성 분포 바 */}
      {totalUnreplied > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-gray-500 font-medium">감성 분포</span>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-100" role="img" aria-label={`감성 분포: 긍정 ${positiveCount}건, 중립(3점) ${inquiryCount}건, 부정 ${negativeCount}건`}>
            {positiveCount > 0 && (
              <div
                className="bg-green-400 transition-all"
                style={{ width: `${(positiveCount / totalUnreplied) * 100}%` }}
                role="presentation"
                title={`긍정 ${positiveCount}건`}
              />
            )}
            {inquiryCount > 0 && (
              <div
                className="bg-amber-400 transition-all"
                style={{ width: `${(inquiryCount / totalUnreplied) * 100}%` }}
                role="presentation"
                title={`중립(3점) ${inquiryCount}건`}
              />
            )}
            {negativeCount > 0 && (
              <div
                className="bg-red-400 transition-all"
                style={{ width: `${(negativeCount / totalUnreplied) * 100}%` }}
                role="presentation"
                title={`부정 ${negativeCount}건`}
              />
            )}
          </div>
          <div className="flex items-center gap-4 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> 긍정 {positiveCount}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> 중립(3점) {inquiryCount}
            </span>
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> 부정 {negativeCount}
            </span>
          </div>
        </div>
      )}

      {/* 통계 / 미답변 리뷰 구분선 */}
      <div className="border-t border-gray-200 my-6" />

      {/* ===== 1차: 생성 결과 검토 영역 (일괄 생성 결과, 인라인 결과와 별도) ===== */}
      {results.filter((r) => r.status === "published").length > 0 && (
        <div className="mb-6 border border-green-200 rounded-lg p-4 bg-green-50/50">
          <h2 className="text-sm font-bold text-green-700 mb-2">
            게시 완료 ({results.filter((r) => r.status === "published").length}건)
          </h2>
          <div className="space-y-1">
            {results.filter((r) => r.status === "published").map((item) => (
              <div key={item.reply_id} className="text-xs text-green-600 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                <span className="truncate">{item.review_text.length > 50 ? item.review_text.slice(0, 50) + "..." : item.review_text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 일괄 관리 바 */}
      {results.filter((r) => r.status !== "published").length > 0 && (
        <div className="mb-4 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium text-amber-800">
            생성된 답변 {results.filter((r) => r.status !== "published").length}건 검토 대기
          </span>
          <div className="flex gap-2">
            <button
              onClick={handlePublishAll}
              className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
            >
              전체 게시
            </button>
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
                disabled={isGenerating || !hasToneProfile}
                title={!hasToneProfile ? "브랜드 톤을 먼저 설정해주세요" : undefined}
                aria-label={`선택한 ${selectedReviews.size}건 리뷰에 대해 대댓글 일괄 생성`}
                className="px-4 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
            <p className="text-gray-500">해당 조건의 미답변 리뷰가 없습니다.</p>
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
                      {group.reviews.map((review) => {
                        const inlineResult = inlineResults.get(review.id);
                        const isExpanded = expandedReviewIds.has(review.id);
                        const isInlineLoading = inlineLoading.has(review.id);

                        return (
                          <div key={review.id}>
                            <div
                              className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-amber-50/50 transition-colors ${
                                selectedReviews.has(review.id) ? "bg-amber-50/30" : ""
                              } ${isExpanded ? "bg-amber-50/40" : ""}`}
                            >
                              <input
                                type="checkbox"
                                checked={selectedReviews.has(review.id)}
                                onChange={() => toggleReview(review.id)}
                                className="w-4 h-4 mt-1 text-amber-500 rounded border-gray-300 focus:ring-amber-400"
                                aria-label={`${review.author}의 리뷰 선택`}
                              />
                              <div
                                className="flex-1 min-w-0"
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setExpandedReviewIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(review.id)) {
                                      next.delete(review.id);
                                    } else {
                                      next.add(review.id);
                                      // 아직 인라인 결과가 없으면 자동 생성 (톤 프로필 있을 때만)
                                      if (!inlineResults.has(review.id) && hasToneProfile) {
                                        handleInlineGenerate(review);
                                      }
                                    }
                                    return next;
                                  });
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setExpandedReviewIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(review.id)) {
                                        next.delete(review.id);
                                      } else {
                                        next.add(review.id);
                                        if (!inlineResults.has(review.id) && hasToneProfile) {
                                          handleInlineGenerate(review);
                                        }
                                      }
                                      return next;
                                    });
                                  }
                                }}
                              >
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <StarRating rating={review.rating} size="text-xs" />
                                  {/* 긴급/주의 배지 */}
                                  {review.rating <= 2 && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full uppercase tracking-wide">
                                      긴급
                                    </span>
                                  )}
                                  {review.rating === 3 && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full uppercase tracking-wide">
                                      주의
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-500 font-medium">
                                    {formatDate(review.created_at)}
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
                                {!isExpanded && !inlineResult && (
                                  <span className="text-xs text-amber-500 mt-1 inline-block">
                                    클릭하여 AI 답변 생성 &rarr;
                                  </span>
                                )}
                                {inlineResult && !isExpanded && inlineResult.status !== "published" && (
                                  <span className="text-xs text-amber-600 mt-1 inline-block font-medium">
                                    AI 답변 생성됨 - 클릭하여 확인 &rarr;
                                  </span>
                                )}
                                {inlineResult && inlineResult.status === "published" && (
                                  <span className="text-xs text-green-600 mt-1 inline-flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                    게시 완료
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 인라인 AI 답변 영역 */}
                            {isExpanded && (
                              <div className="px-4 py-4 bg-gray-50/80 border-t border-gray-100">
                                {!hasToneProfile && !inlineResult && (
                                  <div className="text-center py-6">
                                    <p className="text-sm text-amber-700 font-medium mb-1">톤 설정이 필요합니다</p>
                                    <p className="text-xs text-gray-500 mb-3">브랜드 톤을 먼저 설정해야 AI 대댓글을 생성할 수 있어요.</p>
                                    <Link href="/dashboard/tone" className="px-4 py-2 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium inline-block">
                                      톤 설정하러 가기 &rarr;
                                    </Link>
                                  </div>
                                )}

                                {isInlineLoading && !inlineResult && (
                                  <div className="flex items-center gap-3 py-6 justify-center">
                                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-500" />
                                    <span className="text-sm text-gray-500">AI가 3개 후보를 생성하고 있습니다...</span>
                                  </div>
                                )}

                                {inlineResult && inlineResult.status !== "published" && (
                                  <div>
                                    <div className="flex items-center justify-between mb-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-gray-600">AI 추천 답변</span>
                                        <SentimentBadge sentiment={inlineResult.sentiment} confidence={inlineResult.confidence} />
                                        <StatusBadge status={inlineResult.status} />
                                      </div>
                                      <select
                                        onChange={(e) => { if (e.target.value) { handleInlineToneChange(review.id, e.target.value); } }}
                                        className="px-2 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                                        aria-label="말투 변경"
                                        disabled={inlineResult.status === ("regenerating" as string)}
                                      >
                                        <option value="">말투 변경</option>
                                        <option value="friendly">친근한 톤</option>
                                        <option value="professional">전문적인 톤</option>
                                        <option value="emotional">감성적인 톤</option>
                                      </select>
                                    </div>

                                    {/* 3개 후보 가로 슬라이드 카드 */}
                                    {inlineResult.candidates && inlineResult.candidates.length > 1 && !inlineResult.isEditing && (
                                      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                                        {inlineResult.candidates.map((candidate, ci) => (
                                          <div
                                            key={ci}
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => updateInlineResult(review.id, {
                                              selectedCandidate: ci,
                                              draft_reply: candidate,
                                              editContent: candidate,
                                            })}
                                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); updateInlineResult(review.id, { selectedCandidate: ci, draft_reply: candidate, editContent: candidate }); } }}
                                            className={`flex-shrink-0 w-[280px] snap-start flex flex-col rounded-xl p-4 cursor-pointer transition-all ${
                                              inlineResult.selectedCandidate === ci
                                                ? "border-2 border-amber-400 bg-amber-50/60 shadow-md"
                                                : "border border-gray-200 bg-white hover:border-gray-300 hover:shadow"
                                            }`}
                                          >
                                            <div className="flex items-center justify-between mb-2">
                                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                                inlineResult.selectedCandidate === ci
                                                  ? "bg-amber-200 text-amber-800"
                                                  : "bg-gray-100 text-gray-500"
                                              }`}>
                                                {TONE_LABELS[ci] || `후보 ${ci + 1}`}
                                              </span>
                                              {inlineResult.selectedCandidate === ci && (
                                                <span className="text-xs text-amber-600 font-medium">선택됨</span>
                                              )}
                                            </div>
                                            <p className="text-sm text-gray-700 flex-1 leading-relaxed mb-3 line-clamp-4">{candidate}</p>
                                            <div className="flex gap-2 mt-auto">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  updateInlineResult(review.id, {
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
                                                  updateInlineResult(review.id, {
                                                    selectedCandidate: ci,
                                                    draft_reply: candidate,
                                                    editContent: candidate,
                                                  });
                                                  handleInlineQuickPublish(review.id);
                                                }}
                                                className="flex-1 px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium transition-colors"
                                              >
                                                바로 등록
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {/* 수정 모드 또는 후보 1개 */}
                                    {(inlineResult.isEditing || (inlineResult.candidates && inlineResult.candidates.length <= 1)) && (
                                      <div className="mt-2">
                                        {inlineResult.isEditing ? (
                                          <textarea
                                            value={inlineResult.editContent}
                                            onChange={(e) => updateInlineResult(review.id, { editContent: e.target.value })}
                                            className="w-full border border-amber-300 rounded-lg p-3 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                                          />
                                        ) : (
                                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap">
                                            {inlineResult.draft_reply}
                                          </div>
                                        )}
                                        <div className="flex gap-2 mt-2">
                                          {inlineResult.isEditing ? (
                                            <>
                                              <button onClick={() => handleInlineSaveEdit(review.id)} className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600">저장</button>
                                              <button onClick={() => updateInlineResult(review.id, { isEditing: false, editContent: inlineResult.draft_reply })} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">취소</button>
                                            </>
                                          ) : (
                                            <>
                                              <button onClick={() => updateInlineResult(review.id, { isEditing: true })} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">수정</button>
                                              <button onClick={() => handleInlineQuickPublish(review.id)} className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium">바로 등록</button>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {inlineResult && inlineResult.status === "published" && (
                                  <div className="text-center py-4">
                                    <span className="text-sm text-green-600 font-medium flex items-center justify-center gap-1">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                                      게시 완료
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 일괄 생성 버튼 (하단 스티키) */}
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
                <option value="friendly">친근한 톤</option>
                <option value="professional">전문적인 톤</option>
                <option value="emotional">감성적인 톤</option>
              </select>
            </div>
            <button
              onClick={handleBatchGenerate}
              disabled={isGenerating || !hasToneProfile}
              title={!hasToneProfile ? "브랜드 톤을 먼저 설정해주세요" : undefined}
              aria-label={`선택한 ${selectedReviews.size}건 리뷰에 대해 대댓글 일괄 생성`}
              className="w-full py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Undo 토스트 */}
      {undoToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-4 z-[9999] animate-fade-in">
          <span className="text-sm">{undoToast.message}</span>
          <button
            onClick={async () => {
              try {
                await unpublishReply(undoToast.replyId);
                updateInlineResult(undoToast.reviewId, { status: "draft" });
                setUndoToast(null);
                if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
                await loadData();
              } catch {
                setError("실행 취소에 실패했습니다.");
              }
            }}
            className="text-amber-400 hover:text-amber-300 text-sm font-semibold whitespace-nowrap"
          >
            실행 취소
          </button>
          <button onClick={() => { setUndoToast(null); if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
