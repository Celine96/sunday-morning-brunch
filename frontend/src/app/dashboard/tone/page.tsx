"use client";

import { useState, useEffect } from "react";
import { getToneProfile, createToneProfile } from "../../../lib/api";

const PRESET_KEYWORDS = [
  "친근한", "감사하는", "전문적인", "유머러스한", "공감하는",
  "진심어린", "따뜻한", "편안한", "여유로운", "감성적인",
];

interface PreviewReply {
  review: string;
  sentiment: string;
  reply: string;
}

// 정적 프리뷰 템플릿: 키워드 조합에 따라 예시 문구 생성
function generateStaticPreview(brandName: string, keywords: string[]): PreviewReply[] {
  const keywordStr = keywords.slice(0, 3).join(", ");
  const tone = keywords.length > 0 ? keywords[0] : "친절한";

  return [
    {
      review: "색상이 사진과 똑같고, 소재도 부드러워서 너무 만족합니다!",
      sentiment: "긍정",
      reply: `고객님, ${brandName}을 찾아주셔서 정말 감사합니다! ${tone} 마음을 담아 정성껏 준비한 제품인데, 만족하셨다니 저희도 기분이 좋습니다. 앞으로도 좋은 제품으로 보답하겠습니다. [${keywordStr}]`,
    },
    {
      review: "배송은 빨랐는데 사이즈가 생각보다 작아요. 교환 가능한가요?",
      sentiment: "부정",
      reply: `고객님, 불편을 드려 죄송합니다. 사이즈 관련하여 ${tone} 안내 도와드리겠습니다. 교환은 수령 후 7일 이내 가능하며, ${brandName} 고객센터로 연락주시면 빠르게 처리해드리겠습니다. [${keywordStr}]`,
    },
    {
      review: "이 제품 세탁 방법이 궁금해요. 드라이클리닝만 가능한가요?",
      sentiment: "문의",
      reply: `고객님, ${brandName}입니다! 세탁 관련 문의 감사합니다. 해당 제품은 손세탁 또는 드라이클리닝 모두 가능합니다. ${tone} 답변이 도움이 되셨길 바라며, 추가 문의 사항이 있으시면 편하게 말씀해주세요. [${keywordStr}]`,
    },
  ];
}

