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

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">브랜드 톤 가이드 설정</h1>
      <p className="text-sm text-gray-500 mb-6">
        브랜드의 톤앤매너를 설정하면 AI가 이에 맞는 대댓글을 생성합니다.
      </p>

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
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400 focus:border-transparent"
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
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                selectedKeywords.includes(keyword)
                  ? "bg-lime-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                className="px-3 py-1 rounded-full text-sm bg-lime-500 text-white"
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
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
          />
          <button
            onClick={addCustomKeyword}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"
          >
            + 추가
          </button>
        </div>
      </div>

      {/* Sample Replies */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          기존 대댓글 샘플
          <span className="text-xs text-gray-400 ml-1">(선택, 3~5개)</span>
        </label>
        <div className="space-y-2">
          {sampleReplies.map((sample, i) => (
            <div key={i} className="flex gap-2">
              <textarea
                value={sample}
                onChange={(e) => updateSampleReply(i, e.target.value)}
                placeholder={`샘플 ${i + 1}: "고객님, 소중한 후기 감사합니다!..."`}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-lime-400"
              />
              {sampleReplies.length > 1 && (
                <button
                  onClick={() => removeSampleReply(i)}
                  className="text-gray-400 hover:text-red-500 self-start mt-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {sampleReplies.length < 5 && (
            <button
              onClick={addSampleReply}
              className="text-sm text-lime-600 hover:text-lime-700"
            >
              + 샘플 추가
            </button>
          )}
        </div>
      </div>

      {/* Generate Profile Button */}
      <button
        onClick={handleCreateProfile}
        disabled={isLoading}
        className="w-full py-2.5 bg-lime-500 text-white rounded-lg hover:bg-lime-600 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed mb-6"
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

      {/* Error / Success */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-600 text-sm p-3 rounded-lg mb-4">{success}</div>
      )}

      {/* Preview */}
      {previewReplies.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">─── 미리보기 ───</h2>
          <p className="text-xs text-gray-500 mb-3">테스트 리뷰 → 샘플 대댓글</p>
          <div className="space-y-3">
            {previewReplies.map((preview, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4 bg-white">
                <div className="mb-2">
                  <span className="text-xs text-gray-500">리뷰:</span>
                  <p className="text-sm text-gray-700">&ldquo;{preview.review}&rdquo;</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">대댓글:</span>
                  <p className="text-sm text-gray-700 bg-lime-50 p-2 rounded mt-1">
                    {preview.reply}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-2.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 font-medium text-sm disabled:opacity-50"
      >
        {isSaving ? "저장 중..." : "저장"}
      </button>
    </div>
  );
}
