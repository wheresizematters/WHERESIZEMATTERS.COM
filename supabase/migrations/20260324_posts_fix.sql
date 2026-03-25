-- Fix missing posts columns, tables, and functions

-- Add missing columns to posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0;

-- Comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id    uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
CREATE POLICY "Comments are viewable by everyone"
  ON public.comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own comments" ON public.comments;
CREATE POLICY "Users can insert their own comments"
  ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own comments" ON public.comments;
CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Trigger to keep comment_count in sync
CREATE OR REPLACE FUNCTION public.update_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_comment_change ON public.comments;
CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.update_comment_count();

-- Post votes table
CREATE TABLE IF NOT EXISTS public.post_votes (
  id      uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  vote    integer NOT NULL CHECK (vote IN (-1, 1)),
  UNIQUE (post_id, user_id)
);

ALTER TABLE public.post_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see all post votes" ON public.post_votes;
CREATE POLICY "Users can see all post votes"
  ON public.post_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can manage their own post votes" ON public.post_votes;
CREATE POLICY "Users can manage their own post votes"
  ON public.post_votes FOR ALL USING (auth.uid() = user_id);

-- vote_on_post RPC
CREATE OR REPLACE FUNCTION public.vote_on_post(p_post_id uuid, p_user_id uuid, p_vote integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_vote = 0 THEN
    DELETE FROM public.post_votes WHERE post_id = p_post_id AND user_id = p_user_id;
  ELSE
    INSERT INTO public.post_votes (post_id, user_id, vote)
    VALUES (p_post_id, p_user_id, p_vote)
    ON CONFLICT (post_id, user_id) DO UPDATE SET vote = p_vote;
  END IF;

  UPDATE public.posts
  SET score = COALESCE((SELECT SUM(vote) FROM public.post_votes WHERE post_id = p_post_id), 0)
  WHERE id = p_post_id;
END;
$$;

-- Enable realtime for comments and post_votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_votes;
