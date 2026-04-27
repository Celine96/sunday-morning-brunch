Raw Transcript

AI 도구(Claude Code) 활용 전체 과정 기록

Sunday Morning Brunch — 리뷰 대댓글 생성 에이전트

# 1. 개요

- AI 도구: Claude Code (Claude Opus 4.6, 1M context)

- 프로젝트: Sunday Morning Brunch — 리뷰 대댓글 생성 에이전트

- 작업 기간: 2026-04-22 ~ 2026-04-26

- 사용 방식: Claude Code CLI에서 대화형으로 기획 → 설계 → 구현 → 배포 전 과정 수행

# 2. 프롬프트 및 모델 응답 주요 로그

시간순으로 주요 프롬프트와 응답을 정리합니다.

## Phase 1: 문제 정의 (4/22~4/24)

프롬프트

"이커머스 에이전트를 위한 인터뷰 질문을 뽑아주세요" (인터뷰이 3명 특성 제공)

응답

인터뷰이별 맞춤 질문 설계 — 이선혜: 운영자 메타관점, 구아정: 소비자 여정, 변승혜: 실운영

프롬프트

구아정 인터뷰 음성 트랜스크립트 + 직접 메모 공유 → "인사이트를 뽑아주세요"

응답

인사이트 9개 도출 (시스템 먼저 자동화는 그 다음, 부정 리뷰가 정보원, AI 수용도 카테고리별 격차 등)

설계 변경

첫 버전에서 브랜드명/상세 여정 누락 → PM 피드백 → 직접 메모 기반 보충

## Phase 2: 에이전트 선정 (4/25)

프롬프트

"고객/공급자/플랫폼 관점별 에이전트 옵션을 분석해주세요"

응답

8개 에이전트 옵션 비교 (구현 난이도, 데모 임팩트, 데이터 확보, 차별화)

프롬프트

"B-1 리뷰 관리를 선택, 리뷰 조작 방지와 브랜드 톤 댓글은 맥락이 다릅니다"

응답

B-1-a(필터링) vs B-1-b(대댓글 생성) 가지치기

의사결정

B-1-b 대댓글 에이전트 확정

## Phase 3: 설계 (4/25)

프롬프트

"하네스 팀을 구성해주세요" (Harness 플러그인 활용)

응답

planner → designer → developer → qa 파이프라인 팀 구성

설계 변경 1

PM 피드백 "각 에이전트에 제작과 검수 역할 구별" → 자체 검수 + QA는 최종 프로덕트만

설계 변경 2

PM 피드백 "KPI 온보딩 소요시간은 우리 에이전트에 맞지 않음" → 제거

설계 변경 3

PM 피드백 "API 연동 포함하고 싶다" → 샘플 쇼핑몰 + API 연동 추가

프롬프트

"대시보드 vs 팝업 vs FAB 어떤 형태가 좋을까?"

응답

5가지 UI 형태 비교 → D-2(대시보드+FAB) 확정

## Phase 4: 구현 (4/25)

프롬프트

developer 에이전트에 PRD/아키텍처 기반 구현 지시

응답

Next.js 14 + FastAPI + Claude API + SQLite 전체 구현

에러/디버깅 로그:

- 에러 1: CORS 포트 3001 누락 → 상품 미표시 → CORS 설정 추가

- 에러 2: frontend가 git submodule로 등록 → GitHub push 후 Render에서 파일 못 찾음 → submodule 제거 후 일반 디렉토리로 재추가

- 에러 3: 대댓글이 동일하게 생성 → ANTHROPIC_API_KEY 미설정으로 폴백 모드 동작 → .env 파일 생성 + dotenv 로드 추가

- 에러 4: Haiku 모델명 404 오류 → claude-haiku-4-20250414 → claude-haiku-4-5-20251001로 수정

- 에러 5: 일괄 생성 시 3개 후보가 동일 → asyncio.gather 병렬 호출 시 rate limit → 순차 처리로 변경

- 에러 6: Render 배포 시 uvicorn 대시(—) 인코딩 오류 → em dash를 하이픈으로 수정

## Phase 5: 코드 리뷰 및 리팩토링 (4/25)

프롬프트

"시니어 엔지니어로서 코드베이스를 리뷰해"

응답

CRITICAL 6건 + HIGH 7건 + MEDIUM 6건 + LOW 3건 = 22건 이슈 발견

주요 수정

라우트 충돌, N+1 쿼리, XSS 벡터, 동기 LLM 블로킹, 에러 silent 무시

재시도

