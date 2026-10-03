-- Novelara Supabase foundation
-- Run this migration in Supabase SQL Editor / migrations.
-- Admin access is controlled by profiles.role = 'admin'.
create extension if not exists pgcrypto;

create type public.user_role as enum ('reader','admin');
create type public.publish_status as enum ('draft','published','scheduled');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.user_role not null default 'reader',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.genres (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.novels (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  author text not null default 'Novelara',
  cover_url text,
  synopsis text,
  status public.publish_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.novel_genres (
  novel_id uuid not null references public.novels(id) on delete cascade,
  genre_id uuid not null references public.genres(id) on delete cascade,
  primary key (novel_id, genre_id)
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  novel_id uuid not null references public.novels(id) on delete cascade,
  chapter_number integer not null check (chapter_number > 0),
  title text not null,
  content text not null default '',
  status public.publish_status not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (novel_id, chapter_number)
);

create table if not exists public.bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  novel_id uuid not null references public.novels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, novel_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  novel_id uuid not null references public.novels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ratings (
  novel_id uuid not null references public.novels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (novel_id, user_id)
);

create table if not exists public.ad_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position text not null check (position in ('header','between_chapters','footer')),
  enabled boolean not null default false,
  ad_code text,
  updated_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  id boolean primary key default true check (id = true),
  site_name text not null default 'Novelara',
  tagline text not null default 'Cerita yang Menemukan Hati',
  logo_url text,
  seo_description text,
  about text,
  privacy_policy text,
  terms text,
  contact text,
  updated_at timestamptz not null default now()
);

create index if not exists novels_status_idx on public.novels(status);
create index if not exists chapters_novel_idx on public.chapters(novel_id, chapter_number);
create index if not exists comments_novel_idx on public.comments(novel_id, created_at desc);

-- Helper used only by RLS policies. SECURITY DEFINER prevents policy recursion.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- New Auth users get a reader profile by default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.genres enable row level security;
alter table public.novels enable row level security;
alter table public.novel_genres enable row level security;
alter table public.chapters enable row level security;
alter table public.bookmarks enable row level security;
alter table public.comments enable row level security;
alter table public.ratings enable row level security;
alter table public.ad_settings enable row level security;
alter table public.site_settings enable row level security;

-- Profiles
drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Public reader data
drop policy if exists "published novels public read" on public.novels;
create policy "published novels public read" on public.novels for select to anon, authenticated using (status = 'published' or public.is_admin());
drop policy if exists "admin novels all" on public.novels;
create policy "admin novels all" on public.novels for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "genres public read" on public.genres;
create policy "genres public read" on public.genres for select to anon, authenticated using (true);
drop policy if exists "admin genres write" on public.genres;
create policy "admin genres write" on public.genres for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "novel genres public read" on public.novel_genres;
create policy "novel genres public read" on public.novel_genres for select to anon, authenticated using (exists (select 1 from public.novels n where n.id = novel_id and n.status = 'published') or public.is_admin());
drop policy if exists "admin novel genres write" on public.novel_genres;
create policy "admin novel genres write" on public.novel_genres for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "published chapters public read" on public.chapters;
create policy "published chapters public read" on public.chapters for select to anon, authenticated using (
  public.is_admin() or (
    status = 'published' and exists (
      select 1 from public.novels n where n.id = novel_id and n.status = 'published'
    )
  )
);
drop policy if exists "admin chapters all" on public.chapters;
create policy "admin chapters all" on public.chapters for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- User-owned features
drop policy if exists "own bookmarks select" on public.bookmarks;
create policy "own bookmarks select" on public.bookmarks for select to authenticated using (user_id = auth.uid());
drop policy if exists "own bookmarks insert" on public.bookmarks;
create policy "own bookmarks insert" on public.bookmarks for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own bookmarks delete" on public.bookmarks;
create policy "own bookmarks delete" on public.bookmarks for delete to authenticated using (user_id = auth.uid());

drop policy if exists "published comments read" on public.comments;
create policy "published comments read" on public.comments for select to anon, authenticated using (
  exists (select 1 from public.novels n where n.id = novel_id and n.status = 'published') or public.is_admin()
);
drop policy if exists "own comments insert" on public.comments;
create policy "own comments insert" on public.comments for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own comments update" on public.comments;
create policy "own comments update" on public.comments for update to authenticated using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists "own comments delete" on public.comments;
create policy "own comments delete" on public.comments for delete to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "ratings public read" on public.ratings;
create policy "ratings public read" on public.ratings for select to anon, authenticated using (true);
drop policy if exists "own ratings insert" on public.ratings;
create policy "own ratings insert" on public.ratings for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "own ratings update" on public.ratings;
create policy "own ratings update" on public.ratings for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Admin-only configuration
drop policy if exists "admin ad settings" on public.ad_settings;
create policy "admin ad settings" on public.ad_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public enabled ads" on public.ad_settings;
create policy "public enabled ads" on public.ad_settings for select to anon, authenticated using (enabled = true);

drop policy if exists "public site settings read" on public.site_settings;
create policy "public site settings read" on public.site_settings for select to anon, authenticated using (true);
drop policy if exists "admin site settings write" on public.site_settings;
create policy "admin site settings write" on public.site_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into public.site_settings (id) values (true) on conflict (id) do nothing;

insert into public.ad_settings (name, position, enabled)
values
 ('Header', 'header', false),
 ('Di antara chapter', 'between_chapters', false),
 ('Footer', 'footer', false)
on conflict (name) do nothing;
