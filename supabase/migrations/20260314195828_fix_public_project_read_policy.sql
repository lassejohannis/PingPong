-- Fix infinite recursion: projects policy queries pitch_links, which queries projects.
-- Solution: use a SECURITY DEFINER function to bypass RLS when checking pitch_links.

create or replace function public.project_has_active_pitch_link(project_uuid uuid)
returns boolean as $$
  select exists (
    select 1 from public.pitch_links
    where project_id = project_uuid and status = 'active'
  );
$$ language sql security definer stable;

-- Drop the recursive policy
drop policy if exists "Public can view projects via active pitch link" on public.projects;

-- Re-create with the safe function
create policy "Public can view projects via active pitch link"
  on public.projects for select
  using (public.project_has_active_pitch_link(id));
