# Momentum redesigned home: retire old standalone web pages (2026-11-09)

The new homepage at / is the only general sales landing page. At the
owner's request, 21 old standalone public pages (13 old service pages,
five old industries, one about, and two old free-tool pages) were retired.

The original page URLs now permanently redirect to the new main website,
including direct /index.html paths. The sitemap was updated accordingly.
Previous Naver DataLab and portfolio demo redirects remain as they were.

The public rank query endpoint (api/place-rank-live.js) and its quota helper
were removed. This eliminates one explicitly Chromium-bearing serverless
function. Admin's rank browser modules and API handlers are preserved,
along with the modern homepage, production inquiries, marketing news and
insights articles, portfolio demonstrations, and membership/admin data.

Old /lab static resources were removed. Service-specific CSS and other
shared site assets were kept pending a separate dependency review.

Validation:
node --test tests/site-legacy-retirement.test.cjs tests/active-momentum-workflow.test.cjs tests/retired-pages-redirects.test.cjs tests/search-trends.test.cjs tests/public-free-tools-access.test.cjs

Releasing this change does not immediately remove older retained
function builds. Vercel Function Storage savings must be checked later.
