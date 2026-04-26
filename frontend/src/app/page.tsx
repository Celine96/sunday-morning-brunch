import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-orange-50/30 to-white">
      {/* Hero */}
      <div className="max-w-3xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">
          AI 리뷰 대댓글 서비스
        </h1>
        <p className="text-lg text-amber-700 font-medium mb-3">
          브랜드 톤에 맞는 대댓글, AI가 대신 써드립니다
        </p>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          브랜드 톤에 맞는 리뷰 대댓글을 AI가 자동으로 생성하고,<br />
          원클릭으로 게시할 수 있습니다.
        </p>
      </div>

      {/* CTA Cards */}
      <div className="max-w-2xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Link
            href="/shop"
            className="group block bg-white border border-amber-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-amber-300 transition-all"
          >
            <div className="text-3xl mb-3">🛍️</div>
            <h2 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-amber-700 transition-colors">
              쇼핑몰 보기
            </h2>
            <p className="text-sm text-gray-500">
              Sunday Morning Brunch 쇼핑몰 화면을 확인합니다.
            </p>
          </Link>

          <Link
            href="/dashboard/reviews"
            className="group block bg-white border border-amber-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-amber-300 transition-all"
          >
            <div className="text-3xl mb-3">💬</div>
            <h2 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-amber-700 transition-colors">
              대댓글 관리 시작
            </h2>
            <p className="text-sm text-gray-500">
              운영자 대시보드에서 리뷰를 관리합니다.
            </p>
          </Link>
        </div>
      </div>

      {/* 3-Step Guide */}
      <div className="max-w-2xl mx-auto px-6 pb-20">
        <h3 className="text-center text-sm font-bold text-gray-700 mb-6 uppercase tracking-wider">
          사용 가이드
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/80 border border-amber-100 rounded-xl p-5 text-center">
            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 font-bold text-sm flex items-center justify-center mx-auto mb-3">
              1
            </div>
            <h4 className="text-sm font-bold text-gray-900 mb-1">브랜드 톤 설정</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              브랜드의 톤앤매너 키워드를 설정하여 AI가 브랜드에 맞는 답변을 생성하도록 합니다.
            </p>
          </div>
          <div className="bg-white/80 border border-amber-100 rounded-xl p-5 text-center">
            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 font-bold text-sm flex items-center justify-center mx-auto mb-3">
              2
            </div>
            <h4 className="text-sm font-bold text-gray-900 mb-1">리뷰 확인</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              미답변 리뷰를 확인하고 AI가 분석한 감성 분류와 긴급도를 파악합니다.
            </p>
          </div>
          <div className="bg-white/80 border border-amber-100 rounded-xl p-5 text-center">
            <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 font-bold text-sm flex items-center justify-center mx-auto mb-3">
              3
            </div>
            <h4 className="text-sm font-bold text-gray-900 mb-1">AI 대댓글 생성/게시</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              AI가 생성한 3개 후보 중 선택하여 수정 후 원클릭으로 게시합니다.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-8">
        <p className="text-xs text-gray-400">Powered by AI</p>
      </div>
    </div>
  );
}
