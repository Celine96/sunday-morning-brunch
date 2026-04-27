"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import SentimentBadge from "./SentimentBadge";
import StarRating from "./StarRating";
import {
  getUnrepliedReviews,
  generateReply,
  updateAgentReply,
  confirmReply,
  publishReply,
  getToneProfile,
} from "../lib/api";

// NOTE: Generate/publish/tone logic is duplicated with dashboard/reviews/page.tsx
// TODO: Extract shared useReplyGeneration hook for deduplication

interface UnrepliedReview {
  id: number;
  product_id: number;
  author: string;
  rating: number;
  content: string;
  sentiment?: string;
  created_at: string;
}

interface GeneratedReply {
  reply_id: number;
  draft_reply: string;
  candidates: string[];
  selectedCandidate: number;
  sentiment: string;
  confidence: number;
  status: string;
}

type FABReview = UnrepliedReview;

export default function FABMiniPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [reviews, setReviews] = useState<FABReview[]>([]);
  const [selectedReview, setSelectedReview] = useState<FABReview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generatedReply, setGeneratedReply] = useState<GeneratedReply | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [toneOverride, setToneOverride] = useState<string>("");
  const [error, setError] = useState("");
  const [unrepliedCount, setUnrepliedCount] = useState(0);
  const [hasToneProfile, setHasToneProfile] = useState<boolean>(true);
  const pathname = usePathname();
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  // Extract product ID from pathname
  const productIdMatch = pathname.match(/\/shop\/products\/(\d+)/);
  const currentProductId = productIdMatch ? parseInt(productIdMatch[1]) : undefined;

  useEffect(() => {
    loadUnrepliedReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProductId]);

  async function loadUnrepliedReviews() {
    setLoadError(null);
    try {
      const [reviewsResult, toneResult] = await Promise.allSettled([
        getUnrepliedReviews(currentProductId),
        getToneProfile(),
      ]);
      if (reviewsResult.status === "fulfilled") {
        setReviews(reviewsResult.value.reviews || []);
        setUnrepliedCount(reviewsResult.value.reviews?.length || 0);
      } else {
        setLoadError("데이터를 불러올 수 없습니다. 다시 시도해주세요.");
        setReviews([]);
        setUnrepliedCount(0);
      }
      setHasToneProfile(toneResult.status === "fulfilled");
    } catch (err) {
      console.error("Failed to load:", err);
      setLoadError("데이터를 불러올 수 없습니다. 다시 시도해주세요.");
      setReviews([]);
      setUnrepliedCount(0);
    }
  }

  async function handleGenerate(review: FABReview) {
    setIsLoading(true);
    setError("");
    try {
      const result = await generateReply({
        review_text: review.content,
        rating: review.rating,
        review_id: review.id,
        source: "fab",
        tone_override: toneOverride || undefined,
      });
      const candidates = result.candidates || [result.draft_reply];
      setGeneratedReply({
        reply_id: result.reply_id,
        draft_reply: candidates[0],
        candidates,
        selectedCandidate: 0,
        sentiment: result.sentiment,
        confidence: result.confidence,
        status: "draft",
      });
      setEditContent(candidates[0]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "대댓글 생성에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToneChange(newTone: string) {
    if (!generatedReply || !selectedReview) return;
    setIsLoading(true);
    setError("");
    try {
      const result = await generateReply({
        review_text: selectedReview.content,
        rating: selectedReview.rating,
        review_id: selectedReview.id,
        source: "fab",
        tone_override: newTone || undefined,
      });
      const candidates = result.candidates || [result.draft_reply];
      setGeneratedReply({
        reply_id: result.reply_id,
        draft_reply: candidates[0],
        candidates,
        selectedCandidate: 0,
        sentiment: result.sentiment,
        confidence: result.confidence,
        status: "draft",
      });
      setEditContent(candidates[0]);
      setIsEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "말투 변경에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveEdit() {
    if (!generatedReply) return;
    try {
      await updateAgentReply(generatedReply.reply_id, editContent);
      setGeneratedReply({ ...generatedReply, draft_reply: editContent });
      setIsEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "수정에 실패했습니다.");
    }
  }

  async function handlePublish(overrideReplyId?: number) {
    const replyId = overrideReplyId ?? generatedReply?.reply_id;
    if (!replyId || !generatedReply) return;
    setIsLoading(true);
    try {
      // confirm 단계를 자동으로 처리
      if (generatedReply.status === "draft") {
        await confirmReply(replyId);
      }
      await publishReply(replyId);
      setGeneratedReply({ ...generatedReply, status: "published" });
      // Refresh unreplied reviews
      await loadUnrepliedReviews();
      // 상품 페이지에 대댓글 게시 알림 → 자동 새로고침
      window.dispatchEvent(new CustomEvent("reply-published"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "게시에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleBack() {
    setSelectedReview(null);
    setGeneratedReply(null);
    setEditContent("");
    setError("");
    setIsEditing(false);
    loadUnrepliedReviews();
  }

  // Only show on /shop pages
  if (!pathname.startsWith("/shop")) return null;

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 z-[9999]"
        aria-label="리뷰 대댓글 에이전트"
      >
        <span className="text-2xl">💬</span>
        {unrepliedCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
            {unrepliedCount > 99 ? "99+" : unrepliedCount}
          </span>
        )}
      </button>

      {/* Mini Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[360px] h-[500px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-[9999] overflow-hidden" onKeyDown={(e) => { if (e.key === "Escape") setIsOpen(false); }}>
          {/* Header */}
          <div className="bg-amber-500 text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            {selectedReview ? (
              <button onClick={handleBack} className="flex items-center gap-1 text-sm hover:opacity-80" aria-label="리뷰 목록으로 돌아가기">
                ← 리뷰 목록
              </button>
            ) : (
              <span className="font-semibold text-sm">리뷰 대댓글 에이전트</span>
            )}
            <button autoFocus onClick={() => setIsOpen(false)} className="text-white hover:opacity-80 text-lg" aria-label="패널 닫기">
              ×
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-3">
            {!selectedReview ? (
              /* Review List View */
              <div>
                <p className="text-xs text-gray-500 mb-3">
                  대댓글 미작성 리뷰 ({reviews.length}건)
                </p>
                {loadError ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-500 mb-3">{loadError}</p>
                    <button
                      onClick={loadUnrepliedReviews}
                      className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded hover:bg-amber-600"
                    >
                      다시 시도
                    </button>
                  </div>
                ) : reviews.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    모든 리뷰에 대댓글이 작성되었습니다.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {reviews.slice(0, 20).map((review) => (
                      <div
                        key={review.id}
                        role="button"
                        tabIndex={0}
                        className="border border-gray-200 rounded-lg p-3 hover:border-amber-300 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedReview(review);
                          setGeneratedReply(null);
                          setEditContent("");
                          setError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedReview(review);
                            setGeneratedReply(null);
                            setEditContent("");
                            setError("");
                          }
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-700">{review.author}</span>
                          <StarRating rating={review.rating} size="text-xs" />
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2">{review.content}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            className={`text-xs font-medium ${hasToneProfile ? "text-amber-600 hover:text-amber-700" : "text-gray-400 cursor-not-allowed"}`}
                            disabled={!hasToneProfile}
                            title={!hasToneProfile ? "브랜드 톤을 먼저 설정해주세요" : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!hasToneProfile) return;
                              setSelectedReview(review);
                              handleGenerate(review);
                            }}
                          >
                            [대댓글 생성]
                          </button>
                          <Link
                            href={`/shop/products/${review.product_id}`}
                            className="text-xs text-gray-400 hover:text-amber-600"
                            onClick={(e) => e.stopPropagation()}
                          >
                            상품 보기 →
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Reply Generation View */
              <div>
                {/* Review Original */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-gray-500">리뷰 원문:</p>
                    <Link
                      href={`/shop/products/${selectedReview.product_id}`}
                      className="text-xs text-amber-600 hover:text-amber-700"
                    >
                      상품 페이지 →
                    </Link>
                  </div>
                  <div className="bg-gray-50 rounded p-2 text-sm text-gray-700">
                    &ldquo;{selectedReview.content}&rdquo;
                  </div>
                  {generatedReply && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">감성:</span>
                      <SentimentBadge
                        sentiment={generatedReply.sentiment}
                        confidence={generatedReply.confidence}
                      />
                    </div>
                  )}
                </div>

                {/* Loading */}
                {isLoading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-500" />
                    <span className="ml-2 text-sm text-gray-500">생성 중...</span>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="bg-red-50 text-red-600 text-xs p-2 rounded mb-2">
                    {error}
                  </div>
                )}

                {/* Tone selector */}
                {!generatedReply && !isLoading && (
                  <div className="mb-2">
                    <select
                      value={toneOverride}
                      onChange={(e) => setToneOverride(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
                      aria-label="말투 선택"
                    >
                      <option value="">기본 (브랜드 톤)</option>
                      <option value="friendly">😊 친근한 톤</option>
                      <option value="professional">💼 전문적인 톤</option>
                      <option value="emotional">💛 감성적인 톤</option>
                    </select>
                  </div>
                )}

                {/* Generate Button (if not generated yet) */}
                {!generatedReply && !isLoading && (
                  hasToneProfile ? (
                    <button
                      onClick={() => handleGenerate(selectedReview)}
                      className="w-full py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 text-sm font-medium"
                    >
                      대댓글 생성
                    </button>
                  ) : (
                    <div className="text-center py-3">
                      <p className="text-xs text-amber-700 font-medium mb-1">톤 설정이 필요합니다</p>
                      <p className="text-[10px] text-gray-500 mb-2">브랜드 톤을 먼저 설정해야 AI 대댓글을 생성할 수 있어요.</p>
                      <Link
                        href="/dashboard/tone"
                        className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-medium inline-block"
                      >
                        톤 설정하러 가기 &rarr;
                      </Link>
                    </div>
                  )
                )}

                {/* Generated Reply */}
                {generatedReply && !isLoading && (
                  <div>
                    {/* 3개 후보 카드 */}
                    {generatedReply.candidates && generatedReply.candidates.length > 1 && !isEditing && generatedReply.status !== "published" && (
                      <div className="mb-2 space-y-2">
                        {generatedReply.candidates.map((c, ci) => {
                          const LABELS = ["후보 A", "후보 B", "후보 C"];
                          return (
                            <div
                              key={ci}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setGeneratedReply({
                                  ...generatedReply,
                                  selectedCandidate: ci,
                                  draft_reply: c,
                                });
                                setEditContent(c);
                              }}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setGeneratedReply({ ...generatedReply, selectedCandidate: ci, draft_reply: c }); setEditContent(c); } }}
                              className={`rounded-lg p-3 cursor-pointer transition-all ${
                                generatedReply.selectedCandidate === ci
                                  ? "border-2 border-amber-400 bg-amber-50/60 shadow-sm"
                                  : "border border-gray-200 bg-white hover:border-gray-300"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  generatedReply.selectedCandidate === ci
                                    ? "bg-amber-200 text-amber-800"
                                    : "bg-gray-100 text-gray-500"
                                }`}>
                                  {LABELS[ci] || `후보 ${ci + 1}`}
                                </span>
                                {generatedReply.selectedCandidate === ci && (
                                  <span className="text-[10px] text-amber-600 font-medium">선택됨</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-700 line-clamp-3 mb-2">{c}</p>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGeneratedReply({ ...generatedReply, selectedCandidate: ci, draft_reply: c });
                                    setEditContent(c);
                                    setIsEditing(true);
                                  }}
                                  className="flex-1 px-2 py-1 text-[10px] border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                                >
                                  수정
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    // Update server with selected candidate content first
                                    try {
                                      await updateAgentReply(generatedReply.reply_id, c);
                                    } catch { setError("후보 저장에 실패했습니다."); return; }
                                    setGeneratedReply({ ...generatedReply, selectedCandidate: ci, draft_reply: c });
                                    setEditContent(c);
                                    handlePublish(generatedReply.reply_id);
                                  }}
                                  className="flex-1 px-2 py-1 text-[10px] bg-amber-500 text-white rounded hover:bg-amber-600 font-medium transition-colors"
                                >
                                  바로 등록
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mb-1 font-medium">
                      ─── 채택된 대댓글 ───
                    </p>
                    {isEditing ? (
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full border border-amber-300 rounded p-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    ) : (
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 text-sm text-gray-700 whitespace-pre-wrap">
                        {generatedReply.draft_reply}
                      </div>
                    )}

                    {/* Status */}
                    {generatedReply.status === "published" && (
                      <div className="mt-2 bg-green-50 text-green-700 text-xs p-2 rounded text-center font-medium">
                        게시 완료
                      </div>
                    )}

                    {/* Action Buttons */}
                    {generatedReply.status !== "published" && (
                      <div className="flex gap-1.5 mt-3 flex-wrap">
                        <select
                          onChange={(e) => { if (e.target.value) { handleToneChange(e.target.value); } }}
                          className="px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                          aria-label="말투 변경"
                          disabled={isLoading}
                        >
                          <option value="">🔄 말투 변경</option>
                          <option value="friendly">😊 친근한</option>
                          <option value="professional">💼 전문적인</option>
                          <option value="emotional">💛 감성적인</option>
                        </select>
                        {isEditing ? (
                          <button
                            onClick={handleSaveEdit}
                            className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            저장
                          </button>
                        ) : (
                          <button
                            onClick={() => setIsEditing(true)}
                            className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
                          >
                            수정
                          </button>
                        )}
                        <button
                          onClick={() => handlePublish()}
                          className="px-3 py-1.5 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 font-medium"
                          disabled={isLoading}
                        >
                          바로 등록
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-4 py-2 flex-shrink-0">
            <Link
              href="/dashboard/reviews"
              className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
            >
              📊 대시보드로 이동 →
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
