-- Update radius leaderboard to show verified users only
CREATE OR REPLACE FUNCTION leaderboard_by_radius(
  center_lat float,
  center_lng float,
  radius_miles float
)
RETURNS TABLE(
  id uuid,
  username text,
  size_inches float,
  is_verified boolean,
  lat float,
  lng float,
  distance_miles float,
  rank bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.username,
    p.size_inches::float,
    p.is_verified,
    p.lat,
    p.lng,
    haversine_miles(center_lat, center_lng, p.lat, p.lng) AS distance_miles,
    ROW_NUMBER() OVER (ORDER BY p.size_inches DESC) AS rank
  FROM profiles p
  WHERE
    p.lat IS NOT NULL
    AND p.lng IS NOT NULL
    AND p.has_set_size = true
    AND p.is_verified = true
    AND haversine_miles(center_lat, center_lng, p.lat, p.lng) <= radius_miles
  ORDER BY p.size_inches DESC;
END;
$$ LANGUAGE plpgsql STABLE;
