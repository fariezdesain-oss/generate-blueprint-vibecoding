CREATE TABLE public.rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  reset_at timestamptz NOT NULL
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer
)
RETURNS TABLE(allowed boolean, retry_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer;
  v_reset_at timestamptz;
BEGIN
  IF v_user_id IS NULL OR p_key IS NULL OR left(p_key, length(v_user_id::text) + 1) <> v_user_id::text || ':' THEN
    RAISE EXCEPTION 'invalid rate limit key';
  END IF;

  IF p_limit IS NULL OR p_window_ms IS NULL OR p_limit <= 0 OR p_window_ms <= 0 THEN
    RAISE EXCEPTION 'limit and window must be positive';
  END IF;

  INSERT INTO public.rate_limits AS rate_limit (key, count, reset_at)
  VALUES (p_key, 1, clock_timestamp() + make_interval(secs => p_window_ms / 1000.0))
  ON CONFLICT (key) DO UPDATE
  SET (count, reset_at) = (
    SELECT
      CASE
        WHEN rate_limit.reset_at <= current_clock.value THEN 1
        ELSE rate_limit.count + 1
      END,
      CASE
        WHEN rate_limit.reset_at <= current_clock.value THEN current_clock.value + make_interval(secs => p_window_ms / 1000.0)
        ELSE rate_limit.reset_at
      END
    FROM (SELECT clock_timestamp() AS value) AS current_clock
  )
  RETURNING rate_limit.count, rate_limit.reset_at
  INTO v_count, v_reset_at;

  RETURN QUERY SELECT
    v_count <= p_limit,
    CASE
      WHEN v_count <= p_limit THEN 0
      ELSE greatest(1, ceil(extract(epoch FROM v_reset_at - clock_timestamp()))::integer)
    END;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO authenticated;
