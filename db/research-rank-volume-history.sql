-- Momentum research lab: owner-isolated time-series.
-- Apply only in the dedicated Momentum Supabase project after db/member-portal.sql.
-- Internal service-role only; app enforces verified signed member session
-- and validates ownership on ALL reads/writes.
BEGIN;
-- Composite ownership constraint prevents a rank record referring to another user's target.
CREATE UNIQUE INDEX IF NOT EXISTS member_targets_owner_id_unique
 ON public.momentum_member_targets(owner_id,id);
CREATE TABLE IF NOT EXISTS public.momentum_research_rank_checks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES public.momentum_member_accounts(user_id) ON DELETE CASCADE,
 target_id uuid NOT NULL REFERENCES public.momentum_member_targets(id) ON DELETE CASCADE,
 keyword text NOT NULL CHECK(length(keyword) BETWEEN 2 AND 60),
 place_id text NOT NULL CHECK(place_id ~ '^[0-9]{6,20}$'),
 observed_at timestamptz NOT NULL DEFAULT now(),
 rank integer CHECK(rank BETWEEN 1 AND 500),
 status text NOT NULL CHECK(status IN ('found','not_found_in_sample','found_without_rank','rank_list_unavailable')),
 observed_count integer NOT NULL DEFAULT 0 CHECK(observed_count BETWEEN 0 AND 500),
 rank_basis text NOT NULL DEFAULT 'observed_mobile_list' CHECK(rank_basis='observed_mobile_list'),
 CONSTRAINT research_rank_status_consistent CHECK (
  (status='found' AND rank IS NOT NULL) OR
  (status<>'found' AND rank IS NULL)
 )
);
DO $research$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_constraint WHERE conname='momentum_research_rank_owner_target_fk'
 ) THEN
  ALTER TABLE public.momentum_research_rank_checks
   ADD CONSTRAINT momentum_research_rank_owner_target_fk
   FOREIGN KEY(owner_id,target_id)
   REFERENCES public.momentum_member_targets(owner_id,id) ON DELETE CASCADE;
 END IF;
END $research$;
CREATE INDEX IF NOT EXISTS research_rank_owner_target_time
 ON public.momentum_research_rank_checks(owner_id,target_id,observed_at DESC);
CREATE TABLE IF NOT EXISTS public.momentum_research_keyword_volumes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES public.momentum_member_accounts(user_id) ON DELETE CASCADE,
 keyword text NOT NULL CHECK(length(keyword) BETWEEN 2 AND 40),
 measured_date date NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),
 pc_raw text NOT NULL CHECK(length(pc_raw) BETWEEN 1 AND 40),
 mobile_raw text NOT NULL CHECK(length(mobile_raw) BETWEEN 1 AND 40),
 pc_count bigint CHECK(pc_count >= 0),
 mobile_count bigint CHECK(mobile_count >= 0),
 total_count bigint CHECK(total_count >= 0),
 source text NOT NULL DEFAULT 'naver_searchad_keywordstool' CHECK(source='naver_searchad_keywordstool'),
 UNIQUE(owner_id,keyword,measured_date),
 CONSTRAINT research_volume_total_consistent CHECK(
  (pc_count IS NULL OR mobile_count IS NULL) AND total_count IS NULL
  OR
  (pc_count IS NOT NULL AND mobile_count IS NOT NULL AND total_count=pc_count+mobile_count)
 )
);
CREATE INDEX IF NOT EXISTS research_volume_owner_keyword_date
 ON public.momentum_research_keyword_volumes(owner_id,keyword,measured_date DESC);

ALTER TABLE public.momentum_research_rank_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_research_keyword_volumes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.momentum_research_rank_checks FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.momentum_research_keyword_volumes FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.momentum_research_rank_checks TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.momentum_research_keyword_volumes TO service_role;

-- Important: The service role bypasses RLS. Never expose it to frontend code.
-- The API MUST filter by verified session owner_id and verify target ownership.
COMMIT;