export default function ToneSettingsPage() {
  const [brandName, setBrandName] = useState("Sunday Morning Brunch");
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(["편안한", "여유로운", "따뜻한", "진심어린"]);
  const [customKeyword, setCustomKeyword] = useState("");
  const [sampleReplies, setSampleReplies] = useState<string[]>([""]);
  const [previewReplies, setPreviewReplies] = useState<PreviewReply[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 실시간 정적 프리뷰
  const staticPreview = generateStaticPreview(brandName, selectedKeywords);

  useEffect(() => {
    loadExistingProfile();
  }, []);

  async function loadExistingProfile() {
    try {
      const profile = await getToneProfile();
      setBrandName(profile.brand_name);
      setSelectedKeywords(profile.keywords);
      if (profile.sample_replies && profile.sample_replies.length > 0) {
        setSampleReplies(profile.sample_replies);
      }
    } catch {
      // No existing profile, use defaults
    }
  }

  function toggleKeyword(keyword: string) {
    setSelectedKeywords((prev) =>
      prev.includes(keyword)
        ? prev.filter((k) => k !== keyword)
        : [...prev, keyword]
    );
  }

  function addCustomKeyword() {
    const trimmed = customKeyword.trim();
    if (trimmed && !selectedKeywords.includes(trimmed)) {
      setSelectedKeywords((prev) => [...prev, trimmed]);
      setCustomKeyword("");
    }
  }

  function addSampleReply() {
    setSampleReplies((prev) => [...prev, ""]);
  }

  function updateSampleReply(index: number, value: string) {
    setSampleReplies((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function removeSampleReply(index: number) {
    setSampleReplies((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCreateProfile() {
    if (!brandName.trim()) {
      setError("브랜드명을 입력해주세요.");
      return;
    }
    if (selectedKeywords.length < 1) {
      setError("톤 키워드를 최소 1개 이상 선택해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await createToneProfile({
        brand_name: brandName.trim(),
        keywords: selectedKeywords,
        sample_replies: sampleReplies.filter((s) => s.trim()),
      });
      setPreviewReplies(result.preview_replies || []);
      setSuccess("톤 프로필이 생성되었습니다.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "톤 프로필 생성에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    setIsSaving(true);
    setError("");
    try {
      await createToneProfile({
        brand_name: brandName.trim(),
        keywords: selectedKeywords,
        sample_replies: sampleReplies.filter((s) => s.trim()),
      });
      setSuccess("톤 프로필이 저장되었습니다.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  const SENTIMENT_COLORS: Record<string, string> = {
    "긍정": "border-green-200 bg-green-50",
    "부정": "border-red-200 bg-red-50",
    "문의": "border-amber-200 bg-amber-50",
  };

  const SENTIMENT_LABEL_COLORS: Record<string, string> = {
    "긍정": "bg-green-100 text-green-700",
    "부정": "bg-red-100 text-red-700",
    "문의": "bg-amber-100 text-amber-700",
  };

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">브랜드 톤 학습</h1>
      <p className="text-sm text-gray-500 mb-6">
        브랜드의 톤앤매너를 설정하면 AI가 이에 맞는 대댓글을 생성합니다. 우측 프리뷰에서 결과를 즉시 확인하세요.
      </p>

      {/* Error / Success */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-sm p-3 rounded-lg mb-4">{success}</div>
      )}

      {/* 2분할 레이아웃: 좌측 설정 / 우측 프리뷰 */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* 좌측: 설정 영역 */}
        <div className="flex-1 min-w-0">
          {/* Brand Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              브랜드명 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="예: Sunday Morning Brunch"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>

          {/* Tone Keywords */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              톤앤매너 키워드 <span className="text-red-500">*</span>
              <span className="text-xs text-gray-400 ml-1">(1개 이상 선택 또는 입력)</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_KEYWORDS.map((keyword) => (
                <button
                  key={keyword}
                  onClick={() => toggleKeyword(keyword)}
                  aria-pressed={selectedKeywords.includes(keyword)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedKeywords.includes(keyword)
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-amber-50 hover:text-amber-700"
                  }`}
                >
                  {keyword}
                  {selectedKeywords.includes(keyword) && " ×"}
                </button>
              ))}
              {/* Custom keywords */}
              {selectedKeywords
                .filter((k) => !PRESET_KEYWORDS.includes(k))
                .map((keyword) => (
                  <button
                    key={keyword}
                    onClick={() => toggleKeyword(keyword)}
                    aria-pressed={true}
                    className="px-3 py-1.5 rounded-full text-sm font-medium bg-amber-500 text-white shadow-sm"
                  >
                    {keyword} ×
                  </button>
                ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customKeyword}
                onChange={(e) => setCustomKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomKeyword()}
                placeholder="직접 입력..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                onClick={addCustomKeyword}
                className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
              >
                + 추가
              </button>
            </div>
          </div>

          {/* Sample Replies — 카드화 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              기존 대댓글 샘플
              <span className="text-xs text-gray-400 ml-1">(선택, 3~5개)</span>
            </label>
            <div className="grid grid-cols-1 gap-3">
              {/* Note: Using index as key. Sample deletion re-indexes, which may cause
                  brief textarea flash. Acceptable for demo scope. */}
              {sampleReplies.map((sample, i) => (
                <div key={i} className="relative bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-400">샘플 {i + 1}</span>
                    {sampleReplies.length > 1 && (
                      <button
                        onClick={() => removeSampleReply(i)}
                        className="text-gray-400 hover:text-red-500 text-xs px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <textarea
                    value={sample}
                    onChange={(e) => updateSampleReply(i, e.target.value)}
                    placeholder={`"고객님, 소중한 후기 감사합니다!..."`}
                    className="w-full border-0 bg-transparent text-sm min-h-[60px] focus:outline-none resize-none placeholder:text-gray-300"
                  />
                </div>
              ))}
              {sampleReplies.length < 5 && (
                <button
                  onClick={addSampleReply}
                  className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-sm text-gray-400 hover:text-amber-600 hover:border-amber-300 transition-colors flex items-center justify-center gap-1"
                >
                  <span className="text-lg">+</span> 새 샘플 추가
                </button>
              )}
            </div>
          </div>

          {/* Generate Profile Button */}
          <button
            onClick={handleCreateProfile}
            disabled={isLoading}
            className="w-full py-3 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed mb-4 shadow-sm transition-colors"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                톤 프로필 생성 중...
              </span>
            ) : (
              "톤 프로필 생성"
            )}
          </button>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-900 font-medium text-sm disabled:opacity-50 transition-colors"
          >
            {isSaving ? "저장 중..." : "저장"}
          </button>
        </div>

        {/* 우측: 실시간 프리뷰 영역 */}
        <div className="lg:w-[420px] flex-shrink-0">
          <div className="sticky top-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
              <h2 className="text-sm font-bold text-amber-800 mb-1">실시간 프리뷰</h2>
              <p className="text-xs text-amber-600/80 mb-4">키워드를 변경하면 예시가 자동 갱신됩니다</p>

              {/* 정적 프리뷰 (키워드 변경 시 즉시 반영) */}
              <div className="space-y-3">
                {staticPreview.map((preview, i) => (
                  <div key={i} className={`border rounded-lg p-3 ${SENTIMENT_COLORS[preview.sentiment] || "border-gray-200 bg-white"}`}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SENTIMENT_LABEL_COLORS[preview.sentiment] || "bg-gray-100 text-gray-600"}`}>
                        {preview.sentiment} 리뷰
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2 italic">&ldquo;{preview.review}&rdquo;</p>
                    <div className="bg-white/70 rounded-lg p-2.5">
                      <span className="text-[10px] text-gray-400 font-medium block mb-1">AI 답변 예시</span>
                      <p className="text-xs text-gray-700 leading-relaxed">{preview.reply}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* API 기반 실제 프리뷰 (프로필 생성 후) */}
              {previewReplies.length > 0 && (
                <div className="mt-5 pt-4 border-t border-amber-200">
                  <h3 className="text-xs font-bold text-amber-800 mb-3">AI 생성 프리뷰 (실제 결과)</h3>
                  <div className="space-y-3">
                    {previewReplies.map((preview, i) => (
                      <div key={i} className="border border-amber-200 rounded-lg p-3 bg-white">
                        <div className="mb-2">
                          <span className="text-[10px] text-gray-400 font-medium">리뷰:</span>
                          <p className="text-xs text-gray-600 italic">&ldquo;{preview.review}&rdquo;</p>
                        </div>
                        <div className="bg-amber-50 rounded-lg p-2.5">
                          <span className="text-[10px] text-amber-600 font-medium block mb-1">AI 답변</span>
                          <p className="text-xs text-gray-700 leading-relaxed">{preview.reply}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
