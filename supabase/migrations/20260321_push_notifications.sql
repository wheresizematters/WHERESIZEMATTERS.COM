-- ─────────────────────────────────────────────────────────────────────────────
-- Push Notification Setup
-- Run this in the Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add push_token column to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_token text;

-- 2. Helper function: calls the send-notification edge function
--    Uses pg_net (enabled by default on Supabase) to make async HTTP calls.
CREATE OR REPLACE FUNCTION notify_user(
  p_user_id   uuid,
  p_title     text,
  p_body      text,
  p_data      jsonb DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_url     text;
  v_key     text;
BEGIN
  v_url := current_setting('app.supabase_url', true) || '/functions/v1/send-notification';
  v_key := current_setting('app.service_role_key', true);

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body    := jsonb_build_object(
      'user_id', p_user_id::text,
      'title',   p_title,
      'body',    p_body,
      'data',    p_data
    )
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Trigger: New message → notify recipient
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_notify_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_recipient_id  uuid;
  v_sender_name   text;
  v_preview       text;
BEGIN
  -- Find the other participant in the conversation
  SELECT
    CASE
      WHEN c.user_1_id = NEW.sender_id THEN c.user_2_id
      ELSE c.user_1_id
    END
  INTO v_recipient_id
  FROM conversations c
  WHERE c.id = NEW.conversation_id;

  IF v_recipient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get sender username
  SELECT username INTO v_sender_name
  FROM profiles WHERE id = NEW.sender_id;

  -- Build preview (truncate long messages)
  IF NEW.media_url IS NOT NULL THEN
    v_preview := CASE NEW.media_type
      WHEN 'video' THEN '📹 sent you a video'
      ELSE '📸 sent you a photo'
    END;
  ELSE
    v_preview := left(NEW.content, 100);
  END IF;

  PERFORM notify_user(
    v_recipient_id,
    '@' || v_sender_name,
    v_preview,
    jsonb_build_object('screen', 'chat', 'conversation_id', NEW.conversation_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_message_notify ON messages;
CREATE TRIGGER on_new_message_notify
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_new_message();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Trigger: New comment → notify post author
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_notify_new_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_post_author_id  uuid;
  v_commenter_name  text;
  v_post_title      text;
BEGIN
  -- Get post author (don't notify if they comment on their own post)
  SELECT user_id, COALESCE(title, left(content, 50))
  INTO v_post_author_id, v_post_title
  FROM posts WHERE id = NEW.post_id;

  IF v_post_author_id IS NULL OR v_post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT username INTO v_commenter_name
  FROM profiles WHERE id = NEW.user_id;

  PERFORM notify_user(
    v_post_author_id,
    '@' || v_commenter_name || ' commented on your post',
    left(NEW.content, 120),
    jsonb_build_object('screen', 'post', 'post_id', NEW.post_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_comment_notify ON comments;
CREATE TRIGGER on_new_comment_notify
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_new_comment();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Trigger: New follow → notify the person being followed
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_notify_new_follow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_follower_name   text;
  v_follower_size   numeric;
  v_tier            text;
BEGIN
  SELECT username, size_inches INTO v_follower_name, v_follower_size
  FROM profiles WHERE id = NEW.follower_id;

  -- Don't notify if somehow following yourself
  IF NEW.follower_id = NEW.following_id THEN
    RETURN NEW;
  END IF;

  -- Simple tier label based on size
  v_tier := CASE
    WHEN v_follower_size >= 8   THEN '🏆 Monster'
    WHEN v_follower_size >= 7   THEN '🔥 Hung'
    WHEN v_follower_size >= 6   THEN '💪 Above Average'
    WHEN v_follower_size >= 5   THEN '📊 Average'
    ELSE '🌱 Grower'
  END;

  PERFORM notify_user(
    NEW.following_id,
    '@' || v_follower_name || ' connected with you',
    v_tier || ' — Check out their profile',
    jsonb_build_object('screen', 'profile', 'user_id', NEW.follower_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_follow_notify ON follows;
CREATE TRIGGER on_new_follow_notify
  AFTER INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION trigger_notify_new_follow();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Set app.supabase_url and app.service_role_key
--    Replace the values below with your actual Supabase URL and service role key
--    then run this block separately in the SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────
-- ALTER DATABASE postgres
--   SET app.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';
-- ALTER DATABASE postgres
--   SET app.service_role_key = 'YOUR_SERVICE_ROLE_KEY';
