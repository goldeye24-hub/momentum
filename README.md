# 모멘텀마케팅 (Momentum Marketing)

운영 목적: **공개 마케팅 홈페이지 + 관리자 1인 전용 운영센터**.

| 영역 | 경로 | 접근 |
| --- | --- | --- |
| 공개 홈페이지 | `/` | 누구나 접근 |
| 통합 관리자 | `/admin/` | 관리자 로그인 필요 |
| 관리자 연구실 | `/admin/research/` | 동일 관리자 세션 재사용 |
| 순위 추적 · 키워드 표 | `/admin/watches/`, `/admin/keyword-matrix/` | 동일 관리자 세션 |
| 거래처 · 재무 | `/admin/crm/`, `/admin/finance/` | 동일 관리자 세션 |
| 내부 홈페이지 제작 | `/admin/studio/`, `/admin/designs/` | 동일 관리자 세션 |
| 더소통 비공개 조사실 | `/private/kw/:access` | 기존 별도 토큰 방식 유지 |

## 로그인 원칙

- 현재 운영하는 로그인은 `api/admin-site-builder.js`의 서명된 `momentum_admin_session` 쿠키입니다. `Path=/admin`으로 관리자 하위 경로에 공통 적용됩니다.
- `MOMENTUM_ADMIN_PASSWORD`, `MOMENTUM_SESSION_SECRET` 환경변수는 서버에서만 관리합니다. 공개 홈페이지의 시안용 HTML에는 비밀번호나 세션을 저장하지 않습니다.
- 공개 홈페이지 `index.html`에 남은 예전 로컬 개발판 관리자 코드는 실제 서비스가 아닙니다. `/#/admin` 진입은 `/admin/`으로 이동하도록 처리했습니다.
- 회원가입·외부 고객용 회원 서비스는 운영하지 않습니다.
- 더소통컴퍼니와 연결된 비공개 키워드 조사실의 별도 비밀 링크 인증은 변경하지 않습니다.

## 데이터와 검증

- CRM·재무 일부 기록은 브라우저 로컬 저장형입니다. 기존 브라우저 데이터 삭제 전 백업하세요.
- 배포 테스트는 `tests/unified-admin-session.test.cjs`와 `.github/workflows/marketing-lab-checks.yml`에서 관리자 화면 간 공통 세션을 검증합니다.
- Vercel 배포 성공은 실제 계정 로그인이나 DB 기록 조회 성공의 증명이 아닙니다. 최종 사용자 브라우저의 인증 상태와 데이터는 별도로 확인해야 합니다.
- 다른 Supabase 프로젝트는 건드리지 않으며 비밀번호·API 키를 저장소에 넣지 않습니다.
