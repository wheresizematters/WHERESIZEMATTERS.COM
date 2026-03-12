-- SIZE. App — Supabase Schema
-- Run this in your Supabase SQL editor

-- Profiles table
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  username    text unique not null,
  size_inches decimal(4, 2) not null check (size_inches > 0 and size_inches < 20),
  is_verified boolean default false,
  country     text,
  age_range   text,
  bio         text,
  created_at  timestamptz default now()
);

-- Row Level Security
alter table public.profiles enable row level security;

create policy "Public profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Posts table
create table if not exists public.posts (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  type        text not null check (type in ('discussion', 'poll')),
  content     text not null,
  comment_count integer default 0,
  created_at  timestamptz default now()
);

alter table public.posts enable row level security;

create policy "Posts are viewable by everyone"
  on public.posts for select using (true);

create policy "Users can create posts"
  on public.posts for insert with check (auth.uid() = user_id);

create policy "Users can delete their own posts"
  on public.posts for delete using (auth.uid() = user_id);

-- Poll options table
create table if not exists public.poll_options (
  id          uuid default gen_random_uuid() primary key,
  post_id     uuid references public.posts(id) on delete cascade not null,
  text        text not null,
  vote_count  integer default 0,
  created_at  timestamptz default now()
);

alter table public.poll_options enable row level security;

create policy "Poll options viewable by everyone"
  on public.poll_options for select using (true);

-- Votes table
create table if not exists public.votes (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid references public.profiles(id) on delete cascade not null,
  poll_option_id uuid references public.poll_options(id) on delete cascade not null,
  created_at     timestamptz default now(),
  unique (user_id, poll_option_id)
);

alter table public.votes enable row level security;

create policy "Users can vote once per option"
  on public.votes for insert with check (auth.uid() = user_id);

create policy "Users can see all votes"
  on public.votes for select using (true);

-- Leaderboard view (computed rank by size)
create or replace view public.leaderboard as
  select
    row_number() over (order by size_inches desc) as rank,
    id,
    username,
    size_inches,
    is_verified,
    country,
    age_range
  from public.profiles
  order by size_inches desc;

-- RPC: safely increment poll vote count
create or replace function public.increment_vote_count(option_id uuid)
returns void language sql security definer as $$
  update public.poll_options
  set vote_count = vote_count + 1
  where id = option_id;
$$;

-- Auto-update comment_count on posts when a comment is added
-- (extend this table when you add a comments feature)

-- Add media columns to posts
alter table public.posts
  add column if not exists media_url  text,
  add column if not exists media_type text check (media_type in ('image', 'video'));

-- Storage bucket for media (run once in Supabase dashboard → Storage → New bucket)
-- Bucket name: media | Public: true
-- Then add this policy in Storage → media → Policies:
--   Allow authenticated users to upload to their own folder:
--   ((storage.foldername(name))[1] = auth.uid()::text)

-- Enable realtime on feed-relevant tables
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.poll_options;
alter publication supabase_realtime add table public.profiles;
