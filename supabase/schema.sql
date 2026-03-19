-- SIZE. App — Supabase Schema
-- Run this in your Supabase SQL editor

-- Auto-create profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, size_inches)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'size_inches')::decimal, 6.0)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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

-- Leaderboard view (computed rank by size, auth-only)
create or replace view public.leaderboard
  with (security_invoker = true)
as
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

-- Poll options insert/update/delete policies
create policy "Post owners can insert poll options"
  on public.poll_options for insert
  with check (
    exists (
      select 1 from public.posts
      where id = post_id and user_id = auth.uid()
    )
  );

create policy "Post owners can delete poll options"
  on public.poll_options for delete
  using (
    exists (
      select 1 from public.posts
      where id = post_id and user_id = auth.uid()
    )
  );

-- RPC: safely increment poll vote count (auth-guarded)
create or replace function public.increment_vote_count(option_id uuid)
returns void language plpgsql security definer as $$
begin
  if not exists (
    select 1 from public.votes
    where poll_option_id = option_id
      and user_id = auth.uid()
  ) then
    raise exception 'Unauthorized: must cast vote before incrementing count';
  end if;

  update public.poll_options
  set vote_count = vote_count + 1
  where id = option_id;
end;
$$;

-- Auto-update comment_count on posts when a comment is added
-- (extend this table when you add a comments feature)

-- Add media columns to posts
alter table public.posts
  add column if not exists media_url  text,
  add column if not exists media_type text check (media_type in ('image', 'video'));

-- Add tag column to posts
alter table public.posts
  add column if not exists tag text;

-- Storage bucket for media (run once in Supabase dashboard → Storage → New bucket)
-- Bucket name: media | Public: true
-- Then add this policy in Storage → media → Policies:
--   Allow authenticated users to upload to their own folder:
--   ((storage.foldername(name))[1] = auth.uid()::text)

-- Enable realtime on feed-relevant tables
alter publication supabase_realtime add table public.posts;
alter publication supabase_realtime add table public.poll_options;
alter publication supabase_realtime add table public.profiles;

-- ── Direct Messaging ──────────────────────────────────────────────────────────

-- user_1_id is always the lexicographically smaller UUID to prevent duplicates
create table if not exists public.conversations (
  id                   uuid default gen_random_uuid() primary key,
  user_1_id            uuid references public.profiles(id) on delete cascade not null,
  user_2_id            uuid references public.profiles(id) on delete cascade not null,
  last_message_at      timestamptz default now(),
  last_message_preview text,
  created_at           timestamptz default now(),
  unique (user_1_id, user_2_id),
  check (user_1_id < user_2_id)
);

alter table public.conversations enable row level security;

create policy "Users can view their conversations"
  on public.conversations for select
  using (auth.uid() = user_1_id or auth.uid() = user_2_id);

create policy "Users can create conversations they are part of"
  on public.conversations for insert
  with check (auth.uid() = user_1_id or auth.uid() = user_2_id);

create table if not exists public.messages (
  id              uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id       uuid references public.profiles(id) on delete cascade not null,
  content         text not null,
  created_at      timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Users can view messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations
      where id = conversation_id
        and (user_1_id = auth.uid() or user_2_id = auth.uid())
    )
  );

create policy "Users can send messages in their conversations"
  on public.messages for insert
  with check (
    auth.uid() = sender_id and
    exists (
      select 1 from public.conversations
      where id = conversation_id
        and (user_1_id = auth.uid() or user_2_id = auth.uid())
    )
  );

-- Keep last_message_at and preview up to date
create or replace function public.update_conversation_last_message()
returns trigger language plpgsql security definer as $$
begin
  update public.conversations
  set
    last_message_at      = new.created_at,
    last_message_preview = left(new.content, 60)
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_message_inserted
  after insert on public.messages
  for each row execute procedure public.update_conversation_last_message();

-- Enable realtime for messaging
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;

-- ── Verification ───────────────────────────────────────────────────────────────

-- Add admin flag to profiles
alter table public.profiles
  add column if not exists is_admin boolean default false;

-- Verification requests table (one active request per user)
create table if not exists public.verification_requests (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null unique,
  image_path    text not null,
  reported_size decimal(4,2) not null,
  ai_est_size   decimal(4,2),
  ai_confidence text,
  ai_notes      text,
  status        text default 'pending'
                  check (status in ('pending', 'auto_verified', 'approved', 'rejected')),
  created_at    timestamptz default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid references public.profiles(id)
);

alter table public.verification_requests enable row level security;

-- Users can view their own request
create policy "Users can view own verification request"
  on public.verification_requests for select
  using (auth.uid() = user_id);

-- Users can insert their own request
create policy "Users can submit verification request"
  on public.verification_requests for insert
  with check (auth.uid() = user_id);

-- Admins can view all pending requests
create policy "Admins can view all verification requests"
  on public.verification_requests for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

-- ── Social Auth ───────────────────────────────────────────────────────────────

-- Track whether user has explicitly set their size (needed for OAuth signups)
alter table public.profiles
  add column if not exists has_set_size boolean default false;

-- Update the handle_new_user trigger to set has_set_size = true
-- when size_inches is provided in metadata (email/password signup)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, size_inches, has_set_size)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'size_inches')::decimal, 6.0),
    (new.raw_user_meta_data->>'size_inches') is not null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Storage bucket: verifications (private)
-- Run in Supabase dashboard → Storage → New bucket:
--   Name: verifications | Public: false
-- Storage policy — allow authenticated users to upload to their own folder:
--   ((storage.foldername(name))[1] = auth.uid()::text)
