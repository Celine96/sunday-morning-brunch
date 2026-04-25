#!/bin/bash
# 리뷰 대댓글 생성 에이전트 - 실행 스크립트
# 사용법: ./run.sh

echo "======================================"
echo "  리뷰 대댓글 생성 에이전트 시작"
echo "  Sunday Morning Brunch"
echo "======================================"

# NVM 로드
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ANTHROPIC_API_KEY 확인
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo ""
    echo "[경고] ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다."
    echo "LLM 기능(감성분류, 대댓글 생성)이 폴백 모드로 동작합니다."
    echo "설정 방법: export ANTHROPIC_API_KEY=your-api-key"
    echo ""
fi

# DB 초기화 (없을 경우)
if [ ! -f "$PROJECT_DIR/backend/data.db" ]; then
    echo "[1/3] 데이터베이스 초기화 중..."
    cd "$PROJECT_DIR/backend"
    source venv/bin/activate
    python3 -m app.seed
    deactivate
else
    echo "[1/3] 데이터베이스 확인 완료"
fi

# 백엔드 시작
echo "[2/3] 백엔드 서버 시작 (포트 8000)..."
cd "$PROJECT_DIR/backend"
source venv/bin/activate
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
deactivate

# 프론트엔드 시작
echo "[3/3] 프론트엔드 서버 시작 (포트 3000)..."
cd "$PROJECT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "======================================"
echo "  서버 시작 완료!"
echo "  쇼핑몰:    http://localhost:3000/shop"
echo "  대시보드:  http://localhost:3000/dashboard/reviews"
echo "  API 문서:  http://localhost:8000/docs"
echo "======================================"
echo ""
echo "종료하려면 Ctrl+C를 누르세요."

# 종료 시 정리
cleanup() {
    echo ""
    echo "서버 종료 중..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    exit 0
}
trap cleanup SIGINT SIGTERM

wait
