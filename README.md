# 모멘텀마케팅 — 관리자 정리 (2026-11-10)

## 유지
공개 홈페이지·포트폴리오·인사이트·문의 접수, 보호된 순위·키워드 관리자 `/admin/` 및 `/admin/research/`, `/admin/keyword-matrix/`, `/admin/watches/`, `/admin/place-insights/`, `/admin/competitors/`, 더소통컴퍼니 비공개 조사실 `/private/kw/:access`, 실제 네이버 측정 엔진, Supabase 순위 기록, 관리자 세션 인증(`api/_admin-session.js`).

## 삭제
구형 관리자 시작 화면, 구형 홈페이지 제작 스튜디오, 구형 디자인 에디터와 그 전용 JS/CSS/템플릿. `/admin/overview`, `/admin/studio`, `/admin/designs`는 연구실로 임시 연결했습니다. 로그인 후 `/admin/`은 연구실이 기본 화면입니다.

## 이관 보류 (데이터 손실 방지)
기존 거래처·계약·외주업체·재무 페이지는 브라우저 localStorage 자료의 백업·복원에 필요한 상태라 유지합니다. 사용자가 선택한 별도 로컬 신형 관리자 소스와 사용자 브라우저 원본 데이터가 확보돼야 안전하게 이전할 수 있습니다. 이관 후 검증 전까지 이 페이지 및 데이터 삭제 금지. GitHub에서는 브라우저의 원본 데이터를 볼 수 없습니다.

복구용 브랜치: `backup/pre-admin-auth-split-20261110`. Vercel 실배포에서 로그인 이후의 네이버 조회 성공 여부는 별도 확인이 필요합니다.
