# Momentum Lab: retired-feature cleanup (2026-11-09)

Scope confirmed by owner: the active admin-facing Momentum Lab uses the Place ranking monitor, monthly keyword search volume, single Place rank lookup, and a link to Naver DataLab. Public /lab/ and /lab/rank/ remain, as do the existing marketing, CRM, and site-builder pages.

Removed in the cleanup branch:
- lab/rank/rank.js
- lab/customer.js
- lab/intel.js
- lab/tools-v2.js
- lab/studio.js
- lab/self-audit.js
- api/search-trends.js
- api/keyword-opportunities.js
- api/rank-watch-cron.js

Retained: site-builder/research-index.html, api/research-admin.js, api/_research-admin.js, api/rank-rebuild.js, api/_place-observe.js, api/place-rank-live.js, lab/rank/index.html, lab/rank/public-rank.js, the admin/login/CRM/SEO routes, existing redirects and sitemap. NOTE: Removing the disabled cron does not establish daily automated ranking; that was never scheduled in vercel.json.

Verified user-facing defect: admin research screen previously pointed one-off lookup to /rank-rebuild/ (404); change link and both URL variants to the functioning /lab/rank/ endpoint.

No pageview or historical external API caller telemetry was available; removal is based on the declared active workflows and GitHub code references, not proof that endpoint URLs were never requested by a third party. Keep historical SEO redirects.

Validation: node --test tests/active-momentum-workflow.test.cjs tests/retired-pages-redirects.test.cjs tests/search-trends.test.cjs tests/public-free-tools-access.test.cjs tests/rank-position-accuracy.test.cjs
