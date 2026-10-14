# 모멘텀 매장진단 — 내부 운영 설정

고객 화면(/lab/)은 **상호명 + 플레이스 URL** 두 필드만 입력받습니다.
모든 외부 데이터 API 인증/요금/허용범위/호출량은 운영자가 Vercel 서버 환경에서 설정합니다.
고객에게 API 키, CSV, 키워드/지역, 로그인 자격 증명, 외부 서비스 결제를 요구하지 않습니다.

## 네이버 우선 연결(2026년 NAVER API HUB)
- `MOMENTUM_NAVER_API_ENABLED=true`: NAVER HUB 지역검색 연결 스위치. 사용권한·사업 목적 확인 전 기본 꺼짐.
- `MOMENTUM_NAVER_PUBLIC_DISPLAY_APPROVED=true`: 고객용 검색결과 공개 표시 라이선스를 담당자가 문서로 확인한 경우에만 설정. 이 변수는 기술적 게이트이지 법적 허가를 대신하지 않습니다.
- `NAVER_API_HUB_CLIENT_ID`, `NAVER_API_HUB_CLIENT_SECRET`: NAVER Cloud Platform > NAVER API HUB에서 발급받은 전용 키. 기존 developers.naver.com 검색 API 키와 별개.
- 신규 인증 엔드포인트 `https://naverapihub.apigw.ntruss.com/search/v1/local`. API 결과 5개만 반환하며 실제 네이버지도 검색순위가 아닙니다.
- 플레이스 URL의 숫자 ID는 문자열에서 추출 가능하나, 지역검색 API의 업체와 동일 ID라는 증명은 별도 교차 검증이 필요합니다.
- 네이버 검색 API 약관은 검색 결과의 제3자 제공/AI 입력/캐시/수익화 등을 제한합니다. 모멘텀 공개 무료 분석실의 사업 이용 가능 범위는 반드시 NAVER API HUB에 서면으로 문의하고 답변 보관 후 설정하세요.
- 네이버 검색광고 월간 검색량은 검색광고 API 별도 광고주/파트너 계정과 이용조건 확인이 필요하며, 지역검색 API의 검색결과 수를 검색량으로 표현하면 안 됩니다.

## 프로덕션 환경 변수 (Vercel 프로젝트 momentum)
- \`MOMENTUM_PLACE_API_ENABLED=true\` : 카카오/구글 장소조회 서버 활성화 스위치. 실제 재제공 라이선스 검토 후 활성화.
- \`KAKAO_REST_API_KEY\` : Kakao Developers → 앱 → 로컬 검색 기능 권한/할당량 확인.
- \`GOOGLE_PLACES_API_KEY\` : Google Cloud → Maps Platform → Places API (New) 활성화 + 결제/할당량 + 키 제한 설정.
- \`PAGESPEED_API_KEY\` (선택) : Google PageSpeed Insights 기술 SEO 도구. 연결된 구글 장소정보에 홈페이지가 있는 경우에 한함.
- \`MOMENTUM_AI_ENABLED=true\`, \`OPENAI_API_KEY\` : 리뷰 답글 AI. 공개 엔드포인트에 영속 rate limit, 예산 제한, 프롬프트 공격 대비 등이 마련된 뒤 활성화.
- \`MOMENTUM_AI_MODEL\` (선택) : 내부 승인된 모델.

**절대** API 키를 GitHub / HTML / 브라우저 JS / GitHub Issue / 사용자 답변에 넣지 않습니다. Vercel 설정 화면의 환경 변수로만 추가합니다. 값은 코드 변경만으로 자동 생성되지 않습니다.

## 고객 요청 처리
1. 고객은 상호 + 플레이스 URL을 입력.
2. \`POST /api/business-audit\`는 URL이 네이버/구글/카카오 공식 URL인지 확인하고 Google Places / Kakao Local API를 서버에서 호출.
3. 동일 상호가 여러 개면 임의 업체를 확정하지 않고 \`ambiguous\`로 반환.
4. 공개 장소 데이터로 확인한 이름, 주소, 카테고리, 연락처 등을 출처/시점과 함께 표시.
5. 업종/지역이 신뢰 가능하게 식별되면 카카오 API로 유사 업종 경쟁업체 목록 검색(최대 제공 결과 범위). \`MOMENTUM_PLACE_API_ENABLED\` 조건을 따름.
6. Google Places에 신뢰 가능한 업체 홈페이지 URL이 있는 경우 \`/api/website-seo\`로 기술 SEO 검사 시도(실제 지도 SEO나 GEO 점수로 표시 금지).
7. 실제 데이터가 없으면 "관리자 데이터 연동 전"을 표시. 허위 순위, 검색량, 리뷰수, 유동인구, AI 추천률 절대 금지.

## 아직 자동 연결되지 않은 데이터
- 네이버 스마트플레이스 실제 사용자별 지도 순위, 점주 비공개 방문·조회 데이터: 공개 범용 API 없음. 비허가 매크로/봇 접속 전제 금지.
- 네이버 검색광고 월간 검색량: 광고주/파트너 API 계정 및 제3자 전시 허용 조건 별도 검토.
- 다른 AI의 실제 매장 추천: 모델별 공식 응답 호출·약관·비용 확인 필요.
- 전국 실시간 유동인구: 지역별 별도 출처·라이선스 필요.
- 세 포털의 맵 앱 개인화 순위: 공식 장소 API 결과 순서와 다름.

## 과금·운영 안전장치
- Google Places는 FieldMask 기반 과금. 필요한 필드만 요청하고 프로젝트 일일/월별 예산 경고 설정.
- Kakao Local 검색 쿼터·약관은 Kakao Developers에 고지된 최신 내용 확인.
- 클라우드 캐시는 각 제공업체 약관을 확인한 뒤 구축.
- 첫 고객 공개 전에 서버측 영속 Rate Limit, 일일 API 비용 제한, 악의적 반복 조회 방지, 오류 모니터링 필요.
- 원본 API 데이터를 제3자에게 표시하는 계약상 허용 범위와 출처/속성 표시 요건을 확인.

공식 참고:
https://developers.kakao.com/docs/latest/ko/local/dev-guide
https://developers.google.com/maps/documentation/places/web-service/text-search
https://developers.google.com/maps/billing-and-pricing/pricing
