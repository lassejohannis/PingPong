-- Fix: Authenticated users could see other users' projects if those projects
-- had active pitch links. The public read policy should only apply to
-- unauthenticated prospects visiting pitch pages.

drop policy if exists "Public can view projects via active pitch link" on public.projects;

create policy "Public can view projects via active pitch link"
  on public.projects for select
  using (auth.uid() IS NULL AND public.project_has_active_pitch_link(id));
