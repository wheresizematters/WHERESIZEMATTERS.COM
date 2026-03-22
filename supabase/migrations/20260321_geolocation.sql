-- Add location columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lng double precision;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location_updated_at timestamptz;

-- Haversine distance function (returns miles)
CREATE OR REPLACE FUNCTION haversine_miles(lat1 float, lng1 float, lat2 float, lng2 float)
RETURNS float AS $$
DECLARE
  r float := 3958.8;
  dlat float := radians(lat2 - lat1);
  dlng float := radians(lng2 - lng1);
  a float;
BEGIN
  a := sin(dlat/2)^2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)^2;
  RETURN r * 2 * asin(sqrt(a));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Radius leaderboard RPC
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
    AND haversine_miles(center_lat, center_lng, p.lat, p.lng) <= radius_miles
  ORDER BY p.size_inches DESC;
END;
$$ LANGUAGE plpgsql STABLE;
