# 모멘텀마케팅 순위 측정 시스템 — 현재 운영 상태 (2026-10-15)

## 현재 운영 중
- 공개 URL: https://momentum-goldeye24-hubs-projects.vercel.app/lab/rank/
- `scope=map`: 네이버지도 PC 검색 목록의 실제 브라우저 표시 결과. 플레이스 ID 기준 매칭.
- `scope=integrated`: 네이버 PC 통합검색 플레이스 블록의 표시 위치. 지도 검색 순위와 혼합 금지.
- 첫 페이지 표시 순위는 화면 순위 속성에 기반. 추가 로딩한 페이지 순서는 **근사치**로 표기한다.
- 조회 결과 `ranked`만 순위 기록. `not_in_block`은 확인 범위 내 미노출이지 전체 순위 미노출 아님.
- 기록·추세 그래프는 사용자 브라우저 localStorage에 저장. 브라우저가 다르면 동기화되지 않음.
- 플레이스 자동 측정 API는 인스턴스 기준 10분당 3회 제한(운영 규모 확대 전 공유 Rate Limit 도입 필요).
- 2026-10-15: 실제 운영 API로 '포항 물회' / 퐝물회(2085358113) 지도 목록 1위 응답 확인. 이 결과는 당시 관측값이며 고정 순위가 아님.

## 구현됐으나 활성화 전
- 관리자 대상 등록: `/admin/watches/` (기존 관리자 세션으로만 접근)
- 관리자 API: `/admin/watches/api` (기존 관리자 세션 검증)
- DB: `db/rank-watch.sql` (서비스 역할 전용, RLS 활성화, 익명 정책 없음)
- 예약 작업 코드: `/api/rank-watch-cron` (CRON_SECRET 인증과 활성화 플래그가 필요한 비공개 워커)
- **현재 DB 환경변수가 없으면 관리자 API는 503을 반환하며, 예약 실행은 비활성화된다.**
- Vercel Cron 일정은 아직 추가하지 않음. DB 연결·수동 워커 검증 후 등록할 것.

## 데이터베이스 연결 절차 (일회성)
1. 모멘텀 전용 Supabase 프로젝트를 선택/생성한다.
2. SQL Editor에서 `db/rank-watch.sql` 실행 후 2개 테이블 생성 여부를 확인한다.
3. 모멘텀 Vercel **서버 환경 변수**에 아래 이름을 추가한다.
   - `MOMENTUM_RANK_DB_URL`: Supabase Project URL (https://<project>.supabase.co)
   - `MOMENTUM_RANK_DB_SERVICE_KEY`: Service Role Key. 절대 프론트엔드/GitHub/채팅에 저장 금지
   - `CRON_SECRET`: 별도의 32자 이상 무작위 문자열
   - `MOMENTUM_RANK_CRON_ENABLED=true`: 실제 DB 권한 및 사용 동의 검토 완료 후 활성화
4. 재배포 후 `/admin/watches/`에서 측정 대상 등록·읽기·중지·삭제 확인.
5. 시험 대상 2개에 대해 워커를 인증 호출해 DB에 기록이 정확히 생기는지 검증.
6. 정상 운영 확인 후 `vercel.json`에 `crons: [{path:"/api/rank-watch-cron",schedule:"0 3 * * *"}]` 추가하여 매일 한국시간 정오 예약 실행.
7. 현재 워커는 **하루 호출당 최대 2개**만 측정한다. 업체/키워드 수가 늘면 별도 작업 큐 또는 시간 분산 실행으로 확장해야 한다.

## 추가 검증 필요
- 한국 지역별 검색 설정·실제 지도 화면과의 반복 일치율
- 광고 포함 여부 및 10위 이후 목록 순서 오차
- 플랫폼 서비스 약관과 자동화 사용 허용 범위
- 사용자/고객별 회원 계정 및 서버 소유권 분리
- 마케팅 유료 서비스로 공개하기 전 사용량 제어, 공용 rate limit, DB/호출 비용과 장애 알림

결과 수집이 막혔을 때 CAPTCHA 우회·IP 회전으로 해결하도록 설계하지 않는다. 차단시 `blocked` / `no_place_block`로 기록한다.
