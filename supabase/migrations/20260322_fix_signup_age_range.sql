-- Fix handle_new_user trigger to save age_range from signup metadata
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, size_inches, has_set_size, age_range)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'size_inches')::decimal, 6.0),
    (new.raw_user_meta_data->>'size_inches') is not null,
    new.raw_user_meta_data->>'age_range'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