에러 표시 추가 후에도 "상품이 안 보여요" → 원인이 에러가 아니라 새로고침 미반영 → CustomEvent로 FAB↔상품 페이지 상태 동기화

## Phase 6: 기능 추가 및 UI 개선 (4/25~4/26)

프롬프트

"대댓글 초안에 채택할 수 있는 댓글을 3개씩 제공, 말투 변경 기능"

응답

LLM 프롬프트를 3개 후보 JSON 반환으로 변경, tone_override 파라미터 추가

설계 변경

"재생성" → "말투 변경" 드롭다운으로 UX 변경

프롬프트

PM 피드백 "교환과 환불 언급은 하지 않는게 좋다"

응답

LLM 프롬프트에 필수 정책 추가 (교환/환불 미언급, 고객센터 유도)

프롬프트

PM 피드백 "운영자가 댓글을 기억하고 입력하는건 비효율적"

응답

텍스트 입력 → 상품별 리뷰 그루핑 + 체크박스 선택 + 일괄 생성으로 전면 개편

프롬프트

TESER 브랜드 참고 이미지 제공 → "홈페이지 개선점 도출"

응답

9개 개선 항목 (히어로배너, 카테고리필터, 컬러톤, 푸터, 상품카드 등)

프롬프트

댓글몽 서비스 스크린샷 → "대시보드 UI 개선점 도출"

응답

5개 개선 (카드형 후보, 별점필터, 상단일괄생성, 리뷰카드보강, 사이드바)

재시도

도식(graphviz) 여러 차례 수정 — 선 겹침, 노드 관통, ㄱ자 라우팅, 면 중앙 연결 → 최종 draw.io XML로 전환

## Phase 7: 배포 (4/26)

프롬프트

"배포를 시작하죠"

에러/디버깅 로그:

- GitHub 인증 실패 → Personal Access Token 생성 → push 성공

- Render에서 frontend 빌드 실패 → submodule 문제 → 수정 후 재배포

- uvicorn 대시 인코딩 → Start Command 수동 수정

최종 배포

Render (프론트: smb-web.onrender.com, 백엔드: sub-api-qq2o.onrender.com)

## Phase 8: 2차 코드 리뷰 (4/26)

프롬프트

"시니어 엔지니어로서 코드베이스를 리뷰해" (2차)

응답

CRITICAL~LOW 총 20건 이슈 발견 및 전수 수정

주요 수정 (Critical~High)

- CORS 정규식을 특정 Render 서브도메인으로 제한 (보안 강화)
- UnrepliedReview 스키마에 sentiment 필드 누락 수정
- HistoryDetail.reply에 review_id, author, source 등 필드 보강
- useMemo로 getFilteredGroups 최적화
- batch 엔드포인트 flush + 단일 commit 통합
- unpublish API 실제 연동 (mock → 실제 호출)
- FAB handlePublish에 overrideReplyId 파라미터 추가 (비동기 상태 경합 방지)
- 상품 상세 productId NaN 가드 추가

접근성 수정 (A1~A7)

aria-label, aria-pressed, SVG title, select label, sentiment bar ARIA 등 7건

품질 수정 (Q2~Q7)

undoTimer cleanup, 단일 이미지 갤러리 미표시, 데모 상태 주석, eslint-disable, 미사용 타입 제거, 함수명 public화

## Phase 9: QA 전수 검사 (4/26)

프롬프트

"QA 리드로서 이 제품을 테스트해. 엣지 케이스, 에러 처리 누락, UI 깨짐을 심각도 순으로 정리해주세요"

응답

프론트엔드 코드 + 백엔드 API + 라이브 사이트 통합 테스트 3방향 점검 → CRITICAL 5 + HIGH 6 + MEDIUM 8 + LOW 10 = 29건 발견

프롬프트

"low까지 다 시급합니다. 당장 처리하죠"

응답

29건 전체 수정 완료

CRITICAL 수정:

- C1: API 타임아웃 30초→60초 (Render 콜드스타트 대응)
- C2: FAB "바로 등록" stale closure — 후보 선택 후 서버에 updateAgentReply 호출 후 publish
- C3: handlePublishAll 루프 중 배열 변경 → 스냅샷 기반 루프로 수정
- C4: publish 엔드포인트 중복 게시 방지 체크 추가
- C5: regenerate 시 원본 리뷰 없으면 400 에러 반환

HIGH 수정:

