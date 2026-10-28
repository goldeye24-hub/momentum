-- Standalone Momentum administrator research records.
-- Dedicated tables prevent accidental access to or modification of member records.
-- Apply only after verifying the dedicated Momentum Supabase project.
BEGIN;
CREATE TABLE IF NOT EXISTS public.momentum_research_admin_targets(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 label text NOT NULL CHECK(length(label) BETWEEN 1 AND 70),
 keyword text NOT NULL CHECK(length(keyword) BETWEEN 2 AND 60),
 place_id text NOT NULL CHECK(place_id ~ '^[0-9]{6,20}$'),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(keyword,place_id)
);
CREATE TABLE IF NOT EXISTS public.momentum_research_admin_rank_checks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 target_id uuid NOT NULL REFERENCES public.momentum_research_admin_targets(id) ON DELETE CASCADE,
 keyword text NOT NULL CHECK(length(keyword) BETWEEN 2 AND 60),
 place_id text NOT NULL CHECK(place_id ~ '^[0-9]{6,20}$'),
 observed_at timestamptz NOT NULL DEFAULT now(),
 rank integer CHECK(rank BETWEEN 1 AND 500),
 status text NOT NULL CHECK(status IN('found','not_found_in_sample','found_without_rank','rank_list_unavailable')),
 observed_count integer NOT NULL DEFAULT 0 CHECK(observed_count BETWEEN 0 AND 500),
 CONSTRAINT admin_research_rank_match CHECK((status='found' AND rank IS NOT NULL) OR(status<>'found' AND rank IS NULL))
);
CREATE INDEX IF NOT EXISTS research_admin_rank_target_date ON public.momentum_research_admin_rank_checks(target_id,observed_at DESC);
CREATE TABLE IF NOT EXISTS public.momentum_research_admin_keyword_volumes(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 keyword text NOT NULL CHECK(length(keyword) BETWEEN 2 AND 40),
 measured_date date NOT NULL,
 observed_at timestamptz NOT NULL DEFAULT now(),
 pc_raw text NOT NULL CHECK(length(pc_raw) BETWEEN 1 AND 40),
 mobile_raw text NOT NULL CHECK(length(mobile_raw) BETWEEN 1 AND 40),
 pc_count bigint CHECK(pc_count>=0),
 mobile_count bigint CHECK(mobile_count>=0),
 total_count bigint CHECK(total_count>=0),
 CONSTRAINT admin_research_volume_check CHECK (
   ((pc_count IS NULL OR mobile_count IS NULL) AND total_count IS NULL) OR
   (pc_count IS NOT NULL AND mobile_count IS NOT NULL AND total_count=pc_count+mobile_count)
 ),
 UNIQUE(keyword,measured_date)
);
CREATE INDEX IF NOT EXISTS research_admin_volume_keyword_date ON public.momentum_research_admin_keyword_volumes(keyword,measured_date DESC);
ALTER TABLE public.momentum_research_admin_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_research_admin_rank_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.momentum_research_admin_keyword_volumes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.momentum_research_admin_targets FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.momentum_research_admin_rank_checks FROM PUBLIC,anon,authenticated;
REVOKE ALL ON TABLE public.momentum_research_admin_keyword_volumes FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.momentum_research_admin_targets TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.momentum_research_admin_rank_checks TO service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.momentum_research_admin_keyword_volumes TO service_role;
COMMIT;
