-- Safe permissions repair for the dedicated momentum-marketing Supabase project.
-- Apply only if the authenticated admin diagnostics point to permission denied,
-- after confirming the dashboard is on the momentum-marketing project.
-- Does not delete or modify any stored observations.
BEGIN;
REVOKE ALL ON TABLE public.rank_watch_targets FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.rank_watch_observations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rank_watch_targets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rank_watch_observations TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.rank_watch_observations_id_seq TO service_role;
COMMIT;
