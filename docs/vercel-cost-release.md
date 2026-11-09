# Momentum / Vercel low-cost release procedure

## Current safety boundary
- Production Git branch remains `main`; do not delete or pause existing services.
- Vercel Preview deployments are disabled for `momentum` at the project level.
- Work locally or in a non-`main` branch; prefer draft PRs.
- `vercel.json` uses `scripts/should-vercel-build.cjs` as an Ignored Build Step.
  It skips non-main builds and edits to docs/tests/CI/scripts only, and **fails open**
  on an unknown Git baseline. Site content edits, `insights/`, and API edits still deploy.
- The daily editorial GitHub Actions workflow can continue pushing verified news to main.
  Those changes should still deploy. Disabling all production Git deployments would
  prevent that publishing workflow and is not part of this patch.

## Chromium optimization
Before: `api/compact.js`, `api/research-admin.js`, and
`api/place-rank-live.js` each explicitly bundled Chromium's binary files.

After: database and membership operations stay in `api/compact.js`, while the
four administrator ranking operations move to the existing browser-capable
`api/research-admin.js`. The public URL rewrites do not change.
The original admin research endpoint (no `op`) remains available.
The `api/place-rank-live.js` anonymous/mobile rank API is unchanged.
Individual handlers still enforce their existing admin session, method,
and same-origin checks.

This reduces **one explicit Chromium-bearing function bundle**, but exact
GB savings must be verified by comparing Vercel build artifact size and the
subsequent Function Storage usage. It does not remove existing retained builds.

## Test and production release gate
1. `node --test tests/function-routing-cost.test.cjs tests/vercel-build-guard.test.cjs`
2. `node --test tests/admin-members.test.cjs tests/place-keyword-insights.test.cjs tests/competitor-compare.test.cjs tests/rank-live-control.test.cjs tests/rank-outage-fallback.test.cjs`
3. Verify `/admin/research/api`, all four ranking URLs, member listing,
   database connectivity, public ranking, and original inquiry form.
4. For exact bundle sizes use `VERCEL_ANALYZE_BUILD_OUTPUT=1` when producing
   one explicitly approved build; do **not** trigger repeated production builds.
5. Merge only after CI, browser checks, and a reviewed release decision.
6. After the first deployment, compare Vercel `Function Storage` over completed
   daily billing intervals. Restore previous production deployment if regressions occur.

## Avoid recurring costs
- Do not merge every small edit to `main`: collect changes in a branch.
- Do not run `vercel --prod --force` for normal updates.
- Preview deployments can be re-enabled later for a limited approved validation.
- Keep the saved production retention policy (14 days) and other retention
  policies (7 days) unless rollback needs require changes.
