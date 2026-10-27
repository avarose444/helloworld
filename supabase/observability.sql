-- Week 7: the AI pipeline as data, plus logs of every generation.
-- Run in the Supabase SQL editor after admin.sql. Safe to run more than once.
--
--   llm_providers ─< llm_models
--   llm_prompt_chains ─< llm_prompt_chain_steps >─ llm_models
--   llm_prompt_chains ── prompt_chain_mix (how often each chain is picked)
--   terms, generation_examples  (fed into prompts as {{terms}} / {{examples}})
--   generation_requests ─< llm_responses   (one request per "write captions" click,
--                                           one response per model call)
--   allowed_signup_domains, whitelist_email_addresses

-- 1. Tables ------------------------------------------------------------------

create table if not exists public.llm_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 80),
  base_url text,
  api_key_env text, -- name of the server env var holding the key, never the key itself
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.llm_models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.llm_providers (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  api_model_id text not null unique check (char_length(api_model_id) between 1 and 120),
  temperature numeric(3, 2) not null default 1 check (temperature between 0 and 2),
  priority integer not null default 0, -- lower is tried first when falling back
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.llm_prompt_chains (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.llm_prompt_chain_steps (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.llm_prompt_chains (id) on delete cascade,
  step_order integer not null check (step_order >= 1),
  title text not null,
  model_id uuid references public.llm_models (id) on delete set null, -- null = best active model
  include_image boolean not null default true,
  output_json boolean not null default false, -- the last step must return a JSON array of captions
  prompt_template text not null,
  created_at timestamptz not null default now(),
  unique (chain_id, step_order)
);

create table if not exists public.prompt_chain_mix (
  chain_id uuid primary key references public.llm_prompt_chains (id) on delete cascade,
  weight integer not null default 0 check (weight between 0 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  term text not null unique check (char_length(term) between 1 and 80),
  definition text not null check (char_length(definition) between 1 and 400),
  example text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_examples (
  id uuid primary key default gen_random_uuid(),
  scene text not null check (char_length(scene) between 1 and 300), -- what the photo shows
  caption text not null check (char_length(caption) between 1 and 200),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  photo_id uuid references public.photos (id) on delete set null,
  chain_id uuid references public.llm_prompt_chains (id) on delete set null,
  chain_name text,
  source text not null default 'post' check (source in ('post', 'more', 'admin', 'backfill')),
  requested_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  error text,
  caption_count integer not null default 0,
  duration_ms integer,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists generation_requests_created_at_idx on public.generation_requests (created_at desc);

create table if not exists public.llm_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.generation_requests (id) on delete cascade,
  step_order integer not null default 1,
  model text not null,
  prompt text not null,
  response_text text,
  http_status integer,
  ok boolean not null default false,
  duration_ms integer,
  created_at timestamptz not null default now()
);
create index if not exists llm_responses_request_id_idx on public.llm_responses (request_id);

create table if not exists public.allowed_signup_domains (
  id uuid primary key default gen_random_uuid(),
  domain text not null unique check (domain = lower(domain) and domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  created_at timestamptz not null default now()
);

create table if not exists public.whitelist_email_addresses (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  note text,
  created_at timestamptz not null default now()
);

-- Every chain gets a mix row (weight 0 until an admin turns it up).
create or replace function public.add_chain_mix_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.prompt_chain_mix (chain_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists on_prompt_chain_created on public.llm_prompt_chains;
create trigger on_prompt_chain_created
  after insert on public.llm_prompt_chains
  for each row execute function public.add_chain_mix_row();

-- 2. Row Level Security -------------------------------------------------------

-- Pipeline config: signed-in users (the main app, while generating) can read;
-- only superadmins can write.
do $$
declare t text;
begin
  foreach t in array array['llm_providers', 'llm_models', 'llm_prompt_chains', 'llm_prompt_chain_steps', 'prompt_chain_mix', 'terms', 'generation_examples']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Signed-in users can read %1$s" on public.%1$I', t);
    execute format('create policy "Signed-in users can read %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('drop policy if exists "Superadmins manage %1$s" on public.%1$I', t);
    execute format('create policy "Superadmins manage %1$s" on public.%1$I for all to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()))', t);
  end loop;
end $$;

-- Access lists: superadmins only.
do $$
declare t text;
begin
  foreach t in array array['allowed_signup_domains', 'whitelist_email_addresses']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Superadmins manage %1$s" on public.%1$I', t);
    execute format('create policy "Superadmins manage %1$s" on public.%1$I for all to authenticated using ((select public.is_superadmin())) with check ((select public.is_superadmin()))', t);
  end loop;
end $$;

-- generation_requests: users log and finish their own requests; superadmins read all.
alter table public.generation_requests enable row level security;
drop policy if exists "Users can log own generation requests" on public.generation_requests;
create policy "Users can log own generation requests" on public.generation_requests
  for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can view own generation requests" on public.generation_requests;
create policy "Users can view own generation requests" on public.generation_requests
  for select to authenticated using ((select auth.uid()) = user_id or (select public.is_superadmin()));
drop policy if exists "Users can finish own generation requests" on public.generation_requests;
create policy "Users can finish own generation requests" on public.generation_requests
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke update on public.generation_requests from anon, authenticated;
grant update (photo_id, status, error, caption_count, duration_ms, finished_at) on public.generation_requests to authenticated;

-- llm_responses: users log responses to their own requests; superadmins read all.
alter table public.llm_responses enable row level security;
drop policy if exists "Users can log responses to own requests" on public.llm_responses;
create policy "Users can log responses to own requests" on public.llm_responses
  for insert to authenticated with check (
    exists (select 1 from public.generation_requests r where r.id = request_id and r.user_id = (select auth.uid()))
  );
drop policy if exists "Superadmins can view llm responses" on public.llm_responses;
create policy "Superadmins can view llm responses" on public.llm_responses
  for select to authenticated using ((select public.is_superadmin()));

-- 3. Seed data (only fills empty tables) -------------------------------------

insert into public.llm_providers (name, base_url, api_key_env, notes)
values ('Google Gemini', 'https://generativelanguage.googleapis.com/v1beta/models', 'GEMINI_API_KEY', 'Free tier. Overloaded sometimes, hence the fallback models.')
on conflict (name) do nothing;

insert into public.llm_models (provider_id, name, api_model_id, temperature, priority)
select p.id, m.name, m.api_model_id, 1, m.priority
from public.llm_providers p
cross join (values
  ('Gemini Flash-Lite (latest)', 'gemini-flash-lite-latest', 1),
  ('Gemini Flash (latest)', 'gemini-flash-latest', 2),
  ('Gemini 2.5 Flash', 'gemini-2.5-flash', 3)
) as m(name, api_model_id, priority)
where p.name = 'Google Gemini'
on conflict (api_model_id) do nothing;

insert into public.llm_prompt_chains (name, description)
values
  ('Nouvelle Vague', 'One shot: look at the photo and write the subtitles. The original Caption the City prompt.'),
  ('Scene Report', 'Two steps: first describe the photo plainly, then write subtitles from that description. Tests whether a literal first pass makes jokes more specific.')
on conflict (name) do nothing;

insert into public.llm_prompt_chain_steps (chain_id, step_order, title, include_image, output_json, prompt_template)
select c.id, s.step_order, s.title, s.include_image, s.output_json, s.prompt_template
from public.llm_prompt_chains c
join (values
  ('Nouvelle Vague', 1, 'Write subtitles', true, true,
$t$You write captions for "Caption the City", an app where college students in New York City post photos from their weekends and vote on the funniest captions.

Write {{count}} captions for the attached photo. Each one should read like an English subtitle from a 1960s French New Wave film (deadpan, dramatic, a little existential), filtered through someone who is extremely online.

Mix the angles: one moody Godard-style line, one chronically-online joke, one specific observation about New York, and one wildcard.

Rules: each caption is a single line under 120 characters. Describe what is actually in the photo. Never insult anyone's appearance, identity, or body, and never guess who a real person is. No hashtags, no emoji.

{{neighborhood}}
{{note}}
{{terms}}
{{examples}}
{{avoid}}$t$),
  ('Scene Report', 1, 'Describe the scene', true, false,
$t$Describe this photo in 3 to 5 plain, concrete sentences: the setting, the objects, any signage or text, the light, and what people (if any) are doing. Do not guess who anyone is or comment on anyone's appearance. No jokes yet.
{{neighborhood}}
{{note}}$t$),
  ('Scene Report', 2, 'Write subtitles from the description', false, true,
$t$You write captions for "Caption the City", where New York college students vote on the funniest captions for each other's photos.

Here is a description of the photo:
{{previous}}

Write {{count}} captions. Each should read like an English subtitle from a 1960s French New Wave film (deadpan, dramatic, a little existential), filtered through someone who is extremely online. Use specific details from the description. Single line each, under 120 characters, no hashtags, no emoji, never insult anyone.

{{terms}}
{{examples}}
{{avoid}}$t$)
) as s(chain_name, step_order, title, include_image, output_json, prompt_template) on s.chain_name = c.name
on conflict (chain_id, step_order) do nothing;

-- Mix rows exist via the trigger for new chains; make sure seeded ones do too,
-- then start at 70/30 if nobody has set weights yet.
insert into public.prompt_chain_mix (chain_id) select id from public.llm_prompt_chains on conflict do nothing;
update public.prompt_chain_mix m
set weight = case c.name when 'Nouvelle Vague' then 70 when 'Scene Report' then 30 else m.weight end, updated_at = now()
from public.llm_prompt_chains c
where c.id = m.chain_id and not exists (select 1 from public.prompt_chain_mix where weight > 0);

insert into public.terms (term, definition, example) values
  ('Bodega cat', 'The cat who lives in the corner store and runs it.', 'He has seen more of my 2am decisions than my mother.'),
  ('Showtime', 'Subway acrobats announcing a performance between stops.', 'SHOWTIME. I close my eyes and accept my fate.'),
  ('Jump cut', 'Godard''s abrupt edit that skips time within a scene.', 'We were at brunch. Then, without transition, Bushwick.'),
  ('Train traffic ahead', 'The MTA announcement that means you are going to be late.', 'We are delayed because of train traffic ahead. So is my life.'),
  ('Main character energy', 'Acting like the film is about you.', 'The pigeon walked past me like it had a speaking role.')
on conflict (term) do nothing;

insert into public.generation_examples (scene, caption, notes)
select * from (values
  ('A rainy subway platform, one person waiting under a flickering light', 'I waited for the C train. The C train waited for nothing.', 'Deadpan Godard rhythm'),
  ('A dollar-slice pizza on a paper plate on a park bench', 'One dollar. One slice. One brief, perfect afternoon in which I believed in the city again.', 'Earnest-to-absurd escalation'),
  ('A crowded rooftop party at sunset in Williamsburg', 'Everyone here has a podcast. The sun sets anyway, unbothered.', 'Online + New York specific')
) as e(scene, caption, notes)
where not exists (select 1 from public.generation_examples);

-- 4. Backfill: one logged request per existing photo, so history isn't empty.
insert into public.generation_requests (id, user_id, photo_id, chain_name, source, requested_count, status, caption_count, created_at, finished_at)
select gen_random_uuid(), p.user_id, p.id, 'Nouvelle Vague (before logging)', 'backfill', count(c.id), 'succeeded', count(c.id), p.created_at, p.created_at
from public.photos p
join public.captions c on c.photo_id = p.id
where not exists (select 1 from public.generation_requests r where r.photo_id = p.id)
group by p.id, p.user_id, p.created_at;

insert into public.llm_responses (request_id, step_order, model, prompt, response_text, ok, created_at)
select r.id, 1, c.model, c.prompt, json_agg(c.body order by c.created_at)::text, true, min(c.created_at)
from public.generation_requests r
join public.captions c on c.photo_id = r.photo_id
where r.source = 'backfill'
  and not exists (select 1 from public.llm_responses x where x.request_id = r.id)
group by r.id, c.model, c.prompt;
