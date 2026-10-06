-- Caption the City: photos, AI-generated captions, and votes.
-- Run after profiles.sql. Safe to run more than once.

-- 1. Photos users upload. The image itself lives in Storage; we store its URL.
create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  image_url text not null,
  storage_path text not null,
  neighborhood text,
  note text check (char_length(note) <= 140),
  created_at timestamptz not null default now()
);

-- 2. AI-generated captions, with the exact prompt and model used for each.
create table if not exists public.captions (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.photos (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 200),
  prompt text not null,
  model text not null,
  upvotes integer not null default 0,
  downvotes integer not null default 0,
  score integer generated always as (upvotes - downvotes) stored,
  created_at timestamptz not null default now()
);
create index if not exists captions_photo_id_idx on public.captions (photo_id);
create index if not exists captions_created_at_score_idx on public.captions (created_at, score desc);

-- 3. One vote per user per caption: +1 (upvote) or -1 (downvote).
create table if not exists public.caption_votes (
  id uuid primary key default gen_random_uuid(),
  caption_id uuid not null references public.captions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  unique (caption_id, user_id)
);

-- 4. Keep each caption's vote counts in sync. Runs as the table owner so
--    users never need (or get) permission to edit the counts directly.
create or replace function public.update_caption_vote_counts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.captions
    set upvotes = upvotes - (old.vote = 1)::int,
        downvotes = downvotes - (old.vote = -1)::int
    where id = old.caption_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.captions
    set upvotes = upvotes + (new.vote = 1)::int,
        downvotes = downvotes + (new.vote = -1)::int
    where id = new.caption_id;
  end if;
  return null;
end;
$$;

drop trigger if exists on_caption_vote_change on public.caption_votes;
create trigger on_caption_vote_change
  after insert or update or delete on public.caption_votes
  for each row execute function public.update_caption_vote_counts();

-- 5. Row Level Security on every table, as strict as the app allows.

-- movies: read-only for everyone.
alter table public.movies enable row level security;
drop policy if exists "Anyone can view movies" on public.movies;
create policy "Anyone can view movies" on public.movies
  for select to anon, authenticated using (true);

-- photos: everyone can browse; only the owner can add or delete their own.
alter table public.photos enable row level security;
drop policy if exists "Anyone can view photos" on public.photos;
create policy "Anyone can view photos" on public.photos
  for select to anon, authenticated using (true);
drop policy if exists "Users can add own photos" on public.photos;
create policy "Users can add own photos" on public.photos
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete own photos" on public.photos;
create policy "Users can delete own photos" on public.photos
  for delete to authenticated using ((select auth.uid()) = user_id);

-- captions: everyone can read; users can only add captions to their own
-- photos, and can never edit captions or their vote counts.
alter table public.captions enable row level security;
drop policy if exists "Anyone can view captions" on public.captions;
create policy "Anyone can view captions" on public.captions
  for select to anon, authenticated using (true);
drop policy if exists "Users can add captions to own photos" on public.captions;
create policy "Users can add captions to own photos" on public.captions
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.photos
      where photos.id = photo_id and photos.user_id = (select auth.uid())
    )
  );
revoke insert, update on public.captions from anon, authenticated;
grant insert (photo_id, user_id, body, prompt, model) on public.captions to authenticated;

-- caption_votes: signed-in users can only see, cast, change, or remove
-- their own votes. Totals are public through captions.upvotes/downvotes.
alter table public.caption_votes enable row level security;
drop policy if exists "Users can view own votes" on public.caption_votes;
create policy "Users can view own votes" on public.caption_votes
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "Users can cast own votes" on public.caption_votes;
create policy "Users can cast own votes" on public.caption_votes
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can change own votes" on public.caption_votes;
create policy "Users can change own votes" on public.caption_votes
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can remove own votes" on public.caption_votes;
create policy "Users can remove own votes" on public.caption_votes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- 6. Storage bucket for city photos (public read, 5 MB max, images only).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('city-photos', 'city-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Users can upload own city photos" on storage.objects;
create policy "Users can upload own city photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'city-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Users can delete own city photos" on storage.objects;
create policy "Users can delete own city photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'city-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
