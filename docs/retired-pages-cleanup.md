# Retired Momentum page cleanup (2026-11-09)

Safe removal only. This does **not** remove any production service, DB, rankings API, news collection or customer-facing portfolio page.

Removed seven obsolete static files:
- `lab/keywords/index.html`, `keywords.js`, `keywords.css`: every old page URL already redirected to `/lab/`.
- `lab/trends/index.html`, `trends.js`, `trends.css`: old user-facing path already pointed to official Naver DataLab. Add a redirect for the previously unhandled `/lab/trends/index.html`.
- `website-samples/index.html`: HTML-only fallback. Existing portfolio redirects remain; add `/website-samples/index.html` redirect.

Retained intentionally:
- `lab/rank/rank.js` (obsolete on current public page, but contains blog ranking implementation and is referenced in older regression tests).
- `api/search-trends.js`, `api/keyword-opportunities.js`, `api/blog-rank-observation.js` and all active public ranking and admin APIs pending separate usage review.
- `lab/rank/index.html`, `lab/rank/public-rank.js`, the homepage, portfolio, site-builder, SEO content, news jobs, redirects, sitemap and DB configuration.

Validation:
`node --test tests/retired-pages-redirects.test.cjs tests/public-free-tools-access.test.cjs tests/search-trends.test.cjs`

Actual use cannot be verified from pageviews because project Web Analytics is not enabled. These files are removed as unused **default entrypoints**, not proven never requested. Retain redirects for bookmarks and search engine links.
