"use client";

import { useState, useEffect } from "react";
import StatusBadge from "../../../components/StatusBadge";
import SentimentBadge from "../../../components/SentimentBadge";
import Spinner from "../../../components/Spinner";
import { getHistory, getHistoryDetail } from "../../../lib/api";
import { formatDate } from "../../../lib/utils";
import type { HistoryItem, HistoryDetail } from "../../../lib/types";

const ACTION_LABELS: Record<string, string> = {
  created: "생성",
  edited: "수정",
  confirmed: "확정",
  published: "게시 완료",
};

const SOURCE_LABELS: Record<string, { text: string; color: string }> = {
  single: { text: "개별", color: "bg-blue-100 text-blue-700" },
  batch: { text: "일괄", color: "bg-purple-100 text-purple-700" },
  fab: { text: "FAB", color: "bg-green-100 text-green-700" },
};

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function loadHistory() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getHistory(statusFilter || undefined);
      setItems(data.history || []);
    } catch (err) {
      console.error("Failed to load history:", err);
      setError("데이터를 불러올 수 없습니다. 다시 시도해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSelect(id: number) {
    if (selectedId === id) {
      setSelectedId(null);
      setDetail(null);
      return;
    }
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const data = await getHistoryDetail(id);
      setDetail(data);
    } catch (err) {
      console.error("Failed to load detail:", err);
    } finally {
      setDetailLoading(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">대댓글 히스토리</h1>
      <p className="text-sm text-gray-500 mb-6">
        생성/수정/확정/게시된 대댓글 이력을 확인할 수 있습니다.
      </p>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          aria-label="상태 필터"
        >
          <option value="">전체</option>
          <option value="draft">Draft</option>
          <option value="confirmed">Confirmed</option>
          <option value="published">Published</option>
        </select>
      </div>

      {isLoading ? (
        <Spinner className="py-12" />
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadHistory}
            className="px-4 py-2 bg-lime-500 text-white rounded-lg hover:bg-lime-600 text-sm"
          >
            다시 시도
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          아직 생성된 대댓글이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(item.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(item.id);
                  }
                }}
                className={`border rounded-lg p-4 bg-white cursor-pointer transition-colors ${
                  selectedId === item.id
                    ? "border-lime-400 shadow-sm"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-400">
                        {formatDate(item.created_at)}
                      </span>
                      {item.sentiment && <SentimentBadge sentiment={item.sentiment} />}
                      <StatusBadge status={item.status} />
                      {item.source && SOURCE_LABELS[item.source] && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${SOURCE_LABELS[item.source].color}`}>
                          {SOURCE_LABELS[item.source].text}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      &ldquo;{item.review_summary}&rdquo; → &ldquo;{item.reply_text}&rdquo;
                    </p>
                  </div>
                  <span className="text-gray-400 ml-2">
                    {selectedId === item.id ? "▲" : "▼"}
                  </span>
                </div>
              </div>

              {/* Detail */}
              {selectedId === item.id && (
                <div className="border border-t-0 border-lime-200 rounded-b-lg p-4 bg-lime-50/50">
                  {detailLoading ? (
                    <Spinner size="h-5 w-5" className="py-4" />
                  ) : detail ? (
                    <div className="space-y-3">
                      {detail.review && (
                        <div>
                          <span className="text-xs font-medium text-gray-500">리뷰 원문:</span>
                          <p className="text-sm text-gray-700 mt-0.5">
                            {detail.review.content}
                          </p>
                        </div>
                      )}
                      {detail.reply && (
                        <div>
                          <span className="text-xs font-medium text-gray-500">
                            감성: {detail.reply.sentiment || "-"}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-medium text-gray-500">최종 대댓글:</span>
                        <p className="text-sm text-gray-700 bg-white p-2 rounded mt-0.5">
                          {detail.reply?.content}
                        </p>
                      </div>
                      {detail.history.length > 0 && (
                        <div>
                          <span className="text-xs font-medium text-gray-500">수정 이력:</span>
                          <div className="mt-1 space-y-1">
                            {detail.history.map((h) => (
                              <div key={h.id} className="flex items-start gap-2 text-xs">
                                <span className="text-gray-400 whitespace-nowrap">
                                  {new Date(h.created_at).toLocaleString("ko-KR", {
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <span className="text-gray-600">
                                  {ACTION_LABELS[h.action] || h.action}
                                  {h.action === "edited" && h.content_snapshot && (
                                    <span className="text-gray-400 ml-1">
                                      — &ldquo;{h.content_snapshot.length > 30 ? h.content_snapshot.slice(0, 30) + "..." : h.content_snapshot}&rdquo;
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
