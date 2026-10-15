# 회원 포털 파일럿

## 구현 범위
- `/platform/`: 이메일 가입·로그인, 내 업체·검색 키워드 등록, 무료 슬롯 1개, 삭제, 최근 실제 관측 기록 조회
- 관리자 기능과 회원 기능의 데이터·세션 분리. 회원 데이터는 소유자 계정 기준으로만 조회·변경
- 슬롯 초과 검사와 동시 요청 보호는 `db/member-portal.sql`의 PostgreSQL 트랜잭션 함수에서 처리
- 이 단계는 결제와 매일 자동 측정이 연결되지 않은 베타 기능이며 유료 서비스를 보장하지 않습니다.

## 배포 체크리스트
1. Supabase에 기존 `db/rank-keyword-history.sql`과 신규 `db/member-portal.sql`을 적용
2. Supabase Auth 이메일 인증 설정 확인
3. Vercel 서버 전용 환경변수: `MOMENTUM_RANK_DB_URL`, `MOMENTUM_RANK_DB_SERVICE_KEY`, `MOMENTUM_MEMBER_ANON_KEY`, `MOMENTUM_MEMBER_SESSION_SECRET` 구성
4. Auth 가입→이메일 확인→로그인→키워드 등록·삭제를 실제 Preview에서 검증
5. 기존 Vercel build-rate-limit 및 연결된 앱의 프로젝트 접근 제한을 해소한 다음 운영 배포

## 보안·제약
- 브라우저에는 데이터베이스의 관리자 키나 인증 세션 원문을 전달하지 않음
- 회원 쿠키는 암호학적으로 서명되며 HttpOnly·Secure 속성을 사용
- 개인정보·회원 이용권과 운영 관리자 페이지는 분리
- 회원 등록 자체는 모바일 순위 관측을 트리거하지 않음
- 이미 측정된 관측 기록이 없으면 순위 미관측으로 표기
- 네이버 데이터 사용조건 및 안정적인 측정 횟수는 별도 검증 필요

## 후속
- 요금 결제의 검증된 서버 웹훅과 실제 슬롯 변경
- 자동 측정·조회 용량 모니터링
- 그룹별 대행사 권한 관리
