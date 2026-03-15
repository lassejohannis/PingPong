-- Allow public read of project data when accessed via an active pitch link.
-- Needed so the prospect-facing pitch page can load system_prompt and company_name.

create policy "Public can view projects via active pitch link"
  on public.projects for select
  using (
    id in (
      select project_id from public.pitch_links where status = 'active'
    )
  );
