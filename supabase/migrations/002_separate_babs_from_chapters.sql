-- Separate Bab and Chapter data for Novelara
create table if not exists public.babs (
  id uuid primary key default gen_random_uuid(),
  novel_id uuid not null references public.novels(id) on delete cascade,
  bab_number integer not null check (bab_number > 0),
  title text not null,
  content text not null default '',
  status public.publish_status not null default 'draft',
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (novel_id, bab_number)
);
create index if not exists babs_novel_idx on public.babs(novel_id, bab_number);
alter table public.babs enable row level security;
drop policy if exists "published babs public read" on public.babs;
create policy "published babs public read" on public.babs for select to anon, authenticated using (
  public.is_admin() or (
    status='published' and exists (
      select 1 from public.novels n
      where n.id=novel_id and n.status='published'
    )
  )
);
drop policy if exists "admin babs all" on public.babs;
create policy "admin babs all" on public.babs for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Preserve existing numbered content as Bab data during the one-time separation.
insert into public.babs (novel_id,bab_number,title,content,status,scheduled_at,published_at,created_at,updated_at)
select novel_id,chapter_number,title,content,status,scheduled_at,published_at,created_at,updated_at
from public.chapters
on conflict (novel_id,bab_number) do nothing;