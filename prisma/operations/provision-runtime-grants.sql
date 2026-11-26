-- Review on the actual target before any shared change. The owner first creates
-- fyp_app_runtime as a dedicated NOLOGIN role and provisions a separate login.
BEGIN;
DO $guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'fyp_app_runtime'
      AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb
      AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls
  ) OR pg_has_role('fyp_app_runtime', current_user, 'MEMBER') THEN
    RAISE EXCEPTION 'Expected a dedicated unprivileged runtime group';
  END IF;
  IF has_schema_privilege('fyp_app_runtime', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'Remove inherited public-schema CREATE before applying runtime grants';
  END IF;
END
$guard$;

GRANT USAGE ON SCHEMA public TO fyp_app_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE
  public."User", public."Bus", public."ServiceLine", public."Route",
  public."ServiceBlock", public."Stop", public."Trip", public."TripStop",
  public."Booking", public."WaitlistEntry", public."WalkInIntent",
  public."WalkInJourney", public."Penalty", public."PenaltyAppeal", public."Notification"
TO fyp_app_runtime;
GRANT SELECT, INSERT ON TABLE public."TripStatusHistory" TO fyp_app_runtime;
GRANT SELECT, INSERT, DELETE ON TABLE
  public."RouteStop", public."TripSegment", public."TripSeat", public."ReservedSeatSegment",
  public."StandingSegmentClaim", public."TripLocationSample"
TO fyp_app_runtime;
-- The approved workflow may replace an empty Trip's snapshot.
GRANT DELETE ON TABLE public."TripStop" TO fyp_app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public."ExternalAuthIdentity", public."EmailVerificationToken", public."PasswordResetToken"
TO fyp_app_runtime;
CREATE POLICY fyp_app_runtime_identity ON public."ExternalAuthIdentity"
  FOR ALL TO fyp_app_runtime USING (true) WITH CHECK (true);
CREATE POLICY fyp_app_runtime_identity ON public."EmailVerificationToken"
  FOR ALL TO fyp_app_runtime USING (true) WITH CHECK (true);
CREATE POLICY fyp_app_runtime_identity ON public."PasswordResetToken"
  FOR ALL TO fyp_app_runtime USING (true) WITH CHECK (true);
COMMIT;