- H1: 감성 분류 톤 프리뷰 데이터 수정 ("교환 가능한가요?" → inquiry)
- H2: Shop PUT /replies 히스토리 기록 누락 → ReplyHistory 기록 추가
- H3: confirm 성공 후 publish 실패 시 롤백 처리 추가
- H5: ReplyHistory FK cascade delete 추가
- H6: ReplyCreate/Update 빈 문자열 검증 (min_length=1)

MEDIUM 수정:

- M1: batch 요청 최대 50건 제한
- M2: batch source 개별 반영 (하드코딩 제거)
- M3: unpublish 상태 체크 추가 (게시된 것만 취소 가능)
- M4: FAB mountedRef 언마운트 안전장치
- M5: FAB API 로드 Promise.allSettled 병렬화
- M6: 톤 드롭다운 선택 후 리셋 제거
- M8: "문의/중립" → "중립(3점)" 라벨 정확도 개선

LOW 수정:

- L1: SQLite FK PRAGMA 활성화
- L2: deprecated datetime.utcnow() 제거
- L3: reply.content None 가드
- L4: content_snapshot/review_text 조건부 말줄임
- L5: 빈 author 아바타 "?" 폴백
- L6: formatDate 유틸 생성 (Invalid Date 방지)
- L7: undoTimer useState → useRef 전환
- L9: mainImageIdx 상품 변경 시 리셋
- L10: CORS methods/headers 명시적 제한

에러/디버깅 로그:

- .next 캐시 손상 → "Cannot find module './682.js'" → .next 삭제 후 재빌드로 해결

# 3. 설계 변경 이력 요약

# 4. 사용한 AI 도구 및 기법

# 5. 핵심 학습 및 회고

- 인터뷰 기반 문제 정의가 에이전트 기능 방향을 결정하는 핵심

- PM과의 얼라인이 없으면 구현 후 대규모 수정 불가피 (Phase별 검수 게이트의 가치)

- LLM 폴백 모드는 데모 안정성에 필수지만, 실제 LLM 연동 없이는 핵심 가치 검증 불가

- 코드 리뷰 22건 중 "에러 silent 무시"가 실제 PM 검수에서 가장 큰 문제를 일으킴

- UI/UX는 참고 서비스(TESER, 댓글몽) 비교 분석이 개선 방향을 명확하게 함

| 날짜 | 변경 내용 | 사유 |
| --- | --- | --- |
| 4/22 | 인터뷰 정리 퀄리티 보강 | PM 피드백: 브랜드명/상세 여정 누락 |
| 4/25 | 온보딩 KPI 제거 | PM 피드백: 우리 에이전트에 맞지 않음 |
| 4/25 | 샘플 쇼핑몰 + API 연동 추가 | PM 요청: E2E 데모 임팩트 |
| 4/25 | UI를 D-2(대시보드+FAB)로 확정 | PM과 논의: 대시보드 일괄 + FAB 단건 |
| 4/25 | 브랜드명 Sunday Morning Brunch 확정 | PM 제안 |
| 4/25 | 여성 의류만 구성, 신발/속옷 제거 | PM 피드백 |
| 4/25 | 대댓글 3개 후보 + 말투 변경 기능 | PM 요청 |
| 4/25 | 교환/환불 미언급 정책 | PM 피드백: 브랜드 관점 |
| 4/25 | 텍스트 입력 → 상품별 리뷰 그루핑 | PM 피드백: 사용성 개선 |
| 4/25 | 1차 검토 → 2차 반영 흐름 | PM 피드백: 즉시 반영이 아닌 검토 후 반영 |
| 4/26 | 사이드바 올리브 → 주황색 | PM 요청: 브랜드 감성 |
| 4/26 | 이모지 → Heroicons SVG | PM 피드백: AI 느낌 제거 |
| 4/26 | 2차 코드 리뷰 20건 수정 | CORS 보안, 접근성, 최적화, 타입 안전성 |
| 4/26 | QA 전수 검사 29건 수정 | stale closure, 상태 롤백, 입력 검증, FK cascade, 타임아웃 등 |

| 도구 | 용도 |
| --- | --- |
| Claude Code (Opus 4.6) | 기획, 설계, 구현, 코드 리뷰, 배포 전 과정 |
| Claude API (Haiku 4.5) | 리뷰 감성 분류 (프로덕트 내) |
| Claude API (Haiku 4.5) | 대댓글 생성 (프로덕트 내, 초기 Sonnet → 속도 최적화로 Haiku 전환) |
| Harness 플러그인 | 에이전트 팀 구성 (planner/designer/developer/qa) |
| Graphviz → draw.io | 아키텍처 도식 생성 |
| python-docx | 문서 산출물 자동 생성 |
