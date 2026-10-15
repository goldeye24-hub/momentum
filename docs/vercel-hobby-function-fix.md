# Vercel Hobby API 함수 제한 대응

## 확인된 실제 실패 원인

2026-10-15 Vercel `momentum` 프로젝트의 실제 배포 `dpl_GmNAdAredXEVpqtvfESn9WseciaS`는 `ERROR` 상태였으며, 오류는 `exceeded_serverless_functions_per_deployment`입니다.

배포 플랫폼이 전달한 오류: `No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan.`

GitHub의 `build-rate-limit` 상태 링크만 보고 배포 원인을 단정하지 마세요. Vercel 개별 배포의 오류 메시지를 확인해야 합니다.

## 수정 내용

- 기존 `api/` 폴더에 따로 놓여 있던 여덟 개의 함수 진입점을 `server-handlers/`로 옮겼습니다.
- 공통 진입점 `api/compact.js`를 추가하고, 사전에 정해진 여덟 개 핸들러로만 전달합니다.
- `vercel.json`의 원래 URL은 동일하게 유지되며 각 경로를 `/api/compact?op=...`로 연결합니다.
- 기존 각 핸들러의 세션·회원 소유권·동일 출처·비밀키 확인 로직은 바꾸지 않았습니다.
- 공개적인 API 진입점 파일 수는 **18개에서 11개**로 줄었습니다. `_*.js` 내부 유틸리티는 직접 노출하는 함수가 아닙니다.
- Chromium이 필요한 키워드 관측은 공통 함수에 기존 바이너리 포함 규칙을 적용했습니다.
- 기능이 늘어나더라도 신규 `api/*.js`를 계속 생성하지 말고, 한도에 맞춰 내부 핸들러와 공통 진입점으로 추가하세요.

## 배포 및 검증

1. GitHub Node 테스트와 Chromium 브라우저 테스트가 통과했는지 확인합니다.
2. GitHub `main` 병합 후 Vercel 배포 상태 `READY` 여부를 확인합니다. Hobby 함수 수 한도 내에 들어가도 별도의 빌드 오류는 발생할 수 있습니다.
3. 관리자 로그인, 순위 표, 키워드 종합분석, 경쟁업체 비교, 회원 가입·슬롯·이력 화면의 기존 URL이 모두 연결되는지 확인합니다.
4. 실제 데이터 동작에는 Supabase 연결이 별도로 필요합니다. 현재 확인된 프로덕션 환경변수는 `MOMENTUM_SESSION_SECRET` 및 `MOMENTUM_ADMIN_PASSWORD` 두 개이며, 별도의 Rank DB 및 Member Auth 환경변수는 확인되지 않았습니다.
5. 관리자 비밀번호나 서비스 역할 비밀키는 GitHub 저장소나 채팅에 공유하지 않습니다.

이 변경은 서버리스 함수 수 제한을 피하기 위한 코드 수정입니다. 사용량·콘텐츠 이용권·안정적 네이버 관측 가능성 또는 자동 유료 구독 운영을 해결하는 수정은 아닙니다.
