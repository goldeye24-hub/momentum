# 모멘텀 무료 마케팅 작업실 (/lab/)

운영 홈페이지의 기존 index.html, 상담폼, SEO 페이지를 보존하면서 무료 작업실을 추가합니다.

## 포함 (API 키 없이 즉시 사용)
- 12개 항목 매장 진단, 점검 완료율, 현장 증빙 메모, 텍스트 보고서/인쇄
- 네이버·구글·카카오 지도 외부 검색, 앱 화면 직접 확인한 순위 기록(브라우저 저장)
- 지역·업종 키워드 조합기, 확인된 검색량 수동 입력
- 플레이스 SEO 체크리스트, GEO 비교용 검색 질문
- 리뷰 붙여넣기·기본 답글 문안·복사 (AI 비활성 시 기본 문안 표시)
- 1080x1080 / 1080x1920 / 1200x628 PNG 홍보 이미지(로컬 파일 업로드, 브라우저 Canvas)
- 채널별 홍보 문구 초안, 광고 손익분기 계산기, QR 링크(제3자 이미지 서비스), 시즌별 홍보 아이디어
- 브라우저 localStorage 저장: 서버/회원 간 공유 불가, 브라우저 데이터 삭제 시 소멸

## 외부 API (기본 비활성화)
Vercel 환경 변수:
- MOMENTUM_PLACE_API_ENABLED=true
- KAKAO_REST_API_KEY=... (Kakao Developers: Local API 활성화)
- GOOGLE_PLACES_API_KEY=... (Places API New 활성화, 결제/쿼터/제공권한 확인)
- MOMENTUM_AI_ENABLED=true
- OPENAI_API_KEY=...
- MOMENTUM_AI_MODEL=gpt-4.1-mini (선택)

중요: 비밀키를 GitHub 파일/프런트엔드에 절대 쓰지 마세요.
공식 장소 API의 재표시·캐싱·사업용 재제공 허용 조건을 계약별로 확인한 후 활성화하세요.
AI 공개 엔드포인트는 현재 간단한 *인스턴스 내* 6초 제한만 포함합니다. 프로덕션에서는 영속적 Rate Limit, 월 예산/쿼터, Abuse 방어 및 개인정보 처리 고지 없이는 MOMENTUM_AI_ENABLED 값을 켜지 마세요.

## 아직 외부 시스템·승인이 필요한 항목
- 네이버 플레이스 앱 실제 순위의 완전 자동 측정(공식 API 부재)
- 네이버 검색광고 월간 검색량 자동 반영(광고 API 접근·재제공 허용 필요)
- SNS 전체 언급 횟수/네이버 점주 비공개 조회수
- 구글/카카오 앱의 개인화된 실제 순위(장소 API는 별개)
- 전국 실시간 상권 유동인구(지역별 원천데이터 계약 필요)
- AI GEO 추천 확률·자동 크로스 플랫폼 테스트(공식 통합 API 없음)
- 계정 로그인/DB 기반 월별 멀티디바이스 동기화
- 자동 SMS·카카오 발송, 포털 리뷰 자동 게시(초기 범위에서 제외)

테스트: /lab/ 직접 접속, 각 탭에서 입력·저장·이미지 다운로드·출력 동작, /api/place-search 와 /api/review-replies 비활성화 응답을 확인하세요. 실제 키 발급 후 provider 각각 별도 검증하세요.

## 2026-10-28 사용자 공개 무료도구 3종
- `/lab/keywords/`: 지역·업종 롱테일 키워드 후보, 기획용 의도 점수, 정렬·CSV/복사. **실제 검색량**은 `MOMENTUM_SEARCHADS_ENABLED`와 표시 이용 권한, Search Ads API 키가 모두 유효할 때만 표시. 숫자 추측 금지.
- `/lab/rank/`: 네이버 플레이스 검색 화면 자동 관측 시도, 직접 관측 입력, 검색 목록 붙여넣기, 기록·CSV. 차단·검색 범위 제한 시 순위를 만들어내지 않음. 브라우저별 로컬 저장.
- `/lab/trends/`: 네이버 데이터랩 검색어 1~5개 주·월별 상대 지수(0~100) 비교, 결과 그래프·표·CSV. 인증/공개권한 미연결 시 명시적으로 연결 불가를 알리고 **사용자 CSV/TSV 로컬 가져오기**로 시각화. CSV는 첫 행 `날짜,검색어1,검색어2`, 뒤이어 `YYYY-MM-DD,0~100,0~100` 형식. 직접 확보한 실제 측정치만 사용할 것.

### 신규 네이버 검색어 추이 API 연결 (기본 차단)
NAVER API HUB에서 **검색어 트렌드** 이용 신청과 웹 공개·사업적 재표시 사용조건 확인 후, Vercel 서버에 다음 환경 변수를 시크릿으로 설정하고 재배포:
```
MOMENTUM_DATALAB_ENABLED=true
MOMENTUM_DATALAB_PUBLIC_DISPLAY_APPROVED=true
NAVER_API_HUB_CLIENT_ID=<server-secret>
NAVER_API_HUB_CLIENT_SECRET=<server-secret>
```
서버 고정 경로: `POST /api/search-trends` → `https://naverapihub.apigw.ntruss.com/search-trend/v1/search`. 최대 5개 검색어·24개월·요청 IP별 분당 8회, 요청/응답 비저장, 네이버 키는 프런트엔드 노출 금지. 실제 API 계약·표시 권한이 승인되지 않았다면 두 플래그를 켜지 마세요. 각 Vercel 인스턴스 별 메모리 제한이므로 트래픽 증가 시 분산 제한/쿼터·예산 제한 필요.
