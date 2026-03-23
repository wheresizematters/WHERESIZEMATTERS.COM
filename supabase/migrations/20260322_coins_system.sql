-- Coins system infrastructure

-- Ensure size_coins exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS size_coins int NOT NULL DEFAULT 0;

-- Daily tracking columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_daily_coin_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_post_coin_at timestamptz;

-- Notification preference
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;

-- Safe atomic coin increment (prevents race conditions with concurrent updates)
CREATE OR REPLACE FUNCTION public.award_coins(p_user_id uuid, p_amount int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET size_coins = COALESCE(size_coins, 0) + p_amount
  WHERE id = p_user_id;
END;
$$;

-- Trigger: award 15 coins to post author when their post is upvoted
CREATE OR REPLACE FUNCTION public.handle_post_upvote_coins()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  post_author_id uuid;
BEGIN
  -- Fire when vote transitions to +1 (new upvote or changed from downvote/neutral)
  IF (TG_OP = 'INSERT' AND NEW.vote = 1)
  OR (TG_OP = 'UPDATE' AND NEW.vote = 1 AND OLD.vote IS DISTINCT FROM 1) THEN
    SELECT user_id INTO post_author_id FROM public.posts WHERE id = NEW.post_id;
    -- Don't award coins for self-upvotes
    IF post_author_id IS NOT NULL AND post_author_id != NEW.user_id THEN
      PERFORM public.award_coins(post_author_id, 15);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_post_upvote_coins ON public.post_votes;
CREATE TRIGGER on_post_upvote_coins
  AFTER INSERT OR UPDATE ON public.post_votes
  FOR EACH ROW EXECUTE FUNCTION public.handle_post_upvote_coins();
