import Link from "next/link";
import FABMiniPanel from "../../components/FABMiniPanel";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-cream-100 flex flex-col">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-sm border-b border-warm-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Left nav */}
          <nav className="flex items-center gap-6">
            <Link
              href="/shop"
              className="text-xs tracking-widest uppercase text-warm-600 hover:text-amber-600 transition-colors"
            >
              Brand
            </Link>
            <Link
              href="/shop"
              className="text-xs tracking-widest uppercase text-warm-600 hover:text-amber-600 transition-colors"
            >
              Shop
            </Link>
          </nav>

          {/* Center brand */}
          <Link href="/shop" className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center">
            <span className="font-serif text-xl tracking-wide text-warm-800">
              Sunday Morning Brunch
            </span>
          </Link>

          {/* Right - 대댓글 관리 링크 */}
          <div className="flex items-center">
            <Link
              href="/dashboard/reviews"
              className="flex items-center gap-1.5 text-xs tracking-widest uppercase text-warm-600 hover:text-amber-600 transition-colors"
            >
              <span>💬</span>
              <span>리뷰 대댓글 관리</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 flex-1 w-full">{children}</main>

      {/* Footer */}
      <footer className="bg-warm-800 text-warm-300 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Brand */}
            <div>
              <h3 className="font-serif text-lg text-cream-100 mb-2">Sunday Morning Brunch</h3>
              <p className="text-sm text-warm-400 mb-3 italic">
                느긋한 일요일처럼, 매일을 편안하게
              </p>
              <p className="text-xs text-warm-500 leading-relaxed">
                편안하면서도 스타일리시한 데일리 웨어를 만듭니다.<br />
                당신의 일상에 따뜻한 여유를 더해보세요.
              </p>
            </div>

            {/* Customer Service */}
            <div>
              <h4 className="text-sm font-semibold text-cream-200 mb-3 tracking-wide uppercase">고객센터</h4>
              <p className="text-sm text-warm-400">02-1234-5678</p>
              <p className="text-xs text-warm-500 mt-1">
                평일 10:00 - 18:00 (점심 12:00 - 13:00)<br />
                토/일/공휴일 휴무
              </p>
              <p className="text-xs text-warm-500 mt-2">
                이메일: hello@sundaymorningbrunch.kr
              </p>
            </div>

            {/* SNS */}
            <div>
              <h4 className="text-sm font-semibold text-cream-200 mb-3 tracking-wide uppercase">Follow Us</h4>
              <div className="flex gap-4">
                {/* Instagram */}
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-warm-400 hover:text-amber-400 transition-colors"
                  aria-label="Instagram"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </a>
                {/* KakaoTalk */}
                <a
                  href="https://pf.kakao.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-warm-400 hover:text-amber-400 transition-colors"
                  aria-label="KakaoTalk"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3c-5.523 0-10 3.582-10 8 0 2.844 1.888 5.34 4.727 6.76-.175.635-.636 2.305-.728 2.66-.113.436.16.43.337.313.14-.092 2.226-1.516 3.131-2.131.81.118 1.648.18 2.533.18 5.523 0 10-3.582 10-8s-4.477-8-10-8z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-warm-700 mt-8 pt-6 text-center">
            <p className="text-xs text-warm-500">
              &copy; 2026 Sunday Morning Brunch. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* FAB */}
      <FABMiniPanel />
    </div>
  );
}
