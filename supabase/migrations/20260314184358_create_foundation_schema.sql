-- ============================================================
-- 1. TABLES
-- ============================================================

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  company_name text,
  created_at timestamptz default now() not null
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  slug text unique not null,
  company_name text not null,
  company_url text,
  system_prompt text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  file_name text not null,
  file_url text not null,
  file_type text not null,
  extracted_text text,
  created_at timestamptz default now() not null
);

create table public.slides (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  slide_index integer not null,
  title text not null,
  description text,
  image_url text not null,
  created_at timestamptz default now() not null
);

create table public.pitch_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  slug text unique not null,
  prospect_name text not null,
  prospect_url text,
  prospect_context text,
  prospect_logo text,
  headline text not null,
  status text default 'active' not null,
  created_at timestamptz default now() not null
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  pitch_link_id uuid not null references public.pitch_links(id) on delete cascade,
  messages jsonb default '[]'::jsonb not null,
  slides_viewed jsonb default '[]'::jsonb,
  duration_seconds integer default 0,
  qualification text,
  summary text,
  feedback text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  pitch_link_id uuid references public.pitch_links(id) on delete cascade,
  type text not null,
  read boolean default false not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

create index idx_projects_user_id on public.projects(user_id);
create index idx_projects_slug on public.projects(slug);
create index idx_documents_project_id on public.documents(project_id);
create index idx_slides_project_id on public.slides(project_id);
create index idx_pitch_links_project_id on public.pitch_links(project_id);
create index idx_pitch_links_slug on public.pitch_links(slug);
create index idx_conversations_pitch_link_id on public.conversations(pitch_link_id);
create index idx_notifications_user_id on public.notifications(user_id);

-- ============================================================
-- 3. UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at_projects
  before update on public.projects
  for each row execute function public.handle_updated_at();

create trigger set_updated_at_conversations
  before update on public.conversations
  for each row execute function public.handle_updated_at();

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.documents enable row level security;
alter table public.slides enable row level security;
alter table public.pitch_links enable row level security;
alter table public.conversations enable row level security;
alter table public.notifications enable row level security;

-- USERS
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

-- PROJECTS
create policy "Users can CRUD own projects"
  on public.projects for all
  using (auth.uid() = user_id);

-- DOCUMENTS
create policy "Users can CRUD own documents"
  on public.documents for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

-- SLIDES
create policy "Users can CRUD own slides"
  on public.slides for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

create policy "Public can view slides via pitch link"
  on public.slides for select
  using (
    project_id in (
      select project_id from public.pitch_links where status = 'active'
    )
  );

-- PITCH LINKS
create policy "Users can CRUD own pitch links"
  on public.pitch_links for all
  using (
    project_id in (
      select id from public.projects where user_id = auth.uid()
    )
  );

create policy "Public can view active pitch links"
  on public.pitch_links for select
  using (status = 'active');

-- CONVERSATIONS
create policy "Users can view own conversations"
  on public.conversations for select
  using (
    pitch_link_id in (
      select pl.id from public.pitch_links pl
      join public.projects p on pl.project_id = p.id
      where p.user_id = auth.uid()
    )
  );

create policy "Anyone can create conversations"
  on public.conversations for insert
  with check (true);

create policy "Anyone can update conversations"
  on public.conversations for update
  using (true);

-- NOTIFICATIONS
create policy "Users can CRUD own notifications"
  on public.notifications for all
  using (auth.uid() = user_id);

-- ============================================================
-- 5. AUTO-CREATE USER ROW ON SIGNUP
-- ============================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 6. STORAGE BUCKETS
-- ============================================================

insert into storage.buckets (id, name, public)
values ('slides', 'slides', true);

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false);

-- Storage: slides (public read, authenticated upload/delete)
create policy "Public read access for slides"
  on storage.objects for select
  using (bucket_id = 'slides');

create policy "Authenticated users can upload slides"
  on storage.objects for insert
  with check (bucket_id = 'slides' and auth.role() = 'authenticated');

create policy "Authenticated users can delete own slides"
  on storage.objects for delete
  using (bucket_id = 'slides' and auth.uid()::text = (storage.foldername(name))[1]);

-- Storage: documents (private, owner only)
create policy "Authenticated users can upload documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.role() = 'authenticated');

create policy "Users can read own documents"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own documents"
  on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
